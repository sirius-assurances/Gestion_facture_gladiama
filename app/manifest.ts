import type { MetadataRoute } from "next";

/** Next.js serves this at /manifest.webmanifest — what makes "Ajouter à l'écran d'accueil" available on Android/Chrome. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gladiama Factures",
    short_name: "Gladiama",
    description: "Générez vos factures GLADIAMA en quelques secondes.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f4f0",
    theme_color: "#172238",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
