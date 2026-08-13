/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    resolveAlias: {
      canvas: {
        browser: "./src/lib/empty-module.ts",
      },
    },
  },
};

export default nextConfig;
