import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGame, getGames } from "@/lib/data/games";
import { GamePlayer } from "@/components/game-player";

export async function generateStaticParams() {
  const games = await getGames();
  return games.map((g) => ({ id: g.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/games/[id]/play">): Promise<Metadata> {
  const { id } = await params;
  const game = await getGame(id);
  return game ? { title: `Jugando ${game.title} · Arcade Vault` } : {};
}

export default function PlayPage({ params }: PageProps<"/games/[id]/play">) {
  // `params` se lee dentro del límite de Suspense para no atar el shell a una URL.
  return (
    <Suspense fallback={<div className="av-player" aria-busy="true" />}>
      <Player params={params} />
    </Suspense>
  );
}

async function Player({
  params,
}: {
  params: PageProps<"/games/[id]/play">["params"];
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();
  return <GamePlayer game={game} />;
}
