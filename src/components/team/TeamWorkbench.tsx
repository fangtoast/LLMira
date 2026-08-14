"use client";

/**
 * @project LLMira
 * @file src/components/team/TeamWorkbench.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 实现桌面四栏知识工作台和 Android 四项底部导航
 *   - 提供来源定位、逐次授权、模型切换和团队活动交互
 * @description 基于确认稿重建；所有业务图标来自 Tabler Icons。
 */
import * as React from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import {
  IconBooks,
  IconRobot,
  IconBrandDocker,
  IconBrandWindows,
  IconChartBar,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconFileText,
  IconFolder,
  IconFolderOpen,
  IconLayoutSidebarLeftExpand,
  IconLayoutSidebarRightExpand,
  IconMessageCircle,
  IconMicrophone,
  IconMoon,
  IconPaperclip,
  IconPlayerStop,
  IconPlus,
  IconSearch,
  IconSend,
  IconSettings,
  IconShieldCheck,
  IconSparkles,
  IconSun,
  IconTool,
  IconUsers,
  IconWorld,
  type Icon,
} from "@tabler/icons-react";
import type { AgentRunStatus, ApprovalDecision, ApprovalRequest, Citation, RunEvent } from "@llmira/contracts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { TeamApiClient, type TeamSession } from "@/lib/team/api";
import { enqueueOfflineOperation, flushOfflineOperations, readOfflineDraft, saveOfflineDraft } from "@/lib/team/offlineOutbox";

const TeamSectionContent = dynamic(
  () => import("./TeamSections").then((module) => module.TeamSectionContent),
  { loading: () => <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">正在加载团队模块…</div> },
);

type SectionId = "knowledge" | "chat" | "agents" | "compare" | "team" | "settings";

interface WorkbenchProps {
  session: TeamSession;
  api: TeamApiClient;
  preview?: boolean;
  personalMode?: boolean;
}

interface LiveRunState {
  id?: string;
  prompt: string;
  status: AgentRunStatus;
  content: string;
  error?: string;
  approval?: ApprovalRequest;
  citations?: Citation[];
}

const NAV_ITEMS: Array<{ id: SectionId; label: string; icon: Icon }> = [
  { id: "knowledge", label: "知识库", icon: IconBooks },
  { id: "chat", label: "对话", icon: IconMessageCircle },
  { id: "agents", label: "智能体", icon: IconRobot },
  { id: "compare", label: "模型对比", icon: IconChartBar },
  { id: "team", label: "团队", icon: IconUsers },
  { id: "settings", label: "设置", icon: IconSettings },
];

const MOBILE_NAV = NAV_ITEMS.filter((item) =>
  ["knowledge", "chat", "agents", "team"].includes(item.id),
);

const SOURCES = [
  {
    id: "s1",
    index: 1,
    title: "Tauri 2 · Next.js 前端配置",
    host: "v2.tauri.app",
    icon: IconWorld,
    excerpt: "Next.js 应采用静态导出，桌面与移动 WebView 不运行 Next 服务端。",
  },
  {
    id: "s2",
    index: 2,
    title: "跨端发布架构评审纪要",
    host: "团队知识库 · 2026-08-12",
    icon: IconFileText,
    excerpt: "首发支持 Web、Windows x64 与 Android arm64，iOS 作为后续适配目标。",
  },
  {
    id: "s3",
    index: 3,
    title: "Tauri Stronghold 安全手册",
    host: "v2.tauri.app",
    icon: IconShieldCheck,
    excerpt: "桌面和移动端的刷新令牌及设备密钥应进入 Stronghold。",
  },
];

const TREE_GROUPS = [
  {
    title: "产品方案",
    items: ["Tauri 2 跨端方案", "移动端交互规范", "模型路由策略"],
  },
  {
    title: "工程文档",
    items: ["部署与恢复", "MCP 安全边界", "API v1 约定"],
  },
  {
    title: "团队资料",
    items: ["会议纪要", "用量报告", "成员手册"],
  },
];

function RailButton({
  label,
  active,
  icon: IconComponent,
  onClick,
}: {
  label: string;
  active?: boolean;
  icon: Icon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "group relative grid size-11 place-items-center rounded-xl text-muted-foreground outline-none transition hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-primary/12 text-primary",
      )}
    >
      {active && <span aria-hidden className="absolute -left-[18px] h-5 w-1 rounded-r-full bg-primary" />}
      <IconComponent aria-hidden size={21} stroke={1.65} />
    </button>
  );
}

