# SPEC 08 — Juego Arkanoid jugable

> **Status:** Implementado  
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-24
> **Objective:** Portar el juego de `references/started-games/04-arkanoid/` a un motor TypeScript con canvas e integrarlo como nuevo juego `arkanoid` del catálogo, jugable en `/games/arkanoid/play` con el HUD, la pausa y el puntaje guardado en el leaderboard de la plataforma.

---

## Por qué existe este spec

SPEC 05 portó Asteroids como primer motor real y SPEC 07 portó Tetris y dejó el registro `lib/games/registry.ts` (`GAME_REGISTRY`). SPEC 06 hizo el catálogo y el ranking genéricos en Supabase. Este spec aplica esos patrones al tercer juego real: añadir Arkanoid es una entrada más en el registro, sin tocar `components/game-player.tsx`.

La referencia `04-arkanoid` es un clon en canvas (`game.js` de 268 líneas, `levels.js`, spritesheet PNG y 2 sonidos), en JS con globals y sin dependencias. El catálogo ya contiene el mock `bloque-buster` (ARCADE, `cover-bricks`), muy parecido; por decisión del usuario **no se reemplaza**: Arkanoid entra como entrada nueva y `bloque-buster` sigue con el simulador, igual que `caida` junto a Tetris en SPEC 07.

A diferencia de Asteroids y Tetris, este juego trae assets (spritesheet y sonidos) que el usuario decidió incluir.

## Scope

**In:**

- Motor en `lib/games/arkanoid/` (TypeScript sin globals), portado literalmente de `game.js` y `levels.js`: canvas 800×600, paleta de 81×14 px a `y = 560` con `PADDLE_SPEED = 400` px/s, pelota de 16×16 con velocidad base `vx = 200`, `vy = −300` multiplicada por la velocidad del nivel, rebote en paredes izquierda, derecha y techo, rebote en la paleta (ventana vertical de `paddle.h + 8`), colisión AABB con bloques (un bloque por frame, invierte `vy`), 10 puntos por bloque, 3 vidas (la pelota que cae por debajo del canvas resta una y se recoloca sobre la paleta) y fin de partida al quedarse sin vidas.
- 5 niveles de `levels.js` (parrilla 10×6, pirámide, tablero de ajedrez, filas con huecos, marco con cruz) con velocidades `[1.00, 1.10, 1.21, 1.33, 1.46]`; el puntaje se acumula entre niveles. Al limpiar el nivel 5 la partida termina como victoria (`onGameOver`).
- Bloques de 64×24 px en una cuadrícula de 10 columnas con origen `(80, 80)` y 7 colores de sprite (`red`, `yellow`, `cyan`, `magenta`, `hotpink`, `green`, `gray`).
- Animación de explosión de 4 frames (`EXPLOSION_DURATION = 150` ms) al destruir un bloque.
- Sonidos de rebote (`ball-bounce.mp3`) y rotura de bloque (`break-sound.mp3`).
- Assets en `public/games/arkanoid/` (`spritesheet-breakout.png`, `ball-bounce.mp3`, `break-sound.mp3`) y tabla de sprites/explosiones portada de `assets/spritesheet.js` a `lib/games/arkanoid/sprites.ts`.
- API del motor `start/pause/resume/restart/endGame/destroy` y callbacks `onScore/onLives/onLevel/onGameOver`.
- `components/arkanoid-canvas.tsx` con `<canvas width=800 height=600>` (4:3) escalado al ancho de `.crt-screen`.
- Entrada: `←` `→` mueven la paleta (con `preventDefault` solo mientras se juega) y el ratón la mueve con `mousemove` sobre el canvas (coordenadas escaladas por `getBoundingClientRect`).
- Entrada `arkanoid` en `GAME_REGISTRY` (`Canvas`, `hasLives: true`, nota de controles).
- HUD de la plataforma alimentado por el motor (puntaje, vidas y nivel reales) y HUD original dibujado en el canvas (`Score`, `Nivel` y pelotas de vidas).
- Estética original (fondo negro y sprites del spritesheet) dentro del marco CRT.
- Migración `add_arkanoid_game` en `games` (`insert`, `sort_order = 11`).
- Cover `.cover-arkanoid` en `app/globals.css`, distinta de `.cover-bricks` (que sigue en `bloque-buster`).
- Nota de controles en español bajo el CRT y aviso de teclado requerido en táctiles (ya genérico en el reproductor).
- Actualizar `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Controles táctiles o gamepad; soporte móvil.
- Selector de nivel del overlay de pausa y teclas `P`/`Escape` de pausa: la pausa la controla el botón `PAUSA/REANUDAR` de la plataforma.
- Overlays propios `GAME OVER`, `¡Completaste el juego!` y `PAUSA` del canvas: los cubren el modal y la pausa de la plataforma.
- Interruptor de silencio, volumen o música.
- Power-ups, bloques resistentes, ángulo de rebote según el punto de impacto en la paleta u otros cambios de balance respecto a `game.js`.
- Reemplazar o eliminar el mock `bloque-buster`.
- Cambios de esquema o de la capa de leaderboard (ya genéricos en SPEC 06).
- Tests automatizados.

## Data model

```ts
// lib/games/arkanoid/engine.ts
export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 600;

