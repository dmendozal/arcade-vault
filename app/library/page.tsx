import type { Metadata } from "next";
import { Library } from "@/components/library";

export const metadata: Metadata = {
  title: "Biblioteca · Arcade Vault",
  description: "Explora el catálogo de juegos de Arcade Vault y compite por puntos.",
};

export default function LibraryPage() {
  return <Library />;
}
