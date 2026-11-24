# SPEC 09 — Juego Snake jugable

> **Status:** Implementado  
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Date:** 2026-11-24
> **Objective:** Crear Snake como motor TypeScript con canvas, usando las frutas de `references/source-assets/snake-assets/`, e integrarlo reemplazando el mock `serpentina` del catálogo, jugable en `/games/serpentina/play` con el HUD, la pausa y el puntaje guardado en el leaderboard de la plataforma.

---

## Por qué existe este spec

SPEC 05, SPEC 07 y SPEC 08 portaron Asteroids, Tetris y Arkanoid como motores reales y dejaron el registro `lib/games/registry.ts` (`GAME_REGISTRY`). SPEC 06 hizo el catálogo y el ranking genéricos en Supabase. Este spec aplica esos patrones al cuarto juego real: añadir Snake es una entrada más en el registro, sin tocar `components/game-player.tsx`.

A diferencia de los specs anteriores **no hay juego de referencia** en `references/started-games/`: solo existen assets en `references/source-assets/snake-assets/` (`fruits.png`, un spritesheet de 3790×442 px con 3 filas de 22 frutas, y `sprites.js`, un atlas con las coordenadas de la fila pixel-art, extraído de _Google Snake_ vía spriters-resource). Las mecánicas son por tanto de un juego original: Snake clásico en cuadrícula, definido en este spec. El spec no copia el arte del juego de Google más allá de las frutas que el usuario aportó como assets.

El catálogo ya contiene el mock `serpentina` (ARCADE, `green`, `cover-snake`, `sort_order = 3`). Por decisión del usuario **se reemplaza**: la migración hace `update` y conserva `id` y puntajes. Es el primer spec que reemplaza un mock en lugar de añadir una entrada nueva.

## Scope

**In:**

- Motor en `lib/games/snake/` (TypeScript sin globals), con estas mecánicas:
  - Canvas 800×600 con cuadrícula de 20 columnas × 15 filas de 40 px.
  - Serpiente de 3 segmentos que nace en el centro mirando a la derecha; se mueve una celda por _tick_ de tiempo fijo.
  - Muros mortales: chocar con un borde o con el propio cuerpo termina la partida. Sin vidas.
  - Una fruta en el tablero a la vez, en una celda libre al azar; al comerla la serpiente crece un segmento y suma 10 puntos.
  - Nivel propio `floor(frutas / 5) + 1`; el intervalo de _tick_ baja con el nivel (`TICK_BASE_MS = 140`, `TICK_STEP_MS = 8` por nivel, mínimo `TICK_MIN_MS = 70`).
  - Si la serpiente ocupa las 300 celdas, la partida termina como victoria (`onGameOver`).
- Fruta aleatoria en cada aparición, tomada de las 22 frutas pixel-art de la fila `y = 136` de `fruits.png`; la tabla `SPRITE_ATLAS.fruits` de `sprites.js` se porta a `lib/games/snake/sprites.ts`.
- Asset `fruits.png` copiado a `public/games/snake/fruits.png`.
- API del motor `start/pause/resume/restart/endGame/destroy` y callbacks `onScore/onLevel/onGameOver` (`onLives` no se invoca).
- `components/snake-canvas.tsx` con `<canvas width=800 height=600>` (4:3) escalado al ancho de `.crt-screen`.
- Entrada de teclado: `←` `↑` `→` `↓` y `W` `A` `S` `D` cambian la dirección, con `preventDefault` solo mientras se juega. Cola de hasta 2 giros pendientes y sin giro de 180° sobre sí misma.
- Entrada `serpentina` en `GAME_REGISTRY` (`Canvas`, `hasLives: false`, nota de controles).
- HUD de la plataforma alimentado por el motor (puntaje y nivel reales, vidas `—`); sin HUD original dentro del canvas (el original no lo dibuja sobre el tablero).
- Estética: tablero verde clásico de dos tonos alternados (estilo tablero de ajedrez), serpiente dibujada con primitivas de canvas (cuerpo verde-azulado, ojos en la cabeza) y frutas del spritesheet, dentro del marco CRT.
- Migración `replace_serpentina_with_snake` en `games` (`update` de `serpentina`: textos corto/largo; `id`, categoría, color, cover y `sort_order` no cambian).
- Reutilizar la cover existente `.cover-snake` (sin cambios de CSS salvo que se decida otra cosa al revisarla con `/frontend-design`).
- Nota de controles en español bajo el CRT y aviso de teclado requerido en táctiles (ya genérico en el reproductor).
- Actualizar `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Controles táctiles (gestos de deslizar) o gamepad; soporte móvil.
- Sonido y música: no hay assets de audio y el usuario no los aportó.
- Modos de juego (muros que atraviesan, obstáculos, velocidades, tamaños de tablero), frutas especiales o power-ups.
- Pantalla de selección de dificultad y persistencia de preferencias.
- Rediseño neón del tablero; solo se usa la estética verde clásica.
- Otras filas del spritesheet (vectorial y fotorrealista) y el uso de varias frutas a la vez.
- Mantener el mock `serpentina` junto al juego real: se reemplaza.
- Cambios de esquema o de la capa de leaderboard (ya genéricos en SPEC 06).
- Tests automatizados.

## Data model

```ts
// lib/games/snake/engine.ts
export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 600;

