/**
 * @project LLMira
 * @file src/app/page.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @description 静态导出兼容的团队工作台入口。
 */
import { TeamPortal } from "@/components/team/TeamPortal";

export default function Home() {
  return <TeamPortal />;
}
