# SPEC 05 — Juego Asteroids jugable

> **Status:** Implementado  
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-23
> **Objective:** Portar el juego de `references/started-games/02-asteroids/` a un motor TypeScript con un componente de canvas e integrarlo como nuevo juego `asteroids` del catálogo, jugable en `/games/asteroids/play` con el HUD, la pausa y el guardado de puntaje de la plataforma.

---

## Por qué existe este spec

Hasta ahora `/games/[id]/play` solo ejecuta un simulador (`components/game-player.tsx`): el puntaje sube solo con un `setInterval` y no hay juego real. La referencia `02-asteroids` es un clon completo en canvas (`game.js`, 510 líneas, JS con globals, sin dependencias). Este spec lo convierte en el **primer juego real** de la plataforma y deja el patrón (motor TS sin globals + componente que lo monta) para portar después Tetris y Arkanoid (`references/started-games/03-tetris`, `04-arkanoid`).

## Scope

**In:**

- Motor del juego en TypeScript, sin globals ni acceso al DOM global, en `lib/games/asteroids/`. Mantiene la jugabilidad de `game.js`: nave con inercia y rotación, disparo con cooldown de 0,2 s, asteroides de tamaños 3/2/1 que se parten, espacio toroidal 800×600, partículas, 3 vidas con invencibilidad de 3 s al reaparecer, niveles (`3 + level` asteroides) y power-up `3x` (disparo triple 5 s, 15 % de probabilidad de drop, garantizado a la 5ª muerte si no ha caído, TTL 12 s).
- API del motor con ciclo de vida explícito: `start()`, `pause()`, `resume()`, `restart()`, `endGame()`, `destroy()` y callbacks `onScore`, `onLives`, `onLevel`, `onGameOver`.
- Client Component `components/asteroids-canvas.tsx` con `<canvas width=800 height=600>` escalado por CSS al ancho de `.crt-screen`; monta el motor en `useEffect` y lo destruye al desmontar (sin listeners ni `requestAnimationFrame` huérfanos).
- Entrada de teclado capturada por el motor: `←` `→` rotar, `↑` propulsar, `Espacio` disparar; `preventDefault` en esas teclas mientras se juega para que la página no haga scroll.
- `components/game-player.tsx` despacha por `game.id`: `asteroids` usa el motor real; el resto de juegos conserva el simulador actual sin cambios de comportamiento.
- HUD del canvas original conservado, dibujado por el motor: `SCORE`, `NIVEL`, iconos de vidas y temporizador `3x`.
- HUD de la plataforma (`player-hud`) alimentado por el motor: puntaje, vidas y nivel reales (el nivel viene del motor, no de `POINTS_PER_LEVEL`, solo para `asteroids`). `PAUSA/REANUDAR` pausa el motor; `FIN` lo termina; el modal "FIN DEL JUEGO" (existente) aparece al perder la última vida o al pulsar `FIN`, guarda en `av_scores` con `game: "asteroids"` y `JUGAR DE NUEVO` reinicia el motor.
- Nueva entrada en `lib/games.ts`: id `asteroids`, título `ASTEROIDS`, categoría `SHOOTER`, color `cyan`, cover `cover-asteroids`, textos corto/largo en español (sin mencionar OVNIs), `best` y `plays` mock.
- Nueva clase `.cover-asteroids` en `app/globals.css` (nave y rocas vectoriales), diseñada con `/frontend-design`, sin tocar `.cover-rocas`.
- Texto de controles visible en la pantalla de juego (nota bajo el CRT o en el pie `crt-bottom`), en español.
- Estética vectorial original (blanco sobre negro, power-up cian, llama naranja) dentro del marco CRT existente.

**Out of scope (para futuros specs):**

- Portar Tetris y Arkanoid.
- Controles táctiles o gamepad; soporte móvil (el juego exige teclado; en pantallas táctiles solo se muestra un aviso de que requiere teclado).
- Rediseño neón del canvas, efectos de brillo, sonido y música.
- OVNIs, nuevos power-ups o cambios de balance respecto a `game.js`.
- Persistencia de puntajes en Supabase y ranking real (`av_scores` sigue en `localStorage`, spec propio); sesión/Auth.
- Eliminar o reemplazar el juego mock `rocas`: se mantiene como está (sigue con el simulador).
- Tests automatizados.
- Guardar el estado de la partida entre recargas.

## Data model

