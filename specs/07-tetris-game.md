# SPEC 07 — Juego Tetris jugable

> **Status:** Implementado  
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-24
> **Objective:** Portar el juego de `references/started-games/03-tetris/` a un motor TypeScript con canvas e integrarlo como nuevo juego `tetris` del catálogo, jugable en `/games/tetris/play` con el HUD, la pausa y el puntaje guardado en el leaderboard de la plataforma.

---

## Por qué existe este spec

SPEC 05 portó Asteroids como primer motor real y dejó el patrón (motor TS sin globals + componente de canvas) para Tetris y Arkanoid. SPEC 06 hizo el catálogo y el ranking genéricos en Supabase. Este spec aplica ambos patrones al segundo juego real.

La referencia `03-tetris` es un clon completo en canvas (`game.js`, 332 líneas, JS con globals, sin dependencias). El catálogo ya contiene el mock `caida` (PUZZLE, `cover-tetro`), muy parecido; por decisión del usuario **no se reemplaza**: Tetris entra como entrada nueva y `caida` sigue con el simulador, igual que `rocas` junto a `asteroids` en SPEC 05.

`components/game-player.tsx` hoy despacha con `isAsteroids`. Con un segundo motor real ese `if` deja de escalar, así que este spec introduce un registro de juegos (`lib/games/registry.ts`) y migra Asteroids a él sin cambiar su comportamiento.

## Scope

**In:**

- Motor en `lib/games/tetris/` (TypeScript sin globals), portado literalmente de `game.js`: tablero 10×20 con bloques de 30 px, **7 piezas** (I, O, T, S, Z, J, L; se omite la pieza N "tuerca" 3×3 de `game.js`), rotación horaria con _wall kicks_ `[0, -1, 1, -2, 2]`, _soft drop_ (+1 punto por fila), _hard drop_ (+2 por celda), pieza fantasma (`globalAlpha = 0.2`), limpieza de líneas con `LINE_SCORES = [0, 100, 300, 500, 800]` × nivel, nivel = `floor(lines / 10) + 1` y `dropInterval = max(100, 1000 − (level − 1) × 90)` ms.
- Tope de puntaje en 1.000.000: al alcanzarlo el motor fija el puntaje en 1.000.000 y termina la partida (`onGameOver`).
- API del motor `start/pause/resume/restart/endGame/destroy` y callbacks `onScore/onLives/onLevel/onGameOver` (`onLives` no se llama: Tetris no tiene vidas).
- `components/tetris-canvas.tsx` con un único `<canvas width=800 height=600>` (4:3) escalado al ancho de `.crt-screen`: tablero 300×600 centrado a la izquierda y panel original dibujado por el motor (`SCORE`, `LINES`, `LEVEL` y recuadro `NEXT` de 120×120 con la siguiente pieza).
- Teclado: `←` `→` mover, `↑` o `X` rotar, `↓` _soft drop_, `Espacio` _hard drop_, con `preventDefault` solo mientras se juega.
- Registro `lib/games/registry.ts` (id → componente de canvas, nota de controles, si tiene vidas); `components/game-player.tsx` despacha por el registro y Asteroids migra a él sin cambios de comportamiento. Los mocks, incluido `caida`, conservan el simulador.
- HUD de la plataforma alimentado por el motor: puntaje y nivel reales; vidas se muestra `—`.
- Estética original (paleta `COLORS`, brillo superior de 4 px por bloque) sobre fondo oscuro dentro del marco CRT.
- Migración `add_tetris_game` en `games` (`insert`, `sort_order = 10`).
- Cover `.cover-tetris` en `app/globals.css`, distinta de `.cover-tetro` (que sigue en `caida`).
- Nota de controles en español bajo el CRT y aviso de teclado requerido en táctiles.
- Actualizar `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Controles táctiles o gamepad; soporte móvil.
- Sonido, música y animaciones nuevas (la referencia no tiene).
- Interruptor de tema claro/oscuro de la referencia (`theme-toggle`, `localStorage["tetris-theme"]`): el CRT de la plataforma es oscuro.
- Tecla `P` de pausa: la pausa la controla el botón `PAUSA/REANUDAR` de la plataforma.
- Reemplazar o eliminar el mock `caida`.
- Rediseño neón, _hold piece_, _bag randomizer_, rotación SRS, DAS/ARR o cualquier cambio de balance respecto a `game.js`.
- Cambios de esquema o de la capa de leaderboard (ya genéricos en SPEC 06) y subir el CHECK de `scores`.
- Mostrar `LINES` en el HUD de la plataforma (solo en el canvas).
- Tests automatizados.

## Data model

```ts
// lib/games/tetris/engine.ts
export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 600;

