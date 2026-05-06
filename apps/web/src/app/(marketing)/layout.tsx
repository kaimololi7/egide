/**
 * Shared layout for all marketing-site routes outside the dashboard.
 * Keeps header / footer consistent across /docs, /pricing, /about, etc.
 */

import { LandingFooter, LandingHeader } from "@/components/landing/Layout";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LandingHeader />
      <main id="main" className="min-h-[calc(100vh-3rem)]">
        {children}
      </main>
      <LandingFooter />
    </>
  );
}
