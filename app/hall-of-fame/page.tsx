import { Suspense } from "react";
import type { Metadata } from "next";
import { HallOfFame } from "@/components/hall-of-fame";
import { getGames } from "@/lib/data/games";

export const metadata: Metadata = {
  title: "Salón de la Fama · Arcade Vault",
  description: "Los mejores puntajes de cada juego en Arcade Vault.",
};

async function HallOfFameContent() {
  const games = await getGames();
  return <HallOfFame games={games} />;
}

export default function SalonPage() {
  return (
    <Suspense fallback={<div className="av-hall fade-in" aria-busy="true" />}>
      <HallOfFameContent />
    </Suspense>
  );
}
