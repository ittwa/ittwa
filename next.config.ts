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
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
