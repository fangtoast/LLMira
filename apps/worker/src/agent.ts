/**
 * @project LLMira
 * @file apps/worker/src/agent.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 按个人 BYOK 优先、团队密钥回退解析 Provider
 *   - 执行已通过风险门禁的 Agent 运行并持久化事件
 * @description Worker 只在执行边界解密密钥，错误事件不包含请求正文或密钥。
 */
import type { Sql } from "postgres";
import { spawn } from "node:child_process";
import { v7 as uuidv7 } from "uuid";
import { decryptSecret, deriveEncryptionKey } from "@llmira/security";

interface RunRow {
  id: string;
  workspace_id: string;
  requested_by: string;
  prompt: string;
  model: string | null;
  status: string;
  tools: string[];
}

interface ProviderRow {
  base_url: string;
  encrypted_secret: string;
  model_preset: string[];
}

interface AgentConfig {
  masterKeyMaterial: string;
  embeddingBaseUrl?: string;
  embeddingApiKey?: string;
  embeddingModel: string;
  containerRuntime?: "docker" | "podman";
}

interface KnowledgeHit {
  id: string;
  document_id: string;
  document_name: string;
  page: number | null;
  section: string | null;
  content: string;
  score: number;
}

interface McpRow {
  id: string;
  name: string;
  transport: "streamable_http" | "stdio_container";
  endpoint: string | null;
  container_image: string | null;
  allowed_domains: string[];
  timeout_ms: number;
  output_limit_bytes: number;
}

async function appendEvent(sql: Sql, runId: string, type: string, payload: Record<string, unknown>): Promise<void> {
  await sql`
    insert into run_events (id, run_id, sequence, event_type, payload)
    values (${uuidv7()}, ${runId}, (select coalesce(max(sequence), 0) + 1 from run_events where run_id = ${runId}), ${type}, ${JSON.stringify(payload)}::jsonb)
  `;
}

