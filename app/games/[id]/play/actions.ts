"use server";

import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SubmitScoreResult = { ok: true } | { ok: false; error: string };

const MAX_SCORE = 1_000_000;
const MAX_NAME_LENGTH = 10;

const GENERIC_ERROR = "No se pudo guardar la puntuación. Inténtalo de nuevo.";

export async function submitScore(input: {
  gameId: string;
  name: string;
  score: number;
}): Promise<SubmitScoreResult> {
  try {
    const gameId = typeof input?.gameId === "string" ? input.gameId : "";
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    const score = input?.score;

    if (!gameId) return { ok: false, error: "Juego no válido." };
    if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
      return {
        ok: false,
        error: `El nombre debe tener entre 1 y ${MAX_NAME_LENGTH} caracteres.`,
      };
    }
    if (!Number.isInteger(score) || score < 1 || score > MAX_SCORE) {
      return { ok: false, error: "Puntuación no válida." };
    }

    const supabase = await createClient();

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("id", gameId)
      .maybeSingle();
    if (gameError) return { ok: false, error: GENERIC_ERROR };
    if (!game) return { ok: false, error: "Juego no válido." };

    const { error } = await supabase
      .from("scores")
      .insert({ game_id: gameId, player_name: name, score });
    if (error) return { ok: false, error: GENERIC_ERROR };

    updateTag("scores");
    return { ok: true };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}
