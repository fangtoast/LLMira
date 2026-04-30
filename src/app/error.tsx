"use client";

/**
 * @project LLMira
 * @file src/app/error.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 全局路由错误边界 UI 与日志
 * @description Next.js `error.tsx`；错误经 `logger.exception` 记录。
 */
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.exception(error, "global route error");
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">页面出现异常</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>重试</Button>
    </div>
  );
}
