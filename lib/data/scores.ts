import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@/lib/supabase/public";

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "DD/MM/AAAA"
}

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

// Top scores of a game, ordered by score desc and then oldest first.
// `rank` is computed here, not stored. Invalidated with updateTag("scores").
export async function getTopScores(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]> {
  "use cache";
  cacheLife("days");
  cacheTag("scores");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`getTopScores: ${error.message}`);

  return data.map((row, i) => ({
    rank: i + 1,
    name: row.player_name,
    score: row.score,
    date: dateFormat.format(new Date(row.created_at)),
  }));
}
