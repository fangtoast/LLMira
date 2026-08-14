/**
 * @project LLMira
 * @file eslint.config.mjs
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @description Next.js 16 ESLint Flat Config。
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: [
      "src/components/chat/**/*.{ts,tsx}",
      "src/components/layout/**/*.{ts,tsx}",
      "src/components/markdown/**/*.{ts,tsx}",
      "src/components/modals/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
    ],
    rules: {
      // Next 16 enables this compiler-oriented rule; legacy UI synchronization is preserved until those modules are retired.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["apps/api/src/store/postgres.ts"],
    rules: {
      // Database rows are narrowed by dedicated map functions at the storage boundary.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "apps/*/dist/**", "src-tauri/target/**", "reference/**"]),
]);