export interface TetrisCallbacks {
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void; // no se invoca: Tetris no tiene vidas
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void; // spawn bloqueado, tope de puntaje o endGame()
}

export interface TetrisEngine {
  start(): void;   // inicia el loop requestAnimationFrame y escucha teclado
  pause(): void;   // congela update; el último frame sigue visible
  resume(): void;  // reinicia la referencia de tiempo para evitar saltos
  restart(): void; // tablero vacío, puntaje 0, líneas 0, nivel 1
  endGame(): void; // fuerza gameover con el puntaje actual
  destroy(): void; // cancela rAF y quita listeners (idempotente)
}

export function createTetrisEngine(
  canvas: HTMLCanvasElement,
  callbacks?: TetrisCallbacks,
): TetrisEngine;
```

```ts
// lib/games/tetris/constants.ts (valores portados de game.js)
export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;
export const LINE_SCORES = [0, 100, 300, 500, 800];
export const MAX_SCORE = 1_000_000;
export const MAX_DT = 50; // ms
export const BOARD_X = 155; // origen del tablero dentro del canvas 800×600
export const PANEL_X = 485; // origen del panel SCORE / LINES / LEVEL / NEXT
// COLORS (índices 1–7) y PIECES (I, O, T, S, Z, J, L) copiados literalmente.
```

```ts
// lib/games/registry.ts (usado solo desde Client Components)
export interface GameCanvasHandle {
  pause(): void; resume(): void; restart(): void; endGame(): void;
}
export interface GameCanvasProps {
  ref?: Ref<GameCanvasHandle>;
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
}
export interface RegisteredGame {
  Canvas: ComponentType<GameCanvasProps>;
  hasLives: boolean;       // false → el HUD muestra "—" en Vidas
  controls: ReactNode;     // nota de controles bajo el CRT
}
export const GAME_REGISTRY: Record<string, RegisteredGame>; // asteroids, tetris
```

```sql
-- Migración: add_tetris_game
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values (
  'tetris',
  'TETRIS',
  'Encaja las piezas y limpia líneas.',
  'Mueve, gira y suelta las piezas que caen, completa líneas para sumar puntos y aguanta mientras la caída se acelera.',
  'PUZZLE',
  'cover-tetris',
  'cyan',
  10
);
```

Convenciones:

- Constantes y fórmulas portadas literalmente de `references/started-games/03-tetris/game.js`; el `dt` se limita a 50 ms (la referencia no lo limita).
- Estado en el cierre de `createTetrisEngine`, sin variables de módulo mutables; `board`, `current`, `next`, `score`, `lines`, `level`, `dropAccum` y `dropInterval` viven dentro del cierre.
- Coordenadas del tablero: `board[fila][columna]`, `0` vacío, `1–7` índice de color. La cuadrícula usa el color fijo `#22222e` (la referencia lo leía de una variable CSS con `getComputedStyle`, que no se usa en el motor).
- Callbacks solo al cambiar el valor: `onScore` al subir el puntaje, `onLevel` al cambiar de nivel; `restart()` notifica `0` y `1`.
- El puntaje se suma por una única función interna que aplica `MAX_SCORE`: al llegar a 1.000.000 el puntaje queda en 1.000.000 y se llama a `onGameOver`.
- El puntaje se guarda con la Server Action `submitScore` existente (`game_id = 'tetris'`, 1 a 1.000.000).
- El canvas dibuja su panel original, pero no el overlay `PAUSA` / `GAME OVER` ni el botón `Reiniciar` ni la lista de controles de la referencia: los cubren la plataforma y la nota de controles.
- La migración no cambia el esquema ni los tipos generados de `lib/supabase/database.types.ts`.

## Implementation plan

