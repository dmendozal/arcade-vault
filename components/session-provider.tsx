"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  appendScore,
  readUser,
  writeUser,
  type SavedScore,
  type User,
} from "@/lib/storage";

interface SessionContextValue {
  /** null = invitado o aún sin hidratar */
  user: User | null;
  login: (user: User | null) => void;
  signOut: () => void;
  saveScore: (entry: Omit<SavedScore, "at">) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // Empieza en null para coincidir con el HTML del servidor; se hidrata tras el montaje.
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Hidratación única desde un sistema externo (localStorage) tras el montaje.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(readUser());
  }, []);

  const login = useCallback((next: User | null) => {
    setUser(next);
    writeUser(next);
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    writeUser(null);
  }, []);

  const saveScore = useCallback((entry: Omit<SavedScore, "at">) => {
    appendScore(entry);
  }, []);

  const value = useMemo(
    () => ({ user, login, signOut, saveScore }),
    [user, login, signOut, saveScore],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
