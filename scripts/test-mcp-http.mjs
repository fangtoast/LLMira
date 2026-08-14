/**
 * @project LLMira
 * @file scripts/test-mcp-http.mjs
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 真机验收用的本地 Streamable HTTP MCP 回显服务，不记录工具参数或结果。
 */
import { createServer } from "node:http";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { z } from "zod";

const host = process.env.LLMIRA_TEST_MCP_HOST ?? "127.0.0.1";
const port = Number(process.env.LLMIRA_TEST_MCP_PORT ?? 4120);
let toolCalls = 0;

function createFixtureServer() {
  const server = new McpServer({ name: "llmira-http-acceptance", version: "1.0.0" });
  server.registerTool(
    "echo",
    {
      title: "Android HTTP MCP echo",
      description: "Returns the supplied text so Android tool discovery and invocation can be verified.",
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ echo: z.string() }),
    },
    async ({ text }) => {
      toolCalls += 1;
      return {
        content: [{ type: "text", text }],
        structuredContent: { echo: text },
      };
    },
  );
  return server;
}

const handler = createMcpHandler(createFixtureServer, {
  legacy: "stateless",
  responseMode: "json",
  onerror: (error) => process.stderr.write(`MCP fixture error: ${error.message}\n`),
});
const handleMcpRequest = toNodeHandler(handler);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
  if (url.pathname === "/health" && request.method === "GET") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, toolCalls }));
    return;
  }
  if (url.pathname !== "/mcp") {
    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "not found" }));
    return;
  }
  await handleMcpRequest(request, response);
});

server.listen(port, host, () => {
  process.stdout.write(`LLMira HTTP MCP fixture listening at http://${host}:${port}/mcp\n`);
});

async function shutdown() {
  await handler.close();
  server.close(() => process.exit(0));
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
