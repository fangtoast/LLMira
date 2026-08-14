"use client";

/**
 * @project LLMira
 * @file src/components/team/TeamPortal.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 连接团队服务器并完成管理员初始化或成员登录
 *   - 在认证后装配跨端知识工作台
 * @description 团队入口独立于个人客户端；仅开发环境显式 `?demo=1` 可展示演示数据。
 */
import * as React from "react";
import {
  IconBuildingCommunity,
  IconCheck,
  IconCloudLock,
  IconLoader2,
  IconServer2,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TeamWorkbench } from "@/components/team/TeamWorkbench";
import {
  getTeamApiBase,
  setTeamApiBase,
  TeamApiClient,
  TeamApiError,
  type TeamSession,
} from "@/lib/team/api";

type PortalState = "checking" | "unreachable" | "bootstrap" | "login" | "ready";

const PREVIEW_SESSION: TeamSession = {
  accessToken: "preview-only",
  user: {
    userId: "preview-user",
    organizationId: "preview-org",
    email: "lin@llmira.team",
    displayName: "林默",
  },
  workspace: {
    id: "preview-workspace",
    name: "跨端研发",
    role: "workspace_owner",
  },
};

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function strongholdPassword(apiBase: string): string {
  return `llmira:${location.hostname}:${apiBase}`;
}

const loadTauriSecrets = () => import("@/lib/team/tauriSecrets");

function FormField({
  id,
  label,
  type = "text",
  autoComplete,
  placeholder,
  required = true,
}: {
  id: string;
  label: string;
  type?: React.HTMLInputTypeAttribute;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        className="h-11 bg-card/70"
      />
    </div>
  );
}

