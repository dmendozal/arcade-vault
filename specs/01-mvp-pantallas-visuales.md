# SPEC 01 — MVP visual de Arcade Vault (todas las pantallas)

> **Status:** Implementado  
> **Depends on:** Ninguna (los estilos de la rama `02-styles` ya están en `app/globals.css` y `app/layout.tsx`)
> **Date:** 2026-11-20
> **Objective:** Portar a Next.js/TypeScript las cinco pantallas del prototipo `references/templates/` (biblioteca, detalle, reproductor simulado, acceso y salón de la fama) como rutas reales del App Router, sin implementar ningún juego.

---

## Por qué existe este spec

El producto solo existe como prototipo de navegador (React UMD + Babel, router por `location.hash`). Este spec lo convierte en una base real de Next.js 16 sobre la que luego se podrán añadir juegos y backend. El texto del encargo dice "Arcade Bot"; se interpreta como **Arcade Vault** (nombre del producto en `CLAUDE.md`, `README.md` y el prototipo).

## Scope

**In:**

- Rutas del App Router: `/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/acceso`, `/salon`.
- Barra de navegación (con panel móvil), footer y fondo global, compartidos desde `app/layout.tsx`.
- Datos mock tipados (`GAMES`, `CATS`, `seededScores`) portados desde `data.jsx`.
- Sesión demostrativa y puntajes en `localStorage` con las mismas claves del prototipo (`av_user`, `av_scores`).
- Reproductor simulado: HUD, pantalla CRT, pausa, fin de partida y guardado de puntaje, con el temporizador aleatorio del prototipo (sin juego real).
- Salón de la fama que mezcla las filas mock con los puntajes guardados localmente.
- Página `not-found` para ids de juego inexistentes.
- Textos de UI en español, igual que el prototipo.

**Out of scope (para futuros specs):**

- Cualquier juego jugable (lógica, canvas, input de teclado/táctil).
- Backend, base de datos, API routes o autenticación real (Google/GitHub incluidos).
- Migrar o modificar `styles.css`/`globals.css` y las fuentes (ya resuelto en la rama `02-styles`).
- Tests automatizados (el repo no tiene framework de tests).
- Internacionalización, SEO avanzado, analítica, PWA.

## Data model

```ts
// lib/games.ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type AccentColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;            // slug: "bloque-buster", "caida", ...
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;         // clase CSS: "cover-bricks", ...
  color: AccentColor;
  best: number;
  plays: string;         // "12.4K"
}
export const GAMES: Game[];          // los 8 juegos de data.jsx
export const CATS: ("TODOS" | Category)[];

// lib/scores.ts
export interface ScoreRow { rank: number; name: string; score: number; date: string } // date: "DD/MM/2026"
export function seededScores(seed: number, count?: number): ScoreRow[]; // determinista

// lib/storage.ts — claves y formato idénticos al prototipo
export interface User { name: string }                                   // localStorage["av_user"], null si invitado
export interface SavedScore { game: string; score: number; name: string; at: number } // localStorage["av_scores"]: SavedScore[]
```

Convenciones:

- Los ids de juego y las semillas de `seededScores` se conservan para que el ranking mock sea idéntico al prototipo.
- Lectura/escritura de `localStorage` solo dentro de componentes cliente, tras el montaje, y siempre con `try/catch`.

## Implementation plan

1. Crear `lib/games.ts` y `lib/scores.ts` con tipos y datos portados de `data.jsx`. Verificación: `npm run lint` y `npx tsc --noEmit` sin errores.
2. Crear `lib/storage.ts` y `components/session-provider.tsx` (`"use client"`, contexto con `user`, `login(user | null)`, `signOut()`, `saveScore()`; hidrata desde `localStorage` en `useEffect`). Envolver `children` en `app/layout.tsx`.
3. Crear `components/nav.tsx` (logo, enlaces Biblioteca / Salón de la Fama, contador de créditos, botón de sesión, hamburguesa y panel móvil; activo según `usePathname`) y `components/footer.tsx`; montarlos en `app/layout.tsx` junto con `<main className="av-main">`. Verificación: el nav se ve en `/` y el panel móvil abre y cierra.
4. Implementar `/` (`app/page.tsx`): `components/game-card.tsx` (inclinación 3D al pasar el cursor, enlace a `/juegos/[id]`) y `components/library.tsx` (cliente: hero, búsqueda, chips de categoría, estado "NO HAY RESULTADOS").
5. Implementar `/juegos/[id]` (`app/juegos/[id]/page.tsx`): portada, etiquetas, estadísticas, tabla "MEJORES PUNTUACIONES" con `seededScores(id.length * 17 + 3, 10)` y botones a `/juegos/[id]/jugar` y `/`. Id inexistente → `notFound()`. Declarar `generateStaticParams` con los ids de `GAMES`.
6. Implementar `/juegos/[id]/jugar` (`components/game-player.tsx`, cliente): HUD, CRT, pausa, `FIN`, `SALIR` (vuelve al detalle), modal de fin con guardado vía `saveScore()`, `JUGAR DE NUEVO` y `VOLVER AL VAULT`. El nombre por defecto es el del usuario o `INVITADO`.
7. Implementar `/acceso` (`components/auth-form.tsx`, cliente): pestañas iniciar sesión / crear cuenta, campo de correo solo en registro, enviar llama a `login({ name })` (mayúsculas, 10 caracteres, `PLAYER1` por defecto) y redirige a `/`; `JUGAR COMO INVITADO` llama a `login(null)`; botones Google/GitHub inertes.
8. Implementar `/salon` (`components/hall-of-fame.tsx`, cliente): pestañas por juego, podio top 3, tabla de 12 filas combinando `seededScores(tab.length * 23 + 7, 12)` con los puntajes de `av_scores` de ese juego (orden descendente, rangos recalculados), y bloque "TU MEJOR MARCA" visible solo si el usuario tiene sesión y al menos un puntaje guardado.
9. Crear `app/not-found.tsx` con estilo del vault, añadir `metadata` por página, y quitar del scaffold los restos sin uso (`public/*.svg` de create-next-app si nadie los referencia). Verificación: `npm run build` termina sin errores.

