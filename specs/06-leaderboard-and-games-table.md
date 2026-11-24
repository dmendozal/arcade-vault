# SPEC 06 — Tabla `games` y leaderboard persistidos en Supabase

> **Status:** Implementado  
> **Depends on:** SPEC 01, SPEC 04, SPEC 05
> **Date:** 2026-11-24
> **Objective:** Crear las tablas `games` y `scores` en Supabase, mover el catálogo y el ranking de datos mock/`localStorage` a esas tablas, y hacer que `/hall-of-fame` y `/games/[id]` muestren los puntajes reales guardados desde el reproductor.

---

## Por qué existe este spec

SPEC 04 dejó la conexión a Supabase lista pero el proyecto sigue vacío (`list_tables` → `[]`). Hoy el catálogo es un array estático (`lib/games.ts`), los puntajes viven en `localStorage["av_scores"]` y los rankings que se ven son mock deterministas (`seededScores`). Con SPEC 05 ya hay un juego real que genera puntajes de verdad; este spec los vuelve compartidos y persistentes. Es el primer spec que crea tablas, RLS y tipos generados.

Toca tres áreas (base de datos, lectura de catálogo, ranking/guardado) pero comparten un único modelo de datos; separarlas dejaría `scores` sin FK a `games` o `games` sin consumidores.

## Scope

**In:**

- Migración con la tabla `games` (RLS: lectura pública, sin políticas de escritura) y siembra de los 9 juegos actuales de `lib/games.ts` con el mismo `id`, textos, categoría, `cover` y `color`, y `sort_order` igual al orden del array.
- Migración con la tabla `scores` (FK a `games`, CHECKs de nombre y puntaje, índice por juego y puntaje) con RLS: `SELECT` e `INSERT` públicos con las condiciones de validación; sin `UPDATE` ni `DELETE`.
- Vista `game_stats` (`security_invoker`) con `plays` (`COUNT`) y `best` (`MAX(score)`) por juego, que sustituye a los campos mock `best` y `plays`.
- Tipos generados en `lib/supabase/database.types.ts` y clientes `lib/supabase/client.ts` y `lib/supabase/server.ts` tipados con `Database`.
- Cliente de Supabase sin cookies `lib/supabase/public.ts` para funciones con `use cache`.
- Capa de datos de solo lectura en `lib/data/` con `use cache` y `cacheTag`: `getGames()`, `getGame(id)` y `getTopScores(gameId, limit)`.
- Migrar los consumidores del array `GAMES` a esa capa: landing (`app/page.tsx`), `/library`, `/games/[id]`, `/games/[id]/play`, `generateStaticParams` y las pestañas de `/hall-of-fame`.
- Server Action `submitScore` en `app/games/[id]/play/actions.ts`: valida e inserta en `scores` e invalida el tag de caché `scores`.
- `components/game-player.tsx` guarda mediante esa acción, con estados de guardando, error y reintento; el input de nombre limita a 10 caracteres.
- `/hall-of-fame` con top 12 real por juego, podio con huecos vacíos y estado sin puntajes.
- Bloque "MEJORES PUNTUACIONES" de `/games/[id]` con el top 10 real y estado vacío; `Partidas` y `Mejor global` salen de `game_stats`.
- Eliminar `seededScores`, el bloque "TU MEJOR MARCA" y toda la lógica de `av_scores` (`readScoresRaw`, `parseScores`, `readScores`, `appendScore`, `saveScore` de `SessionProvider`).
- Actualizar `CLAUDE.md` (estado del proyecto y lista de pendientes de Supabase).

**Out of scope (para futuros specs):**

- Supabase Auth, `profiles`, `scores.user_id`, `av_user` y la sección "tu mejor marca" (sin identidad real no se puede atribuir).
- Anti-trampa real (el puntaje lo envía el navegador), rate limit, Edge Functions y moderación de nombres.
- Realtime: el ranking se actualiza al recargar o navegar, no en vivo.
- Migrar o importar los puntajes de `localStorage["av_scores"]` (se descartan).
- Panel de administración o escritura sobre `games`; los cambios de catálogo se hacen con migraciones.
- Portar los juegos restantes (Tetris, Arkanoid) y filtros por periodo (semanal, mensual) del ranking.
- Tests automatizados, Supabase CLI y entorno local.

## Data model

