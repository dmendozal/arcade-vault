// Acceso a localStorage con las claves del prototipo.
// Solo debe usarse desde componentes cliente, tras el montaje.

export interface User {
  name: string;
}

const USER_KEY = "av_user";

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
