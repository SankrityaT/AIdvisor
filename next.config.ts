import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not emit AGENTS.md / CLAUDE.md scaffolding into the repo.
  agentRules: false,
  /* config options here */
};

export default nextConfig;
