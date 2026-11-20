import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404 · Arcade Vault",
};

export default function NotFound() {
  return (
    <section className="av-hero fade-in">
      <h1 className="flicker">404</h1>
      <div className="sub">
        JUEGO NO ENCONTRADO · GAME OVER <span className="blink">_</span>
      </div>
      <div style={{ marginTop: 32 }}>
        <Link href="/" className="btn lg">
          VOLVER AL VAULT
        </Link>
      </div>
    </section>
  );
}
