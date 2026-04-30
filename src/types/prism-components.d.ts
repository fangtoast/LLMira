/**
 * Prism 按需语言包的模块声明。
 *
 * @remarks Why：TypeScript 无法解析 `prismjs/components/*` 路径；声明后可按需 import。
 * 工程约定见仓库 `docs/engineering/CONTRIBUTING.md`。
 */
declare module "prismjs/components/prism-javascript";
declare module "prismjs/components/prism-typescript";
declare module "prismjs/components/prism-json";
declare module "prismjs/components/prism-bash";
