import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SHUT10 — Shut the Box party game",
    short_name: "SHUT10",
    description: "Roll. Think. Shut. Multiplayer Shut the Box for 2–4 phones.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07120d",
    theme_color: "#07120d",
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
