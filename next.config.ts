import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // why: stops Next from generating AGENTS.md / CLAUDE.md agent-rule files in
  // the repository on `next dev`.
  agentRules: false,
};

export default nextConfig;