Sin datos persistentes nuevos: el puntaje se guarda con `saveScore({ game: "asteroids", score, name })` ya existente. Nuevos módulos y tipos:

```ts
// lib/games/asteroids/engine.ts
export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 600;

export type AsteroidsStatus = "playing" | "dead" | "gameover";

export interface AsteroidsCallbacks {
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void; // vidas = 0 o endGame()
}

export interface AsteroidsEngine {
  start(): void;      // inicia el loop requestAnimationFrame y escucha teclado
  pause(): void;      // congela update; el último frame sigue visible
  resume(): void;
  restart(): void;    // reinicia puntaje, vidas y nivel
  endGame(): void;    // fuerza gameover con el puntaje actual
  destroy(): void;    // cancela rAF y quita listeners
}

export function createAsteroidsEngine(
  canvas: HTMLCanvasElement,
  callbacks?: AsteroidsCallbacks,
): AsteroidsEngine;
```

```ts
// lib/games.ts — nueva entrada (al final de GAMES, no entra en el "slice(0, 6)" de la landing)
{ id: "asteroids", title: "ASTEROIDS", cat: "SHOOTER", color: "cyan", cover: "cover-asteroids", /* short, long, best, plays mock */ }
```

Estructura de archivos prevista dentro de `lib/games/asteroids/`: `engine.ts` (loop, estado, colisiones, entrada), `entities.ts` (`Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`), `utils.ts` (`wrap`, `dist`, `rand`, `randInt`), `constants.ts` (`RADII`, `SPEEDS`, `POINTS`, constantes de power-up). Los nombres exactos pueden ajustarse al implementar, pero el motor no importa React.

Convenciones:

- Constantes y fórmulas se portan literalmente de `game.js` (puntos 20/50/100, `RADII`, `SPEEDS`, `DRAG`, `THRUST`, factor `0.82` de colisión nave-asteroide); el `dt` se limita a 50 ms.
- El motor mantiene su estado en el cierre de `createAsteroidsEngine`, sin variables de módulo mutables (así dos montajes consecutivos, p. ej. Strict Mode, no comparten estado).
- `Math.random` y `performance.now` solo se llaman dentro de `update`/`draw`/handlers, nunca durante el render de React.
- El HUD de React se actualiza solo cuando cambian puntaje, vidas o nivel (callbacks), no en cada frame.
- El canvas conserva su HUD original (`SCORE`, `NIVEL`, iconos de vidas, temporizador `3x`) y la plataforma muestra el suyo; ambos leen del mismo estado del motor, así que no pueden divergir. El canvas ya no dibuja el overlay "GAME OVER ... ESPACIO PARA REINICIAR": lo cubre el modal de la plataforma. Con la nave muerta (`state === "dead"`) el motor sigue animando partículas y asteroides, como en el original.

## Implementation plan

1. Leer `node_modules/next/dist/docs/01-app/` (Client Components, `use client`, efectos en el navegador y su interacción con `cacheComponents`) según `AGENTS.md`, y revisar `components/game-player.tsx`, `components/session-provider.tsx` y `lib/storage.ts`. Verificación: notas de diferencias antes de escribir código.
2. Crear `lib/games/asteroids/` (`utils.ts`, `constants.ts`, `entities.ts`) con las clases portadas a TypeScript estricto; las entidades reciben el `CanvasRenderingContext2D` en `draw(ctx)` en lugar de usar un `ctx` global. Verificación: `npx tsc --noEmit` y `npm run lint` sin errores.
3. Crear `lib/games/asteroids/engine.ts` con `createAsteroidsEngine`: estado encapsulado, loop, entrada de teclado con `preventDefault` para `ArrowLeft/Right/Up` y `Space`, colisiones, power-up, niveles, callbacks y `destroy()` que limpia rAF y listeners; con el HUD original dibujado en el canvas y sin el overlay de "GAME OVER". Verificación: typecheck, lint y que el módulo no referencie `document`/`window` fuera de `start()`/`destroy()`.
4. Crear `components/asteroids-canvas.tsx` (`"use client"`): `<canvas>` 800×600 con CSS responsivo (`width: 100%`, `height: auto`, `image-rendering` por defecto), monta el motor en `useEffect`, expone el control (`pause`, `resume`, `restart`, `endGame`) mediante `ref` o props y llama a los callbacks. Verificación: montar y desmontar la ruta repetidamente no deja listeners ni loops activos.
5. Añadir la entrada `asteroids` a `lib/games.ts` y `.cover-asteroids` a `app/globals.css` (usar `/frontend-design` solo para la portada). Verificación: aparece en `/library` (filtro SHOOTER y TODOS), `/games/asteroids`, el selector de `/hall-of-fame` y `generateStaticParams` genera `/games/asteroids/play`.
6. Adaptar `components/game-player.tsx`: para `game.id === "asteroids"` renderiza `<AsteroidsCanvas>` dentro de `.crt-screen` en vez de `game-arena`, desactiva el `setInterval` de puntaje simulado, conecta `score/lives/level` del motor al HUD, `PAUSA/REANUDAR`, `FIN`, `JUGAR DE NUEVO` y el modal de guardado; el resto de juegos se queda con el simulador sin cambios. Añadir la nota de controles y el aviso de teclado requerido en táctiles. Verificación: `npm run lint` y `npx tsc --noEmit`; los demás juegos siguen mostrando el simulador.
7. Probar en el navegador (Playwright MCP, capturas en `.playwright-screenshots/`): rotar, propulsar, disparar, partir asteroides y sumar 20/50/100, perder las 3 vidas, `FIN`, pausa, `JUGAR DE NUEVO`, guardado en `av_scores` y su aparición en `/hall-of-fame`. Verificación final: `npm run lint` y `npm run build` sin errores y sin errores de hidratación ni de consola.

