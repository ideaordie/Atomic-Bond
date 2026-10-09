import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atomic Bond",
    short_name: "Atomic Bond",
    description: "See how connected we already are.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/atom-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/atom-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/atom-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