export interface ArkanoidCallbacks {
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void; // sin vidas, nivel 5 completado o endGame()
}

export interface ArkanoidEngine {
  start(): void;   // carga el spritesheet y arranca el loop requestAnimationFrame; escucha teclado y ratón
  pause(): void;   // congela update; limpia las teclas pulsadas; el último frame sigue visible
  resume(): void;  // reinicia la referencia de tiempo para evitar saltos
  restart(): void; // puntaje 0, vidas 3, nivel 1, paleta centrada
  endGame(): void; // fuerza gameover con el puntaje actual
  destroy(): void; // cancela rAF y quita listeners (idempotente)
}

export function createArkanoidEngine(
  canvas: HTMLCanvasElement,
  callbacks?: ArkanoidCallbacks,
): ArkanoidEngine;
```

```ts
// lib/games/arkanoid/constants.ts (valores portados de game.js)
export const PADDLE_SPEED = 400;
export const BLOCK_COLS = 10;
export const BLOCK_ROWS = 6;
export const BLOCK_W = 64;
export const BLOCK_H = 24;
export const BLOCKS_ORIGIN_X = (800 - BLOCK_COLS * BLOCK_W) / 2; // 80
export const BLOCKS_ORIGIN_Y = 80;
export const BASE_BALL_VX = 200;
export const BASE_BALL_VY = -300;
export const POINTS_PER_BLOCK = 10;
export const INITIAL_LIVES = 3;
export const MAX_DT = 50; // ms
// Paleta: { y: 560, w: 81, h: 14 }. Pelota: { w: 16, h: 16 }.
```

```ts
// lib/games/arkanoid/levels.ts: LEVELS portado de levels.js, 5 niveles
export interface LevelBlock { col: number; row: number; color: BlockColor; }
export interface Level { speed: number; blocks: LevelBlock[]; }
export const LEVELS: Level[]; // speed: 1.00, 1.10, 1.21, 1.33, 1.46

