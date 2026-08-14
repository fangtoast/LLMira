/**
 * @project LLMira
 * @file src/app/more/page.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 将团队和实验能力放入个人主流程之后。
 */
import Link from "next/link";
import { Bot, FlaskConical, LibraryBig, Users } from "lucide-react";
import { PersonalSectionPage } from "@/components/layout/PersonalSectionPage";

export default function MorePage() {
  return (
    <PersonalSectionPage
      active="more"
      eyebrow="更多与扩展"
      title="需要时，再打开团队与实验功能"
      description="这些能力不会出现在默认对话流程中。Agent 深度能力仍在设计阶段，团队协作可连接自托管服务器继续使用。"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/knowledge" className="rounded-3xl border border-border/70 bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40">
          <LibraryBig className="mb-8 h-5 w-5 text-cyan-500" />
          <h2 className="font-semibold">知识库</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">管理个人资料，并在需要时加入对话上下文。</p>
        </Link>
        <Link href="/team" className="rounded-3xl border border-border/70 bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40">
          <Users className="mb-8 h-5 w-5 text-primary" />
          <h2 className="font-semibold">团队协作</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">邀请成员、共享知识库与团队密钥。</p>
        </Link>
        <div className="rounded-3xl border border-border/70 bg-card p-5 opacity-75">
          <Bot className="mb-8 h-5 w-5 text-amber-500" />
          <h2 className="font-semibold">Agent 实验室</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">记忆、工具与授权流程将在后续版本单独设计。</p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-card p-5 opacity-75">
          <FlaskConical className="mb-8 h-5 w-5 text-violet-500" />
          <h2 className="font-semibold">模型对比</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">多路并行回答保留为实验功能。</p>
        </div>
      </div>
    </PersonalSectionPage>
  );
}
