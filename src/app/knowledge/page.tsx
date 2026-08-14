/**
 * @project LLMira
 * @file src/app/knowledge/page.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 个人知识库入口；与普通会话上下文明确分离。
 */
import { PersonalSectionPage } from "@/components/layout/PersonalSectionPage";

export default function KnowledgePage() {
  return (
    <PersonalSectionPage
      active="knowledge"
      eyebrow="个人知识库"
      title="让文件成为可追溯的上下文"
      description="知识库 RAG 将独立于普通对话运行。当前开发预览先开放 PDF、DOCX、TXT 与 Markdown 的本地解析；向量检索与定位引用将在下一阶段接入。"
      actionHref="/chat"
      actionLabel="返回对话"
    />
  );
}