// lib/games/arkanoid/sprites.ts: SPRITES, EXPLOSION_FRAMES y EXPLOSION_DURATION de assets/spritesheet.js
```

```ts
// lib/games/registry.ts (entrada nueva)
arkanoid: {
  Canvas: ArkanoidCanvas,
  hasLives: true,
  controls: controlsNote([key("←"), " ", key("→"), " mover"], ["o el ", "ratón"]),
},
```

```sql
-- Migración: add_arkanoid_game
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values (
  'arkanoid',
  'ARKANOID',
  'Rompe todos los bloques con la pelota.',
  'Mueve la paleta para que la pelota no caiga, rompe los bloques de cada nivel y supera los cinco niveles mientras la pelota se acelera.',
  'ARCADE',
  'cover-arkanoid',
  'magenta',
  11
);
```

Convenciones:

- Constantes y fórmulas portadas literalmente de `references/started-games/04-arkanoid/game.js` y `levels.js`; el `dt` se limita a 50 ms (la referencia no lo limita). El paso `dt` va en segundos y `EXPLOSION_DURATION` en ms, como en la referencia.
- Estado en el cierre de `createArkanoidEngine`, sin variables de módulo mutables: `paddle`, `ball`, `blocks`, `explosions`, `lives`, `score`, `currentLevel`, `keys`, `gameState` (`'playing' | 'gameover' | 'win'`) y la referencia al spritesheet y a los `Audio` viven dentro del cierre.
- `Image` y `Audio` se crean en `start()`, nunca al importar el módulo. Los sprites se dibujan con `drawImage` de la imagen cargada; hasta que carga solo se pinta el fondo negro y el loop no actualiza la física. La ruta del PNG es `/games/arkanoid/spritesheet-breakout.png`.
- Sonido: `audio.cloneNode()` y `.play()` con `.catch(() => {})` para que el bloqueo de _autoplay_ del navegador no genere errores de consola.
- Coordenadas con origen arriba a la izquierda. Posición del ratón: `(clientX − rect.left) × (canvas.width / rect.width)`, centrada en la paleta y limitada a `[0, 800 − paddle.w]`.
- Callbacks solo al cambiar el valor: `onScore` al sumar, `onLives` al perder una vida, `onLevel` al cambiar de nivel; `restart()` notifica `0`, `3` y `1`. `onGameOver` se llama una sola vez por partida.
- Tras limpiar un nivel (`< 5`) se llama a `loadLevel(n + 1)`: bloques nuevos, explosiones vaciadas y pelota sobre la paleta con la velocidad del nivel nuevo; la paleta no se recoloca. Al limpiar el nivel 5 pasa a `'win'` y se llama a `onGameOver(score)`.
- Puntaje máximo posible: 208 bloques × 10 = 2.080 puntos (60 + 40 + 30 + 39 + 39 bloques), muy por debajo del CHECK de 1.000.000 de `scores`; el motor no necesita tope.
- El puntaje se guarda con la Server Action `submitScore` existente (`game_id = 'arkanoid'`).
- El canvas dibuja el HUD original (`Score: N` arriba a la izquierda, `Nivel: N` arriba al centro y una pelota por vida arriba a la derecha) solo mientras `gameState === 'playing'`; no dibuja overlays de pausa ni de fin.
- La migración no cambia el esquema ni los tipos generados de `lib/supabase/database.types.ts`.

## Implementation plan

1. Leer en `node_modules/next/dist/docs/01-app/` las guías de Client Components y efectos en el navegador (según `AGENTS.md`) y revisar `components/game-player.tsx`, `components/tetris-canvas.tsx`, `lib/games/registry.ts` y `lib/games/tetris/`. Verificación: notas de diferencias con la referencia escritas antes de tocar código.
2. Copiar `spritesheet-breakout.png`, `ball-bounce.mp3` y `break-sound.mp3` desde `references/started-games/04-arkanoid/assets/` a `public/games/arkanoid/`. Verificación: con `npm run dev`, `http://localhost:3000/games/arkanoid/spritesheet-breakout.png` devuelve la imagen y los dos mp3 responden 200.
3. Crear `lib/games/arkanoid/` con `constants.ts`, `levels.ts` (`LEVELS` portado de `levels.js`) y `sprites.ts` (`SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`). Verificación: `npx tsc --noEmit` y `npm run lint` sin errores; los niveles suman 60, 40, 30, 39 y 39 bloques.
4. Crear `lib/games/arkanoid/engine.ts` con `createArkanoidEngine`: estado encapsulado, carga de spritesheet y sonidos en `start()`, loop con `dt` limitado, movimiento de paleta por teclado y ratón, física de pelota, colisiones, explosiones, vidas, niveles, fin y victoria, HUD del canvas, teclado con `preventDefault` solo mientras se juega, teclas limpiadas en `blur` y `pause()`, callbacks y `destroy()` idempotente. Verificación: typecheck, lint y el módulo no referencia `document`, `window`, `Image` ni `Audio` fuera de `start()`/`destroy()`.
5. Crear `components/arkanoid-canvas.tsx` (`"use client"`) con el mismo patrón que `components/tetris-canvas.tsx` (handle imperativo, callbacks por ref, motor creado y destruido en `useEffect`, `width: 100%; height: auto`). Verificación: typecheck y lint; montar y desmontar repetidamente no deja listeners ni loops.
6. Añadir la entrada `arkanoid` a `GAME_REGISTRY` en `lib/games/registry.ts` con `hasLives: true` y la nota de controles. Verificación: `npx tsc --noEmit`, `npm run lint`; Asteroids, Tetris y los mocks (incluido `bloque-buster`) se comportan igual que antes.
7. Aplicar la migración `add_arkanoid_game` con `apply_migration` y diseñar `.cover-arkanoid` con `/frontend-design`. Verificación: `execute_sql` devuelve la fila `arkanoid` con `sort_order = 11` y `bloque-buster` sin cambios; `get_advisors` sin avisos nuevos; aparece en `/library` (filtro ARCADE), `/games/arkanoid` y en las pestañas de `/hall-of-fame`.
8. Probar en el navegador (Playwright MCP, capturas en `.playwright-screenshots/`): mover con teclado y ratón, rebotes, romper bloques con explosión y sonido, perder vidas, pasar de nivel, fin de partida, pausa, jugar de nuevo, guardado y aparición en `/hall-of-fame` y `/games/arkanoid`, y error de guardado con reintento. Verificación final: `npm run lint` y `npm run build` sin errores ni errores de consola o hidratación.
9. Actualizar `CLAUDE.md` (juegos con motor real: Asteroids, Tetris y Arkanoid; assets en `public/games/arkanoid/`; `bloque-buster` sigue siendo mock). Verificación: el texto refleja el estado final.

