import { Suspense } from "react";
import type { Metadata } from "next";
import { HallOfFame } from "@/components/hall-of-fame";
import { getGames } from "@/lib/data/games";
import { getTopScores } from "@/lib/data/scores";

export const metadata: Metadata = {
  title: "Salón de la Fama · Arcade Vault",
  description: "Los mejores puntajes de cada juego en Arcade Vault.",
};

const ROWS = 12;

async function HallOfFameContent() {
  const games = await getGames();
  const tops = await Promise.all(games.map((g) => getTopScores(g.id, ROWS)));
  const scoresByGame = Object.fromEntries(games.map((g, i) => [g.id, tops[i]]));
  return <HallOfFame games={games} scoresByGame={scoresByGame} />;
}

export default function SalonPage() {
  return (
    <Suspense fallback={<div className="av-hall fade-in" aria-busy="true" />}>
      <HallOfFameContent />
    </Suspense>
  );
}
