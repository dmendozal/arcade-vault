"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Game } from "@/lib/games";
import { useSession } from "@/components/session-provider";
import { submitScore } from "@/app/games/[id]/play/actions";
import {
  AsteroidsCanvas,
  type AsteroidsCanvasHandle,
} from "@/components/asteroids-canvas";

const LIVES = 3;
const POINTS_PER_LEVEL = 2500;

export function GamePlayer({ game }: { game: Game }) {
  const { user } = useSession();
  const isAsteroids = game.id === "asteroids";
  const asteroidsRef = useRef<AsteroidsCanvasHandle>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [engineLevel, setEngineLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  // null = el jugador no ha editado el nombre; se usa el de la sesión o INVITADO.
  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const name = nameEdit ?? user?.name ?? "INVITADO";
  const level = isAsteroids
    ? engineLevel
    : 1 + Math.floor(score / POINTS_PER_LEVEL);

  useEffect(() => {
    // Asteroids tiene su propio motor: no usa el puntaje simulado.
    if (isAsteroids || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [isAsteroids, over, paused]);

  const restart = () => {
    if (isAsteroids) {
      // El motor reinicia y notifica puntaje, vidas y nivel por sus callbacks.
      asteroidsRef.current?.restart();
    } else {
      setScore(0);
    }
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaveError(null);
  };

  const togglePause = (button: HTMLButtonElement) => {
    // Evita que Espacio vuelva a activar el botón enfocado durante el juego.
    button.blur();
    const next = !paused;
    setPaused(next);
    if (isAsteroids) {
      if (next) asteroidsRef.current?.pause();
      else asteroidsRef.current?.resume();
    }
  };

  const finish = (button: HTMLButtonElement) => {
    button.blur();
    if (isAsteroids) asteroidsRef.current?.endGame(); // dispara onGameOver
    else setOver(true);
  };

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    setPaused(false);
    setOver(true);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await submitScore({ gameId: game.id, name, score });
      if (result.ok) setSaved(true);
      else setSaveError(result.error);
    } catch {
      setSaveError("No se pudo guardar la puntuación. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button
            className="btn yellow"
            onClick={(e) => togglePause(e.currentTarget)}
          >
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button
            className="btn magenta"
            onClick={(e) => finish(e.currentTarget)}
          >
            FIN
          </button>
          <Link href={`/games/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {isAsteroids ? (
            <AsteroidsCanvas
              ref={asteroidsRef}
              onScore={setScore}
              onLives={setLives}
              onLevel={setEngineLevel}
              onGameOver={handleGameOver}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {isAsteroids && (
        <>
          <p className="controls-note">
            <span>
              <kbd>←</kbd> <kbd>→</kbd> girar
            </span>
            <span>
              <kbd>↑</kbd> propulsar
            </span>
            <span>
              <kbd>Espacio</kbd> disparar
            </span>
          </p>
          <p className="touch-notice">
            Este juego requiere teclado. En pantallas táctiles no se puede jugar.
          </p>
        </>
      )}

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setNameEdit(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                  maxLength={10}
                  disabled={saving}
                />
                <button
                  className="btn yellow"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? "GUARDANDO…"
                    : saveError
                      ? "REINTENTAR"
                      : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            {!saved && saveError && (
              <div
                role="alert"
                className="mono"
                style={{
                  color: "var(--magenta)",
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  margin: "12px 0",
                }}
              >
                ▸ {saveError}
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/library" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
