/**
 * @project LLMira
 * @file src/test/setup.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @description Vitest DOM 断言初始化。
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
Element.prototype.scrollIntoView = () => undefined;

afterEach(() => cleanup());