/** 团队模式入口。 */
export function TeamPortal() {
  const requestedPreview = process.env.NODE_ENV === "development" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";
  const [preview] = React.useState(requestedPreview);
  const [state, setState] = React.useState<PortalState>("checking");
  const [apiBase, setApiBase] = React.useState(getTeamApiBase);
  const [session, setSession] = React.useState<TeamSession | null>(null);
  const [error, setError] = React.useState<string>();
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (preview) {
      const timer = window.setTimeout(() => {
        setSession(PREVIEW_SESSION);
        setState("ready");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const client = new TeamApiClient(apiBase);
    void Promise.all([client.health(), client.bootstrapStatus()])
      .then(async ([, status]) => {
        if (!status.bootstrapped) {
          setState("bootstrap");
          return;
        }
        try {
          const [{ user }, { items }] = await Promise.all([client.me(), client.workspaces()]);
          if (items[0]) {
            setSession({ user, workspace: items[0] });
            setState("ready");
            return;
          }
        } catch {
          if (isTauriRuntime()) {
            try {
              const { readTauriRefreshToken, saveTauriRefreshToken } = await loadTauriSecrets();
              const refreshToken = await readTauriRefreshToken(strongholdPassword(apiBase));
              if (refreshToken) {
                const refreshed = await client.refreshDevice(refreshToken);
                if (refreshed.refreshToken) await saveTauriRefreshToken(refreshed.refreshToken, strongholdPassword(apiBase));
                const authorized = new TeamApiClient(apiBase, refreshed.accessToken);
                const [{ user }, { items }] = await Promise.all([authorized.me(), authorized.workspaces()]);
                if (items[0]) { setSession({ accessToken: refreshed.accessToken, user, workspace: items[0] }); setState("ready"); return; }
              }
            } catch { /* Stronghold 不可用或刷新失败时转登录页。 */ }
          }
        }
        setState("login");
      })
      .catch(() => setState("unreachable"));
  }, [apiBase, preview]);

  async function reconnect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      const form = new FormData(event.currentTarget);
      const nextBase = setTeamApiBase(String(form.get("server") ?? ""));
      setApiBase(nextBase);
      setState("checking");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "服务器地址无效。");
    }
  }

  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const client = new TeamApiClient(apiBase);
    try {
      if (state === "bootstrap") {
        const nextSession = await client.bootstrap({
          organizationName: String(form.get("organizationName")),
          displayName: String(form.get("displayName")),
          email: String(form.get("email")),
          password: String(form.get("password")),
        });
        setSession(nextSession);
      } else {
        const login = isTauriRuntime() ? await client.loginDevice({
          email: String(form.get("email")),
          password: String(form.get("password")),
        }) : await client.login({
          email: String(form.get("email")),
          password: String(form.get("password")),
        });
        if ("refreshToken" in login && typeof login.refreshToken === "string") {
          const { saveTauriRefreshToken } = await loadTauriSecrets();
          await saveTauriRefreshToken(login.refreshToken, strongholdPassword(apiBase));
        }
        const authorized = new TeamApiClient(apiBase, login.accessToken);
        const { items } = await authorized.workspaces();
        if (!items[0]) throw new Error("当前账号还没有可访问的工作区。");
        setSession({ ...login, workspace: items[0] });
      }
      setState("ready");
    } catch (caught) {
      setError(
        caught instanceof TeamApiError || caught instanceof Error
          ? caught.message
          : "登录失败，请稍后重试。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "ready" && session) {
    return (
      <TeamWorkbench
        session={session}
        api={new TeamApiClient(apiBase, session.accessToken)}
        preview={preview}
        personalMode={false}
      />
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-md rounded-[28px] border border-border/80 bg-card/90 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <IconCloudLock aria-hidden size={23} stroke={1.8} />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">LLMira</p>
            <p className="text-sm text-muted-foreground">团队 AI 工作台</p>
          </div>
        </div>

        {state === "checking" && (
          <div className="flex min-h-52 flex-col items-center justify-center gap-4 text-center" role="status">
            <IconLoader2 aria-hidden className="animate-spin text-primary" size={28} />
            <div>
              <h1 className="font-semibold">正在连接团队服务器</h1>
              <p className="mt-1 text-sm text-muted-foreground">{apiBase}</p>
            </div>
          </div>
        )}

        {state === "unreachable" && (
          <form className="grid gap-5" onSubmit={reconnect}>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">连接团队服务器</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                首发版本需要连接组织服务器。近期缓存与离线草稿仍会保留在设备上。
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="server">服务器地址</Label>
              <div className="relative">
                <IconServer2 aria-hidden className="absolute left-3 top-3 text-muted-foreground" size={18} />
                <Input id="server" name="server" defaultValue={apiBase} className="h-11 pl-10" required />
              </div>
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" className="h-11">重新连接</Button>
          </form>
        )}

        {(state === "bootstrap" || state === "login") && (
          <form className="grid gap-5" onSubmit={authenticate}>
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-medium text-success">
                <IconCheck aria-hidden size={15} /> 已连接 {new URL(apiBase).host}
              </div>
              <h1 className="text-xl font-semibold tracking-tight">
                {state === "bootstrap" ? "初始化团队" : "欢迎回来"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {state === "bootstrap"
                  ? "创建首位组织管理员和默认工作区，之后通过邀请添加成员。"
                  : "使用管理员或受邀成员账号进入团队工作区。"}
              </p>
            </div>
            {state === "bootstrap" && (
              <>
                <FormField id="organizationName" label="组织名称" placeholder="例如：星河研究院" />
                <FormField id="displayName" label="管理员姓名" autoComplete="name" />
              </>
            )}
            <FormField id="email" label="邮箱" type="email" autoComplete="email" />
            <FormField id="password" label="密码" type="password" autoComplete={state === "bootstrap" ? "new-password" : "current-password"} />
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" className="h-11" disabled={submitting}>
              {submitting && <IconLoader2 aria-hidden className="mr-2 animate-spin" size={17} />}
              {state === "bootstrap" ? "创建团队并进入" : "登录"}
            </Button>
          </form>
        )}

        <div className="mt-8 flex items-center gap-3 rounded-2xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
          <IconBuildingCommunity aria-hidden className="shrink-0 text-primary" size={20} />
          <span>组织数据按工作区隔离，模型密钥只在服务器端解密使用。</span>
        </div>
      </section>
    </main>
  );
}