> Usar `/frontend-design` solo para `.cover-asteroids` y la nota de controles, según `CLAUDE.md`. Antes de escribir código de Next (pasos 4–6), leer la guía correspondiente en `node_modules/next/dist/docs/`.

## Acceptance criteria

- [ ] `/games/asteroids/play` muestra la nave centrada, 4 asteroides grandes en el nivel 1 y el HUD de la plataforma con puntaje 0, 3 vidas y nivel 01.
- [ ] `←`/`→` rotan, `↑` propulsa con inercia, `Espacio` dispara con cooldown de 0,2 s; la página no hace scroll al pulsar `Espacio` o las flechas durante el juego.
- [ ] Destruir un asteroide grande, mediano o pequeño suma 20, 50 y 100 puntos respectivamente y el puntaje del HUD se actualiza; los grandes se parten en 2 medianos y los medianos en 2 pequeños.
- [ ] Al chocar con un asteroide fuera de la invencibilidad se pierde 1 vida (el HUD baja), la nave reaparece tras 2 s con 3 s de parpadeo invencible; al llegar a 0 vidas aparece el modal "FIN DEL JUEGO" con el puntaje final.
- [ ] Limpiar todos los asteroides sube el nivel (el HUD muestra 02, 03…) y genera `3 + nivel` asteroides.
- [ ] El power-up `3x` aparece, al recogerlo se disparan 3 balas con abanico de 0,18 rad durante 5 s, y expira tras 12 s si no se recoge.
- [ ] `PAUSA` congela el juego (asteroides, nave y balas quietos) y muestra "EN PAUSA"; `REANUDAR` continúa sin saltos bruscos; `FIN` abre el modal con el puntaje actual.
- [ ] `GUARDAR PUNTUACIÓN` guarda `{ game: "asteroids", score, name }` en `localStorage["av_scores"]` y la entrada aparece en la pestaña ASTEROIDS de `/hall-of-fame`.
- [ ] `JUGAR DE NUEVO` reinicia puntaje 0, 3 vidas, nivel 01 y asteroides nuevos, sin acelerar el juego (un solo loop activo).
- [ ] Salir de la página (`SALIR` o navegación) y volver no deja ningún `requestAnimationFrame` ni listener de teclado activo del juego anterior (comprobado con el juego sin duplicar disparos tras re-entrar).
- [ ] El canvas se escala dentro de `.crt-screen` sin deformarse en anchos de 1280 px y 768 px, manteniendo proporción 4:3.
- [ ] `ASTEROIDS` aparece en `/library` y `/games/asteroids` con su portada `cover-asteroids`, categoría SHOOTER y color cian; `ROCAS` y sus rutas no cambian.
- [ ] El resto de juegos del catálogo siguen mostrando el simulador sin cambios.
- [ ] El canvas dibuja su HUD original (`SCORE`, `NIVEL`, iconos de vidas y `3x` con el power-up) con valores idénticos a los del HUD de la plataforma en todo momento.
- [ ] El canvas no dibuja el overlay "GAME OVER" ni "ESPACIO PARA REINICIAR".
- [ ] `npm run lint` y `npm run build` terminan sin errores, sin errores de hidratación ni de consola en `/games/asteroids/play`.

