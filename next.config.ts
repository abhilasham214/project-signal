import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // why: Next generates its own AGENTS.md/CLAUDE.md on dev start, which would
  // overwrite the development guide maintained in this repository.
  agentRules: false,
};

export default nextConfig;
