import type { MetadataRoute } from "next";

const SITE_URL = "https://egide.io";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Block app surface from indexing — only marketing + docs are public.
        disallow: ["/api/", "/dashboard/", "/_next/"],
      },
      // Block known AI scrapers per current best practice. Configurable per
      // editor preference ; remove if you wish to be indexed by these.
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "ClaudeBot", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "PerplexityBot", disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
