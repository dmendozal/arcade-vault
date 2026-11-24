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

`app/` (App Router) ya implementa el producto "Arcade Vault · Portal Retro" (plataforma para jugar online y competir por puntos, UI en español): landing, `/library`, `/games/[id]`, `/games/[id]/play`, `/hall-of-fame`, `/about`, `/login`. Asteroids (SPEC 05), Tetris (SPEC 07), Arkanoid (SPEC 08) y Snake (SPEC 09, `id = 'serpentina'`, que reemplazó al mock del mismo id) tienen motor real; el resto de juegos, incluidos los mocks `caida` (que convive con `tetris`) y `bloque-buster` (que convive con `arkanoid`), usa un reproductor simulado. Cada motor vive en `lib/games/<juego>/` (TypeScript sin globals, `createXEngine(canvas, callbacks)`) con un componente de canvas delgado en `components/`; el registro `lib/games/registry.ts` (`GAME_REGISTRY`: id → canvas, `hasLives`, nota de controles) lo usa `components/game-player.tsx` para despachar, así que un juego nuevo con motor es una entrada más. Tetris tiene 7 piezas (sin la tuerca N de la referencia), tope de puntaje de 1.000.000 en el motor y nivel propio (`floor(líneas / 10) + 1`). Arkanoid usa spritesheet y sonidos servidos desde `public/games/arkanoid/` (el motor crea `Image` y `Audio` en `start()`), tiene 3 vidas, 5 niveles propios (`lib/games/arkanoid/levels.ts`), control con teclado y ratón, y termina al quedarse sin vidas o al limpiar el nivel 5 (máximo 2.080 puntos, sin tope en el motor). Snake (`lib/games/snake/`) es un juego original sin referencia: tablero de 20×15 celdas de 40 px, muros mortales y sin vidas, 10 puntos por fruta, nivel propio `floor(frutas / 5) + 1` con tick de 140 ms (−8 ms por nivel, mínimo 70 ms), cola de 2 giros sin giro de 180° y victoria al llenar las 300 celdas (máximo 2.970 puntos, sin tope en el motor); las 22 frutas pixel-art se sirven desde `public/games/snake/fruits.png` (el motor crea la `Image` en `start()`), y la serpiente y el tablero se dibujan con primitivas de canvas. El prototipo original sigue en `references/templates/` (trackeado en git) como referencia visual.

El catálogo y los puntajes viven en Supabase (SPEC 06): la capa de lectura está en `lib/data/` (`getGames`, `getGame`, `getTopScores`, con `use cache` y los tags `games` y `scores`) y los puntajes se guardan con la Server Action `submitScore` (`app/games/[id]/play/actions.ts`), que invalida el tag `scores` con `updateTag`. `lib/games.ts` solo conserva tipos y `CATS`. La sesión sigue siendo `localStorage["av_user"]` (solo cliente, hasta el spec de Auth).

El `README.md` indica que el proyecto sigue Spec Driven Design (comandos `/spec` y `/spec-impl`, skills de `Klerith/fernando-skills`, instaladas con `npx skills@latest add Klerith/fernando-skills`).

## Prototipo de referencia (`references/templates/`)

- `Arcade Vault.html` — standalone: React 18 UMD + Babel standalone, carga los `.jsx` como `text/babel` en orden (data → nav → biblioteca → detalle → reproductor → auth → salon → app). Fuentes: Press Start 2P, Courier Prime, JetBrains Mono.
- Los `.jsx` comparten scope global (sin módulos): por eso `app.jsx` renombra hooks (`useStateApp`, etc.) para evitar colisiones. Al portar, convertir a módulos/componentes reales.
- `data.jsx` — datos mock (`GAMES`: id, title, cat, cover, color, best, plays…).
- `app.jsx` — router casero: la ruta es un objeto `{name, ...}` serializado en `location.hash`; la sesión vive en `localStorage["av_user"]` y los puntajes en `localStorage["av_scores"]`. Al portar, esto es estado solo de cliente (requiere `"use client"`) y debe encajar con el modelo de routing y cache de Next en vez de replicar el hash.
- Pantallas: `biblioteca` (catálogo), `detalle`, `reproductor` (jugar), `auth`, `salon` (ranking); `nav.jsx` es la barra de navegación.
- `styles.css` (~950 líneas) — todo el estilo del prototipo (clases `av-*`, covers `cover-*`).


## Supabase

Proyecto vinculado: `emrhttofgulwnllfvvdn`, gestionado con el MCP de Supabase (`.mcp.json`, versionado: solo contiene el `project_ref`, no secretos). No hay Supabase CLI ni entorno local.

Variables de entorno (`.env.local`, plantilla en `.env.example`): `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Usar siempre la publishable key; nunca `service_role` ni la `anon` legacy, y jamás en variables `NEXT_PUBLIC_`.

Clientes (`@supabase/ssr`), ambos exportan `createClient` y lanzan un error claro si falta una variable (validación en `lib/supabase/env.ts`):

- `lib/supabase/client.ts` — para Client Components (`createBrowserClient`).
- `lib/supabase/server.ts` — asíncrono, para Server Components, Route Handlers y Server Actions (`createServerClient` con `await cookies()`). Crear uno por petición. Con `cacheComponents`, `cookies()` es un API de request time: llamarlo dentro de `<Suspense>` o en un route handler.

Esquema (migraciones `create_games_table` y `create_scores_table`, tipos generados en `lib/supabase/database.types.ts`; regenerar con el MCP tras cada migración):

- `games` — catálogo sembrado en la migración; RLS solo `select` público. Los cambios de catálogo van en nuevas migraciones.
- `scores` — `game_id` (FK), `player_name` (1 a 10 caracteres), `score` (1 a 1.000.000); RLS con `select` e `insert` públicos y sin `update`/`delete`. Los puntajes son anónimos (sin `user_id`).
- `game_stats` — vista `security_invoker` con `plays` (`COUNT`) y `best` (`MAX`) por juego.

Cliente adicional: `lib/supabase/public.ts` (sin cookies, `@supabase/supabase-js`) es el único que se usa dentro de funciones con `use cache`, donde `cookies()` no está permitido. `server.ts` solo se usa en la Server Action.

Limitación asumida: cualquiera con la publishable key puede insertar puntajes falsos directamente, saltándose la Server Action; la defensa real son los CHECKs y la RLS de `scores`. No hay anti-trampa ni rate limit.

Pendiente (cada uno en su propio spec): Auth (incluido `proxy` de refresco de sesión, reemplazo de `av_user`, `user_id` en `scores` y "tu mejor marca"), anti-trampa y rate limit, Realtime y Edge Functions.

## Skills

Utiliza siempre /frontend-design para diseñar la interfaz de usuario.