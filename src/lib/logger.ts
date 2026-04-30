/**
 * @project LLMira
 * @file src/lib/logger.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 提供分级结构化日志（debug/info/warn/error）
 *   - 捕获异常时使用 exception 保留堆栈语义
 * @description 全应用唯一推荐的日志入口；内部使用 console 作为输出_sink（仅此文件允许直接调用 console）。
 *   级别由 NEXT_PUBLIC_LOG_LEVEL 或 LOG_LEVEL 控制，默认 info。
 */

export type LogLevelName = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevelName, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function parseLevel(raw: string | undefined): LogLevelName {
  const n = String(raw ?? "").toLowerCase();
  if (n === "debug" || n === "info" || n === "warn" || n === "error") return n;
  return "info";
}

function readMinLevel(): LogLevelName {
  if (typeof process === "undefined") return "info";
  return parseLevel(process.env.NEXT_PUBLIC_LOG_LEVEL ?? process.env.LOG_LEVEL);
}

/** Why：模块加载时固定阈值，避免每次 log 解析 env。 */
const MIN_LEVEL = readMinLevel();

function shouldLog(level: LogLevelName): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[MIN_LEVEL];
}

function isProduction(): boolean {
  return typeof process !== "undefined" && process.env.NODE_ENV === "production";
}

function formatArgs(args: unknown[]): string {
  return args
    .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
    .join(" ");
}

type ParsedEmit =
  | { kind: "kv"; context: Record<string, unknown>; msg: string }
  | { kind: "text"; msg: string };

function parseEmitArgs(args: unknown[]): ParsedEmit {
  if (args.length === 0) return { kind: "text", msg: "" };
  if (args.length === 1 && typeof args[0] === "string") {
    return { kind: "text", msg: args[0] };
  }
  const first = args[0];
  const second = args[1];
  if (
    args.length >= 2 &&
    first !== null &&
    typeof first === "object" &&
    typeof second === "string"
  ) {
    return { kind: "kv", context: { ...(first as Record<string, unknown>) }, msg: second };
  }
  return { kind: "text", msg: formatArgs(args) };
}

function emit(level: LogLevelName, args: unknown[]): void {
  if (!shouldLog(level)) return;

  const parsed = parseEmitArgs(args);
  const time = new Date().toISOString();
  const payload: Record<string, unknown> = {
    level,
    time,
    msg: parsed.msg,
  };
  if (parsed.kind === "kv") {
    Object.assign(payload, parsed.context);
  }

  /* eslint-disable no-console -- 本模块为唯一允许的 console 汇聚点 */
  if (isProduction()) {
    const line = JSON.stringify(payload);
    switch (level) {
      case "debug":
        console.debug(line);
        break;
      case "info":
        console.info(line);
        break;
      case "warn":
        console.warn(line);
        break;
      case "error":
        console.error(line);
        break;
      default:
        console.log(line);
    }
    return;
  }

  const suffix =
    parsed.kind === "kv" && Object.keys(parsed.context).length > 0
      ? ` ${JSON.stringify(parsed.context)}`
      : "";
  const pretty = `${parsed.msg}${suffix}`;
  switch (level) {
    case "debug":
      console.debug(pretty);
      break;
    case "info":
      console.info(pretty);
      break;
    case "warn":
      console.warn(pretty);
      break;
    case "error":
      console.error(pretty);
      break;
    default:
      console.log(pretty);
  }
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),

  /**
   * 记录捕获的异常；Why：统一附加 stack，便于排查而不在各处手写。
   *
   * @param error 任意抛出的值，优先读取 Error 的 message/stack
   * @param message 人类可读说明，会写入日志 msg
   * @param extra 额外上下文（不含密钥）
   */
  exception(error: unknown, message = "exception", extra?: Record<string, unknown>): void {
    const base =
      error instanceof Error
        ? {
            errName: error.name,
            errMessage: error.message,
            stack: error.stack,
          }
        : { thrown: error };
    emit("error", [{ ...base, ...extra }, message]);
  },
};