export interface SnakeCallbacks {
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void; // no se invoca: Snake no tiene vidas
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void; // choque, tablero lleno o endGame()
}

export interface SnakeEngine {
  start(): void;   // carga fruits.png y arranca el loop requestAnimationFrame; escucha teclado
  pause(): void;   // congela update; limpia la cola de giros; el último frame sigue visible
  resume(): void;  // reinicia la referencia de tiempo y el acumulador de tick
  restart(): void; // serpiente de 3 segmentos, puntaje 0, nivel 1
  endGame(): void; // fuerza gameover con el puntaje actual
  destroy(): void; // cancela rAF y quita listeners (idempotente)
}

export function createSnakeEngine(
  canvas: HTMLCanvasElement,
  callbacks?: SnakeCallbacks,
): SnakeEngine;
```

```ts
// lib/games/snake/constants.ts
export const CELL = 40;
export const COLS = 20;
export const ROWS = 15;
export const INITIAL_LENGTH = 3;
export const POINTS_PER_FRUIT = 10;
export const FRUITS_PER_LEVEL = 5;
export const TICK_BASE_MS = 140;
export const TICK_STEP_MS = 8;
export const TICK_MIN_MS = 70;
export const MAX_DT = 50; // ms, tope del dt acumulado por frame
export const MAX_QUEUED_TURNS = 2;
```

```ts
// lib/games/snake/sprites.ts: portado de sprites.js (solo la fila usada)
export interface SpriteRect { x: number; y: number; w: number; h: number; }
export const FRUITS_SHEET_SRC = "/games/snake/fruits.png";
export const FRUITS: Record<string, SpriteRect>; // 22 frutas, y = 136, h = 160
```

```ts
// lib/games/registry.ts (reemplazo de nada: entrada nueva en el registro)
serpentina: {
  Canvas: SnakeCanvas,
  hasLives: false,
  controls: controlsNote(
    [key("←"), " ", key("↑"), " ", key("→"), " ", key("↓"), " mover"],
    ["o ", key("W"), " ", key("A"), " ", key("S"), " ", key("D")],
  ),
},
```

```sql
-- Migración: replace_serpentina_with_snake
update public.games
set short = 'Come frutas y crece sin chocar.',
    long = 'Guía a la serpiente por el tablero, come las frutas para crecer y sumar puntos, y evita chocar con los muros o con tu propia cola mientras el ritmo se acelera.'
