import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@qoder-live-lab/contracts"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
