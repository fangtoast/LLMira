/**
 * @project LLMira
 * @file src/app/page.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @description 个人 AI 客户端默认入口；首条消息发送时才创建本地会话。
 */
import { MainLayout } from "@/components/layout/MainLayout";

export default function Home() {
  return <MainLayout mode="chat" />;
}
