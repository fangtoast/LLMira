"use client";

/**
 * @project LLMira
 * @file src/components/team/TeamSections.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 提供知识来源、模型对比、定时任务、成员邀请和 Provider 配置页面
 *   - 提供旧 Dexie 数据的预览、幂等导入与验证后清理
 * @description 所有提交都进入团队 API；密钥输入成功后立即清空且不回显。
 */
import * as React from "react";
import {
  IconBooks,
  IconChartBar,
  IconClock,
  IconDatabaseImport,
  IconKey,
  IconLink,
  IconRobot,
  IconSettings,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import type { KnowledgeDocument, McpServer, ModelComparison, ProviderProfile, ScheduledTask, ToolRisk, WorkspaceUsageSummary } from "@llmira/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TeamApiClient, type TeamSession } from "@/lib/team/api";
import { buildLegacyImport, clearLegacyData, previewLegacyData, type LegacyMigrationPreview } from "@/lib/team/migrateLegacy";

const inputClass = "h-10 w-full rounded-xl border border-border bg-background/55 px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass = `${inputClass} min-h-24 resize-y py-3`;

function PanelHeader({ icon: Icon, title, detail }: { icon: typeof IconBooks; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="grid size-11 place-items-center rounded-2xl bg-primary/12 text-primary"><Icon aria-hidden size={22} /></div>
      <div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{detail}</p></div>
    </div>
  );
}

function Feedback({ message, error }: { message?: string; error?: string }) {
  if (!message && !error) return null;
  return <p role={error ? "alert" : "status"} className={`mt-3 text-sm ${error ? "text-destructive" : "text-success"}`}>{error ?? message}</p>;
}

function KnowledgeSection({ api, session }: { api: TeamApiClient; session: TeamSession }) {
  const [documents, setDocuments] = React.useState<KnowledgeDocument[]>([]);
  const [url, setUrl] = React.useState("");
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  React.useEffect(() => { void api.documents(session.workspace.id).then((result) => setDocuments(result.items)).catch(() => undefined); }, [api, session.workspace.id]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(undefined);
    try {
      const document = await api.createUrlDocument(session.workspace.id, name.trim() || new URL(url).hostname, url);
      setDocuments((current) => [document, ...current]); setUrl(""); setName("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "无法添加网页来源。"); }
    finally { setBusy(false); }
  }
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(undefined);
    try { const document = await api.uploadDocument(session.workspace.id, file); setDocuments((current) => [document, ...current]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "上传文档失败。"); }
    finally { setBusy(false); event.target.value = ""; }
  }
  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-32 pt-10 md:px-10">
      <PanelHeader icon={IconBooks} title="知识库" detail="安全摄取团队资料并追踪处理状态" />
      <form onSubmit={submit} className="mt-8 grid gap-4 rounded-2xl border border-border/70 bg-card/55 p-5 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
        <div><Label htmlFor="source-name">来源名称</Label><input id="source-name" className={`${inputClass} mt-2`} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：发布手册" /></div>
        <div><Label htmlFor="source-url">安全网页地址</Label><input id="source-url" type="url" required className={`${inputClass} mt-2`} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://docs.example.com/guide" /></div>
        <Button disabled={busy} type="submit"><IconLink aria-hidden size={16} />添加来源</Button>
        <Feedback error={error} />
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border p-4">
        <input id="knowledge-file" type="file" disabled={busy} onChange={(event) => void upload(event)} accept=".pdf,.docx,.txt,.md,.html,.htm,.csv" className="min-w-0 flex-1 text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/12 file:px-3 file:py-2 file:text-primary" />
        <span className="text-xs text-muted-foreground">PDF、DOCX、TXT、Markdown、HTML、CSV · 最大 250 MB</span>
      </div>
      <div className="mt-6 grid gap-3">
        {documents.length ? documents.map((document) => (
          <div key={document.id} className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card/45 p-4">
            <div className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground"><IconBooks aria-hidden size={17} /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{document.name}</p><p className="mt-1 text-xs text-muted-foreground">{document.sourceUrl ?? document.mimeType} · {document.chunkCount} 个知识块</p></div>
            <Badge variant="secondary">{document.status}</Badge>
          </div>
        )) : <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">尚未添加团队来源。</p>}
      </div>
    </div>
  );
}

function CompareSection({ api, session }: { api: TeamApiClient; session: TeamSession }) {
  const [prompt, setPrompt] = React.useState("");
  const [models, setModels] = React.useState("gpt-5.2, claude-sonnet-4.5");
  const [comparison, setComparison] = React.useState<ModelComparison>();
  const [error, setError] = React.useState<string>();
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(undefined);
    try { setComparison(await api.compareModels({ workspaceId: session.workspace.id, prompt, models: models.split(",").map((item) => item.trim()).filter(Boolean) })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "无法创建模型对比。"); }
  }
  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-32 pt-10 md:px-10">
      <PanelHeader icon={IconChartBar} title="模型对比" detail="同一提示词并行运行 2–4 路模型" />
      <form onSubmit={submit} className="mt-8 grid gap-4 rounded-2xl border border-border/70 bg-card/55 p-5">
        <div><Label htmlFor="compare-models">模型（逗号分隔）</Label><input id="compare-models" required className={`${inputClass} mt-2`} value={models} onChange={(event) => setModels(event.target.value)} /></div>
        <div><Label htmlFor="compare-prompt">提示词</Label><textarea id="compare-prompt" required className={`${textareaClass} mt-2`} value={prompt} onChange={(event) => setPrompt(event.target.value)} /></div>
        <div><Button type="submit">开始并行对比</Button><Feedback error={error} /></div>
      </form>
      {comparison ? <div className="mt-6 grid gap-3 md:grid-cols-2">{comparison.runs.map((run) => <div key={run.id} className="rounded-2xl border border-primary/20 bg-primary/5 p-5"><p className="font-medium">{run.model}</p><p className="mt-2 text-xs text-muted-foreground">运行 {run.id.slice(0, 8)} · {run.status}</p></div>)}</div> : null}
    </div>
  );
}