async function embedQuery(prompt: string, config: AgentConfig, signal: AbortSignal): Promise<number[] | undefined> {
  if (!config.embeddingBaseUrl || !config.embeddingApiKey) return undefined;
  const response = await fetch(`${config.embeddingBaseUrl.replace(/\/$/, "")}/v1/embeddings`, {
    method: "POST",
    signal,
    headers: { authorization: `Bearer ${config.embeddingApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: config.embeddingModel, input: prompt }),
  });
  if (!response.ok) return undefined;
  const body = await response.json() as { data?: Array<{ embedding?: number[] }> };
  return body.data?.[0]?.embedding;
}

async function searchKnowledge(sql: Sql, run: RunRow, config: AgentConfig, signal: AbortSignal): Promise<KnowledgeHit[]> {
  const embedding = await embedQuery(run.prompt, config, signal);
  if (embedding) {
    const vector = `[${embedding.join(",")}]`;
    return sql<KnowledgeHit[]>`
      with semantic as (
        select kc.id, row_number() over (order by kc.embedding <=> ${vector}::vector) as rank
        from knowledge_chunks kc
        where kc.workspace_id = ${run.workspace_id} and kc.embedding is not null
        order by kc.embedding <=> ${vector}::vector
        limit 20
      ), lexical as (
        select kc.id, row_number() over (order by ts_rank_cd(kc.search_vector, websearch_to_tsquery('simple', ${run.prompt})) desc) as rank
        from knowledge_chunks kc
        where kc.workspace_id = ${run.workspace_id}
          and kc.search_vector @@ websearch_to_tsquery('simple', ${run.prompt})
        order by ts_rank_cd(kc.search_vector, websearch_to_tsquery('simple', ${run.prompt})) desc
        limit 20
      ), fused as (
        select id, sum(score)::float as score from (
          select id, 0.7 / (60 + rank) as score from semantic
          union all
          select id, 0.3 / (60 + rank) as score from lexical
        ) candidates group by id
      )
      select kc.id, kc.document_id, kd.name as document_name, kc.page, kc.section, kc.content, fused.score
      from fused join knowledge_chunks kc on kc.id = fused.id
      join knowledge_documents kd on kd.id = kc.document_id
      order by fused.score desc limit 8
    `;
  }
  return sql<KnowledgeHit[]>`
    select kc.id, kc.document_id, kd.name as document_name, kc.page, kc.section, kc.content,
           ts_rank_cd(kc.search_vector, websearch_to_tsquery('simple', ${run.prompt}))::float as score
    from knowledge_chunks kc join knowledge_documents kd on kd.id = kc.document_id
    where kc.workspace_id = ${run.workspace_id}
      and kc.search_vector @@ websearch_to_tsquery('simple', ${run.prompt})
    order by score desc limit 8
  `;
}

function parseMcpPayload(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const values = trimmed.split(/\r?\n/).filter((line) => line.startsWith("data:"));
  return values.length ? JSON.parse(values.at(-1)!.slice(5).trim()) : trimmed;
}

async function callHttpMcp(server: McpRow, toolName: string, run: RunRow): Promise<unknown> {
  if (!server.endpoint) throw new Error("MCP_ENDPOINT_MISSING");
  const endpoint = new URL(server.endpoint);
  if (!server.allowed_domains.includes(endpoint.hostname)) throw new Error("MCP_DOMAIN_NOT_ALLOWED");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), server.timeout_ms);
  let sessionId: string | null = null;
  const post = async (payload: Record<string, unknown>) => {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
        ...(sessionId ? { "mcp-session-id": sessionId } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`MCP_HTTP_FAILED:${response.status}`);
    sessionId = response.headers.get("mcp-session-id") ?? sessionId;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > server.output_limit_bytes) throw new Error("MCP_OUTPUT_TOO_LARGE");
    return parseMcpPayload(new TextDecoder().decode(bytes));
  };
  try {
    await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "LLMira", version: "0.1.0" } } });
    await post({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    return await post({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: toolName, arguments: { input: run.prompt, workspaceId: run.workspace_id } } });
  } finally {
    clearTimeout(timeout);
  }
}

async function callContainerMcp(server: McpRow, toolName: string, run: RunRow, runtime?: "docker" | "podman"): Promise<unknown> {
  if (!runtime) throw new Error("MCP_CONTAINER_RUNTIME_DISABLED");
  if (!server.container_image || !/@sha256:[a-f0-9]{64}$/i.test(server.container_image)) throw new Error("MCP_CONTAINER_IMAGE_UNPINNED");
  return new Promise((resolve, reject) => {
    const child = spawn(runtime, ["run", "--rm", "--network", "none", "--read-only", "--memory", "256m", "--cpus", "0.5", "--pids-limit", "128", "-i", server.container_image!], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let output = "";
    let errorOutput = "";
    let settled = false;
    const fail = (error: Error) => { if (settled) return; settled = true; clearTimeout(timeout); child.kill(); reject(error); };
    const timeout = setTimeout(() => fail(new Error("MCP_TIMEOUT")), server.timeout_ms);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
      if (Buffer.byteLength(output) > server.output_limit_bytes) return fail(new Error("MCP_OUTPUT_TOO_LARGE"));
      for (const line of output.split(/\r?\n/).slice(0, -1)) {
        try {
          const message = JSON.parse(line) as { id?: number };
          if (message.id === 2 && !settled) { settled = true; clearTimeout(timeout); child.kill(); resolve(message); }
        } catch { /* 等待完整 JSON 行。 */ }
      }
    });
    child.stderr.on("data", (chunk: string) => { errorOutput += chunk; if (errorOutput.length > 2_000) errorOutput = errorOutput.slice(-2_000); });
    child.on("error", (error) => fail(error));
    child.on("close", (code) => {
      if (settled) return;
      clearTimeout(timeout);
      if (Buffer.byteLength(output) > server.output_limit_bytes) return fail(new Error("MCP_OUTPUT_TOO_LARGE"));
      if (code !== 0) return fail(new Error(`MCP_CONTAINER_FAILED:${code}:${errorOutput.slice(-200)}`));
      const messages = output.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { id?: number });
      settled = true;
      resolve(messages.find((message) => message.id === 2));
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "LLMira", version: "0.1.0" } } })}\n`);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })}\n`);
    child.stdin.end(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: toolName, arguments: { input: run.prompt, workspaceId: run.workspace_id } } })}\n`);
  });
}

async function executeMcpTools(sql: Sql, run: RunRow, config: AgentConfig): Promise<string[]> {
  const outputs: string[] = [];
  for (const declaration of run.tools ?? []) {
    const match = /^mcp:([0-9a-f-]{36}):(.+)$/i.exec(declaration);
    if (!match) continue;
    const [server] = await sql<McpRow[]>`select * from mcp_servers where id = ${match[1]!} and workspace_id = ${run.workspace_id} and enabled = true`;
    if (!server) throw new Error("MCP_SERVER_UNAVAILABLE");
    await appendEvent(sql, run.id, "tool.started", { toolName: declaration });
    const result = server.transport === "streamable_http"
      ? await callHttpMcp(server, match[2]!, run)
      : await callContainerMcp(server, match[2]!, run, config.containerRuntime);
    const serialized = JSON.stringify(result).slice(0, server.output_limit_bytes);
    outputs.push(`[MCP ${server.name} · ${match[2]}]\n${serialized}`);
    await appendEvent(sql, run.id, "tool.completed", { toolName: declaration, output: serialized });
  }
  return outputs;
}

