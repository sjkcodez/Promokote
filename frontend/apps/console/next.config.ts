import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: [
    "@promokote/ui",
    "@promokote/api-client",
    "@promokote/auth",
    "@promokote/design-tokens",
  ],
  devIndicators: false, // <--- Add this line
};

export default nextConfig;
