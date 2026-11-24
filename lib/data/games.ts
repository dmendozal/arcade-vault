import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@/lib/supabase/public";
import type { AccentColor, Category, Game } from "@/lib/games";

// Catalog + stats. Tagged with both "games" (catalog) and "scores" because
// each Game embeds `best` and `plays` derived from the scores table.
// Uses the cookie-less client: cookies() is not allowed inside `use cache`.
export async function getGames(): Promise<Game[]> {
  "use cache";
  cacheLife("days");
  cacheTag("games", "scores");

  const supabase = createClient();
  const [gamesRes, statsRes] = await Promise.all([
    supabase.from("games").select("*").order("sort_order", { ascending: true }),
    supabase.from("game_stats").select("game_id, plays, best"),
  ]);

  if (gamesRes.error) throw new Error(`getGames: ${gamesRes.error.message}`);
  if (statsRes.error) throw new Error(`getGames: ${statsRes.error.message}`);

  const stats = new Map(
    statsRes.data.map((s) => [s.game_id, { plays: s.plays ?? 0, best: s.best }]),
  );

  return gamesRes.data.map((g) => ({
    id: g.id,
    title: g.title,
    short: g.short,
    long: g.long,
    cat: g.category as Category,
    cover: g.cover,
    color: g.color as AccentColor,
    best: stats.get(g.id)?.best ?? null,
    plays: stats.get(g.id)?.plays ?? 0,
  }));
}

export async function getGame(id: string): Promise<Game | null> {
  "use cache";
  cacheLife("days");
  cacheTag("games", "scores");

  const games = await getGames();
  return games.find((g) => g.id === id) ?? null;
}