1. Leer en `node_modules/next/dist/docs/01-app/` las guías de Client Components y efectos en el navegador (según `AGENTS.md`) y revisar `components/game-player.tsx`, `components/asteroids-canvas.tsx` y `lib/games/asteroids/`. Verificación: notas de diferencias antes de escribir código.
2. Crear `lib/games/tetris/` con `constants.ts`, `utils.ts` (`createBoard`, `rotateCW`, `randomPiece`) y `pieces.ts` si hace falta, portados de `game.js`. Verificación: `npx tsc --noEmit` y `npm run lint` sin errores.
3. Crear `lib/games/tetris/engine.ts` con `createTetrisEngine`: estado encapsulado, loop con `dt` limitado, colisiones, _wall kicks_, bloqueo y limpieza de líneas, puntaje con tope, nivel y velocidad, pieza fantasma, panel dibujado en el canvas (`SCORE`, `LINES`, `LEVEL`, `NEXT`), teclado con `preventDefault` solo mientras se juega, callbacks y `destroy()` idempotente. Verificación: typecheck, lint y que el módulo no referencie `document`/`window` fuera de `start()`/`destroy()`.
4. Crear `components/tetris-canvas.tsx` (`"use client"`) con el mismo patrón que `components/asteroids-canvas.tsx` (handle imperativo, callbacks por ref, motor creado y destruido en `useEffect`, `width: 100%; height: auto`). Verificación: typecheck y lint; montar y desmontar repetidamente no deja listeners ni loops.
5. Crear `lib/games/registry.ts` con las entradas `asteroids` y `tetris` y adaptar `components/game-player.tsx` para despachar por el registro (canvas, nota de controles, `hasLives`) en lugar de `isAsteroids`; los ids fuera del registro siguen con el simulador. Verificación: `npx tsc --noEmit`, `npm run lint`, y Asteroids y los mocks (incluido `caida`) se comportan igual que antes.
6. Aplicar la migración `add_tetris_game` con `apply_migration` y diseñar `.cover-tetris` con `/frontend-design`. Verificación: `execute_sql` devuelve la fila `tetris` con `sort_order = 10` y `caida` sin cambios; `get_advisors` sin avisos nuevos; aparece en `/library` (filtro PUZZLE), `/games/tetris` y en las pestañas de `/hall-of-fame`.
7. Probar en el navegador (Playwright MCP, capturas en `.playwright-screenshots/`): mover, rotar, _soft drop_, _hard drop_, limpiar líneas y subir de nivel, ver la siguiente pieza, fin de partida, pausa, jugar de nuevo, guardado y aparición en `/hall-of-fame` y `/games/tetris`, y error de guardado con reintento. Verificación final: `npm run lint` y `npm run build` sin errores ni errores de consola o hidratación.
8. Actualizar `CLAUDE.md` (juegos con motor real: Asteroids y Tetris; registro de juegos; `caida` sigue siendo mock). Verificación: el texto refleja el estado final.

> Antes de escribir código de Next (pasos 4 y 5), leer la guía correspondiente en `node_modules/next/dist/docs/`. Usar `/frontend-design` solo para `.cover-tetris` y la nota de controles, según `CLAUDE.md`.

## Acceptance criteria

