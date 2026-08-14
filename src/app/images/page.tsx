/**
 * @project LLMira
 * @file src/app/images/page.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 独立生图入口，复用个人会话的附件、历史与 Provider transport。
 */
import { MainLayout } from "@/components/layout/MainLayout";

export default function ImagesPage() {
  return <MainLayout mode="image" />;
}