```sql
-- Migración 1: create_games_table
create table public.games (
  id          text primary key,                 -- slug en inglés, p. ej. 'asteroids'
  title       text not null,
  short       text not null,
  long        text not null,
  category    text not null check (category in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover       text not null,                    -- clase CSS, p. ej. 'cover-asteroids'
  color       text not null check (color in ('cyan','magenta','yellow','green')),
  sort_order  integer not null,
  created_at  timestamptz not null default now()
);
-- RLS activada; policy: select para anon y authenticated; sin policies de escritura.

-- Migración 2: create_scores_table
create table public.scores (
  id           bigint generated always as identity primary key,
  game_id      text not null references public.games(id),
  player_name  text not null check (char_length(player_name) between 1 and 10),
  score        integer not null check (score between 1 and 1000000),
  created_at   timestamptz not null default now()
);
create index scores_game_score_idx on public.scores (game_id, score desc, created_at);
-- RLS activada; policies: select y insert (with check true) para anon y authenticated;
-- sin policies de update/delete.

create view public.game_stats with (security_invoker = true) as
  select game_id, count(*)::int as plays, max(score) as best
  from public.scores group by game_id;
```

```ts
// lib/games.ts — se conservan solo tipos y constantes; desaparece el array GAMES
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type AccentColor = "cyan" | "magenta" | "yellow" | "green";
export const CATS = /* igual que hoy */;

export interface Game {
  id: string; title: string; short: string; long: string;
  cat: Category; cover: string; color: AccentColor;
  best: number | null;  // MAX(score) de game_stats; null si no hay partidas
  plays: number;        // COUNT de game_stats; 0 si no hay partidas
}

// lib/data/scores.ts
export interface ScoreRow { rank: number; name: string; score: number; date: string } // date "DD/MM/AAAA"

// app/games/[id]/play/actions.ts
export type SubmitScoreResult = { ok: true } | { ok: false; error: string };
export async function submitScore(input: { gameId: string; name: string; score: number }): Promise<SubmitScoreResult>;
```

Convenciones:

- `Game.cat` se mapea desde la columna `category`; `Game.plays` pasa de `string` ("12.4K") a `number` y se formatea al mostrarlo.
- Los juegos sin partidas muestran `—` en lugar de `best` y `0` en `plays`.
- Orden del ranking: `score desc, created_at asc` (a igualdad de puntaje gana el más antiguo); `rank` se calcula al leer, no se guarda.
- `date` se formatea en servidor con `es-ES`; el nombre se guarda tal como lo envía el jugador, recortado y sin espacios en los extremos.
- Las cabeceras de las funciones con `use cache` no pueden leer `cookies()`: usan `lib/supabase/public.ts`, nunca el cliente de `server.ts`.
- Tags de caché: `games` (catálogo) y `scores` (ranking y `game_stats`); `getGames()` lleva ambos porque incluye `best` y `plays`.
- Nombres de migración: `create_games_table`, `create_scores_table`.

## Implementation plan

