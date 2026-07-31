import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IBC Membros",
    short_name: "IBC",
    description: "Gestão de membros, grupos e eventos da igreja",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f5",
    theme_color: "#176b4d",
    icons: [
      { src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
  };
}