- [x] `/games/tetris/play` muestra el tablero 10×20 vacío, una pieza cayendo desde la parte superior central, la siguiente pieza en `NEXT` y el HUD de la plataforma con puntaje 0, vidas `—` y nivel 01.
- [x] `←`/`→` mueven la pieza, `↑` y `X` la rotan en sentido horario (con _wall kicks_ pegada a la pared), `↓` baja una fila y `Espacio` la deja caer; la página no hace scroll con esas teclas mientras se juega.
- [x] Cada fila bajada con `↓` suma 1 punto y cada celda recorrida con `Espacio` suma 2, y el puntaje del HUD se actualiza.
- [x] La pieza fantasma se dibuja con opacidad 0,2 donde aterrizará la pieza actual.
- [x] Completar 1, 2, 3 o 4 líneas suma 100, 300, 500 u 800 puntos multiplicados por el nivel actual.
- [x] Cada 10 líneas el nivel sube (el HUD de la plataforma y el panel del canvas muestran 02, 03…) y la caída se acelera según `max(100, 1000 − (nivel − 1) × 90)` ms.
- [x] Solo aparecen las 7 piezas estándar (I, O, T, S, Z, J, L); no existe la pieza N.
- [x] Si la pieza recién generada colisiona al aparecer, se abre el modal "FIN DEL JUEGO" con el puntaje final.
- [x] El motor nunca reporta más de 1.000.000 puntos: al alcanzarlo fija el puntaje en 1.000.000 y termina la partida (verificado leyendo la función interna que suma el puntaje).
- [x] `PAUSA` congela el juego (la pieza deja de caer y las teclas de juego no actúan) y muestra "EN PAUSA"; `REANUDAR` continúa sin salto de la pieza; `FIN` abre el modal con el puntaje actual.
- [x] `JUGAR DE NUEVO` reinicia tablero, puntaje 0, nivel 01 y líneas 0, sin acelerar el juego (un solo loop activo).
- [x] Salir de la página y volver no deja `requestAnimationFrame` ni listeners de teclado del juego anterior (una pulsación mueve la pieza una sola celda).
- [x] Con el modal de guardado abierto, escribir espacios y flechas en el input del nombre funciona con normalidad (el motor ya no captura teclas).
- [x] El canvas dibuja el panel original (`SCORE`, `LINES`, `LEVEL`, `NEXT`) con puntaje y nivel idénticos a los del HUD de la plataforma en todo momento, y no dibuja overlay de pausa ni de game over.
- [x] El canvas mantiene proporción 4:3 dentro de `.crt-screen` a 1280 px y 768 px.
- [x] `games` contiene la fila `tetris` (`PUZZLE`, `cyan`, `cover-tetris`, `sort_order = 10`) y la fila `caida` no cambió; `TETRIS` aparece en `/library`, `/games/tetris` y las pestañas de `/hall-of-fame`.
- [x] Guardar el puntaje crea una fila en `scores` con `game_id = 'tetris'` y aparece en `/hall-of-fame` y `/games/tetris` tras recargar; `Partidas` y `Mejor global` coinciden con `COUNT` y `MAX` de `scores`.
- [x] Si `submitScore` falla, el modal sigue abierto, muestra un error en español y permite reintentar sin perder el puntaje.
- [x] Bajo el CRT se ve la nota de controles en español y, en pantallas táctiles, el aviso de que el juego requiere teclado.
- [x] `caida`, `rocas` y el resto de mocks siguen mostrando el simulador sin cambios, y Asteroids funciona igual tras migrar al registro.
- [x] `npm run lint` y `npm run build` terminan sin errores, sin errores de hidratación ni de consola en `/games/tetris` y `/games/tetris/play`.

## Decisions

