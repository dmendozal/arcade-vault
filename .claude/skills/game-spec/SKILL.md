---
name: game-spec
description: Genera el spec para portar o crear un juego jugable con su leaderboard en Arcade Vault. Lee la referencia (carpeta de references/started-games o una descripción), consulta el catálogo real en Supabase, pregunta lo que falta y guarda specs/NN-<id>-game.md en borrador. No escribe código.
disable-model-invocation: true
argument-hint: '<03-tetris | 04-arkanoid | descripción de un juego original>'
allowed-tools: Read(~/.claude/skills/spec/**), Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(wc:*), mcp__supabase__execute_sql, mcp__supabase__list_tables
---

# /game-spec — Spec de un juego nuevo para Arcade Vault

## Session context

Fecha de hoy (usar para la cabecera del spec, nunca adivinarla):
!`date +%F`

Specs existentes:
!`ls specs/ 2>/dev/null || echo "No existe specs/"`

Juegos de referencia disponibles:
!`ls references/started-games/ 2>/dev/null`

Motores reales ya portados:
!`ls lib/games/ 2>/dev/null`

---

Esta skill produce **solo el spec** de un juego. **No escribas código, no apliques migraciones, no toques la app.** La implementación se hace después con `/spec-impl`. El patrón sale de `specs/05-asteroids-game.md` (motor + canvas + HUD) y `specs/06-leaderboard-and-games-table.md` (catálogo y ranking en Supabase).

`$ARGUMENTS` es la carpeta de referencia (`03`, `tetris`, `03-tetris`...) o la descripción de un juego original. Responde en español; identificadores, rutas y SQL en inglés.

## Fase 0 — Leer la skill `/spec` (obligatorio, antes de todo)

`/game-spec` es una especialización de `/spec`: el método, la estructura y las reglas de formato vienen de ella. Antes de cualquier otra cosa, lee completos:

1. `~/.claude/skills/spec/SKILL.md` (el flujo, las reglas de la cabecera, estados válidos, fases de preguntas y de guardado).
2. `~/.claude/skills/spec/template.md` (la forma de cada sección).

Si algún archivo no existe, avisa al usuario y detente (no improvises el formato).

Prioridad cuando haya conflicto: `/spec` manda en método y estructura (cabecera, secciones obligatorias, regla del objetivo en una frase, no marcar como aprobado, no asumir decisiones); esta skill solo añade el contenido específico de juegos (`template.md` y `checklist.md` de esta carpeta) y omite de `/spec` lo que contradice "solo spec, sin código".

## Fase 1 — Contexto del proyecto

1. Lee `CLAUDE.md`, `specs/05-asteroids-game.md` y `specs/06-leaderboard-and-games-table.md` (patrón y formato exactos a imitar), y los specs posteriores si existen (pueden haber cambiado el patrón).
2. Lee `components/game-player.tsx`, `components/asteroids-canvas.tsx`, la cabecera de `lib/games/asteroids/engine.ts` y `lib/games.ts`. Comprueba si ya existe un registro de juegos (`lib/games/registry.ts` o similar) o si el reproductor sigue despachando con `isAsteroids`.
3. Consulta el catálogo **real**, no el de memoria:
   `select id, title, category, cover, color, sort_order from public.games order by sort_order;`
   Anota el `max(sort_order)` y los mocks (juegos sin carpeta en `lib/games/`).
4. Si ya existe `lib/games/<id>/` para el juego pedido, avisa y detente.

## Fase 2 — Origen del juego

**Con referencia** en `references/started-games/`: lee `README.md`, `CLAUDE.md`, `game.js` completo y los auxiliares (`levels.js`, `style.css`, `assets/`). Inventaría:

- dimensiones del canvas y elementos extra (p. ej. canvas de "siguiente pieza");
- controles, mecánicas, constantes y fórmulas (se portan literalmente);
- sistema de puntos, vidas, niveles y condición de fin;
- overlays propios de pausa/game over (los sustituye el modal de la plataforma);
- HUD original del canvas, assets y sonidos;
- estado global/DOM que haya que encapsular en el cierre del motor.

**Sin referencia**: es un juego original; define mecánicas desde la descripción. No recrees un juego comercial concreto (nombre, personajes, arte, niveles) aunque lo renombres.

## Fase 3 — Preguntas (no saltar)

Usa `AskUserQuestion`. Pregunta solo lo que no se deduzca del código de referencia:

- **Mock parecido** (por categoría, cover o temática, p. ej. `caida` ≈ Tetris, `bloque-buster` ≈ Arkanoid): preguntar siempre, cada vez, entre **reemplazar el mock** (conserva `id` y puntajes; la migración hace `update`) o **entrada nueva** (`insert` con `sort_order = max + 1`, el mock queda intacto). Sin coincidencia, entrada nueva sin preguntar.
- `id` (slug en inglés), título y textos corto/largo en español, categoría (`ARCADE|PUZZLE|SHOOTER|VERSUS`), color (`cyan|magenta|yellow|green`) y cover (nueva `.cover-<id>` o reutilizar la del mock).
- Fidelidad visual (estética original dentro del CRT o rediseño), HUD original del canvas sí/no, assets y sonido (incluir o fuera de alcance).
- Cómo se mapean vidas y nivel si el juego no los tiene (p. ej. vidas `—`).
- Si puede superar 1.000.000 puntos (CHECK de `scores`).
- Sin referencia: mecánicas, controles, puntuación y condición de fin.

## Fase 4 — Escribir el spec

Parte de la estructura de `/spec` (Fase 0), luego lee `template.md` y `checklist.md` (en el directorio de esta skill) y rellénalos con lo recogido. Si la plantilla de `/spec` y la de esta skill difieren, gana la de `/spec` en secciones y formato, y esta en el contenido específico del juego.

- Archivo: `specs/NN-<id>-game.md`, con `NN` = siguiente número libre.
- `Status:` `Borrador` (vocabulario del repo; no marcar como aprobado). `Depends on:` SPEC 05, SPEC 06 (+ el spec que haya generalizado el reproductor, si existe). `Date:` la del contexto.
- Mismas secciones, encabezados y tono que SPEC 05/06. Toda decisión no confirmada por el usuario se marca "Decisión por defecto, no discutida".
- Los pasos del plan llevan verificación concreta y no deben depender de nada fuera del spec.

## Fase 5 — Guardar y cerrar

Guarda el archivo, muestra la ruta y un resumen de 3-5 líneas con las decisiones clave, y recuerda: cambiar el estado a `Aprobado` tras releerlo y ejecutar `/spec-impl NN`.

## Reglas

- No inventes decisiones; pregunta en la Fase 3.
- Nada de `service_role` ni claves en el spec.
- No escribir código, no aplicar migraciones, no modificar la base de datos (solo `SELECT`).
