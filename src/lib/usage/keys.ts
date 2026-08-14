/**
 * @project LLMira
 * @file src/lib/usage/keys.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function Stable usage-setting keys without loading the price catalog
 */
export function pricingOverrideKey(providerId: string, modelId: string) {
  return `${providerId}::${modelId}`;
}
