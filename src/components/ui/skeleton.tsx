/** @project LLMira @file src/components/ui/skeleton.tsx @author fangtoast <fangtoast@foxmail.com> @date 2026-08-14 @description 加载占位骨架。 */
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  )
}

export { Skeleton }