where id = 'serpentina';
```

Convenciones:

- Fórmulas del juego original (definido en este spec): `level = floor(fruits / 5) + 1`; `tickMs = max(TICK_MIN_MS, TICK_BASE_MS − (level − 1) × TICK_STEP_MS)`; el nivel 9 alcanza el mínimo de 76 ms y el nivel 10 el de 70 ms.
- Estado en el cierre de `createSnakeEngine`, sin variables de módulo mutables: `snake` (lista de celdas, cabeza primero), `direction`, `turnQueue`, `fruit` (`{ col, row, sprite }`), `score`, `fruitsEaten`, `level`, `tickAcc`, `gameState` (`'playing' | 'gameover' | 'win'`) y la referencia a la `Image` viven dentro del cierre.
- Tiempo: acumulador `tickAcc += min(dt, MAX_DT)`; mientras `tickAcc ≥ tickMs` se avanza un _tick_. El `dt` limitado evita saltos al volver de una pestaña en segundo plano.
- El _tick_ procesa en orden: sacar un giro de `turnQueue` (descartando el que sea opuesto a la dirección actual o igual a ella), calcular la nueva cabeza, comprobar muro, comprobar cuerpo (la cola actual se considera libre si no se come fruta en ese _tick_), mover, comer fruta y crecer, generar la siguiente fruta, comprobar tablero lleno.
- `Image` se crea en `start()`, nunca al importar el módulo; hasta que carga se pinta el tablero sin fruta y el loop no avanza ticks. La ruta del PNG es `/games/snake/fruits.png`.
- Fruta: celda libre elegida al azar entre las no ocupadas; sprite elegido al azar de las 22 entradas de `FRUITS`. Se dibuja con `drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)` escalada para caber en la celda (`CELL − 4` px de lado máximo) conservando la proporción y centrada.
- Callbacks solo al cambiar el valor: `onScore` al comer, `onLevel` al cambiar de nivel; `restart()` notifica `0` y `1`. `onGameOver` se llama una sola vez por partida.
- Coordenadas con origen arriba a la izquierda; celda `(col, row)` ocupa `x = col × 40`, `y = row × 40`.
- Puntaje máximo posible: 297 frutas × 10 = 2.970 puntos (300 celdas − 3 iniciales), muy por debajo del CHECK de 1.000.000 de `scores`; el motor no necesita tope.
- El puntaje se guarda con la Server Action `submitScore` existente (`game_id = 'serpentina'`).
- El tablero es verde claro `#aad751` y verde oscuro `#a2d149` alternados; la serpiente es `#4a75e8` (cuerpo) con la cabeza algo más oscura. Son valores de partida que se pueden afinar con `/frontend-design` al implementar.
- La migración no cambia el esquema ni los tipos generados de `lib/supabase/database.types.ts`.

## Implementation plan

1. Leer en `node_modules/next/dist/docs/01-app/` las guías de Client Components y efectos en el navegador (según `AGENTS.md`) y revisar `components/game-player.tsx`, `components/arkanoid-canvas.tsx`, `lib/games/registry.ts` y `lib/games/arkanoid/`. Verificación: notas de diferencias escritas antes de tocar código.
2. Copiar `references/source-assets/snake-assets/fruits.png` a `public/games/snake/fruits.png`. Verificación: con `npm run dev`, `http://localhost:3000/games/snake/fruits.png` devuelve la imagen (200) y las rutas `/games/serpentina` y `/games/serpentina/play` siguen resolviendo.
3. Crear `lib/games/snake/` con `constants.ts` y `sprites.ts` (las 22 frutas de `sprites.js` tipadas). Verificación: `npx tsc --noEmit` y `npm run lint` sin errores; `FRUITS` tiene 22 entradas con `y = 136` y `h = 160`.
4. Crear `lib/games/snake/engine.ts` con `createSnakeEngine`: estado encapsulado, carga de `fruits.png` en `start()`, loop con `dt` limitado y acumulador de _tick_, cola de giros, movimiento, comer y crecer, nivel y velocidad, choques, tablero lleno, dibujo del tablero, la serpiente y la fruta, teclado con `preventDefault` solo mientras se juega, cola limpiada en `blur` y `pause()`, callbacks y `destroy()` idempotente. Verificación: typecheck, lint y el módulo no referencia `document`, `window` ni `Image` fuera de `start()`/`destroy()`.
5. Crear `components/snake-canvas.tsx` (`"use client"`) con el patrón de `components/arkanoid-canvas.tsx` (handle imperativo, callbacks por ref, motor creado y destruido en `useEffect`, `width: 100%; height: auto`). Verificación: typecheck y lint; montar y desmontar repetidamente no deja listeners ni loops.
6. Añadir la entrada `serpentina` a `GAME_REGISTRY` en `lib/games/registry.ts` con `hasLives: false` y la nota de controles. Verificación: `npx tsc --noEmit`, `npm run lint`; Asteroids, Tetris, Arkanoid y los mocks restantes se comportan igual que antes.
7. Aplicar la migración `replace_serpentina_with_snake` con `apply_migration` y revisar `.cover-snake` con `/frontend-design` (ajustar solo si desentona con el juego real). Verificación: `execute_sql` devuelve la fila `serpentina` con los textos nuevos y `id`, `category`, `color`, `cover` y `sort_order = 3` intactos; `get_advisors` sin avisos nuevos; aparece en `/library`, `/games/serpentina` y en las pestañas de `/hall-of-fame` sin perder puntajes previos.
8. Probar en el navegador (Playwright MCP, capturas en `.playwright-screenshots/`): controles con flechas y WASD, comer frutas, crecimiento, subida de nivel y aceleración, choque con muro y con el cuerpo, fin de partida, pausa, jugar de nuevo, guardado y aparición en `/hall-of-fame` y `/games/serpentina`, y error de guardado con reintento. Verificación final: `npm run lint` y `npm run build` sin errores ni errores de consola o hidratación.
9. Actualizar `CLAUDE.md` (juegos con motor real: Asteroids, Tetris, Arkanoid y Snake; `fruits.png` en `public/games/snake/`; `serpentina` deja de ser mock). Verificación: el texto refleja el estado final.

