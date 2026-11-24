# Checklist de integración de un juego

Todo spec de juego debe cubrir estos puntos (el leaderboard ya es genérico: `submitScore`, `getTopScores`, `getGames`, vista `game_stats`, `/hall-of-fame` y `/games/[id]` no se tocan).

## Motor — `lib/games/<id>/`

- TypeScript estricto, sin globals ni React; estado dentro del cierre de `create<Name>Engine(canvas, callbacks)`, sin variables de módulo mutables (Strict Mode monta dos veces).
- API: `start() · pause() · resume() · restart() · endGame() · destroy()`; callbacks `onScore`, `onLives`, `onLevel`, `onGameOver(finalScore)`.
- Archivos sugeridos: `engine.ts`, `entities.ts`, `constants.ts`, `utils.ts`. Constantes y fórmulas portadas literalmente de la referencia.
- `dt` limitado (50 ms); `Math.random`/`performance.now` solo en `update`/`draw`/handlers.
- Teclado: `preventDefault` en las teclas del juego mientras se juega; limpiar teclas en `blur` y en `pause()`.
- `destroy()` idempotente: cancela `requestAnimationFrame` y quita listeners.
- Callbacks solo al cambiar el valor (no cada frame). Sin overlay propio de game over/pausa: lo cubre la plataforma.

## Componente — `components/<id>-canvas.tsx`

- `"use client"`; patrón de `components/asteroids-canvas.tsx`: handle imperativo (`pause/resume/restart/endGame`), callbacks por ref, motor creado y destruido en `useEffect`, canvas con atributos fijos y `width: 100%; height: auto`.

## Reproductor

- Si `components/game-player.tsx` despacha con `isAsteroids`, incluir un paso para generalizarlo con un registro (`lib/games/registry.ts`: id → componente canvas + nota de controles) y migrar Asteroids sin cambiar su comportamiento. Si el registro existe, solo añadir la entrada.
- Los juegos mock siguen con el simulador sin cambios.
- Nota de controles en español bajo el CRT; aviso de teclado requerido en táctiles.

## Catálogo y leaderboard

- Migración vía `apply_migration`: `add_<id>_game` (`insert`, `sort_order = max + 1`) o `replace_<mock>_with_<id>` (`update`, conserva `id` y puntajes). Sin cambios de esquema ni de tipos generados.
- Verificar con `execute_sql` la fila resultante y con `get_advisors` que no hay avisos nuevos.
- Cover `.cover-<id>` en `app/globals.css` (diseñada con `/frontend-design`) o reutilizar la del mock.
- Assets (si los hay) en `public/games/<id>/`.
- Actualizar `CLAUDE.md` (juegos con motor real).

## Criterios de aceptación base

- [ ] `/games/<id>/play` muestra el juego con su estado inicial y el HUD de la plataforma (puntaje, vidas, nivel) igual al del motor.
- [ ] Controles responden; la página no hace scroll con las teclas del juego.
- [ ] `PAUSA/REANUDAR`, `FIN` y `JUGAR DE NUEVO` funcionan con un solo loop activo (sin acelerar).
- [ ] Salir y volver no deja `requestAnimationFrame` ni listeners del juego anterior.
- [ ] El canvas mantiene proporción dentro de `.crt-screen` a 1280 px y 768 px.
- [ ] `games` contiene la fila correcta; aparece en `/library`, landing (si entra en los 6 primeros), `/games/<id>` y en las pestañas de `/hall-of-fame`.
- [ ] Guardar puntaje crea la fila en `scores` con `game_id = '<id>'` y aparece en `/hall-of-fame` y `/games/<id>` tras recargar; `Partidas` y `Mejor global` coinciden.
- [ ] Fallo de guardado: el modal sigue abierto, muestra error en español y permite reintentar.
- [ ] Asteroids y los demás juegos no sufren regresiones.
- [ ] `npm run lint` y `npm run build` sin errores; sin errores de hidratación ni de consola en las rutas del juego.
- [ ] Prueba en navegador con Playwright MCP (capturas en `.playwright-screenshots/`).