1. Leer en `node_modules/next/dist/docs/01-app/` las guías de `use cache`, `cacheTag`/`cacheLife`, invalidación (`updateTag` / `revalidateTag`), Server Actions y `generateStaticParams` con `cacheComponents`, y consultar RLS y vistas con `security_invoker` con `search_docs` del MCP. Verificación: notas de diferencias y API exacta de invalidación elegida antes de escribir código.
2. Aplicar la migración `create_games_table` con la siembra de los 9 juegos (copiados de `lib/games.ts`). Verificación: `list_tables` muestra `games`; `execute_sql` devuelve 9 filas con `sort_order` 1..9 y `asteroids` al final; `get_advisors` (security) sin avisos de RLS para `games`.
3. Aplicar la migración `create_scores_table` (tabla, índice, RLS y vista `game_stats`). Verificación: con `execute_sql` un INSERT válido se acepta y uno con `score = 0`, nombre vacío o `game_id` inexistente falla; luego borrar las filas de prueba; `get_advisors` sin errores nuevos (una policy `insert ... with check (true)` puede generar aviso: documentarlo en Risks).
4. Generar tipos con `generate_typescript_types` en `lib/supabase/database.types.ts` y tipar `lib/supabase/client.ts` y `lib/supabase/server.ts` con `Database`. Crear `lib/supabase/public.ts` (cliente sin cookies con las mismas variables validadas por `env.ts`). Verificación: `npx tsc --noEmit` y `npm run lint`.
5. Crear `lib/data/games.ts` (`getGames`, `getGame`) con `use cache`, `cacheTag("games", "scores")` y `cacheLife`, que lee `games` y `game_stats` y devuelve `Game[]` ordenado por `sort_order`. Verificación: un script o una página temporal imprime los 9 juegos; typecheck y lint.
6. Migrar el catálogo: `app/page.tsx` (primeros 6), `app/library/page.tsx` + `components/library.tsx` (reciben `games` por props desde un Server Component dentro de `<Suspense>`), `app/games/[id]/page.tsx` y `app/games/[id]/play/page.tsx` (con `generateStaticParams` y `generateMetadata` desde `getGames`/`getGame`), y `components/game-card.tsx` (`best` nulo → `—`). Quitar el array `GAMES` de `lib/games.ts` conservando tipos y `CATS`; `lib/home.ts` sigue importando `AccentColor`. Verificación: las pantallas del catálogo se ven igual que antes, `ASTEROIDS` sigue en `/library` y `npm run build` genera `/games/asteroids/play`.
7. Crear `lib/data/scores.ts` con `getTopScores(gameId, limit)` (`use cache`, `cacheTag("scores")`) que devuelve `ScoreRow[]` ya ordenado y con `rank`. Verificación: con una fila de prueba en `scores` la función devuelve el top esperado; borrar la fila después.
8. Crear `app/games/[id]/play/actions.ts` con `submitScore`: valida (nombre recortado de 1 a 10 caracteres, puntaje entero entre 1 y 1.000.000, juego existente), inserta con el cliente de `server.ts`, invalida el tag `scores` y devuelve `SubmitScoreResult` sin lanzar excepciones al cliente. Verificación: typecheck, lint y una llamada manual desde el reproductor guarda la fila (comprobar con `execute_sql`).
9. Adaptar `components/game-player.tsx`: `handleSave` llama a `submitScore` con estados `saving`/`error` (mensaje en español y botón de reintento, el modal no se cierra si falla), el input de nombre con `maxLength={10}`; quitar `saveScore` de `components/session-provider.tsx` y de su contexto. Verificación: guardar un puntaje de `asteroids` crea la fila y el modal muestra "guardado"; con la red cortada muestra el error y permite reintentar.
10. Reescribir `/hall-of-fame`: `app/hall-of-fame/page.tsx` obtiene los juegos y el top 12 de cada uno en paralelo (en `<Suspense>`) y los pasa a `components/hall-of-fame.tsx`, que conserva las pestañas por estado de cliente. Podio con `—` en los puestos vacíos, mensaje "AÚN NO HAY PUNTAJES · SÉ EL PRIMERO" si no hay filas, y sin el bloque "TU MEJOR MARCA" ni `useSyncExternalStore`. Verificación: el ranking de `asteroids` muestra el puntaje guardado en el paso 9 tras navegar o recargar.
11. Sustituir en `app/games/[id]/page.tsx` el bloque `seededScores` por `getTopScores(id, 10)` con estado vacío; `Partidas` y `Mejor global` desde `Game`. Verificación: el detalle de `asteroids` muestra el mismo puntaje que `/hall-of-fame`.
12. Limpieza: borrar `lib/scores.ts` (`seededScores`; `ScoreRow` vive en `lib/data/scores.ts`), las funciones de `av_scores` de `lib/storage.ts` (se conserva `av_user`) y el tipo `SavedScore`; actualizar `CLAUDE.md` (estado del proyecto, tablas, variables sin cambios y pendientes: Auth, Realtime, Edge Functions). Verificación: `grep -rn "av_scores\|seededScores\|SavedScore"` no devuelve resultados; `npm run lint` y `npx tsc --noEmit` sin errores.
13. Probar en el navegador (Playwright MCP, capturas en `.playwright-screenshots/`): jugar `asteroids`, guardar dos puntajes con nombres distintos, ver el orden en `/hall-of-fame` y `/games/asteroids`, guardar un puntaje en un juego simulado, y comprobar los estados vacíos de un juego sin partidas. Verificación final: `npm run build` sin errores y sin errores de hidratación ni de consola.

> Antes de escribir código de Next (pasos 5 a 11), leer la guía correspondiente en `node_modules/next/dist/docs/` según `AGENTS.md`. Las pantallas ya existen: solo se tocan para cambiar su fuente de datos y añadir los estados vacío y de error, que usan las clases actuales (`podium`, `hall-table`, `leaderboard`); usar `/frontend-design` únicamente para esos estados nuevos, según `CLAUDE.md`.

