import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@qoder-live-lab/contracts"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
