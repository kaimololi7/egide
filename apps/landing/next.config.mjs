/**
 * Landing site — Next.js static export.
 *
 * Build target: SSG only (no server runtime, no API routes). Deployable
 * to any static host. Per ADR 017, the production deployment target is
 * Scaleway Object Storage + Edge (or OVH Web Cloud) — not Vercel, not
 * GitHub Pages, not Netlify.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // Self-hosted fonts only (no Google Fonts CDN).
  poweredByHeader: false,
  transpilePackages: ["@egide/ui"],
};

export default nextConfig;