## Decisions

- **Sí:** nueva entrada `asteroids` en el catálogo y mantener `rocas` como mock. Decisión del usuario; implica dos juegos de temática similar, aceptable por ahora.
- **No:** reemplazar `rocas` por el juego real. Descartado por el usuario.
- **Sí:** motor TS sin globals en `lib/games/asteroids/` más un componente cliente delgado. Separa lógica y React, evita colisiones de estado entre montajes y sirve de plantilla para Tetris y Arkanoid.
- **No:** un único componente con toda la lógica (difícil de reutilizar) ni un `iframe` del HTML original (no se integra con puntaje, pausa ni HUD).
- **Sí:** mantener ambos HUD: el de la plataforma (puntaje, vidas, nivel, pausa, fin de partida y guardado) y el original del canvas. Decisión del usuario, que prioriza fidelidad al juego original; la información queda duplicada a propósito.
- **Sí:** el estado vive solo en el motor y ambos HUD lo leen, para que nunca muestren valores distintos.
- **No:** el overlay "GAME OVER / ESPACIO PARA REINICIAR" del canvas, porque el modal "FIN DEL JUEGO" de la plataforma ya cubre ese momento.
- **Sí:** estética vectorial original (blanco sobre negro) escalada dentro del CRT. Fidelidad al juego y menor riesgo; el rediseño neón queda para otro spec.
- **Sí:** nueva `cover-asteroids` en CSS en lugar de reutilizar `cover-rocas`, para que las dos tarjetas se distingan.
- **Sí:** el nivel del HUD viene del motor (su propia progresión por asteroides limpiados) y no de `POINTS_PER_LEVEL`, que solo aplica al simulador de los otros juegos.
- **Sí:** el power-up `3x` se incluye aunque el README de la referencia no lo documenta; está en `game.js` y forma parte de la jugabilidad.
- **Sí:** solo teclado; en táctiles se avisa que se requiere teclado. Controles táctiles requieren su propio diseño.
- **Sí:** `av_scores` en `localStorage` sin cambios; la persistencia en Supabase es otro spec (ver SPEC 04).
- **Sí:** el id del juego en `av_scores` es `asteroids`, el slug en inglés de la ruta, según la regla global de idioma (los textos de UI siguen en español).

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Strict Mode / navegación montan el motor dos veces y duplican loops o listeners | Estado encapsulado, `destroy()` idempotente que cancela rAF y quita listeners; criterio de aceptación explícito de no duplicar disparos tras re-entrar. |
| `cacheComponents: true` y APIs de navegador (`window`, `performance`) fuera del cliente | El motor solo toca el navegador desde `start()`/`destroy()`, invocados en `useEffect` de un Client Component; verificar en el paso 1. |
| Actualizar el HUD en cada frame provoca renders excesivos | Los callbacks solo se disparan al cambiar puntaje, vidas o nivel. |
| Flechas y `Espacio` hacen scroll o activan un botón enfocado (p. ej. `PAUSA`) | `preventDefault` sobre esas teclas mientras el juego está activo y quitar el foco del botón tras pulsarlo. |
| Pestaña en segundo plano: `requestAnimationFrame` se detiene y el `dt` crece | Se conserva el límite de `dt` a 50 ms del original; opcionalmente pausar con `visibilitychange`. |
| Canvas escalado difumina el trazo o no mantiene proporción | `width: 100%; height: auto` con atributos 800×600 fijos; verificar a 1280 px y 768 px. Considerar `devicePixelRatio` solo si el trazo se ve borroso. |
| Dos entradas casi iguales (`rocas` y `asteroids`) confunden en el catálogo | Descripciones y portadas distintas; el usuario puede retirar `rocas` en un spec posterior. |
| La rotación y propulsión dependen de `keys[e.code]` y se quedan "pegadas" al perder el foco | Limpiar el estado de teclas en `blur` y en `pause()`. |

## What is **not** in this spec

- Tetris y Arkanoid.
- Controles táctiles, gamepad o soporte móvil.
- Rediseño neón, sonido o música.
- OVNIs, nuevos power-ups o cambios de balance.
- Puntajes en Supabase, ranking real o Auth.
- Eliminar o modificar el juego mock `rocas`.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propio spec.
