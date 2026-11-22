import type { MetadataRoute } from "next";

/** Instalace na plochu telefonu (PWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "iRemeslo.cz – zakázky, nabídky a faktury",
    short_name: "iRemeslo",
    description: "Řemeslná práce pod kontrolou: zakázky, nabídky, faktury a zisk z telefonu.",
    start_url: "/app",
    display: "standalone",
    background_color: "#F4F6F9",
    theme_color: "#05264C",
    lang: "cs",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
