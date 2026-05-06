import type { MetadataRoute } from "next";

const SITE_URL = "https://egide.io";

/**
 * Static sitemap. ADR documents are listed by ID (cf. docs/adr/).
 * Updated manually when a new ADR ships ; small enough to not warrant
 * a generator.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const adrIds = [
    "001-foundation",
    "002-licensing-strategy",
    "003-stack-decision",
    "004-multi-llm-router",
    "005-policy-as-code-multi-target",
    "006-graph-persistence",
    "007-rag-normative",
    "008-job-queue",
    "009-eval-framework",
    "010-approval-workflow",
    "011-agent-strategy",
    "012-terminology",
    "013-mvp-persona",
    "014-security-by-design",
    "015-architectural-principles",
    "016-secure-sdlc",
    "017-frontend-identity",
  ];

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, priority: 1, changeFrequency: "weekly" },
    { url: `${SITE_URL}/pricing`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${SITE_URL}/docs`, priority: 0.9, changeFrequency: "weekly" },
    { url: `${SITE_URL}/docs/install`, priority: 0.9, changeFrequency: "weekly" },
    { url: `${SITE_URL}/docs/architecture`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${SITE_URL}/docs/security`, priority: 0.8, changeFrequency: "monthly" },
    { url: `${SITE_URL}/docs/api`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${SITE_URL}/docs/editions`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${SITE_URL}/docs/roadmap`, priority: 0.6, changeFrequency: "weekly" },
    { url: `${SITE_URL}/docs/adr`, priority: 0.7, changeFrequency: "weekly" },
    { url: `${SITE_URL}/changelog`, priority: 0.5, changeFrequency: "weekly" },
    { url: `${SITE_URL}/about`, priority: 0.4, changeFrequency: "yearly" },
    { url: `${SITE_URL}/contact`, priority: 0.4, changeFrequency: "yearly" },
    { url: `${SITE_URL}/legal`, priority: 0.3, changeFrequency: "yearly" },
  ];

  const adrPages: MetadataRoute.Sitemap = adrIds.map((id) => ({
    url: `${SITE_URL}/docs/adr/${id}`,
    priority: 0.5,
    changeFrequency: "monthly",
  }));

  return staticPages
    .map((p) => ({ ...p, lastModified: now }))
    .concat(adrPages.map((p) => ({ ...p, lastModified: now })));
}
