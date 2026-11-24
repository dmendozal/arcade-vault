"use client";

import { useState } from "react";
import Link from "next/link";
import type { Game } from "@/lib/games";
import type { ScoreRow } from "@/lib/data/scores";

const fmt = (n: number) => n.toLocaleString("es-ES");

const EMPTY_SLOT = { name: "—", score: "—", date: "\u00A0" };

export function HallOfFame({
  games,
  scoresByGame,
  initialTab,
}: {
  games: Game[];
  scoresByGame: Record<string, ScoreRow[]>;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(
    games.some((g) => g.id === initialTab) ? initialTab! : (games[0]?.id ?? ""),
  );

  const rows = scoresByGame[tab] ?? [];

  // Puestos vacíos del podio muestran "—" (con 0, 1 o 2 filas).
  const slot = (i: number) => {
    const r = rows[i];
    return r
      ? { name: r.name, score: fmt(r.score), date: r.date }
      : EMPTY_SLOT;
  };

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      <div className="podium">
        <div className="podium-slot silver">
          <div className="rank-num">02</div>
          <div className="name">{slot(1).name}</div>
          <div className="score">{slot(1).score}</div>
          <div className="date">{slot(1).date}</div>
        </div>
        <div className="podium-slot gold">
          <div
            className="pixel"
            style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}
          >
            CAMPEÓN
          </div>
          <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
            01
          </div>
          <div className="name">{slot(0).name}</div>
          <div className="score" style={{ fontSize: 20 }}>
            {slot(0).score}
          </div>
          <div className="date">{slot(0).date}</div>
        </div>
        <div className="podium-slot bronze">
          <div className="rank-num">03</div>
          <div className="name">{slot(2).name}</div>
          <div className="score">{slot(2).score}</div>
          <div className="date">{slot(2).date}</div>
        </div>
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.length === 0 && (
          <div
            className="tr"
            style={{
              display: "block",
              textAlign: "center",
              padding: "32px 16px",
              color: "var(--ink-faint)",
            }}
          >
            <span className="pixel" style={{ fontSize: 11, color: "var(--magenta)" }}>
              AÚN NO HAY PUNTAJES · SÉ EL PRIMERO
            </span>
          </div>
        )}
        {rows.map((r, i) => (
          <div
            key={`${r.name}-${r.score}-${i}`}
            className={
              "tr" +
              (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
            }
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{fmt(r.score)}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/library" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
