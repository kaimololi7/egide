import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { HowWeBuildIt } from "@/components/HowWeBuildIt";
import { Pricing } from "@/components/Pricing";
import { ShowMeTheCode } from "@/components/ShowMeTheCode";
import { Sovereignty } from "@/components/Sovereignty";
import { WhatItDoes } from "@/components/WhatItDoes";

export default function Page() {
  return (
    <main>
      <Hero />
      <WhatItDoes />
      <ShowMeTheCode />
      <Sovereignty />
      <HowWeBuildIt />
      <Pricing />
      <Footer />
    </main>
  );
}
