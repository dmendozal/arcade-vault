"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/session-provider";

type Section = "home" | "library" | "hall-of-fame" | "about" | "login";

function sectionOf(pathname: string): Section | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/library") || pathname.startsWith("/games")) return "library";
  if (pathname.startsWith("/hall-of-fame")) return "hall-of-fame";
  if (pathname.startsWith("/about")) return "about";
  if (pathname.startsWith("/login")) return "login";
  return null;
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const active = sectionOf(pathname);
  const cls = (s: Section) => (active === s ? "active" : undefined);
  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={cls("home")}>
            Inicio
          </Link>
          <Link href="/library" className={cls("library")}>
            Biblioteca
          </Link>
          <Link href="/hall-of-fame" className={cls("hall-of-fame")}>
            Salón de la Fama
          </Link>
          <Link href="/about" className={cls("about")}>
            Acerca de
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={signOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/login" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENÚ
        </div>
        <Link href="/" className={cls("home")} onClick={close}>
          Inicio
        </Link>
        <Link href="/library" className={cls("library")} onClick={close}>
          Biblioteca
        </Link>
        <Link href="/hall-of-fame" className={cls("hall-of-fame")} onClick={close}>
          Salón de la Fama
        </Link>
        <Link href="/about" className={cls("about")} onClick={close}>
          Acerca de
        </Link>
        <Link href="/login" className={cls("login")} onClick={close}>
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
