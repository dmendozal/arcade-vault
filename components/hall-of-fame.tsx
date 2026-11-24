"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Game } from "@/lib/games";
import { seededScores, type ScoreRow } from "@/lib/scores";
import { parseScores, readScoresRaw } from "@/lib/storage";
import { useSession } from "@/components/session-provider";

const ROWS = 12;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

const fmt = (n: number) => n.toLocaleString("es-ES");

function formatDate(ts: number) {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function HallOfFame({ games }: { games: Game[] }) {
  const { user } = useSession();
  const [tab, setTab] = useState(games[0].id);
  // Servidor y primer render del cliente: null (sin puntajes locales) -> sin desajuste de hidratación.
  const rawScores = useSyncExternalStore(subscribe, readScoresRaw, () => null);

  const game = games.find((g) => g.id === tab) ?? games[0];

  const saved = useMemo(
    () => parseScores(rawScores).filter((s) => s.game === tab),
    [rawScores, tab],
  );

  const all: ScoreRow[] = useMemo(() => {
    const mock = seededScores(tab.length * 23 + 7, ROWS);
    const local: ScoreRow[] = saved.map((s) => ({
      rank: 0,
      name: s.name,
      score: s.score,
      date: formatDate(s.at),
    }));
    return [...mock, ...local]
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [tab, saved]);

  const rows = all.slice(0, ROWS);

  const best = useMemo(() => {
    if (saved.length === 0) return null;
    const top = saved.reduce((a, b) => (b.score > a.score ? b : a));
    const rank =
      all.findIndex((r) => r.score === top.score && r.name === top.name) + 1;
    return { score: top.score, rank, date: formatDate(top.at) };
  }, [saved, all]);

  const slot = (i: number) => rows[i];

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
          <div className="score">{fmt(slot(1).score)}</div>
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
            {fmt(slot(0).score)}
          </div>
          <div className="date">{slot(0).date}</div>
        </div>
        <div className="podium-slot bronze">
          <div className="rank-num">03</div>
          <div className="name">{slot(2).name}</div>
          <div className="score">{fmt(slot(2).score)}</div>
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
        {user && best && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
            <div
              className="tr you"
              style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
            >
              <div className="rk" style={{ color: "var(--yellow)" }}>
                #{String(best.rank).padStart(2, "0")}
              </div>
              <div className="pl" style={{ color: "var(--yellow)" }}>
                {user.name}
              </div>
              <div
                className="sc"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                {fmt(best.score)}
              </div>
              <div className="dt">{best.date}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/library" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