## Acceptance criteria

- [ ] `list_tables` devuelve `games` y `scores` con RLS activada, y `list_migrations` incluye `create_games_table` y `create_scores_table`.
- [ ] `games` contiene exactamente 9 filas con los mismos `id`, títulos, categorías, covers y colores que tenía `lib/games.ts`, y `asteroids` es la de mayor `sort_order`.
- [ ] Un INSERT en `scores` con nombre vacío o de más de 10 caracteres, puntaje 0 o mayor que 1.000.000, o `game_id` inexistente es rechazado por la base de datos.
- [ ] Con la publishable key, `UPDATE` y `DELETE` sobre `scores` y cualquier escritura sobre `games` son rechazados por RLS.
- [ ] `lib/games.ts` ya no exporta `GAMES`; `lib/scores.ts` ya no existe y `grep -rn "av_scores\|seededScores\|SavedScore" app components lib` no devuelve resultados.
- [ ] `/library`, la landing, `/games/[id]` y `/games/[id]/play` muestran los mismos 9 juegos en el mismo orden que antes, con `ASTEROIDS` al final y filtros por categoría funcionando.
- [ ] Un juego sin puntajes muestra `—` como mejor puntaje y `0` partidas en tarjeta y detalle.
- [ ] Terminar una partida de `asteroids` y pulsar `GUARDAR PUNTUACIÓN` crea una fila en `scores` con `game_id = 'asteroids'`, el nombre recortado y el puntaje exacto.
- [ ] Tras guardar y recargar `/hall-of-fame`, el puntaje aparece en la pestaña ASTEROIDS en la posición correcta (orden por puntaje descendente; empate: el más antiguo primero).
- [ ] `/games/asteroids` muestra el mismo top (hasta 10) que `/hall-of-fame`, y `Partidas` y `Mejor global` coinciden con `COUNT` y `MAX` de `scores` para ese juego.
- [ ] El input de nombre del reproductor no admite más de 10 caracteres.
- [ ] Si `submitScore` falla (red cortada o error de la base de datos), el modal permanece abierto, muestra un mensaje de error en español y permite reintentar sin perder el puntaje.
- [ ] Un juego sin puntajes en `/hall-of-fame` muestra "AÚN NO HAY PUNTAJES" y un podio sin errores de renderizado; con 1 o 2 filas, los puestos vacíos muestran `—`.
- [ ] `/hall-of-fame` ya no muestra "TU MEJOR MARCA" y `av_scores` ya no se lee ni se escribe en `localStorage`.
- [ ] `lib/supabase/public.ts` no importa `next/headers`, y las funciones de `lib/data/` con `use cache` no llaman a `cookies()`.
- [ ] El repositorio no contiene claves `service_role` ni secretos de Supabase.
- [ ] `npm run lint` y `npm run build` terminan sin errores, sin errores de hidratación ni de consola en `/hall-of-fame`, `/games/asteroids` y `/games/asteroids/play`.

## Decisions

