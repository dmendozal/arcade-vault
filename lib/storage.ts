// Acceso a localStorage con las claves del prototipo.
// Solo debe usarse desde componentes cliente, tras el montaje.

export interface User {
  name: string;
}

export interface SavedScore {
  game: string;
  score: number;
  name: string;
  at: number;
}

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

export function readUser(): User | null {
  try {
    const raw = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    if (raw && typeof raw.name === "string") return { name: raw.name };
  } catch {}
  return null;
}

export function writeUser(user: User | null): void {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {}
}

export function readScores(): SavedScore[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SCORES_KEY) || "[]");
    if (Array.isArray(raw)) {
      return raw.filter(
        (s): s is SavedScore =>
          s &&
          typeof s.game === "string" &&
          typeof s.score === "number" &&
          typeof s.name === "string" &&
          typeof s.at === "number",
      );
    }
  } catch {}
  return [];
}

export function appendScore(entry: Omit<SavedScore, "at">): void {
  try {
    const all = readScores();
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {}
}
