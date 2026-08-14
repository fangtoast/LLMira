/**
 * @project LLMira
 * @file src/lib/mcp/chatTools.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 将已启用 MCP 工具转换为 OpenAI-compatible 工具目录
 * @description 只在请求时读取秘密值；秘密值不会进入工具定义或日志。
 */
import type { ChatToolDefinition } from "@/lib/api/types";
import { getMcpRuntimeAdapter } from "@/lib/mcp/runtime";
import { readMcpSecrets } from "@/lib/mcp/secrets";
import type { McpConnectionInput, McpServerConfig, McpToolDescriptor } from "@/lib/mcp/types";

export interface McpChatTool {
  descriptor: McpToolDescriptor;
  connection: McpConnectionInput;
  definition: ChatToolDefinition;
}

export async function collectMcpChatTools(servers: McpServerConfig[]): Promise<McpChatTool[]> {
  const adapter = await getMcpRuntimeAdapter();
  const enabledServers = servers.filter((server) => server.enabled);
  const groups = await Promise.all(enabledServers.map(async (config) => {
    const secrets = await readMcpSecrets(config.id);
    const connection: McpConnectionInput = { config, ...secrets };
    const tools = await adapter.listTools(connection);
    return tools
      .filter((tool) => tool.enabled && !config.disabledTools.includes(tool.name))
      .map((descriptor): McpChatTool => ({
        descriptor,
        connection,
        definition: {
          type: "function",
          function: {
            name: descriptor.wireName,
            description: `${descriptor.serverName} / ${descriptor.name}${descriptor.description ? ` — ${descriptor.description}` : ""}`,
            parameters: descriptor.inputSchema,
          },
        },
      }));
  }));
  return groups.flat();
}
