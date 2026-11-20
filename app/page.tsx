import type { Metadata } from "next";
import { Library } from "@/components/library";

export const metadata: Metadata = {
  title: "Arcade Vault · Portal Retro",
  description: "Juega online y compite por puntos en Arcade Vault.",
};

export default function Home() {
  return <Library />;
}
