import { Suspense } from "react";
import type { Metadata } from "next";
import { Library } from "@/components/library";
import { getGames } from "@/lib/data/games";

export const metadata: Metadata = {
  title: "Biblioteca · Arcade Vault",
  description: "Explora el catálogo de juegos de Arcade Vault y compite por puntos.",
};

async function LibraryContent() {
  const games = await getGames();
  return <Library games={games} />;
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="fade-in" aria-busy="true" />}>
      <LibraryContent />
    </Suspense>
  );
}
