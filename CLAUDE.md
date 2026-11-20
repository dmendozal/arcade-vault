# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

- `npm run dev` — servidor de desarrollo en http://localhost:3000
- `npm run build` / `npm start` — build de producción y servidor
- `npm run lint` — ESLint (`eslint-config-next` core-web-vitals + typescript)
- No hay framework de tests configurado.

## Next.js no estándar

`AGENTS.md` advierte que esta versión (Next 16.4.6, React 19.3) tiene cambios incompatibles respecto al conocimiento previo. Antes de escribir código de Next, leer la guía relevante en `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`; empezar por `index.md`). Respetar los avisos de deprecación. El bloque de `AGENTS.md` lo regenera `next dev`.

Configuración relevante en `next.config.ts`: `cacheComponents: true`, `partialPrefetching: true`, `experimental.agentFeedback`, y una regla de Turbopack que procesa `*.css` con `@tailwindcss/turbopack` (Tailwind v4, importado vía `@import "tailwindcss"` en `app/globals.css`, sin `tailwind.config`). Alias de path: `@/*` → raíz del repo. En `app/layout.tsx` se usa el tipo global `LayoutProps<"/">`.

## Estado del proyecto

`app/` (App Router) sigue siendo el scaffold de create-next-app (`page.tsx` y metadata por defecto). El producto, "Arcade Vault · Portal Retro" (plataforma para jugar online y competir por puntos, UI en español), existe solo como prototipo de referencia en `references/templates/` (trackeado en git), que debe portarse a Next/TypeScript.

El `README.md` indica que el proyecto sigue Spec Driven Design (comandos `/spec` y `/spec-impl`, skills de `Klerith/fernando-skills`, instaladas con `npx skills@latest add Klerith/fernando-skills`).

## Prototipo de referencia (`references/templates/`)

- `Arcade Vault.html` — standalone: React 18 UMD + Babel standalone, carga los `.jsx` como `text/babel` en orden (data → nav → biblioteca → detalle → reproductor → auth → salon → app). Fuentes: Press Start 2P, Courier Prime, JetBrains Mono.
- Los `.jsx` comparten scope global (sin módulos): por eso `app.jsx` renombra hooks (`useStateApp`, etc.) para evitar colisiones. Al portar, convertir a módulos/componentes reales.
- `data.jsx` — datos mock (`GAMES`: id, title, cat, cover, color, best, plays…).
- `app.jsx` — router casero: la ruta es un objeto `{name, ...}` serializado en `location.hash`; la sesión vive en `localStorage["av_user"]` y los puntajes en `localStorage["av_scores"]`. Al portar, esto es estado solo de cliente (requiere `"use client"`) y debe encajar con el modelo de routing y cache de Next en vez de replicar el hash.
- Pantallas: `biblioteca` (catálogo), `detalle`, `reproductor` (jugar), `auth`, `salon` (ranking); `nav.jsx` es la barra de navegación.
- `styles.css` (~950 líneas) — todo el estilo del prototipo (clases `av-*`, covers `cover-*`).