- **Sí:** tabla `games` real en Supabase con el catálogo migrado y consumidores leyendo de ella. Decisión del usuario.
- **No:** dejar `lib/games.ts` como fuente y usar `games` solo para la FK. Descartado por el usuario; mantendría dos fuentes de verdad.
- **Sí:** `id` de `games` es el slug en inglés ya usado en rutas (`bloque-buster`, `asteroids`…). Evita migrar URLs y respeta la regla global de idioma; los textos de UI siguen en español.
- **Sí:** `best` y `plays` derivados de `scores` mediante la vista `game_stats` (`security_invoker`). Decisión del usuario; los números nunca divergen del ranking.
- **No:** columnas estáticas `best`/`plays` ni contador de partidas no guardadas. Quedarían incoherentes con el ranking real.
- **Sí:** puntajes anónimos con nombre libre (`player_name`), sin `user_id`. Decisión del usuario; Auth es otro spec y añadirá `user_id` con su propia migración.
- **No:** Auth ni `profiles` en este spec; hacerlo exigiría dividirlo.
- **Sí:** descartar `localStorage["av_scores"]` sin migración. Decisión del usuario; son datos locales de prueba y evita duplicados o trampas.
- **Sí:** Server Action `submitScore` con validación básica más CHECKs y RLS en la base de datos. Decisión del usuario; centraliza mensajes de error y la invalidación de caché.
- **No:** Edge Function con rate limit (tiene spec propio pendiente) ni insert directo desde el navegador (peor control del flujo y de la invalidación).
- **Sí:** lectura del catálogo y del ranking en servidor con `use cache` y tags, invalidando `scores` al guardar. Decisión del usuario; mantiene el prerender y evita parpadeos de carga.
- **No:** fetch desde componentes cliente (pierde prerender) ni consulta dinámica sin caché (más lecturas a la BD).
- **No:** Realtime. Decisión del usuario; sigue como spec propio pendiente.
- **Sí:** ranking real sin filas mock de relleno; los juegos sin partidas muestran estado vacío. Decisión del usuario ("Hall of Fame con datos reales").
- **Sí:** pestañas de `/hall-of-fame` por estado de cliente con el top 12 de todos los juegos cargado en servidor (9 consultas pequeñas en paralelo, cacheadas). Descartado: pestañas por `searchParams` (cada cambio de pestaña sería una navegación) y una función SQL con `row_number()` (más superficie de BD para 9 juegos).
- **Sí:** el detalle `/games/[id]` pasa a mostrar el top 10 real y se elimina `seededScores`. Decisión por defecto, no discutida: es consecuencia de borrar el mock; si se prefiere conservar datos falsos en el detalle, cambiarlo antes de implementar.
- **Sí:** quitar el bloque "TU MEJOR MARCA". Decisión por defecto, no discutida: sin Auth no hay identidad fiable para atribuir puntajes a un usuario (el nombre es libre y repetible); vuelve con el spec de Auth.
- **Sí:** nombre de 1 a 10 caracteres, igual que el límite que ya aplica `auth-form` (`slice(0, 10)`); puntaje máximo de 1.000.000 como tope razonable contra valores absurdos, no como anti-trampa. Decisión por defecto, no discutida.
- **Sí:** siembra de `games` dentro de la migración de creación. El catálogo es dato de configuración versionado; los cambios futuros van en nuevas migraciones.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Cualquiera con la publishable key puede insertar puntajes falsos directamente, saltándose la Server Action | Limitación asumida: la defensa real son los CHECKs y RLS de la tabla, no la acción. Anti-trampa y rate limit quedan para un spec posterior; documentado en `CLAUDE.md`. |
| Un `INSERT` con `with check (true)` genera avisos de `get_advisors` | Es intencional (ranking público anónimo); las restricciones están en CHECKs y FK. Revisar que no aparezcan otros avisos y anotarlo al implementar. |
| Spam o nombres ofensivos en el ranking público | Fuera de alcance (moderación). Mitigación mínima: límite de 10 caracteres y borrado manual vía MCP/SQL si hace falta. |
| `use cache` no puede leer `cookies()`; usar `server.ts` dentro de una función cacheada rompe el build | `lib/supabase/public.ts` sin cookies para lecturas cacheadas; criterio de aceptación explícito; `server.ts` solo en la Server Action. |
| Invalidación incorrecta: el ranking no muestra el puntaje recién guardado | La acción invalida `scores` tras el insert; la API exacta (`updateTag` o `revalidateTag`) se decide en el paso 1 según la guía de esta versión de Next. |
| `generateStaticParams` consulta la BD en build; si Supabase no responde, el build falla | El build usa las mismas variables de entorno que el resto; el error de `env.ts` es explícito. Si falla en CI, documentar las variables requeridas en `.env.example` (ya existentes). |
| Cambio de `Game.plays` (`string` → `number`) rompe consumidores no revisados | Typecheck y `grep` de `plays`/`best` en el paso 6; formatear en un único helper. |
| Pérdida de los puntajes locales existentes | Aceptada por el usuario: eran datos de prueba. |
| La vista `game_stats` sin `security_invoker` se salta RLS | Se crea con `security_invoker = true`; verificado con `get_advisors`. |

## What is **not** in this spec

- Auth, `profiles`, `user_id`, sesión real o "tu mejor marca".
- Anti-trampa, rate limit, Edge Functions o moderación de nombres.
- Realtime y rankings en vivo.
- Migración de `av_scores` desde `localStorage`.
- Administración o edición de `games` desde la UI.
- Filtros de ranking por periodo, paginación o perfil de jugador.
- Portar Tetris y Arkanoid.
- Tests automatizados, Supabase CLI y entorno local.

Cada uno de estos puntos, si se aborda, va en su propio spec.
