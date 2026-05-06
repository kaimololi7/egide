/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict React
  reactStrictMode: true,

  // Standalone output for minimal container image (cf. apps/web/Dockerfile).
  // Produces .next/standalone/server.js + .next/static.
  output: "standalone",

  // Transpile workspace packages
  transpilePackages: ["@egide/ui", "@egide/api"],

  // Security headers (cf. ADR 014 §A05)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  // Disable powered-by header
  poweredByHeader: false,
};

export default nextConfig;