function AgentSection({ api, session }: { api: TeamApiClient; session: TeamSession }) {
  const [tasks, setTasks] = React.useState<ScheduledTask[]>([]);
  const [name, setName] = React.useState("");
  const [cron, setCron] = React.useState("0 9 * * 1-5");
  const [prompt, setPrompt] = React.useState("");
  const [error, setError] = React.useState<string>();
  React.useEffect(() => { void api.scheduledTasks(session.workspace.id).then((result) => setTasks(result.items)).catch(() => undefined); }, [api, session.workspace.id]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(undefined);
    try { const task = await api.createScheduledTask({ workspaceId: session.workspace.id, name, cronExpression: cron, timezone: "Asia/Shanghai", prompt }); setTasks((current) => [task, ...current]); setName(""); setPrompt(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "无法创建定时任务。"); }
  }
  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-32 pt-10 md:px-10">
      <PanelHeader icon={IconRobot} title="智能体" detail="计划、记忆、定时任务与逐次授权" />
      <form onSubmit={submit} className="mt-8 grid gap-4 rounded-2xl border border-border/70 bg-card/55 p-5 md:grid-cols-2">
        <div><Label htmlFor="task-name">任务名称</Label><input id="task-name" required className={`${inputClass} mt-2`} value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div><Label htmlFor="task-cron">Cron</Label><input id="task-cron" required className={`${inputClass} mt-2`} value={cron} onChange={(event) => setCron(event.target.value)} /></div>
        <div className="md:col-span-2"><Label htmlFor="task-prompt">任务说明</Label><textarea id="task-prompt" required className={`${textareaClass} mt-2`} value={prompt} onChange={(event) => setPrompt(event.target.value)} /></div>
        <div><Button type="submit"><IconClock aria-hidden size={16} />创建任务</Button><Feedback error={error} /></div>
      </form>
      <div className="mt-6 grid gap-3">{tasks.map((task) => <div key={task.id} className="rounded-2xl border border-border/70 bg-card/45 p-4"><p className="text-sm font-medium">{task.name}</p><p className="mt-1 text-xs text-muted-foreground">{task.cronExpression} · {task.timezone}</p></div>)}</div>
    </div>
  );
}

function TeamSection({ api, session }: { api: TeamApiClient; session: TeamSession }) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"editor" | "viewer">("editor");
  const [token, setToken] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const [usage, setUsage] = React.useState<WorkspaceUsageSummary>();
  React.useEffect(() => { void api.usage(session.workspace.id).then(setUsage).catch(() => undefined); }, [api, session.workspace.id]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(undefined);
    try { const result = await api.invite({ workspaceId: session.workspace.id, email, role }); setToken(result.token); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "无法创建邀请。"); }
  }
  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-32 pt-10 md:px-10">
      <PanelHeader icon={IconUsers} title="团队" detail="邀请成员并按工作区角色协作" />
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["运行", usage?.runCount ?? 0], ["完成", usage?.completedCount ?? 0], ["失败", usage?.failedCount ?? 0], ["Token", usage?.totalTokens ?? 0]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-border/70 bg-card/45 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{Number(value).toLocaleString()}</p></div>)}
      </div>
      <form onSubmit={submit} className="mt-6 grid gap-4 rounded-2xl border border-border/70 bg-card/55 p-5 md:grid-cols-[1fr_180px_auto] md:items-end">
        <div><Label htmlFor="invite-email">成员邮箱</Label><input id="invite-email" type="email" required className={`${inputClass} mt-2`} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div><Label htmlFor="invite-role">角色</Label><select id="invite-role" className={`${inputClass} mt-2`} value={role} onChange={(event) => setRole(event.target.value as "editor" | "viewer")}><option value="editor">编辑者</option><option value="viewer">查看者</option></select></div>
        <Button type="submit">生成邀请</Button>
        <Feedback error={error} />
      </form>
      {token ? <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/8 p-4"><p className="text-sm font-medium text-warning">一次性邀请令牌</p><p className="mt-2 break-all font-mono text-xs">{token}</p><p className="mt-2 text-xs text-muted-foreground">请通过安全渠道发送；服务端只保存令牌摘要。</p></div> : null}
    </div>
  );
}

