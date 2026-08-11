import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: [
    "@resvg/resvg-js",
    "sharp",
    "satori",
    "bcryptjs",
  ],
};

export default nextConfig;
