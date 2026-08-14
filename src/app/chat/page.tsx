/**
 * @project LLMira
 * @file src/app/chat/page.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @description 保留旧书签兼容，并进入个人对话工作台。
 */
import { MainLayout } from "@/components/layout/MainLayout";

export default function ChatPage() {
  return <MainLayout mode="chat" />;
}
