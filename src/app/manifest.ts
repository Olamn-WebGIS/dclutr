import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "D_clutr",
    short_name: "D_clutr",
    description: "D_clutr is a student-to-student marketplace for pre-loved finds around FUTA, Akure.",
    start_url: "/market",
    display: "standalone",
    background_color: "#f8f7f1",
    theme_color: "#244b39",
    orientation: "portrait",
    prefer_related_applications: false,
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
