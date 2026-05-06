import type { Metadata } from "next";
import { Pricing } from "@/components/landing/Pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Community 0€ AGPL-3.0. Professional 8 000 €/year. Enterprise 30k–100k €/year. Annual pricing only, no contact-us tax.",
};

export default function PricingPage() {
  return (
    <div className="border-t border-border">
      <Pricing />
    </div>
  );
}