> Antes de escribir código de Next (pasos 5 y 6), leer la guía correspondiente en `node_modules/next/dist/docs/`. Usar `/frontend-design` solo para la cover y la nota de controles, según `CLAUDE.md`.

## Acceptance criteria

- [ ] `/games/serpentina/play` muestra el tablero de 20×15 celdas de dos tonos de verde, la serpiente de 3 segmentos en el centro, una fruta del spritesheet y el HUD de la plataforma con puntaje 0, vidas `—` y nivel 01.
- [ ] La serpiente se mueve una celda por _tick_ a 140 ms en el nivel 1; `←` `↑` `→` `↓` y `W` `A` `S` `D` cambian la dirección y la página no hace scroll con esas teclas mientras se juega.
- [ ] Pulsar la dirección opuesta a la actual no hace girar la serpiente sobre sí misma; dos giros pulsados dentro de un mismo _tick_ se aplican en _ticks_ consecutivos (máximo 2 en cola).
- [ ] Comer una fruta suma exactamente 10 puntos, añade un segmento, genera una nueva fruta en una celda libre y el HUD de la plataforma se actualiza.
- [ ] La fruta cambia de sprite entre apariciones y nunca aparece sobre la serpiente.
- [ ] Al comer 5 frutas el HUD pasa a nivel 02 y el _tick_ baja a 132 ms; el _tick_ nunca baja de 70 ms.
- [ ] Chocar con cualquier borde abre el modal "FIN DEL JUEGO" con el puntaje final.
- [ ] Chocar con el propio cuerpo abre el modal "FIN DEL JUEGO"; moverse a la celda que la cola libera en ese mismo _tick_ no cuenta como choque.
- [ ] Si la serpiente ocupa las 300 celdas, se abre el modal "FIN DEL JUEGO" con el puntaje acumulado (máximo 2.970).
- [ ] `PAUSA` congela el juego (la serpiente queda quieta y las teclas no cambian la dirección) y muestra "EN PAUSA"; `REANUDAR` continúa sin saltos; `FIN` abre el modal con el puntaje actual.
- [ ] El canvas no dibuja overlays de pausa ni de fin; `P` y `Escape` no pausan el juego.
- [ ] `JUGAR DE NUEVO` reinicia puntaje 0, nivel 1 y serpiente de 3 segmentos, sin acelerar el juego (un solo loop activo y un solo listener de teclado).
- [ ] Salir de la página y volver no deja `requestAnimationFrame` ni listeners del juego anterior (una pulsación gira la serpiente una sola vez).
- [ ] Con el modal de guardado abierto, escribir espacios y flechas en el input del nombre funciona con normalidad (el motor ya no captura teclas).
- [ ] Mantener una flecha pulsada y pulsar `PAUSA` no deja giros pendientes al reanudar (cola limpiada en `pause()`/`blur`).
- [ ] El canvas mantiene proporción 4:3 dentro de `.crt-screen` a 1280 px y 768 px.
- [ ] `games` contiene la fila `serpentina` con los textos nuevos y `id`, `ARCADE`, `green`, `cover-snake` y `sort_order = 3` sin cambios; los puntajes previos de `serpentina` siguen visibles; `SERPENTINA` aparece en `/library`, `/games/serpentina` y las pestañas de `/hall-of-fame`.
- [ ] Guardar el puntaje crea una fila en `scores` con `game_id = 'serpentina'` y aparece en `/hall-of-fame` y `/games/serpentina` tras recargar; `Partidas` y `Mejor global` coinciden con `COUNT` y `MAX` de `scores`.
- [ ] Si `submitScore` falla, el modal sigue abierto, muestra un error en español y permite reintentar sin perder el puntaje.
- [ ] Bajo el CRT se ve la nota de controles en español y, en pantallas táctiles, el aviso de que el juego requiere teclado.
- [ ] Los demás mocks siguen mostrando el simulador sin cambios, y Asteroids, Tetris y Arkanoid funcionan igual.
- [ ] `npm run lint` y `npm run build` terminan sin errores, sin errores de hidratación ni de consola en `/games/serpentina` y `/games/serpentina/play`.

