import type { NextConfig } from "next";

// Baseline security headers on every response.
// - Pages can't be framed by other sites (clickjacking), but can frame themselves.
// - No plugins (<object>/<embed>) and no <base> hijacking.
// - Camera and microphone stay available to BoutCasts itself (in-app recording).
// A strict script allow-list isn't set here on purpose: YouTube, TikTok and
// Instagram embeds load their own scripts, and blocking them would break clips.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Matchups and Explore now live inside Discover. Old links keep working.
  async redirects() {
    return [
      { source: "/matchups", destination: "/discover?view=matchups", permanent: true },
      {
        source: "/explore",
        has: [{ type: "query", key: "category", value: "(?<category>.+)" }],
        destination: "/discover?view=events&category=:category",
        permanent: true,
      },
      { source: "/explore", destination: "/discover?view=events", permanent: true },
    ];
  },
};

export default nextConfig;
