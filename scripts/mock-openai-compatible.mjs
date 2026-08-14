/**
 * @project LLMira
 * @file scripts/mock-openai-compatible.mjs
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 本地验收用 OpenAI-compatible 模拟服务，覆盖模型扫描、跨模型流式回答与生图。
 */
import { createServer } from "node:http";

const port = Number(process.env.LLMIRA_MOCK_PROVIDER_PORT ?? 4010);
const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z3gAAAABJRU5ErkJggg==";

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type,x-llmira-provider-id", "access-control-allow-methods": "GET,POST,OPTIONS" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

createServer(async (request, response) => {
  if (request.method === "OPTIONS") { json(response, 204, {}); return; }
  if (request.headers.authorization !== "Bearer llmira-demo-key") { json(response, 401, { error: { message: "invalid demo key" } }); return; }
  if (request.url === "/v1/models" && request.method === "GET") {
    json(response, 200, { data: [
      { id: "gpt-demo", owned_by: "mock", context_window: 128000, supports_chat: true, supports_tools: true },
      { id: "claude-demo", owned_by: "mock", context_window: 200000, supports_chat: true, supports_reasoning: true },
      { id: "gpt-image-demo", owned_by: "mock", supports_chat: false, supports_image_generation: true },
    ] }); return;
  }
  if (request.url === "/v1/chat/completions" && request.method === "POST") {
    const body = await readJson(request);
    process.stdout.write(`chat request ${JSON.stringify({ model: body.model, messageCount: Array.isArray(body.messages) ? body.messages.length : 0, reasoningEffort: body.reasoning_effort ?? null, hasWebSearch: body.web_search_options !== undefined })}\n`);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const priorAssistant = messages.slice(0, -1).filter((item) => item.role === "assistant").at(-1)?.content;
    const answer = `${body.model} 已收到 ${messages.length} 条上下文${priorAssistant ? `，并看到了先前回答“${String(priorAssistant).slice(0, 24)}”` : ""}。`;
    response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", "access-control-allow-origin": "*" });
    for (const token of answer.match(/.{1,8}/gu) ?? []) response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`);
    response.write(`data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: messages.length * 8, completion_tokens: 12, total_tokens: messages.length * 8 + 12 } })}\n\n`);
    response.end("data: [DONE]\n\n"); return;
  }
  if (request.url === "/v1/images/generations" && request.method === "POST") { await readJson(request); json(response, 200, { data: [{ b64_json: pixel }] }); return; }
  json(response, 404, { error: { message: "not found" } });
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`LLMira mock provider listening at http://127.0.0.1:${port}\n`);
});
