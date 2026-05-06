/**
 * Landing page.
 *
 * All 7 sections shipped (cf. docs/landing-blueprint.md).
 */

import { Hero } from "@/components/landing/Hero";
import { HowWeBuildIt } from "@/components/landing/HowWeBuildIt";
import { Integrations } from "@/components/landing/Integrations";
import { LandingFooter, LandingHeader } from "@/components/landing/Layout";
import { LiveStatus } from "@/components/landing/LiveStatus";
import { Pricing } from "@/components/landing/Pricing";
import { ShowMeTheCode } from "@/components/landing/ShowMeTheCode";
import { Sovereignty } from "@/components/landing/Sovereignty";
import { StandardsBar } from "@/components/landing/StandardsBar";
import { WhatItDoes } from "@/components/landing/WhatItDoes";

export default function HomePage() {
  return (
    <>
      <LandingHeader />
      <main id="main" className="min-h-screen flex flex-col">
        <Hero />
        <LiveStatus />
        <StandardsBar />
        <WhatItDoes />
        <ShowMeTheCode />
        <Sovereignty />
        <Integrations />
        <HowWeBuildIt />
        <Pricing />
      </main>
      <LandingFooter />
    </>
  );
}
