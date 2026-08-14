/**
 * @project LLMira
 * @file src/lib/mcp/webAdapter.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function Web/Android WebView 的 Streamable HTTP MCP 客户端
 * @description 使用官方 MCP v2 客户端自动协商 modern 与 legacy era；不提供废弃的独立 SSE 配置。
 */
import { Client, StreamableHTTPClientTransport, type CallToolResult } from "@modelcontextprotocol/client";
import { createMcpToolWireName } from "@/lib/mcp/wireName";
import type { McpRuntimeAdapter, McpCallResult, McpCallOptions } from "@/lib/mcp/runtime";
import type { McpConnectionInput, McpRuntimeLogEntry, McpRuntimeSnapshot, McpToolDescriptor } from "@/lib/mcp/types";

type Session = {
  fingerprint: string;
  client: Client;
  tools: McpToolDescriptor[];
};

const sessions = new Map<string, Session>();
const connecting = new Map<string, Promise<McpRuntimeSnapshot>>();
const callControllers = new Map<string, AbortController>();
const logs: McpRuntimeLogEntry[] = [];

function fingerprint(input: McpConnectionInput) {
  const { config } = input;
  return JSON.stringify({ id: config.id, updatedAt: config.updatedAt, url: config.url, authMode: config.authMode, headers: config.headers });
}

function log(serverId: string, level: McpRuntimeLogEntry["level"], message: string) {
  logs.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, serverId, level, message, createdAt: Date.now() });
  if (logs.length > 200) logs.length = 200;
}

function summarize(result: CallToolResult): string {
  if (result.structuredContent !== undefined) return JSON.stringify(result.structuredContent).slice(0, 2_000);
  const text = result.content
    .filter((item): item is Extract<(typeof result.content)[number], { type: "text" }> => item.type === "text")
    .map((item) => item.text)
    .join("\n");
  return (text || JSON.stringify(result.content)).slice(0, 2_000);
}

async function disconnectSession(serverId: string) {
  const session = sessions.get(serverId);
  sessions.delete(serverId);
  if (session) await session.client.close().catch(() => undefined);
}

async function ensureConnected(input: McpConnectionInput): Promise<McpRuntimeSnapshot> {
  const desiredFingerprint = fingerprint(input);
  const existing = sessions.get(input.config.id);
  if (existing?.fingerprint === desiredFingerprint) {
    return { serverId: input.config.id, status: "connected", fingerprint: desiredFingerprint, tools: existing.tools };
  }
  const pending = connecting.get(input.config.id);
  if (pending) return pending;

  const connection = (async () => {
    if (input.config.transport !== "streamable_http") {
      throw new Error("Web 与 Android 仅支持远程 HTTP MCP；STDIO 仅可在 Windows 桌面端使用。");
    }
    if (!input.config.url.trim()) throw new Error("请填写 MCP 服务 URL。");
    await disconnectSession(input.config.id);
    const headers = new Headers();
    for (const entry of input.config.headers) {
      const value = entry.sensitive ? input.sensitiveHeaders?.[entry.name] : entry.value;
      if (entry.name && value) headers.set(entry.name, value);
    }
    if (input.config.authMode === "bearer" && input.bearerToken) headers.set("Authorization", `Bearer ${input.bearerToken}`);
    const client = new Client(
      { name: "LLMira", version: "0.2.0" },
      { versionNegotiation: { mode: "auto" } },
    );
    const transport = new StreamableHTTPClientTransport(new URL(input.config.url), {
      requestInit: { headers },
      reconnectionOptions: { maxReconnectionDelay: 5_000, initialReconnectionDelay: 500, reconnectionDelayGrowFactor: 1.5, maxRetries: 0 },
    });
    await client.connect(transport);
    const listed = await client.listTools();
    const tools = listed.tools.map((tool): McpToolDescriptor => ({
      serverId: input.config.id,
      serverName: input.config.name,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as Record<string, unknown>,
      wireName: createMcpToolWireName(input.config.id, tool.name),
      enabled: !input.config.disabledTools.includes(tool.name),
    }));
    sessions.set(input.config.id, { fingerprint: desiredFingerprint, client, tools });
    log(input.config.id, "info", `已连接，发现 ${tools.length} 个工具。`);
    return { serverId: input.config.id, status: "connected" as const, fingerprint: desiredFingerprint, tools };
  })()
    .catch((error) => {
      const message = error instanceof Error ? error.message : "MCP 连接失败";
      log(input.config.id, "error", message);
      return { serverId: input.config.id, status: "error" as const, fingerprint: desiredFingerprint, tools: [], error: message };
    })
    .finally(() => connecting.delete(input.config.id));
  connecting.set(input.config.id, connection);
  return connection;
}

export const webMcpRuntime: McpRuntimeAdapter = {
  connect: ensureConnected,
  disconnect: disconnectSession,
  testConnection: async (input) => {
    await disconnectSession(input.config.id);
    return ensureConnected(input);
  },
  listTools: async (input) => (await ensureConnected(input)).tools,
  callTool: async (input, toolName, args, options: McpCallOptions): Promise<McpCallResult> => {
    const snapshot = await ensureConnected(input);
    if (snapshot.status !== "connected") throw new Error(snapshot.error ?? "MCP 未连接");
    const session = sessions.get(input.config.id);
    if (!session) throw new Error("MCP 会话不可用");
    const controller = new AbortController();
    callControllers.set(options.callId, controller);
    const forwardAbort = () => controller.abort();
    options.signal?.addEventListener("abort", forwardAbort, { once: true });
    const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const result = await session.client.callTool(
        { name: toolName, arguments: args },
        { signal: controller.signal } as Parameters<Client["callTool"]>[1],
      );
      return { content: result, isError: Boolean(result.isError), summary: summarize(result) };
    } finally {
      window.clearTimeout(timeout);
      options.signal?.removeEventListener("abort", forwardAbort);
      callControllers.delete(options.callId);
    }
  },
  cancelCall: async (callId) => callControllers.get(callId)?.abort(),
  readLogs: async (serverId) => logs.filter((entry) => !serverId || entry.serverId === serverId),
};
