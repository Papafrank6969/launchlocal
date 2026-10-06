import type { Metadata } from "next";
import { HouseView } from "@/components/house/HouseView";

export const metadata: Metadata = {
  title: "The Villa",
  description: "The social media agents' house: posts written, rendered and published.",
};

// Behind the operator password (src/proxy.ts).
export default function VillaPage() {
  return <HouseView house="villa" />;
}
