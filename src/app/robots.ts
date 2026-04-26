import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin"] },
    ],
    sitemap: "https://school-37.com/sitemap.xml",
  };
}
