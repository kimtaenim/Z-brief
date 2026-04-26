import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["172.30.1.95", "192.168.0.0/16", "10.0.0.0/8"],
  experimental: {
    serverActions: { allowedOrigins: ["*"] },
  },
};

export default nextConfig;