- **Sí:** entrada nueva `tetris` (`insert`, `sort_order = 10`) y mantener `caida` como mock. Decisión del usuario; implica dos juegos de temática similar, aceptable por ahora.
- **No:** reemplazar `caida` por el juego real. Descartado por el usuario.
- **Sí:** solo las 7 piezas estándar; se omite la tuerca N de `game.js`. Decisión del usuario (revierte la decisión inicial de portar las 8).
- **No:** portar la pieza N. Descartado por el usuario.
- **Sí:** un único canvas 800×600 (4:3) con el tablero 300×600 y el panel original dibujado en el canvas. Decisión del usuario; encaja en `.crt-screen`, mantiene el patrón de Asteroids y evita un segundo canvas para `NEXT`.
- **No:** tablero vertical 300×600 con un canvas `NEXT` aparte ni HUD solo de plataforma. Descartado por el usuario.
- **Sí:** tope de 1.000.000 en el motor, que termina la partida al alcanzarlo. Decisión del usuario; el CHECK de `scores` no cambia.
- **No:** subir el CHECK de `scores` ni dejar puntajes sin tope (fallarían al guardar). Descartado por el usuario.
- **Sí:** motor TS sin globals en `lib/games/tetris/` con un componente cliente delgado. Mismo patrón que SPEC 05.
- **Sí:** registro `lib/games/registry.ts` y migrar Asteroids a él. Decisión por defecto, no discutida: con dos motores reales el `if (isAsteroids)` se duplicaría, y el registro deja a Arkanoid como un cambio de una entrada.
- **Sí:** vidas `—` en el HUD (`hasLives: false`) y nivel tomado del motor. Decisión por defecto, no discutida: Tetris no tiene vidas; el nivel lo define `floor(lines / 10) + 1`, no `POINTS_PER_LEVEL`.
- **Sí:** `title` `TETRIS`, categoría `PUZZLE`, color `cyan` y textos corto/largo en español. Decisión por defecto, no discutida: el color y los textos son propuestas; se pueden cambiar antes de implementar.
- **Sí:** nueva `.cover-tetris` en lugar de reutilizar `.cover-tetro`. Decisión por defecto, no discutida: así las tarjetas de `caida` y `tetris` se distinguen.
- **Sí:** estética original (paleta de `COLORS` sobre fondo oscuro) sin rediseño neón. Decisión por defecto, no discutida: mismo criterio que SPEC 05.
- **Sí:** sin interruptor de tema claro/oscuro, sin tecla `P` y sin lista de controles dentro del canvas. Decisión por defecto, no discutida: la plataforma ya controla tema, pausa y nota de controles; así no hay dos fuentes del estado de pausa.
- **Sí:** el panel del canvas muestra `LINES` aunque el HUD de la plataforma no. Decisión por defecto, no discutida: es parte del panel original y no requiere cambiar el HUD genérico.
- **Sí:** sin sonido ni assets. Decisión por defecto, no discutida: la referencia no tiene.
- **Sí:** solo teclado; en táctiles se avisa. Mismo criterio que SPEC 05.
- **Sí:** `dt` limitado a 50 ms aunque la referencia no lo limita. Decisión por defecto, no discutida: evita que una pestaña en segundo plano acumule caídas al volver.
- **Sí:** repetición de teclas del navegador tal cual (sin DAS/ARR propio). Decisión por defecto, no discutida: es el comportamiento de la referencia.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Strict Mode monta el motor dos veces y duplica loops o listeners | Estado encapsulado, `destroy()` idempotente, criterio de aceptación explícito |
| Teclas del juego hacen scroll o activan un botón enfocado | `preventDefault` solo mientras se juega y quitar el foco del botón tras pulsarlo |
| El motor captura `Espacio` y flechas con el modal abierto e impide escribir el nombre | `preventDefault` únicamente con la partida en juego y sin pausa; criterio de aceptación explícito |
| La referencia no tiene estado de teclas pulsadas, así que "limpiar teclas en `blur`" no aplica | El motor reacciona a `keydown` discretos e ignora las teclas en pausa y fin; no hay estado que limpiar |
| Mantener `Espacio` pulsado encadena _hard drops_ por la repetición del navegador (comportamiento de la referencia) | Se porta literal; si resulta molesto, ignorar `e.repeat` en `Espacio` en un spec posterior |
| Migrar Asteroids al registro introduce una regresión | Paso 5 con verificación explícita de Asteroids y de los mocks; criterio de aceptación de no regresión |
| `lib/games/registry.ts` importa Client Components y se usa desde un Server Component | Solo se importa desde `components/game-player.tsx` (cliente); las páginas servidor siguen pasando únicamente `game` |
| `dt` limitado a 50 ms ralentiza la caída en pestañas en segundo plano | Aceptado: es el comportamiento deseado (la partida no avanza sola al volver) |
| El tablero 300×600 se ve pequeño o desbalanceado dentro del canvas 800×600 | `BOARD_X` y `PANEL_X` son constantes ajustables; verificar capturas a 1280 px y 768 px |
| Llegar a 1.000.000 puntos es muy improbable, por lo que el tope apenas se ejercita | Se verifica leyendo la función única que suma el puntaje; es un tope de seguridad, no una mecánica |

## What is **not** in this spec

- Controles táctiles, gamepad o soporte móvil.
- Sonido y música.
- Tema claro/oscuro, tecla `P` y overlays propios de la referencia.
- Reemplazar o eliminar el mock `caida`.
- _Hold piece_, _bag randomizer_, SRS, DAS/ARR o cambios de balance.
- Cambios de esquema, subir el CHECK de `scores` o cambios en el leaderboard.
- Portar Arkanoid.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propio spec.
