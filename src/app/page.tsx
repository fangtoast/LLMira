/**
 * @project LLMira
 * @file src/app/page.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @description 根路径重定向至 `/chat`。
 */
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/chat");
}