/** 执行一个 Agent 运行。 */
export async function executeAgentRun(sql: Sql, config: AgentConfig, runId: string): Promise<void> {
  const [run] = await sql<RunRow[]>`select id, workspace_id, requested_by, prompt, model, status, tools from agent_runs where id = ${runId}`;
  if (!run) throw new Error("RUN_NOT_FOUND");
  if (run.status !== "running" && run.status !== "queued") return;
  const [provider] = await sql<ProviderRow[]>`
    select p.base_url, p.encrypted_secret, p.model_preset
    from provider_profiles p
    join workspaces w on w.organization_id = p.organization_id and w.id = ${run.workspace_id}
    where p.enabled = true and p.encrypted_secret is not null
      and (p.owner_user_id = ${run.requested_by} or (p.scope = 'team' and p.owner_user_id is null))
    order by (p.owner_user_id = ${run.requested_by}) desc, p.updated_at desc
    limit 1
  `;
  if (!provider) throw new Error("PROVIDER_NOT_CONFIGURED");
  await sql`update agent_runs set status = 'running', updated_at = now() where id = ${run.id}`;
  await appendEvent(sql, run.id, "run.started", { model: run.model ?? provider.model_preset[0] ?? "router:auto" });
  const apiKey = decryptSecret(provider.encrypted_secret, deriveEncryptionKey(config.masterKeyMaterial));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  const cancellationPoll = setInterval(() => {
    void sql<{ status: string }[]>`select status from agent_runs where id = ${run.id}`
      .then(([current]) => {
        if (current?.status === "cancelled") controller.abort();
      })
      .catch(() => controller.abort());
  }, 1_000);
  try {
    await appendEvent(sql, run.id, "tool.started", { toolName: "knowledge.search", risk: "read" });
    const knowledge = await searchKnowledge(sql, run, config, controller.signal);
    const citations = knowledge.map((hit) => ({
      id: hit.id,
      documentId: hit.document_id,
      documentName: hit.document_name,
      chunkId: hit.id,
      page: hit.page ?? undefined,
      section: hit.section ?? undefined,
      quote: hit.content.slice(0, 320),
      score: hit.score,
    }));
    await appendEvent(sql, run.id, "tool.completed", { toolName: "knowledge.search", citations });
    const context = knowledge.length
      ? knowledge.map((hit, index) => `[来源 ${index + 1} · ${hit.document_name}]\n${hit.content}`).join("\n\n")
      : "当前工作区没有命中相关知识块。";
    const mcpOutputs = await executeMcpTools(sql, run, config);
    const response = await fetch(`${provider.base_url.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: run.model ?? provider.model_preset[0],
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: "system", content: `You are LLMira's team agent. Follow workspace permissions and never claim an unexecuted action succeeded. Cite provided workspace sources as [来源 N] when used.\n\nWorkspace context:\n${context}\n\nApproved MCP outputs:\n${mcpOutputs.join("\n\n") || "none"}` },
          { role: "user", content: run.prompt },
        ],
      }),
    });
    if (!response.ok) throw new Error(`PROVIDER_REQUEST_FAILED:${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    let usage: Record<string, number> = {};
    if (contentType.includes("text/event-stream") && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let pending = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = frame.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
          if (data && data !== "[DONE]") {
            const packet = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
              usage?: Record<string, number>;
            };
            pending += packet.choices?.[0]?.delta?.content ?? "";
            if (packet.usage) usage = packet.usage;
            if (pending.length >= 96) {
              await appendEvent(sql, run.id, "run.delta", { content: pending });
              pending = "";
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
        if (done) break;
      }
      if (pending) await appendEvent(sql, run.id, "run.delta", { content: pending });
    } else {
      const body = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: Record<string, number> };
      const content = body.choices?.[0]?.message?.content ?? "";
      if (content) await appendEvent(sql, run.id, "run.delta", { content });
      usage = body.usage ?? {};
    }
    const [latest] = await sql<{ status: string }[]>`select status from agent_runs where id = ${run.id}`;
    if (latest?.status === "cancelled") return;
    await appendEvent(sql, run.id, "run.completed", { usage });
    await sql`update agent_runs set status = 'completed', updated_at = now() where id = ${run.id}`;
  } catch (error) {
    const [latest] = await sql<{ status: string }[]>`select status from agent_runs where id = ${run.id}`;
    if (latest?.status === "cancelled") return;
    const code = error instanceof Error ? error.message.split(":")[0] : "UNKNOWN_AGENT_ERROR";
    await appendEvent(sql, run.id, "run.failed", { code });
    await sql`update agent_runs set status = 'failed', updated_at = now() where id = ${run.id}`;
    throw error;
  } finally {
    clearTimeout(timeout);
    clearInterval(cancellationPoll);
  }
}