## Decisions

- **Sí:** reemplazar el mock `serpentina` (`update`, conserva `id` y puntajes). Decisión del usuario; evita dos juegos duplicados en el catálogo.
- **No:** entrada nueva `snake` con `sort_order = 12`. Descartada por el usuario.
- **Sí:** muros mortales y sin vidas (`hasLives: false`, vidas `—`). Decisión del usuario; es el Snake clásico y sigue el criterio de Tetris.
- **No:** 3 vidas o muros que se atraviesan. Descartados por el usuario.
- **Sí:** nivel propio `floor(frutas / 5) + 1` con aceleración hasta un tope. Decisión del usuario; da progresión visible en el HUD sin usar `POINTS_PER_LEVEL`.
- **No:** velocidad fija con nivel siempre 01. Descartada por el usuario.
- **Sí:** estética verde clásica con frutas pixel-art del spritesheet dentro del CRT. Decisión del usuario; coincide con la fila que referencia `sprites.js`.
- **No:** rediseño neón y fila vectorial plana. Descartados por el usuario.
- **Sí:** motor TS sin globals en `lib/games/snake/` con un componente cliente delgado y una entrada en `GAME_REGISTRY`. Mismo patrón que SPEC 05, 07 y 08.
- **Sí:** `id = 'serpentina'` (no `snake`). Decisión por defecto, no discutida: es consecuencia de reemplazar el mock y conserva las URLs y los puntajes existentes; el nombre del motor y los archivos usan `snake`.
- **Sí:** mantener `title`, `category`, `color`, `cover` y `sort_order` del mock y cambiar solo los textos corto y largo. Decisión por defecto, no discutida: ya son coherentes con Snake y minimizan el cambio de catálogo.
- **Sí:** tablero de 20×15 celdas de 40 px sobre un canvas de 800×600. Decisión por defecto, no discutida: mantiene 4:3 como los demás juegos y cada celda queda grande para las frutas de 160 px de alto.
- **Sí:** _tick_ de 140 ms con −8 ms por nivel y mínimo de 70 ms. Decisión por defecto, no discutida: valores razonables para jugabilidad que se pueden afinar en la prueba del paso 8.
- **Sí:** 10 puntos por fruta, sin bonus por velocidad o nivel. Decisión por defecto, no discutida: es la fórmula más simple y el máximo (2.970) queda lejos del CHECK de `scores`.
- **Sí:** victoria al llenar el tablero, usando `onGameOver`. Decisión por defecto, no discutida: la plataforma solo tiene el modal de fin, igual que en SPEC 08.
- **Sí:** teclado con flechas y `WASD`, cola de 2 giros y bloqueo del giro de 180°. Decisión por defecto, no discutida: evita muertes injustas al pulsar dos teclas seguidas en un mismo _tick_.
- **Sí:** la cola de la serpiente cuenta como celda libre al comprobar el choque con el cuerpo, salvo que se coma fruta en ese _tick_. Decisión por defecto, no discutida: es el comportamiento del Snake clásico.
- **Sí:** sin HUD dentro del canvas. Decisión por defecto, no discutida: no hay juego de referencia con HUD propio y el de la plataforma ya muestra puntaje y nivel.
- **Sí:** serpiente dibujada con primitivas de canvas, sin sprites de cuerpo. Decisión por defecto, no discutida: los assets aportados solo contienen frutas.
- **Sí:** sin sonido. Decisión por defecto, no discutida: no hay assets de audio entre los aportados.
- **Sí:** una sola fila de frutas (pixel-art) y una sola fruta en el tablero. Decisión por defecto, no discutida: es el alcance de `sprites.js`.
- **Sí:** `dt` limitado a 50 ms con acumulador de _tick_. Decisión por defecto, no discutida: evita avanzar varias celdas de golpe al volver de una pestaña en segundo plano.
- **Sí:** teclado ignorado en pausa y tras el fin de partida. Decisión por defecto, no discutida: la plataforma congela el juego.
- **Sí:** sin tope de puntaje en el motor. Decisión por defecto, no discutida: el máximo es 2.970 puntos.
- **Sí:** solo teclado; en táctiles se avisa. Mismo criterio que SPEC 05, 07 y 08.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Strict Mode monta el motor dos veces y duplica loops, listeners o `Image` | Estado encapsulado, recurso creado en `start()`, `destroy()` idempotente que ignora la carga de imagen pendiente, criterio de aceptación explícito |
| Teclas del juego hacen scroll o activan un botón enfocado | `preventDefault` solo mientras se juega y quitar el foco del botón tras pulsarlo (ya lo hace el reproductor) |
| El motor captura flechas con el modal de guardado abierto e impide escribir | `preventDefault` únicamente con la partida en juego y sin pausa; criterio de aceptación explícito |
| Giros pulsados al pausar o perder el foco quedan pendientes | Limpiar `turnQueue` en `blur` y en `pause()`; criterio de aceptación explícito |
| Dos giros rápidos en un mismo _tick_ hacen que la serpiente se mate a sí misma (180°) | Cola de máximo 2 giros, validados contra la dirección vigente en cada _tick_; criterio de aceptación explícito |
| `fruits.png` pesa 586 KB y retrasa el primer frame | Se carga en `start()` antes del primer _tick_; el tablero se pinta mientras tanto; es el mismo orden de tamaño que el spritesheet de Arkanoid |
| Las coordenadas de `sprites.js` recortan mal alguna fruta (bordes o fruta vecina) | El paso 3 comprueba las 22 entradas y el paso 8 revisa en captura que todas se ven completas; se ajusta `sprites.ts` si alguna no |
| Las frutas son de ancho variable (110–170 px) y se deforman al escalar | Se escala con proporción conservada y centrada en la celda; criterio visual en el paso 8 |
| Reemplazar el mock deja `cover-snake` y textos antiguos inconsistentes con el juego | El paso 7 revisa la cover y actualiza los textos en la misma migración |
| Los assets en `public/games/snake/` comparten prefijo con las rutas `/games/[id]` | La URL del asset (`/games/snake/fruits.png`) no coincide con `/games/[id]` ni `/games/[id]/play` (el `id` es `serpentina`); se verifica en el paso 2 |
| Las frutas de las imágenes proceden de un juego comercial (Google Snake, vía spriters-resource) | Son assets aportados por el usuario para uso en este proyecto de aprendizaje; el spec no copia nombre, tablero ni serpiente del juego original |

## What is **not** in this spec

- Controles táctiles, gestos o gamepad.
- Sonido y música.
- Modos de juego, obstáculos, power-ups, frutas especiales o selector de dificultad.
- Rediseño neón del tablero y otras filas del spritesheet.
- Mantener el mock `serpentina` o añadir una entrada `snake` aparte.
- Cambios de esquema, subir el CHECK de `scores` o cambios en el leaderboard.
- Portar otros juegos.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propio spec.