> Antes de escribir código de Next (pasos 5 y 6), leer la guía correspondiente en `node_modules/next/dist/docs/`. Usar `/frontend-design` solo para `.cover-arkanoid` y la nota de controles, según `CLAUDE.md`.

## Acceptance criteria

- [ ] `/games/arkanoid/play` muestra la parrilla del nivel 1 (60 bloques de 6 colores), la paleta centrada, la pelota sobre ella y el HUD de la plataforma con puntaje 0, vidas `♥ ♥ ♥` y nivel 01.
- [ ] `←`/`→` mueven la paleta a 400 px/s sin salir del canvas y el ratón sobre el canvas la mueve a la posición del cursor, también con el canvas escalado; la página no hace scroll con esas teclas mientras se juega.
- [ ] La pelota rebota en las paredes izquierda, derecha y techo, y en la paleta; al romper un bloque suma exactamente 10 puntos, invierte `vy` y el HUD de la plataforma y el del canvas se actualizan.
- [ ] Al romper un bloque se reproduce la animación de explosión de 4 frames durante 150 ms y suena `break-sound.mp3`; al rebotar suena `ball-bounce.mp3`, y un bloqueo de _autoplay_ del navegador no genera errores de consola.
- [ ] Si la pelota cae por debajo del canvas se pierde una vida (el HUD pasa a `♥ ♥`), la pelota vuelve a la paleta con la velocidad del nivel y el juego sigue; con la tercera caída se abre el modal "FIN DEL JUEGO" con el puntaje final.
- [ ] Al limpiar un nivel carga el siguiente (HUD 02, 03…) con su patrón de bloques y su velocidad (`1.10`, `1.21`, `1.33`, `1.46`), conservando el puntaje y las vidas.
- [ ] Al limpiar el nivel 5 se abre el modal "FIN DEL JUEGO" con el puntaje acumulado (máximo 2.080).
- [ ] `PAUSA` congela el juego (pelota y paleta quietas, el ratón y las teclas no mueven la paleta) y muestra "EN PAUSA"; `REANUDAR` continúa sin salto de la pelota; `FIN` abre el modal con el puntaje actual.
- [ ] El canvas no dibuja overlays de pausa, `GAME OVER` ni de victoria, ni el selector de nivel; `P` y `Escape` no pausan el juego.
- [ ] `JUGAR DE NUEVO` reinicia nivel 1, puntaje 0 y 3 vidas, sin acelerar el juego (un solo loop activo, un solo listener de teclado y de ratón).
- [ ] Salir de la página y volver no deja `requestAnimationFrame` ni listeners del juego anterior (una pulsación mueve la paleta una sola vez y un clic de ratón no dispara nada extra).
- [ ] Con el modal de guardado abierto, escribir espacios y flechas en el input del nombre funciona con normalidad (el motor ya no captura teclas).
- [ ] Mantener `←` pulsado y pulsar `PAUSA` no deja la paleta moviéndose al reanudar (teclas limpiadas en `pause()`/`blur`).
- [ ] El canvas mantiene proporción 4:3 dentro de `.crt-screen` a 1280 px y 768 px.
- [ ] `games` contiene la fila `arkanoid` (`ARCADE`, `magenta`, `cover-arkanoid`, `sort_order = 11`) y la fila `bloque-buster` no cambió; `ARKANOID` aparece en `/library`, `/games/arkanoid` y las pestañas de `/hall-of-fame`.
- [ ] Guardar el puntaje crea una fila en `scores` con `game_id = 'arkanoid'` y aparece en `/hall-of-fame` y `/games/arkanoid` tras recargar; `Partidas` y `Mejor global` coinciden con `COUNT` y `MAX` de `scores`.
- [ ] Si `submitScore` falla, el modal sigue abierto, muestra un error en español y permite reintentar sin perder el puntaje.
- [ ] Bajo el CRT se ve la nota de controles en español y, en pantallas táctiles, el aviso de que el juego requiere teclado.
- [ ] `bloque-buster` y el resto de mocks siguen mostrando el simulador sin cambios, y Asteroids y Tetris funcionan igual.
- [ ] `npm run lint` y `npm run build` terminan sin errores, sin errores de hidratación ni de consola en `/games/arkanoid` y `/games/arkanoid/play`.

