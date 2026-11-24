# Plantilla de spec de juego

Forma que debe respetar el spec generado. No es texto para copiar tal cual: sustituir los `<...>`, adaptar a lo que dijo el usuario y eliminar lo que no aplique. Imitar el tono y los encabezados de `specs/05-asteroids-game.md` y `specs/06-leaderboard-and-games-table.md`.

---

````markdown
# SPEC NN — Juego <Título> jugable

> **Status:** Borrador  
> **Depends on:** SPEC 05, SPEC 06
> **Date:** <YYYY-MM-DD>
> **Objective:** <Una frase: portar/crear <Título> como motor TypeScript con canvas e integrarlo como juego `<id>` del catálogo, con HUD, pausa y puntaje guardado en el leaderboard.>

---

## Por qué existe este spec

<Origen (`references/started-games/<carpeta>/` o idea original), qué mock reemplaza o por qué es entrada nueva, y qué patrón reutiliza (SPEC 05 motor+canvas, SPEC 06 leaderboard).>

## Scope

**In:**

- Motor en `lib/games/<id>/` (TS sin globals): <mecánicas principales con constantes literales>.
- API del motor `start/pause/resume/restart/endGame/destroy` y callbacks `onScore/onLives/onLevel/onGameOver`.
- `components/<id>-canvas.tsx` con `<canvas width=<W> height=<H>>` escalado al ancho de `.crt-screen`.
- Entrada de teclado: <controles>, con `preventDefault` mientras se juega.
- Integración en el reproductor: <registro de juegos / entrada en el registro>; los mocks conservan el simulador.
- HUD de la plataforma alimentado por el motor; <HUD original del canvas sí/no>.
- Migración `<add_<id>_game | replace_<mock>_with_<id>>` en `games` (`<id>`, textos, categoría, color, cover, `sort_order`).
- Cover `.cover-<id>` en `app/globals.css` <o reutiliza `<cover-del-mock>`>.
- Nota de controles y aviso de teclado requerido en táctiles.
- Actualizar `CLAUDE.md`.

**Out of scope (para futuros specs):**

- <Controles táctiles, sonido, assets, rediseño, otros juegos, cambios de balance, etc.>
- Cambios de esquema o de la capa de leaderboard (ya genéricos en SPEC 06).
- Tests automatizados.

## Data model

```ts
// lib/games/<id>/engine.ts
export const WORLD_WIDTH = <W>;
export const WORLD_HEIGHT = <H>;

export interface <Name>Callbacks {
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
}

export interface <Name>Engine {
  start(): void; pause(): void; resume(): void;
  restart(): void; endGame(): void; destroy(): void;
}

export function create<Name>Engine(canvas: HTMLCanvasElement, callbacks?: <Name>Callbacks): <Name>Engine;
```

```sql
-- Migración: <nombre>
<insert into public.games (...) values (...); | update public.games set ... where id = '<mock>';>
```

Convenciones:

- Constantes y fórmulas portadas literalmente de `<referencia>/game.js`.
- Estado en el cierre del motor; `dt` limitado; callbacks solo al cambiar el valor.
- <Mapeo de vidas/nivel si el juego no los tiene.>
- El puntaje se guarda con la Server Action `submitScore` existente (`game_id = '<id>'`, 1 a 1.000.000).

## Implementation plan

1. Leer en `node_modules/next/dist/docs/01-app/` las guías de Client Components y efectos en el navegador (según `AGENTS.md`) y revisar `components/game-player.tsx`, `components/asteroids-canvas.tsx` y `lib/games/asteroids/`. Verificación: notas de diferencias antes de escribir código.
2. Crear `lib/games/<id>/` (`utils.ts`, `constants.ts`, `entities.ts`). Verificación: `npx tsc --noEmit` y `npm run lint`.
3. Crear `engine.ts`. Verificación: typecheck, lint y sin `document`/`window` fuera de `start()`/`destroy()`.
4. Crear `components/<id>-canvas.tsx`. Verificación: montar y desmontar repetidamente no deja listeners ni loops.
5. <Generalizar el reproductor con `lib/games/registry.ts` y migrar Asteroids | añadir la entrada al registro>. Verificación: Asteroids y los mocks se comportan igual.
6. Aplicar la migración con `apply_migration` y diseñar `.cover-<id>` con `/frontend-design`. Verificación: `execute_sql` devuelve la fila; `get_advisors` sin avisos nuevos; aparece en `/library`, `/games/<id>` y `/hall-of-fame`.
7. Probar en el navegador (Playwright MCP, capturas en `.playwright-screenshots/`): controles, puntos, fin de partida, pausa, jugar de nuevo, guardado y aparición en `/hall-of-fame` y `/games/<id>`, error de guardado con reintento. Verificación final: `npm run lint` y `npm run build` sin errores ni errores de consola.
8. Actualizar `CLAUDE.md`. Verificación: refleja el nuevo juego con motor real.

> Antes de escribir código de Next (pasos 4 y 5), leer la guía correspondiente en `node_modules/next/dist/docs/`. Usar `/frontend-design` solo para la cover y la nota de controles, según `CLAUDE.md`.

## Acceptance criteria

<Criterios base de `checklist.md` + los específicos del juego (mecánicas, puntos, niveles). Cada uno verificable.>

## Decisions

<Sí/No con razón. Decisiones del usuario vs "Decisión por defecto, no discutida". Incluir la decisión sobre el mock (reemplazo o entrada nueva).>

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Strict Mode monta el motor dos veces y duplica loops o listeners | Estado encapsulado, `destroy()` idempotente, criterio de aceptación explícito |
| Teclas del juego hacen scroll o activan un botón enfocado | `preventDefault` y quitar el foco del botón tras pulsarlo |
| Teclas "pegadas" al perder el foco | Limpiar teclas en `blur` y `pause()` |
| <Riesgos propios del juego> | <Mitigación> |

## What is **not** in this spec

<Lista espejo de Out of scope.>

Cada uno de estos puntos, si se aborda, va en su propio spec.
````
