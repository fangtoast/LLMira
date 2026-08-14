/**
 * @project LLMira
 * @file scripts/test-mcp-stdio.mjs
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description Rust MCP runtime 的受控 STDIO 测试服务器夹具。
 */
import readline from "node:readline";

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
function send(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

lines.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.id === undefined) return;
  if (message.method === "initialize") {
    send({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: message.params?.protocolVersion ?? "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "llmira-test", version: "1.0.0" } } });
    return;
  }
  if (message.method === "tools/list") {
    send({ jsonrpc: "2.0", id: message.id, result: { tools: [{ name: "echo", description: "Echo text", inputSchema: { type: "object", properties: { text: { type: "string" } } } }] } });
    return;
  }
  if (message.method === "tools/call") {
    const text = message.params?.arguments?.text ?? "";
    send({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text }], isError: false } });
    return;
  }
  send({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } });
});
