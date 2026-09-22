import type { MetadataRoute } from "next";

const BASE_URL = "https://www.boutcasts.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/matchups",
    "/leaderboard",
    "/sponsor",
    "/how-it-works",
    "/submit",
    "/search",
    "/login",
    "/signup",
    "/privacy",
    "/terms",
  ];

  return staticRoutes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "hourly" : "daily",
    priority: route === "" ? 1 : 0.6,
  }));
}
