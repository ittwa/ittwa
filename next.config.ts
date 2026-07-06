import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/auction-schema.ts reads migrations/0001_auction.sql at runtime to
  // auto-create the auction tables on first "Start Auction"; without this the
  // file wouldn't be traced into the serverless bundle.
  outputFileTracingIncludes: {
    "/api/auction/admin/start": ["./migrations/**"],
  },
  images: {
    // The Vercel Image Optimization quota is exhausted: every NEW
    // transformation returns 402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED and
    // the image breaks (only long-cached variants still serve, which is why
    // breakage appeared gradually as new widths/URLs were requested). All
    // images on this site are tiny Sleeper CDN avatars/thumbs that don't need
    // optimization — serve them as-is, directly from sleepercdn, like the
    // Sleeper app does. Remove this line only if the project moves to a plan
    // with image-optimization headroom.
    unoptimized: true,
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