function GlobalRail({
  activeSection,
  onSectionChange,
  personalMode,
}: {
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
  personalMode: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <aside className="hidden w-[76px] shrink-0 flex-col items-center border-r border-border/70 bg-workbench-rail py-5 lg:flex">
      <div className="mb-6 grid size-10 place-items-center overflow-hidden rounded-2xl bg-primary shadow-lg shadow-primary/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/llmira-logo.svg" alt="LLMira" className="size-7" />
      </div>
      <nav aria-label="全局功能" className="flex flex-1 flex-col items-center gap-2">
        {NAV_ITEMS.filter((item) => !personalMode || item.id !== "team").map((item) => (
          <RailButton
            key={item.id}
            label={item.label}
            icon={item.icon}
            active={item.id === activeSection}
            onClick={() => onSectionChange(item.id)}
          />
        ))}
      </nav>
      <button
        type="button"
        title={resolvedTheme === "dark" ? "切换浅色主题" : "切换深色主题"}
        aria-label={resolvedTheme === "dark" ? "切换浅色主题" : "切换深色主题"}
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="grid size-11 place-items-center rounded-xl text-muted-foreground outline-none transition hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {resolvedTheme === "dark" ? <IconSun aria-hidden size={20} /> : <IconMoon aria-hidden size={20} />}
      </button>
      <Avatar className="mt-3 size-9 border border-border">
        <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">林</AvatarFallback>
      </Avatar>
    </aside>
  );
}

function KnowledgeTree({
  workspaceName,
  onOpenSources,
}: {
  workspaceName: string;
  onOpenSources: () => void;
}) {
  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-border/70 bg-workbench-panel lg:flex">
      <div className="border-b border-border/60 p-4">
        <button type="button" className="flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/14 text-primary">
            <IconFolderOpen aria-hidden size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{workspaceName}</p>
            <p className="text-xs text-muted-foreground">12 位成员 · 46 份资料</p>
          </div>
          <IconChevronDown aria-hidden size={16} className="text-muted-foreground" />
        </button>
      </div>
      <div className="p-4">
        <div className="relative">
          <IconSearch aria-hidden size={16} className="absolute left-3 top-2.5 text-muted-foreground" />
          <input
            aria-label="搜索知识库"
            className="h-9 w-full rounded-xl border border-border/70 bg-background/55 pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="搜索文档与对话"
          />
        </div>
        <Button className="mt-3 h-9 w-full justify-start rounded-xl text-xs" size="sm">
          <IconPlus aria-hidden className="mr-2" size={16} /> 新建知识
        </Button>
      </div>
      <nav aria-label="知识树" className="min-h-0 flex-1 overflow-y-auto px-3 pb-5">
        {TREE_GROUPS.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {group.title}
            </p>
            {group.items.map((item, index) => (
              <button
                key={item}
                type="button"
                onClick={index === 0 && group.title === "产品方案" ? onOpenSources : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] text-muted-foreground outline-none transition hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  item === "Tauri 2 跨端方案" && "bg-primary/10 font-medium text-primary",
                )}
              >
                {item === "Tauri 2 跨端方案" ? <IconFileText aria-hidden size={15} /> : <IconFolder aria-hidden size={15} />}
                <span className="truncate">{item}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-border/60 p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>团队存储</span><span>6.8 / 20 GB</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-muted">
          <div className="h-full w-[34%] rounded-full bg-primary" />
        </div>
      </div>
    </aside>
  );
}

function CitationButton({
  source,
  onClick,
}: {
  source: (typeof SOURCES)[number];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`查看来源 ${source.index}：${source.title}`}
      className="inline-flex size-5 translate-y-[-1px] items-center justify-center rounded-md bg-primary/14 text-[10px] font-semibold text-primary outline-none hover:bg-primary/22 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {source.index}
    </button>
  );
}

