import type { MetadataRoute } from "next";

// Every page on this site is server-rendered on demand, so each crawler hit
// is a Vercel Function invocation that counts against the Hobby plan's CPU
// limit (the project was paused for exceeding it in Nov 2026). This is a
// private league site with no need for search traffic beyond the homepage:
//   • AI/data-scraping crawlers are blocked entirely.
//   • Everyone else may index the top-level pages but not the thousands of
//     per-player pages or the API routes.
// robots.txt is advisory: well-behaved bots honour it; for the rest, Vercel's
// Firewall (Bot Protection / AI Bots managed rules) is the enforcement layer.
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Bytespider",
  "PerplexityBot",
  "Amazonbot",
  "Applebot-Extended",
  "meta-externalagent",
  "Diffbot",
  "ImagesiftBot",
  "omgili",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_CRAWLERS, disallow: "/" },
      { userAgent: "*", allow: "/", disallow: ["/players/", "/api/", "/auction/admin"] },
    ],
  };
}
