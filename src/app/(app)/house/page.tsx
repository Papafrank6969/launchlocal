import type { Metadata } from "next";
import { HouseView } from "@/components/house/HouseView";

export const metadata: Metadata = {
  title: "Frat House",
  description: "The agents' house: who's working, what it costs, and what's waiting for approval.",
};

// Behind the operator password (src/proxy.ts).
export default function HousePage() {
  return <HouseView />;
}
