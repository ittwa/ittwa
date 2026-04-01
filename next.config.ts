import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.ittwa.com",
      },
      {
        protocol: "https",
        hostname: "sleepercdn.com",
      },
    ],
  },
};

export default nextConfig;