function SettingsSection({ api, session }: { api: TeamApiClient; session: TeamSession }) {
  const [providers, setProviders] = React.useState<ProviderProfile[]>([]);
  const [scope, setScope] = React.useState<"personal" | "team">("personal");
  const [baseUrl, setBaseUrl] = React.useState("https://api.openai.com");
  const [apiKey, setApiKey] = React.useState("");
  const [models, setModels] = React.useState("gpt-5.2");
  const [feedback, setFeedback] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const [migration, setMigration] = React.useState<LegacyMigrationPreview>();
  const [migrationVerified, setMigrationVerified] = React.useState(false);
  const [mcpServers, setMcpServers] = React.useState<McpServer[]>([]);
  const [mcpName, setMcpName] = React.useState("");
  const [mcpTransport, setMcpTransport] = React.useState<McpServer["transport"]>("streamable_http");
  const [mcpTarget, setMcpTarget] = React.useState("");
  const [mcpDomains, setMcpDomains] = React.useState("");
  const [mcpRisk, setMcpRisk] = React.useState<ToolRisk>("read");
  React.useEffect(() => {
    void api.providers().then((result) => setProviders(result.items)).catch(() => undefined);
    void api.mcpServers(session.workspace.id).then((result) => setMcpServers(result.items)).catch(() => undefined);
    void previewLegacyData().then(setMigration).catch(() => undefined);
  }, [api, session.workspace.id]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError(undefined); setFeedback(undefined);
    try {
      const profile = await api.saveProvider({ workspaceId: session.workspace.id, name: scope === "personal" ? "个人 Provider" : "团队 Provider", baseUrl, scope, apiKey, modelPreset: models.split(",").map((item) => item.trim()).filter(Boolean) });
      setProviders((current) => [profile, ...current.filter((item) => item.id !== profile.id)]); setApiKey(""); setFeedback("Provider 已加密保存，密钥未返回客户端。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存 Provider 失败。"); }
  }
  async function migrate() {
    setError(undefined); setFeedback(undefined);
    try { const payload = await buildLegacyImport(session.workspace.id); const result = await api.importLegacy(payload); setMigrationVerified(true); setFeedback(result.duplicate ? "该批旧数据已导入，服务端幂等校验通过。" : `已验证导入 ${result.imported} 个会话。`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "迁移失败。"); }
  }
  async function saveMcp(event: React.FormEvent) {
    event.preventDefault(); setError(undefined); setFeedback(undefined);
    try {
      const server = await api.saveMcpServer({
        workspaceId: session.workspace.id,
        name: mcpName,
        transport: mcpTransport,
        endpoint: mcpTransport === "streamable_http" ? mcpTarget : undefined,
        containerImage: mcpTransport === "stdio_container" ? mcpTarget : undefined,
        defaultRisk: mcpRisk,
        allowedDomains: mcpDomains.split(",").map((item) => item.trim()).filter(Boolean),
        timeoutMs: 30_000,
        outputLimitBytes: 1024 * 1024,
        enabled: true,
      });
      setMcpServers((current) => [server, ...current]); setMcpName(""); setMcpTarget(""); setMcpDomains(""); setFeedback("MCP 服务器已保存，工具将按声明风险执行或等待授权。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存 MCP 服务器失败。"); }
  }
  async function clearLocal() {
    if (!migrationVerified || !window.confirm("服务端导入已经验证。确定清理旧版本地会话副本吗？")) return;
    await clearLegacyData(); setMigration(await previewLegacyData()); setMigrationVerified(false); setFeedback("旧版本地会话副本已清理。");
  }
  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-32 pt-10 md:px-10">
      <PanelHeader icon={IconSettings} title="设置" detail="模型路由、安全策略与旧数据迁移" />
      <form onSubmit={save} className="mt-8 grid gap-4 rounded-2xl border border-border/70 bg-card/55 p-5 md:grid-cols-2">
        <div><Label htmlFor="provider-scope">密钥范围</Label><select id="provider-scope" className={`${inputClass} mt-2`} value={scope} onChange={(event) => setScope(event.target.value as "personal" | "team")}><option value="personal">个人 BYOK（优先）</option><option value="team">团队密钥</option></select></div>
        <div><Label htmlFor="provider-url">OpenAI 兼容地址</Label><input id="provider-url" type="url" required className={`${inputClass} mt-2`} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></div>
        <div><Label htmlFor="provider-key">API Key</Label><input id="provider-key" type="password" autoComplete="off" required className={`${inputClass} mt-2`} value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></div>
        <div><Label htmlFor="provider-models">允许模型</Label><input id="provider-models" required className={`${inputClass} mt-2`} value={models} onChange={(event) => setModels(event.target.value)} /></div>
        <div><Button type="submit"><IconKey aria-hidden size={16} />加密保存</Button></div>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">{providers.map((provider) => <Badge key={provider.id} variant="secondary">{provider.scope === "personal" ? "个人" : "团队"} · {provider.name} · {provider.hasSecret ? "已配置" : "无密钥"}</Badge>)}</div>
      <form onSubmit={saveMcp} className="mt-8 grid gap-4 rounded-2xl border border-border/70 bg-card/55 p-5 md:grid-cols-2">
        <div className="md:col-span-2"><h2 className="font-semibold">MCP 服务器</h2><p className="mt-1 text-xs text-muted-foreground">HTTP 端点按允许域名连接；stdio 只运行固定 digest 的隔离容器。</p></div>
        <div><Label htmlFor="mcp-name">名称</Label><input id="mcp-name" required className={`${inputClass} mt-2`} value={mcpName} onChange={(event) => setMcpName(event.target.value)} /></div>
        <div><Label htmlFor="mcp-transport">传输</Label><select id="mcp-transport" className={`${inputClass} mt-2`} value={mcpTransport} onChange={(event) => setMcpTransport(event.target.value as McpServer["transport"])}><option value="streamable_http">Streamable HTTP</option><option value="stdio_container">隔离 stdio 容器</option></select></div>
        <div><Label htmlFor="mcp-target">{mcpTransport === "streamable_http" ? "Endpoint" : "镜像（必须 @sha256）"}</Label><input id="mcp-target" required className={`${inputClass} mt-2`} value={mcpTarget} onChange={(event) => setMcpTarget(event.target.value)} /></div>
        <div><Label htmlFor="mcp-domains">允许域名（逗号分隔）</Label><input id="mcp-domains" required={mcpTransport === "streamable_http"} className={`${inputClass} mt-2`} value={mcpDomains} onChange={(event) => setMcpDomains(event.target.value)} /></div>
        <div><Label htmlFor="mcp-risk">默认风险</Label><select id="mcp-risk" className={`${inputClass} mt-2`} value={mcpRisk} onChange={(event) => setMcpRisk(event.target.value as ToolRisk)}><option value="read">读取</option><option value="write">写入</option><option value="external_side_effect">外部副作用</option><option value="irreversible">不可逆</option></select></div>
        <div className="flex items-end"><Button type="submit">保存 MCP</Button></div>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">{mcpServers.map((server) => <Badge key={server.id} variant="outline">{server.name} · {server.transport} · {server.defaultRisk}</Badge>)}</div>
      <section className="mt-8 rounded-2xl border border-border/70 bg-card/55 p-5">
        <div className="flex items-center gap-2"><IconDatabaseImport aria-hidden size={18} className="text-primary" /><h2 className="font-semibold">旧版数据迁移</h2></div>
        <p className="mt-3 text-sm text-muted-foreground">检测到 {migration?.conversationCount ?? 0} 个会话、{migration?.messageCount ?? 0} 条消息。旧 API Key 不会包含在导入载荷中。</p>
        <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void migrate()} disabled={!migration?.conversationCount}>预览并幂等导入</Button><Button type="button" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => void clearLocal()} disabled={!migrationVerified}><IconTrash aria-hidden size={16} />验证后清理本地副本</Button></div>
      </section>
      <Feedback message={feedback} error={error} />
    </div>
  );
}

/** 根据全局导航显示可工作的团队功能页。 */
export function TeamSectionContent({ section, api, session }: { section: "chat" | "agents" | "compare" | "team" | "settings"; api: TeamApiClient; session: TeamSession }) {
  if (section === "agents") return <AgentSection api={api} session={session} />;
  if (section === "compare") return <CompareSection api={api} session={session} />;
  if (section === "team") return <TeamSection api={api} session={session} />;
  if (section === "settings") return <SettingsSection api={api} session={session} />;
  return <KnowledgeSection api={api} session={session} />;
}
