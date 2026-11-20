import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CUEVA · Un lugar para avanzar",
    short_name: "CUEVA",
    description: "El espacio digital de CUEVA.",
    lang: "es-AR",
    start_url: "/cuenta",
    scope: "/",
    display: "standalone",
    background_color: "#f6f6f3",
    theme_color: "#f6f6f3",
    icons: [
      { src: "/api/pwa/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/api/pwa/icon/512", sizes: "512x512", type: "image/png" },
      {
        src: "/brand/cueva-symbol.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