function SourceCards({ onSelect }: { onSelect: (index: number) => void }) {
  return (
    <div className="mt-6 grid gap-2 sm:grid-cols-3">
      {SOURCES.map((source, index) => {
        const SourceIcon = source.icon;
        return (
          <button
            key={source.id}
            type="button"
            onClick={() => onSelect(index)}
            className="group rounded-2xl border border-border/70 bg-card/45 p-3 text-left outline-none transition hover:border-primary/35 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex gap-2.5">
              <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground group-hover:text-primary">
                <SourceIcon aria-hidden size={16} />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-xs font-medium leading-5">{source.title}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{source.host}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function LiveRunPanel({
  run,
  deciding,
  onDecide,
}: {
  run: LiveRunState;
  deciding: boolean;
  onDecide: (decision: ApprovalDecision["decision"]) => void;
}) {
  const statusLabel: Record<AgentRunStatus, string> = {
    queued: "排队中",
    running: "生成中",
    waiting_approval: "等待授权",
    completed: "已完成",
    failed: "失败",
    cancelled: "已停止",
  };
  return (
    <section aria-live="polite" className="mb-7 rounded-2xl border border-primary/25 bg-primary/5 p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">本次运行</p>
          <p className="mt-1 break-words text-sm font-medium">{run.prompt}</p>
        </div>
        <Badge variant="outline" className="shrink-0 border-primary/25 bg-background/50 text-primary">{statusLabel[run.status]}</Badge>
      </div>
      {run.content ? <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/90">{run.content}</p> : null}
      {run.citations?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {run.citations.map((citation) => (
            <Badge key={citation.id} variant="secondary" className="max-w-full font-normal">
              <span className="truncate">{citation.documentName}{citation.page ? ` · 第 ${citation.page} 页` : ""}</span>
            </Badge>
          ))}
        </div>
      ) : null}
      {run.error ? <p role="alert" className="mt-4 text-sm text-destructive">{run.error}</p> : null}
      {run.approval?.status === "pending" ? (
        <div className="mt-4"><ApprovalCard decision={undefined} deciding={deciding} onDecide={onDecide} /></div>
      ) : null}
    </section>
  );
}

function KnowledgeAnswer({
  onSelectSource,
  approvalDecision,
  approvalDeciding,
  onDecide,
  liveRun,
  showDemoApproval,
}: {
  onSelectSource: (index: number) => void;
  approvalDecision?: ApprovalDecision["decision"];
  approvalDeciding: boolean;
  onDecide: (decision: ApprovalDecision["decision"]) => void;
  liveRun?: LiveRunState;
  showDemoApproval: boolean;
}) {
  return (
    <article className="mx-auto w-full max-w-[790px] px-5 pb-40 pt-6 md:px-8 md:pt-10">
      <div className="mb-6 flex items-start gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
          <IconSparkles aria-hidden size={17} />
        </div>
        <div>
          <p className="text-[15px] font-semibold">架构顾问</p>
          <p className="mt-0.5 text-xs text-muted-foreground">已检索 8 份可信来源 · 14:32</p>
        </div>
      </div>

      {liveRun ? <LiveRunPanel run={liveRun} deciding={approvalDeciding} onDecide={onDecide} /> : null}

      <div className="space-y-6 text-[14px] leading-7 text-foreground/88 md:text-[15px]">
        <p>
          建议将 LLMira 调整为静态客户端与团队服务分离的架构。Windows 和 Android 由 Tauri 2 承载同一套界面，所有认证、知识检索和 Agent 运行统一进入团队 API。
          <CitationButton source={SOURCES[0]} onClick={() => onSelectSource(0)} />
        </p>
        <section>
          <h2 className="mb-3 text-[16px] font-semibold text-foreground">1. 跨端客户端</h2>
          <p>
            Next.js 使用静态导出，Web 由 Caddy 托管，Windows 与 Android 的 WebView 加载同一份构建产物。桌面刷新凭据进入 Stronghold，Android 只连接服务器 MCP。
            <CitationButton source={SOURCES[2]} onClick={() => onSelectSource(2)} />
          </p>
          <div className="mt-4 hidden gap-3 sm:grid sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card/55 p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><IconBrandWindows aria-hidden size={18} className="text-primary" /> Windows x64</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">默认 1440×900，提供 MSI 与 NSIS 安装包。</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/55 p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><IconBrandDocker aria-hidden size={18} className="text-primary" /> Android arm64</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">近期缓存、离线草稿与重连 outbox。</p>
            </div>
          </div>
        </section>

        <div className={cn("lg:hidden", !showDemoApproval && "hidden")}>
          <ApprovalCard decision={approvalDecision} deciding={approvalDeciding} onDecide={onDecide} />
        </div>

        <section>
          <h2 className="mb-3 text-[16px] font-semibold text-foreground">2. 团队知识与模型路由</h2>
          <p>
            团队密钥只在服务端保存；成员可以设置个人 BYOK，调用顺序固定为个人密钥、团队密钥、不可用。共享知识库统一使用团队嵌入配置，引用回到原文片段。
            <CitationButton source={SOURCES[1]} onClick={() => onSelectSource(1)} />
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-[16px] font-semibold text-foreground">3. Agent 授权边界</h2>
          <p>
            读取类工具自动执行；写入、外部副作用和不可逆动作逐次暂停。每次授权都记录发起者、授权人、脱敏参数和结果摘要，定时任务遵守相同边界。
          </p>
        </section>
      </div>

      <div className="mt-8 border-t border-border/60 pt-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">引用来源</p>
          <button type="button" onClick={() => onSelectSource(0)} className="text-xs text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">查看全部 8 条</button>
        </div>
        <SourceCards onSelect={onSelectSource} />
      </div>
    </article>
  );
}

function Composer({
  busy,
  workspaceId,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  workspaceId: string;
  onSubmit: (input: { prompt: string; model?: string; tools: string[]; idempotencyKey: string }) => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [draft, setDraft] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [modelIndex, setModelIndex] = React.useState(1);
  const [writeTool, setWriteTool] = React.useState(false);
  const models = [
    { label: "自动路由", value: undefined },
    { label: "GPT-5.2", value: "gpt-5.2" },
    { label: "Claude Sonnet", value: "claude-sonnet-4.5" },
  ];
  const draftId = `workspace:${workspaceId}:composer`;
  React.useEffect(() => { void readOfflineDraft(draftId).then((content) => { if (content) setDraft(content); }); }, [draftId]);
  React.useEffect(() => {
    const timeout = window.setTimeout(() => { void saveOfflineDraft({ id: draftId, workspaceId, content: draft }); }, 250);
    return () => window.clearTimeout(timeout);
  }, [draft, draftId, workspaceId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || busy) return;
    setSent(true);
    setDraft("");
    const idempotencyKey = crypto.randomUUID();
    const input = {
      prompt,
      model: models[modelIndex]?.value,
      tools: [writeTool ? "workspace.write" : "knowledge.read"],
      idempotencyKey,
    };
    try {
      await onSubmit(input);
      await saveOfflineDraft({ id: draftId, workspaceId, content: "" });
    } catch {
      await enqueueOfflineOperation({ workspaceId, operation: "message.create", payload: input, idempotencyKey });
    } finally {
      setSent(false);
    }
  }

  return (
    <form onSubmit={submit} className="absolute inset-x-0 bottom-[58px] z-20 bg-gradient-to-t from-workbench-canvas via-workbench-canvas/95 to-transparent px-4 pb-3 pt-10 md:px-8 lg:bottom-0 lg:pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-[790px] rounded-[22px] border border-border/80 bg-card/95 p-2 shadow-2xl shadow-black/20 backdrop-blur">
        <label htmlFor="team-prompt" className="sr-only">向团队智能体提问</label>
        <textarea
          id="team-prompt"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          className="max-h-32 min-h-12 w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          placeholder={sent ? "正在创建运行…" : "继续询问，或 @ 成员协作…"}
          rows={1}
        />
        <div className="flex items-center gap-1 px-1 pb-1">
          <button type="button" aria-label="添加附件" title="添加附件" className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><IconPaperclip aria-hidden size={18} /></button>
          <button type="button" aria-label="语音输入" title="语音输入" className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><IconMicrophone aria-hidden size={18} /></button>
          <button type="button" aria-label={`切换模型，当前 ${models[modelIndex]?.label}`} onClick={() => setModelIndex((current) => (current + 1) % models.length)} className="ml-1 flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            {models[modelIndex]?.label} <IconChevronDown aria-hidden size={13} />
          </button>
          <button type="button" aria-pressed={writeTool} aria-label={writeTool ? "写入工具已启用，需要逐次授权" : "只读工具模式"} onClick={() => setWriteTool((current) => !current)} className={cn("grid size-8 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", writeTool && "bg-warning/12 text-warning")}>
            <IconTool aria-hidden size={17} />
          </button>
          <button type={busy ? "button" : "submit"} onClick={busy ? () => void onCancel() : undefined} aria-label={busy ? "停止生成" : "发送消息"} title={busy ? "停止生成" : "发送消息"} disabled={!busy && !draft.trim()} className="ml-auto grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground outline-none transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40">
            {busy ? <IconPlayerStop aria-hidden size={17} /> : <IconSend aria-hidden size={17} />}
          </button>
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-[790px] text-center text-[10px] text-muted-foreground">模型可能产生错误，请核对重要信息与引用来源。</p>
    </form>
  );
}

function ApprovalCard({
  decision,
  deciding,
  onDecide,
}: {
  decision?: ApprovalDecision["decision"];
  deciding: boolean;
  onDecide: (decision: ApprovalDecision["decision"]) => void;
}) {
  if (decision) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/55 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <IconCheck aria-hidden size={17} className={decision === "approved" ? "text-success" : "text-muted-foreground"} />
          {decision === "approved" ? "已允许本次操作" : "已拒绝本次操作"}
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">决定已写入审计记录，授权不会自动沿用到下一次写操作。</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-warning/35 bg-warning/8 p-4 shadow-lg shadow-warning/5">
      <div className="flex items-center gap-2 text-xs font-semibold text-warning">
        <IconShieldCheck aria-hidden size={17} /> 等待你的授权
      </div>
      <p className="mt-3 text-sm font-medium">创建发布流水线</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Agent 将写入 3 个工作流文件，并配置 Windows 与 Android 构建任务。</p>
      <div className="mt-3 hidden rounded-xl border border-warning/15 bg-background/45 p-3 font-mono text-[10px] leading-5 text-muted-foreground sm:block">
        tool: workspace.write<br />scope: .github/workflows/*
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" disabled={deciding} onClick={() => onDecide("rejected")}>拒绝</Button>
        <Button type="button" variant="approval" size="sm" disabled={deciding} onClick={() => onDecide("approved")}>仅本次允许</Button>
      </div>
    </div>
  );
}

function ActivityPanel({
  decision,
  deciding,
  onDecide,
  showApproval,
}: {
  decision?: ApprovalDecision["decision"];
  deciding: boolean;
  onDecide: (decision: ApprovalDecision["decision"]) => void;
  showApproval: boolean;
}) {
  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">协作者</h2>
          <span className="text-[11px] text-success">3 人在线</span>
        </div>
        <div className="flex -space-x-2">
          {[
            ["林", "bg-blue-500"],
            ["周", "bg-violet-500"],
            ["陈", "bg-emerald-500"],
            ["+9", "bg-muted"],
          ].map(([label, color]) => (
            <Avatar key={label} className="size-8 border-2 border-workbench-panel">
              <AvatarFallback className={cn("text-[10px] text-white", color)}>{label}</AvatarFallback>
            </Avatar>
          ))}
        </div>
      </section>
      {showApproval ? <ApprovalCard decision={decision} deciding={deciding} onDecide={onDecide} /> : (
        <div className="rounded-2xl border border-border/70 bg-card/45 p-4">
          <p className="text-sm font-medium">暂无待授权操作</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">只读工具会自动运行；高风险操作会在这里逐次暂停。</p>
        </div>
      )}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">运行动态</h2>
        <ol className="space-y-4">
          {[
            ["知识检索完成", "命中 8 份来源", "刚刚", IconBooks],
            ["安全检查通过", "未检测到外部副作用", "1 分钟前", IconShieldCheck],
            ["周璇加入协作", "正在查看架构建议", "8 分钟前", IconUsers],
          ].map(([title, detail, time, ActivityIcon]) => (
            <li key={String(title)} className="flex gap-3">
              <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                {React.createElement(ActivityIcon as Icon, { size: 14, "aria-hidden": true })}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{title as string}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{detail as string}</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><IconClock aria-hidden size={11} />{time as string}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function MobileNavigation({ active, onChange, personalMode }: { active: SectionId; onChange: (value: SectionId) => void; personalMode: boolean }) {
  return (
    <nav aria-label="移动端主导航" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border/80 bg-workbench-panel/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {MOBILE_NAV.filter((item) => !personalMode || item.id !== "team").map((item) => {
        const MobileIcon = item.icon;
        return (
          <button key={item.id} type="button" onClick={() => onChange(item.id)} aria-current={active === item.id ? "page" : undefined} className={cn("flex min-h-[58px] flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", active === item.id && "text-primary")}>
            <MobileIcon aria-hidden size={20} stroke={1.7} />{item.label}
          </button>
        );
      })}
    </nav>
  );
}

/** 已登录团队工作台。 */
export function TeamWorkbench({ session, api, preview = false, personalMode = false }: WorkbenchProps) {
  const [activeSection, setActiveSection] = React.useState<SectionId>("knowledge");
  const [sourceOpen, setSourceOpen] = React.useState(false);
  const [activityOpen, setActivityOpen] = React.useState(false);
  const [treeOpen, setTreeOpen] = React.useState(false);
  const [selectedSource, setSelectedSource] = React.useState(0);
  const [decision, setDecision] = React.useState<ApprovalDecision["decision"]>();
  const [deciding, setDeciding] = React.useState(false);
  const [liveRun, setLiveRun] = React.useState<LiveRunState>();
  const streamController = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => streamController.current?.abort(), []);
  React.useEffect(() => {
    const flush = () => void flushOfflineOperations(async (item) => {
      if (item.operation !== "message.create") return;
      const payload = item.payload as { prompt: string; model?: string; tools?: string[] };
      await api.createRun({ workspaceId: item.workspaceId, title: payload.prompt.slice(0, 60), prompt: payload.prompt, model: payload.model, tools: payload.tools, idempotencyKey: item.idempotencyKey });
    });
    window.addEventListener("online", flush);
    flush();
    return () => window.removeEventListener("online", flush);
  }, [api, session.workspace.id]);

  function openSource(index: number) {
    setSelectedSource(index);
    setSourceOpen(true);
  }

  async function decide(nextDecision: ApprovalDecision["decision"]) {
    setDeciding(true);
    try {
      if (!preview && liveRun?.approval) {
        const approval = await api.decideApproval(liveRun.approval.id, nextDecision);
        setLiveRun((current) => current ? {
          ...current,
          approval,
          status: nextDecision === "approved" ? "running" : "cancelled",
        } : current);
        if (nextDecision === "approved" && liveRun.id) void streamEvents(liveRun.id);
      }
      setDecision(nextDecision);
    } finally {
      setDeciding(false);
    }
  }

  function applyRunEvent(event: RunEvent) {
    setLiveRun((current) => {
      if (!current) return current;
      if (event.type === "run.delta") return { ...current, status: "running", content: current.content + String(event.payload.content ?? "") };
      if (event.type === "approval.required") return { ...current, status: "waiting_approval", approval: event.payload.approval as ApprovalRequest };
      if (event.type === "tool.completed" && event.payload.toolName === "knowledge.search") return { ...current, citations: event.payload.citations as Citation[] };
      if (event.type === "approval.resolved") return current.approval ? {
        ...current,
        status: event.payload.decision === "approved" ? "running" : "cancelled",
        approval: { ...current.approval, status: event.payload.decision === "approved" ? "approved" : "rejected" },
      } : current;
      if (event.type === "run.completed") return { ...current, status: "completed" };
      if (event.type === "run.failed") return { ...current, status: "failed", error: `运行失败：${String(event.payload.code ?? "UNKNOWN")}` };
      if (event.type === "run.cancelled") return { ...current, status: "cancelled" };
      if (event.type === "run.started") return { ...current, status: "running" };
      return current;
    });
  }

  async function streamEvents(runId: string) {
    streamController.current?.abort();
    const controller = new AbortController();
    streamController.current = controller;
    let cursor = 0;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await api.streamRunEvents(runId, (event) => {
          cursor = Math.max(cursor, event.sequence);
          applyRunEvent(event);
        }, controller.signal, cursor);
        return;
      } catch (error) {
        if (controller.signal.aborted) return;
        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }
        setLiveRun((current) => current ? {
          ...current,
          status: "failed",
          error: error instanceof Error ? error.message : "运行事件流中断。",
        } : current);
      }
    }
  }

  async function submitPrompt(input: { prompt: string; model?: string; tools: string[]; idempotencyKey: string }) {
    setDecision(undefined);
    setLiveRun({ prompt: input.prompt, status: "queued", content: "" });
    if (preview) {
      setLiveRun({ prompt: input.prompt, status: "completed", content: "预览模式已验证输入、模型与工具状态；连接团队服务器后将显示实时流式回答。" });
      return;
    }
    try {
      const run = await api.createRun({ workspaceId: session.workspace.id, title: input.prompt.slice(0, 60), ...input });
      setLiveRun({ id: run.id, prompt: input.prompt, status: run.status, content: "", approval: run.approval });
      if (!run.approval) void streamEvents(run.id);
    } catch (error) {
      setLiveRun({ prompt: input.prompt, status: "failed", content: "", error: error instanceof Error ? error.message : "无法创建运行。" });
      throw error;
    }
  }

  async function cancelRun() {
    streamController.current?.abort();
    const runId = liveRun?.id;
    setLiveRun((current) => current ? { ...current, status: "cancelled" } : current);
    if (!preview && runId) {
      try {
        await api.cancelRun(runId);
      } catch (error) {
        setLiveRun((current) => current ? { ...current, status: "failed", error: error instanceof Error ? error.message : "停止运行失败。" } : current);
      }
    }
  }

  const selected = SOURCES[selectedSource];

  return (
    <main className="flex h-dvh min-h-[640px] overflow-hidden bg-workbench-canvas text-foreground">
      <GlobalRail activeSection={activeSection} onSectionChange={setActiveSection} personalMode={personalMode} />
      <KnowledgeTree workspaceName={session.workspace.name} onOpenSources={() => openSource(0)} />

      <section className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-[62px] shrink-0 items-center gap-3 border-b border-border/70 bg-workbench-canvas/95 px-4 backdrop-blur md:px-6">
          <button type="button" aria-label="打开知识树" title="打开知识树" onClick={() => setTreeOpen(true)} className="grid size-9 place-items-center rounded-xl text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring lg:hidden"><IconLayoutSidebarLeftExpand aria-hidden size={20} /></button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">{session.workspace.name}</span>
              <span className="truncate text-sm font-semibold sm:hidden">LLMira</span>
              <IconChevronRight aria-hidden size={12} className="text-muted-foreground" />
              <span className="truncate text-sm font-medium">{activeSection === "knowledge" ? "Tauri 2 跨端方案" : NAV_ITEMS.find((item) => item.id === activeSection)?.label}</span>
            </div>
          </div>
          <Badge variant="outline" className="hidden border-success/25 bg-success/8 text-success sm:inline-flex"><span aria-hidden className="mr-1.5 size-1.5 rounded-full bg-success" />{preview ? "演示数据" : "已同步"}</Badge>
          <Button type="button" variant="ghost" size="icon" aria-label="打开协作与授权" title="打开协作与授权" onClick={() => setActivityOpen(true)} className="min-[1280px]:hidden"><IconLayoutSidebarRightExpand aria-hidden size={20} /></Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeSection === "knowledge" ? (
            <KnowledgeAnswer
              onSelectSource={openSource}
              approvalDecision={decision}
              approvalDeciding={deciding}
              onDecide={decide}
              liveRun={liveRun}
              showDemoApproval={preview}
            />
          ) : <TeamSectionContent section={activeSection} api={api} session={session} />}
        </div>
        {(activeSection === "knowledge" || activeSection === "chat") && (
          <Composer
            busy={Boolean(liveRun && ["queued", "running", "waiting_approval"].includes(liveRun.status))}
            workspaceId={session.workspace.id}
            onSubmit={submitPrompt}
            onCancel={cancelRun}
          />
        )}
      </section>

      <aside className="hidden w-[286px] shrink-0 flex-col border-l border-border/70 bg-workbench-panel min-[1280px]:flex">
        <div className="flex h-[62px] items-center justify-between border-b border-border/60 px-5">
          <p className="text-sm font-semibold">协作与授权</p>
          <Badge variant="secondary" className="font-normal">实时</Badge>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5"><ActivityPanel decision={decision} deciding={deciding} onDecide={decide} showApproval={preview || liveRun?.approval?.status === "pending"} /></div>
      </aside>

      <Sheet open={sourceOpen} onOpenChange={setSourceOpen}>
        <SheetContent side="right" className="w-[92vw] border-border bg-workbench-panel p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border/70 p-6 pr-14 text-left">
            <SheetTitle>引用来源 {selected.index}</SheetTitle>
            <SheetDescription>{selected.host}</SheetDescription>
          </SheetHeader>
          <div className="p-6">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">{React.createElement(selected.icon, { size: 20, "aria-hidden": true })}</div>
              <div><h3 className="font-semibold leading-6">{selected.title}</h3><p className="mt-1 text-xs text-muted-foreground">已验证 · 团队可见</p></div>
            </div>
            <blockquote className="mt-6 rounded-2xl border border-primary/20 bg-primary/6 p-4 text-sm leading-7">{selected.excerpt}</blockquote>
            <div className="mt-6 space-y-3 text-xs leading-6 text-muted-foreground">
              <p>定位：第 3 节 · 客户端运行边界</p>
              <p>摄取方式：{selected.host.includes("团队") ? "团队文件" : "安全网页抓取"}</p>
              <p>最后更新：2026-08-12 21:06</p>
            </div>
            <Button type="button" variant="outline" className="mt-7 w-full" onClick={() => setSourceOpen(false)}>返回回答</Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={treeOpen} onOpenChange={setTreeOpen}>
        <SheetContent side="left" className="w-[88vw] border-border bg-workbench-panel p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-border/70 p-6 pr-14 text-left">
            <SheetTitle>{session.workspace.name}</SheetTitle>
            <SheetDescription>工作区知识树 · 46 份资料</SheetDescription>
          </SheetHeader>
          <nav aria-label="移动端知识树" className="space-y-5 p-4">
            {TREE_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group.title}</p>
                {group.items.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setTreeOpen(false);
                      if (item === "Tauri 2 跨端方案") openSource(0);
                    }}
                    className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", item === "Tauri 2 跨端方案" && "bg-primary/10 text-primary")}
                  >
                    <IconFileText aria-hidden size={16} /><span className="truncate">{item}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <Sheet open={activityOpen} onOpenChange={setActivityOpen}>
        <SheetContent side="right" className="w-[92vw] border-border bg-workbench-panel sm:max-w-sm">
          <SheetHeader className="text-left"><SheetTitle>协作与授权</SheetTitle><SheetDescription>查看在线成员、运行状态和待授权操作。</SheetDescription></SheetHeader>
          <div className="mt-7"><ActivityPanel decision={decision} deciding={deciding} onDecide={decide} showApproval={preview || liveRun?.approval?.status === "pending"} /></div>
        </SheetContent>
      </Sheet>

      <MobileNavigation active={activeSection} onChange={setActiveSection} personalMode={personalMode} />
    </main>
  );
}
