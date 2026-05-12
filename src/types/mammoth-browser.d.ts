/**
 * @project LLMira
 * @file src/types/mammoth-browser.d.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-05-12
 * @description mammoth 浏览器打包入口未带类型声明，补充以供客户端动态 import。
 */
declare module "mammoth/mammoth.browser" {
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
}