> Antes de escribir código de Next (pasos 2, 5 y 9), leer la guía relevante en `node_modules/next/dist/docs/` según `AGENTS.md` (en particular `cacheComponents`, `params` asíncronos y `generateStaticParams`).

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] Existen exactamente las rutas `/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/acceso` y `/salon`; no se usa `location.hash` para navegar.
- [ ] `/` muestra las 8 tarjetas de juego; buscar "caí" deja solo CAÍDA; elegir el chip `SHOOTER` deja solo INVASORES y ROCAS.
- [ ] Una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Clic en una tarjeta o en `JUGAR` navega a `/juegos/[id]` sin recargar la página completa.
- [ ] `/juegos/inexistente` muestra la página `not-found` (HTTP 404).
- [ ] `/juegos/caida` muestra título, descripción larga, estadísticas y 10 filas de puntuaciones, idénticas en cada recarga.
- [ ] `JUGAR AHORA` abre `/juegos/[id]/jugar`; el puntaje sube solo mientras no hay pausa; `PAUSA` lo detiene y muestra "EN PAUSA"; `REANUDAR` lo reanuda.
- [ ] `FIN` abre el modal con la puntuación final; `GUARDAR PUNTUACIÓN` muestra "PUNTUACIÓN GUARDADA" y añade una entrada a `localStorage["av_scores"]`.
- [ ] `SALIR` vuelve a `/juegos/[id]`; `JUGAR DE NUEVO` reinicia puntaje, vidas y nivel; `VOLVER AL VAULT` va a `/`.
- [ ] En `/acceso`, la pestaña "CREAR CUENTA" muestra el campo de correo y "INICIAR SESIÓN" lo oculta.
- [ ] Enviar el formulario con usuario `px_kai` guarda `{"name":"PX_KAI"}` en `localStorage["av_user"]`, redirige a `/` y el nav muestra `PX_KAI ▾`.
- [ ] `JUGAR COMO INVITADO` redirige a `/` sin usuario y el nav muestra "Iniciar Sesión".
- [ ] Clic en `PX_KAI ▾` cierra la sesión y elimina `av_user`.
- [ ] Recargar la página conserva la sesión sin errores de hidratación en la consola.
- [ ] `/salon` muestra podio y 12 filas; cambiar de pestaña cambia el ranking de forma determinista.
- [ ] Un puntaje guardado en el reproductor aparece en el ranking de ese juego en `/salon`, y "TU MEJOR MARCA" aparece solo con sesión y puntaje.
- [ ] A ancho < 768 px el nav muestra la hamburguesa y el panel lateral abre y cierra con el backdrop.
- [ ] El enlace activo del nav es "Biblioteca" en `/`, `/juegos/*` y `/juegos/*/jugar`, y "Salón de la Fama" en `/salon`.
- [ ] Con `localStorage` bloqueado, ninguna pantalla lanza excepciones (la app funciona sin persistir).

## Decisions

- **Sí:** rutas reales del App Router en vez de replicar el router por hash. Encaja con `cacheComponents`, `partialPrefetching` y permite enlaces compartibles.
- **No:** una sola página con hash. Rompe SSR, prefetch y el modelo de cache de Next.
- **Sí:** reproductor con simulación del prototipo. Permite probar el flujo completo (jugar → guardar → ranking) sin ningún juego.
- **No:** placeholder "Próximamente" ni marco estático. Dejarían sin probar el guardado de puntajes.
- **Sí:** `localStorage` con las claves `av_user` y `av_scores` del prototipo. No hay backend y mantiene compatibilidad con datos ya guardados.
- **No:** base de datos o auth real. Requiere su propio spec (modelo de usuarios, API, seguridad).
- **Sí:** asumir que los estilos y fuentes ya están en `app/globals.css` y `app/layout.tsx` (rama `02-styles`). Este spec no los toca salvo montar nav, footer y proveedor en el layout.
- **Sí:** el ranking del salón mezcla filas mock con puntajes locales; la tabla del detalle usa solo datos mock (decisión por defecto, no discutida).
- **Sí:** el nombre "Arcade Bot" del encargo se trata como "Arcade Vault".
- **Sí:** la pestaña activa del salón es estado de cliente, como en el prototipo; no se refleja en la URL.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Leer `localStorage` en el primer render provoca error de hidratación | `SessionProvider` empieza con `user = null` y hidrata en `useEffect`; el nav no depende del usuario para su estructura. |
| `cacheComponents: true` rechaza accesos dinámicos fuera de `Suspense` en rutas con `params` | Usar `generateStaticParams` con los ids de `GAMES` y leer la guía en `node_modules/next/dist/docs/` antes del paso 5. |
| El prototipo asume scope global y colisiones de hooks | Cada componente se escribe como módulo con sus propios imports; no se copian los alias `useStateX`. |
| `localStorage` bloqueado o con JSON corrupto | Todo acceso va en `try/catch` y cae a valores vacíos. |
| Los estilos de `02-styles` están sin commitear | Confirmar que `app/globals.css` contiene las clases `av-*` antes del paso 3. |

## What is **not** in this spec

- Ningún juego jugable.
- Backend, base de datos o autenticación real (incluido Google/GitHub).
- Migración de estilos o fuentes.
- Tests automatizados.
- Multijugador, modo de dos jugadores o controles táctiles.

Cada uno de estos puntos, si se aborda, va en su propio spec.