## Decisions

- **Sí:** entrada nueva `arkanoid` (`insert`, `sort_order = 11`) y mantener `bloque-buster` como mock. Decisión del usuario; implica dos juegos de temática similar, aceptable por ahora.
- **No:** reemplazar `bloque-buster` por el juego real. Descartado por el usuario.
- **Sí:** incluir spritesheet, animación de explosión y los dos sonidos, con los assets en `public/games/arkanoid/`. Decisión del usuario; mantiene la fidelidad visual y sonora de la referencia.
- **No:** dibujar solo con primitivas de canvas ni dejar el sonido fuera. Descartado por el usuario.
- **Sí:** control con teclado y ratón. Decisión del usuario; el ratón es el control natural de Arkanoid y es parte de la referencia.
- **Sí:** eliminar el selector de nivel y las teclas `P`/`Escape` de pausa; la pausa es la de la plataforma. Decisión del usuario; así no hay dos fuentes del estado de pausa ni se pueden saltar niveles para el ranking.
- **Sí:** motor TS sin globals en `lib/games/arkanoid/` con un componente cliente delgado y una entrada en `GAME_REGISTRY`. Mismo patrón que SPEC 05 y SPEC 07.
- **Sí:** fin de partida en victoria al limpiar el nivel 5, usando `onGameOver` con el puntaje acumulado. Decisión por defecto, no discutida: la referencia muestra `¡Completaste el juego!` y la plataforma solo tiene el modal de fin.
- **Sí:** `hasLives: true` y niveles tomados del motor (5 niveles). Decisión por defecto, no discutida: Arkanoid tiene 3 vidas y niveles propios, no `POINTS_PER_LEVEL`.
- **Sí:** sin tope de puntaje en el motor. Decisión por defecto, no discutida: el máximo es 2.080 puntos, lejos del CHECK de 1.000.000.
- **Sí:** `title` `ARKANOID`, categoría `ARCADE`, color `magenta` y textos corto/largo en español. Decisión por defecto, no discutida: el título sigue el nombre de la carpeta de referencia; el color evita repetir el `cyan` de `bloque-buster`; todo se puede cambiar antes de implementar.
- **Sí:** nueva `.cover-arkanoid` en lugar de reutilizar `.cover-bricks`. Decisión por defecto, no discutida: así las tarjetas de `bloque-buster` y `arkanoid` se distinguen.
- **Sí:** estética original (fondo negro y sprites) sin rediseño neón, y HUD original del canvas además del de la plataforma. Decisión por defecto, no discutida: mismo criterio que SPEC 05 y SPEC 07 (el HUD del canvas es parte del juego original).
- **Sí:** `dt` limitado a 50 ms aunque la referencia no lo limita. Decisión por defecto, no discutida: evita que una pestaña en segundo plano haga atravesar bloques a la pelota al volver.
- **Sí:** teclado y ratón ignorados en pausa y tras el fin de partida. Decisión por defecto, no discutida: la referencia mueve la paleta con el ratón aun en pausa, pero la plataforma congela el juego.
- **Sí:** sin sonido ni movimiento durante la carga del spritesheet; el loop de física arranca cuando la imagen carga. Decisión por defecto, no discutida: es el comportamiento de la referencia (`loadSpritesheet(cb)`).
- **Sí:** sin interruptor de silencio. Decisión por defecto, no discutida: el sonido es breve y el volumen lo controla el navegador; se puede añadir en otro spec.
- **Sí:** solo teclado y ratón; en táctiles se avisa. Mismo criterio que SPEC 05 y SPEC 07.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Strict Mode monta el motor dos veces y duplica loops, listeners, `Image` o `Audio` | Estado encapsulado, recursos creados en `start()`, `destroy()` idempotente que ignora la carga de imagen pendiente, criterio de aceptación explícito |
| El navegador bloquea el audio hasta que hay un gesto del usuario | `play().catch(() => {})`; el juego empieza tras pulsar un botón de la plataforma, así que normalmente ya hay gesto |
| Teclas del juego hacen scroll o activan un botón enfocado | `preventDefault` solo mientras se juega y quitar el foco del botón tras pulsarlo (ya lo hace el reproductor) |
| El motor captura flechas con el modal de guardado abierto e impide escribir | `preventDefault` únicamente con la partida en juego y sin pausa; criterio de aceptación explícito |
| Tecla `←`/`→` pulsada al pausar o perder el foco deja la paleta "pegada" | Limpiar `keys` en `blur` y en `pause()`; criterio de aceptación explícito |
| El ratón apunta mal con el canvas escalado por CSS | Escalar con `canvas.width / rect.width` como en la referencia; verificar a 1280 px y 768 px |
| La pelota atraviesa bloques o paleta si un frame dura demasiado | `dt` limitado a 50 ms; es la misma física discreta de la referencia |
| El spritesheet no carga (404 o ruta incorrecta) y el juego queda en negro | Paso 2 verifica la URL del PNG; el error de carga se registra en consola y se detecta en la prueba del paso 8 |
| Los mp3 pesan o se solapan al romper muchos bloques seguidos | Se porta `cloneNode().play()` literal; los bloques se rompen de uno en uno por frame |
| `ARKANOID` es el nombre de un juego comercial | El nombre sigue la carpeta de referencia del usuario; `title` e `id` pueden cambiarse antes de aprobar el spec |
| Los assets en `public/games/arkanoid/` comparten prefijo con las rutas `/games/[id]` | Las URLs de los assets (`/games/arkanoid/<archivo>`) no coinciden con `/games/[id]` ni `/games/[id]/play`; se verifica en el paso 2 |

## What is **not** in this spec

- Controles táctiles, gamepad o soporte móvil.
- Selector de nivel, teclas `P`/`Escape` y overlays propios de la referencia.
- Interruptor de silencio, volumen o música.
- Power-ups, bloques resistentes, rebote angular o cambios de balance.
- Reemplazar o eliminar el mock `bloque-buster`.
- Cambios de esquema, subir el CHECK de `scores` o cambios en el leaderboard.
- Portar otros juegos.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propio spec.
