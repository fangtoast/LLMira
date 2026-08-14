"use client";

/**
 * @project LLMira
 * @file src/components/settings/McpSettings.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 个人 MCP 服务器列表、配置、连接测试与工具开关
 * @description Windows 原生支持 HTTP/STDIO；Android 与 Web 仅提供 Streamable HTTP。
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Activity, Check, CircleAlert, Plus, Server, Trash2, Wrench } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getMcpRuntimeAdapter } from "@/lib/mcp/runtime";
import { deleteMcpSecrets, readMcpSecrets, saveMcpSecrets } from "@/lib/mcp/secrets";
import type { McpConnectionInput, McpNameValueEntry, McpRuntimeSnapshot, McpServerConfig } from "@/lib/mcp/types";
import { isTauriRuntime } from "@/lib/providers/runtime";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { cn } from "@/lib/utils";
import { SettingsCard, SettingsPageHeader } from "./SettingsPrimitives";

function entryId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${prefix}-${Date.now()}`;
}

function canUseStdio() {
  return isTauriRuntime() && typeof navigator !== "undefined" && !/Android/i.test(navigator.userAgent);
}

export function validateMcpServerConfig(config: McpServerConfig, stdioAllowed: boolean): string | null {
  if (!config.name.trim()) return "请填写服务器名称。";
  if (config.timeoutSeconds < 5 || config.timeoutSeconds > 600) return "调用超时必须在 5–600 秒之间。";
  const names = [...config.env, ...config.headers].map((entry) => entry.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) return "环境变量和请求头名称不能重复。";
  if (config.transport === "stdio") {
    if (!stdioAllowed) return "当前平台不支持 STDIO MCP。";
    if (!config.command.trim()) return "请填写 STDIO 启动命令。";
    return null;
  }
  try {
    const url = new URL(config.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    return "请填写有效的 HTTP 或 HTTPS MCP URL。";
  }
  return null;
}

export function McpServerList() {
  const servers = useSettingsStore((state) => state.mcpServers);
  const activeId = useSettingsStore((state) => state.activeMcpServerId);
  const setActive = useSettingsStore((state) => state.setActiveMcpServerId);
  const addServer = useSettingsStore((state) => state.addMcpServer);
  return (
    <div className="grid content-start gap-3 p-4">
      <div className="flex items-center justify-between px-1"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">我的服务器</p><Button size="icon" variant="ghost" onClick={addServer} aria-label="添加 MCP 服务器"><Plus className="size-4" /></Button></div>
      {servers.length ? servers.map((server) => (
        <button key={server.id} type="button" onClick={() => setActive(server.id)} className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition", server.id === activeId ? "border-primary/40 bg-primary/10" : "border-transparent hover:border-border hover:bg-muted/40")}>
          <span className={cn("size-2 rounded-full", server.enabled ? "bg-emerald-500" : "bg-muted-foreground/35")} />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{server.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{server.transport === "stdio" ? "STDIO · Windows" : server.url || "未配置 URL"}</span></span>
        </button>
      )) : <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center"><Server className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm font-medium">尚未配置服务器</p><Button className="mt-4" size="sm" onClick={addServer}><Plus className="mr-2 size-4" />添加服务器</Button></div>}
    </div>
  );
}

function NameValueEditor({ entries, values, onEntriesChange, onValuesChange, sensitiveByDefault = false }: { entries: McpNameValueEntry[]; values: Record<string, string>; onEntriesChange: (entries: McpNameValueEntry[]) => void; onValuesChange: (values: Record<string, string>) => void; sensitiveByDefault?: boolean }) {
  function patch(id: string, next: Partial<McpNameValueEntry>) {
    onEntriesChange(entries.map((entry) => entry.id === id ? { ...entry, ...next } : entry));
  }
  return (
    <div className="grid gap-3">
      {entries.map((entry) => (
        <div key={entry.id} className="grid gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
          <Input value={entry.name} onChange={(event) => patch(entry.id, { name: event.target.value })} placeholder="名称" aria-label="名称" />
          <Input type={entry.sensitive || sensitiveByDefault ? "password" : "text"} value={entry.sensitive || sensitiveByDefault ? (values[entry.id] ?? "") : (entry.value ?? "")} onChange={(event) => entry.sensitive || sensitiveByDefault ? onValuesChange({ ...values, [entry.id]: event.target.value }) : patch(entry.id, { value: event.target.value })} placeholder="值" aria-label="值" autoComplete="off" />
          <div className="flex items-center gap-2">
            {!sensitiveByDefault ? <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={Boolean(entry.sensitive)} onCheckedChange={(checked) => patch(entry.id, { sensitive: checked === true, value: checked ? undefined : entry.value })} />敏感</label> : null}
            <Button size="icon" variant="ghost" onClick={() => onEntriesChange(entries.filter((item) => item.id !== entry.id))} aria-label="删除"><Trash2 className="size-4" /></Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onEntriesChange([...entries, { id: entryId("entry"), name: "", sensitive: sensitiveByDefault }])}><Plus className="mr-2 size-4" />添加一项</Button>
    </div>
  );
}

export function McpSettings() {
  const store = useSettingsStore();
  const active = store.mcpServers.find((server) => server.id === store.activeMcpServerId) ?? store.mcpServers[0];
  const [draft, setDraft] = useState<McpServerConfig | null>(active ?? null);
  const [bearerToken, setBearerToken] = useState("");
  const [environmentValues, setEnvironmentValues] = useState<Record<string, string>>({});
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
  const [snapshot, setSnapshot] = useState<McpRuntimeSnapshot>();
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const stdioAllowed = mounted && canUseStdio();

  useEffect(() => {
    if (!active) return;
    void readMcpSecrets(active.id).then((secrets) => {
      setBearerToken(secrets.bearerToken ?? "");
      setEnvironmentValues(Object.fromEntries(active.env.map((entry) => [entry.id, secrets.environment?.[entry.name] ?? ""])));
      setHeaderValues(Object.fromEntries(active.headers.filter((entry) => entry.sensitive).map((entry) => [entry.id, secrets.sensitiveHeaders?.[entry.name] ?? ""])));
    });
  }, [active]);

  const connectionInput = useMemo<McpConnectionInput | null>(() => {
    if (!draft) return null;
    return {
      config: draft,
      bearerToken,
      environment: Object.fromEntries(draft.env.filter((entry) => entry.name && environmentValues[entry.id]).map((entry) => [entry.name, environmentValues[entry.id]!])),
      sensitiveHeaders: Object.fromEntries(draft.headers.filter((entry) => entry.sensitive && entry.name && headerValues[entry.id]).map((entry) => [entry.name, headerValues[entry.id]!])),
    };
  }, [bearerToken, draft, environmentValues, headerValues]);

  if (!draft) {
    return <div className="grid min-h-[28rem] place-items-center"><div className="text-center"><Wrench className="mx-auto size-9 text-muted-foreground" /><h1 className="mt-4 text-lg font-semibold">添加你的第一个 MCP 服务器</h1><p className="mt-2 text-sm text-muted-foreground">连接远程 HTTP 服务，或在 Windows 原生端使用 STDIO。</p><Button className="mt-5" onClick={store.addMcpServer}><Plus className="mr-2 size-4" />添加服务器</Button></div></div>;
  }

  async function save() {
    if (!draft) return;
    const validation = validateMcpServerConfig(draft, stdioAllowed);
    if (validation) { setFormError(validation); return; }
    setFormError("");
    setBusy(true);
    try {
      store.updateMcpServer(draft.id, draft);
      await saveMcpSecrets(draft.id, connectionInput ?? {});
      const runtime = await getMcpRuntimeAdapter();
      await runtime.disconnect(draft.id);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    if (!connectionInput) return;
    const validation = validateMcpServerConfig(connectionInput.config, stdioAllowed);
    if (validation) { setFormError(validation); return; }
    setFormError("");
    setBusy(true);
    try {
      const runtime = await getMcpRuntimeAdapter();
      setSnapshot(await runtime.testConnection(connectionInput));
    } catch (error) {
      setSnapshot({ serverId: connectionInput.config.id, status: "error", tools: [], error: error instanceof Error ? error.message : "连接失败。" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft) return;
    const runtime = await getMcpRuntimeAdapter();
    await runtime.disconnect(draft.id);
    await deleteMcpSecrets(draft.id);
    store.deleteMcpServer(draft.id);
  }

  const patch = (next: Partial<McpServerConfig>) => setDraft((current) => current ? { ...current, ...next, updatedAt: Date.now() } : current);

  return (
    <div className="grid gap-6">
      <SettingsPageHeader title={draft.name} description={draft.transport === "stdio" ? "STDIO · 仅 Windows 原生端" : "Streamable HTTP · Windows / Android / Web"} actions={<div className="flex items-center gap-2"><Button variant="outline" onClick={() => void test()} disabled={busy}><Activity className="mr-2 size-4" />测试连接</Button><Button onClick={() => void save()} disabled={busy}><Check className="mr-2 size-4" />保存</Button><Switch checked={draft.enabled} onCheckedChange={(enabled) => patch({ enabled })} aria-label="启用服务器" /></div>} />
      {draft.secretsRequired ? <Alert><CircleAlert className="size-4" /><AlertTitle>需要重新填写秘密值</AlertTitle><AlertDescription>此配置来自备份，已保持禁用；请补充 Token、环境变量或敏感请求头后再启用。</AlertDescription></Alert> : null}
      {formError ? <Alert variant="destructive"><CircleAlert className="size-4" /><AlertTitle>配置有误</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert> : null}
      {snapshot ? <Alert variant={snapshot.status === "connected" ? "default" : "destructive"}><Activity className="size-4" /><AlertTitle>{snapshot.status === "connected" ? "连接正常" : "连接失败"}</AlertTitle><AlertDescription>{snapshot.status === "connected" ? `发现 ${snapshot.tools.length} 个工具。` : snapshot.error}</AlertDescription></Alert> : null}
      <SettingsCard title="基本信息">
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor="mcp-name">名称</FieldLabel><Input id="mcp-name" value={draft.name} onChange={(event) => patch({ name: event.target.value })} /></Field>
            <Field><FieldLabel>传输方式</FieldLabel><Select value={draft.transport} onValueChange={(transport) => patch({ transport: transport as McpServerConfig["transport"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="streamable_http">Streamable HTTP</SelectItem>{stdioAllowed ? <SelectItem value="stdio">STDIO（仅 Windows 原生端）</SelectItem> : null}</SelectContent></Select>{!stdioAllowed ? <FieldDescription>当前平台只支持远程 HTTP MCP，STDIO 控件已禁用。</FieldDescription> : null}</Field>
          </div>
          <Field><FieldLabel htmlFor="mcp-description">描述</FieldLabel><Textarea id="mcp-description" value={draft.description} onChange={(event) => patch({ description: event.target.value })} /></Field>
        </FieldGroup>
      </SettingsCard>
      {draft.transport === "streamable_http" ? <SettingsCard title="连接配置"><FieldGroup className="gap-4"><Field><FieldLabel htmlFor="mcp-url">服务 URL</FieldLabel><Input id="mcp-url" type="url" value={draft.url} onChange={(event) => patch({ url: event.target.value })} placeholder="https://example.com/mcp" /></Field><Field><FieldLabel>认证方式</FieldLabel><Select value={draft.authMode} onValueChange={(authMode) => patch({ authMode: authMode as McpServerConfig["authMode"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">无认证</SelectItem><SelectItem value="bearer">Bearer Token</SelectItem><SelectItem value="headers">自定义请求头</SelectItem></SelectContent></Select></Field>{draft.authMode === "bearer" ? <Field><FieldLabel htmlFor="mcp-bearer">Bearer Token</FieldLabel><Input id="mcp-bearer" type="password" value={bearerToken} onChange={(event) => setBearerToken(event.target.value)} autoComplete="off" /><FieldDescription>{isTauriRuntime() ? "保存在 Stronghold" : "Web 仅保留当前会话"}</FieldDescription></Field> : null}<Field><FieldLabel>自定义请求头</FieldLabel><NameValueEditor entries={draft.headers} values={headerValues} onEntriesChange={(headers) => patch({ headers })} onValuesChange={setHeaderValues} /></Field></FieldGroup></SettingsCard> : <SettingsCard title="启动配置"><FieldGroup className="gap-4"><Field><FieldLabel htmlFor="mcp-command">命令</FieldLabel><Input id="mcp-command" value={draft.command} onChange={(event) => patch({ command: event.target.value })} placeholder="uvx 或 npx" /><FieldDescription>命令与参数分开执行，不经过 shell 拼接。</FieldDescription></Field><Field><FieldLabel htmlFor="mcp-args">参数（每行一个）</FieldLabel><Textarea id="mcp-args" value={draft.args.join("\n")} onChange={(event) => patch({ args: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) })} /></Field><Field><FieldLabel htmlFor="mcp-cwd">工作目录</FieldLabel><Input id="mcp-cwd" value={draft.cwd} onChange={(event) => patch({ cwd: event.target.value })} /></Field><Field><FieldLabel>环境变量</FieldLabel><NameValueEditor entries={draft.env} values={environmentValues} onEntriesChange={(env) => patch({ env })} onValuesChange={setEnvironmentValues} sensitiveByDefault /></Field></FieldGroup></SettingsCard>}
      <SettingsCard title="安全与调用">
        <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="mcp-timeout">调用超时（秒）</FieldLabel><Input id="mcp-timeout" type="number" min={5} max={600} value={draft.timeoutSeconds} onChange={(event) => patch({ timeoutSeconds: Number(event.target.value) })} /></Field><div className="rounded-lg border border-border/60 px-4 py-3"><p className="text-sm font-medium">人工批准</p><p className="mt-1 text-xs leading-5 text-muted-foreground">每次工具调用均需批准；首轮不提供永久允许。</p></div></div>
      </SettingsCard>
      <SettingsCard title="可用工具" description="连接成功后可逐项启用或禁用。">
        {snapshot?.tools.length ? <div className="grid gap-2">{snapshot.tools.map((tool) => <div key={tool.wireName} className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{tool.name}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tool.description || "无描述"}</p></div><div className="flex items-center gap-2"><Badge variant="secondary">{tool.wireName}</Badge><Switch checked={!draft.disabledTools.includes(tool.name)} onCheckedChange={(enabled) => patch({ disabledTools: enabled ? draft.disabledTools.filter((name) => name !== tool.name) : [...draft.disabledTools, tool.name] })} /></div></div>)}</div> : <p className="text-sm text-muted-foreground">点击“测试连接”发现工具。</p>}
      </SettingsCard>
      <div className="flex items-center justify-between border-t border-border/70 pt-5"><p className="text-xs text-muted-foreground">秘密值不会进入 localStorage、日志或备份。</p><Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void remove()}><Trash2 className="mr-2 size-4" />删除服务器</Button></div>
    </div>
  );
}
