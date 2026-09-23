import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Repository governance is maintained by the project owner.
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
