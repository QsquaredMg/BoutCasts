import type { MetadataRoute } from "next";

// Makes boutcasts.com installable ("Add to Home Screen"). Android builds its
// launch splash from background_color + the 512 icon; iOS uses the
// apple-touch-startup-image links declared in layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BoutCasts",
    short_name: "BoutCasts",
    description: "Live voting and head-to-head competition platform.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0e1a",
    theme_color: "#0a0e1a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
