# SPEC 02 — Home (landing) y página Acerca de/Contacto

> **Status:** Implemented  
> **Depends on:** SPEC 01
> **Date:** 2026-11-20
> **Objective:** Portar a Next.js/TypeScript la landing page y la página Acerca de/Contacto de `references/home-about/`, moviendo la Biblioteca de `/` a `/library`.

---

## Por qué existe este spec

El spec 01 dejó la Biblioteca en `/`. La referencia `references/home-about/` añade una landing de marketing (hero, ventajas, vista previa de juegos, estadísticas, actividad, precios, CTA final) y una página Acerca de con formulario de contacto. La landing debe ocupar `/`, así que el catálogo se mueve a `/library`, como en el prototipo (Inicio · Biblioteca · Salón de la Fama · Acerca de).

La carpeta de referencia contiene `home.jsx`, `about.jsx`, `nav.jsx`, `styles.css` (1744 líneas) y `arcade-vault-standalone.html`.

## Scope

**In:**

- Renombrar las rutas del spec 01 al inglés, según la regla global de idioma: `/juegos/[id]` → `/games/[id]`, `/juegos/[id]/jugar` → `/games/[id]/play`, `/acceso` → `/login`, `/salon` → `/hall-of-fame` (carpetas de `app/` y todos los enlaces, redirecciones y criterios que las referencian).
- Ruta `/` con la landing (`home.jsx`): hero con siluetas flotantes, "¿POR QUÉ ARCADE VAULT?", "JUEGOS DISPONIBLES AHORA" (primeros 6 de `GAMES`), estadísticas, "ACTIVIDAD EN VIVO", "PRECIOS" con FAQ y CTA final.
- Ruta `/library` con el catálogo actual (`components/library.tsx` sin cambios funcionales).
- Ruta `/about` con Acerca de + Contacto (`about.jsx`): misión, tres destacados, divisor de píxeles y formulario de contacto simulado en cliente (validación, animación `shake`, terminal de éxito `VAULT-OS // TERMINAL`, `ENVIAR OTRO MENSAJE`). Sin envío real.
- Animación de aparición al hacer scroll (`.reveal` / `.in`) como hook cliente reutilizable con `IntersectionObserver`.
- Nav (escritorio y panel móvil): enlaces **Inicio** (`/`), **Biblioteca** (`/library`), **Salón de la Fama** (`/hall-of-fame`), **Acerca de** (`/about`); el logo apunta a `/`.
- Actualizar los enlaces que hoy usan `/` con sentido de "Biblioteca": detalle (`app/games/[id]/page.tsx`), reproductor (`VOLVER AL VAULT`), `app/not-found.tsx` y `components/hall-of-fame.tsx`.
- Portar a `app/globals.css` solo los estilos nuevos de la referencia (desde `/* ===== HOME PAGE ===== */`, línea 930 de `styles.css`, hasta el final), sin tocar lo existente.
- Constantes mock tipadas para los datos inventados de la landing en `lib/home.ts`.
- Textos de UI en español, iguales a la referencia. `metadata` por página.

**Out of scope (para futuros specs):**

- Backend, envío real del formulario de contacto, API routes, correo.
- Autenticación real o cambios en `/login`.
- Datos derivados de `seededScores`/`av_scores` para "ACTIVIDAD EN VIVO" y "TOP JUGADORES" (se mantienen mock estáticos).
- Pasarela de pago real o planes (el "plan único" es solo texto).
- Reemplazar `globals.css` completo o modificar fuentes.
- Tests automatizados, SEO avanzado, analítica, i18n.
- Cualquier juego jugable.

## Data model

```ts
// lib/home.ts — constantes mock tipadas, portadas tal cual de home.jsx
import type { AccentColor } from "@/lib/games";

export type FeatureIconKind = "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";

export interface Feature { icon: FeatureIconKind; title: string; desc: string; color: AccentColor }
export interface Stat { n: string; unit: string; sub: string }                       // "12+" / "JUEGOS" / "Y CONTANDO"
export interface ActivityRow { player: string; game: string; score: number; when: string; color: AccentColor } // when: "hace 2 min"
export interface TopPlayer { rank: number; player: string; score: number }
export interface FaqItem { q: string; a: string }

export const FEATURES: Feature[];       // 4
export const STATS: Stat[];             // 3
export const ACTIVITY: ActivityRow[];   // 7
export const TOP_PLAYERS: TopPlayer[];  // 5
export const PRICE_FEATURES: string[];  // 6 viñetas "✔ ..."
export const FAQ: FaqItem[];            // 3

// about: lista de destacados
export type HighlightIconKind = "HEART" | "BROWSER" | "PLANT";
export interface Highlight { icon: HighlightIconKind; text: string; color: AccentColor } // color: cyan | magenta | green
export const HIGHLIGHTS: Highlight[];   // 3
```

Convenciones:

- La landing no lee `localStorage` ni sesión; es contenido estático.
- Las 6 tarjetas de "JUEGOS DISPONIBLES AHORA" salen de `GAMES.slice(0, 6)`; no se duplican datos.
- Formato de números con `toLocaleString("es-ES")` como en la referencia (evita desajustes de hidratación al fijar el locale).
- El estado del formulario de contacto (`name`, `email`, `msg`, `sent`, `shake`) es local al componente y no se persiste.

## Implementation plan

1. Renombrar las rutas del spec 01 al inglés: mover `app/juegos` → `app/games`, `app/juegos/[id]/jugar` → `app/games/[id]/play`, `app/acceso` → `app/login`, `app/salon` → `app/hall-of-fame` (con `git mv`), y actualizar `generateStaticParams`, `Link`/`router.push`, `usePathname` en `components/nav.tsx` y cualquier cadena con las rutas antiguas (`grep -rn "juegos\|acceso\|salon\|jugar" app components lib`). Verificación: `npm run lint`, `npx tsc --noEmit` y recorrer las 5 pantallas del spec 01 sin 404.
2. Añadir a `app/globals.css` los estilos nuevos de la referencia (líneas 930–1744 de `references/home-about/styles.css`: `.home*`, `.silo`, `.feature-*`, `.mini-*`, `.stat-*`, `.activity-*`, `.pricing-*`, `.home-final`, `.reveal`, `.about*`, `.contact-*`, `.terminal-success`, `.shake`, etc.). Verificación: no hay selectores duplicados con los ya existentes y `npm run build` compila el CSS.
3. Crear `lib/home.ts` con los tipos y constantes anteriores. Verificación: `npm run lint` y `npx tsc --noEmit` sin errores.
4. Mover la Biblioteca: crear `app/library/page.tsx` (con la `metadata` actual de `/`) que renderiza `<Library />`. Actualizar `components/nav.tsx` (enlaces Inicio/Biblioteca/Salón/Acerca de en escritorio y panel móvil; activo por `pathname`: `/` solo Inicio, `/library`, `/games/*` y `/games/*/play` → Biblioteca, `/hall-of-fame`, `/about`, `/login`) y los enlaces `/` → `/library` en `app/games/[id]/page.tsx`, `components/game-player.tsx` (`VOLVER AL VAULT`), `components/hall-of-fame.tsx` y `app/not-found.tsx`. `auth-form.tsx` sigue redirigiendo a `/`. Verificación: el sistema sigue funcional con `/` aún mostrando la Biblioteca hasta el paso 6.
5. Crear `components/use-reveal.ts` (`"use client"`, hook que observa `.reveal` y añade `.in`, con limpieza al desmontar) y `components/pixel-silhouettes.tsx` + `components/feature-icon.tsx` (SVG de `FloatingSilhouettes` y `FeatureIcon`, sin estado). Considerar el caso sin `IntersectionObserver` (mostrar contenido directamente). Verificación: lint y typecheck.
6. Implementar la landing en `app/page.tsx`: componente de servidor con las secciones estáticas y un wrapper cliente `components/reveal-section.tsx` (o el hook anterior en un componente cliente de página) para las animaciones. `components/mini-card.tsx` enlaza con `<Link>` a `/games/[id]`; los CTA usan `<Link className="btn ...">` a `/library`, `/login` y `/hall-of-fame`. Sustituir `navigate(...)` por enlaces reales. Verificación: `/` muestra las 6 secciones y los 3 CTA navegan sin recarga completa.
7. Implementar `/about` (`app/about/page.tsx` + `components/contact-form.tsx` cliente): hero, destacados (`components/highlight-icon.tsx`), divisor de 24 píxeles, formulario con validación (`name`, `email`, `msg` no vacíos; si falla, `shake` 400 ms y no envía), estado de éxito en terminal con `{name.toUpperCase()}` y botón `ENVIAR OTRO MENSAJE` que limpia el formulario. Limpiar el `setTimeout` del `shake` al desmontar. Verificación: flujo completo en el navegador.
8. Revisar `metadata` de `/`, `/library` y `/about`. Verificación final: `npm run lint` y `npm run build` sin errores; recorrer `/`, `/library`, `/about` a 1280 px y a < 768 px.

> Antes de escribir código de Next (pasos 4, 6 y 8), leer la guía relevante en `node_modules/next/dist/docs/` según `AGENTS.md` (en particular `cacheComponents`, `Link` y componentes de servidor con hijos cliente). Usar `/frontend-design` para la UI, según `CLAUDE.md`.

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] Las rutas antiguas `/juegos/*`, `/acceso` y `/salon` ya no existen (404). Existen las rutas `/`, `/library`, `/about`, `/games/[id]`, `/games/[id]/play`, `/login` y `/hall-of-fame`; no se usa `location.hash` para navegar.
- [ ] `/` muestra hero con título "EL ARCADE CLÁSICO ESTÁ DE VUELTA", siluetas decorativas (8 SVG con `aria-hidden`) y los CTA `EXPLORAR JUEGOS` (→ `/library`) y `CREAR CUENTA` (→ `/login`).
- [ ] `/` muestra 4 tarjetas de ventajas, 6 tarjetas de juego (las 6 primeras de `GAMES`), 3 bloques de estadísticas, 7 filas de "ÚLTIMAS PUNTUACIONES", 5 filas de "TOP JUGADORES · HOY", la tarjeta de precio con 6 viñetas, 3 preguntas frecuentes y el CTA final `INSERTAR MONEDA →`.
- [ ] Clic en una mini-tarjeta navega a `/games/[id]` correspondiente; `VER TODOS LOS JUEGOS →` y `INSERTAR MONEDA →` van a `/library`; `VER SALÓN →` va a `/hall-of-fame`; `EMPEZAR GRATIS →` va a `/login`. Ninguna navegación recarga la página completa.
- [ ] Las secciones con `.reveal` aparecen al entrar en el viewport (clase `in`) y no quedan invisibles tras navegar entre rutas ni al recargar.
- [ ] `/library` muestra las 8 tarjetas; la búsqueda y los chips de categoría se comportan igual que en el spec 01.
- [ ] El nav muestra Inicio, Biblioteca, Salón de la Fama y Acerca de en escritorio y en el panel móvil; el logo lleva a `/`.
- [ ] El enlace activo es "Inicio" solo en `/`, "Biblioteca" en `/library`, `/games/*` y `/games/*/play`, "Salón de la Fama" en `/hall-of-fame` y "Acerca de" en `/about`.
- [ ] `VOLVER AL VAULT` (reproductor), el botón de volver del detalle, el de `not-found` y el de `/hall-of-fame` llevan a `/library`.
- [ ] Iniciar sesión o `JUGAR COMO INVITADO` en `/login` sigue redirigiendo a `/` (la landing).
- [ ] `/about` muestra el título "ACERCA DE ARCADE VAULT", el texto de misión, 3 destacados y el divisor de 24 píxeles animados.
- [ ] Enviar el formulario de contacto con algún campo vacío lo sacude (`shake`) y no muestra el éxito.
- [ ] Enviar con `px_kai`, un correo y un mensaje muestra la terminal con "MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, PX_KAI."; `ENVIAR OTRO MENSAJE` vuelve al formulario vacío.
- [ ] No hay errores de hidratación en la consola en `/`, `/library` ni `/about`.
- [ ] A ancho < 768 px las rejillas de `/` y `/about` se apilan sin desbordamiento horizontal y el panel lateral del nav abre y cierra.
- [ ] Las clases y comportamientos de las pantallas del spec 01 no cambian (sin regresiones visuales en `/hall-of-fame`, `/login`, detalle y reproductor).

## Decisions

- **Sí:** mover la Biblioteca a `/library` y dejar `/` para la landing. Coincide con el prototipo y con la intención de una landing de entrada.
- **No:** dejar la Biblioteca en `/` y poner el home en `/inicio`. Rompe el significado del logo y de los enlaces de "volver".
- **Sí:** rutas, carpetas, identificadores y archivos en inglés; la prosa de los specs y el texto de la UI siguen en español. Es una regla global del usuario (`~/.claude/CLAUDE.md`), por eso también se renombran las rutas del spec 01.
- **No:** dejar las rutas del spec 01 en español y solo las nuevas en inglés. Mezclaría idiomas en las URLs.
- **Sí:** incluir Acerca de/Contacto (`/about`) en este spec. Comparte nav, estilos y la animación `reveal` con la landing; separarlo duplicaría trabajo de nav.
- **Sí:** formulario de contacto simulado en cliente. No hay backend (fuera de alcance, igual que en el spec 01).
- **Sí:** portar solo los estilos nuevos a `globals.css` (líneas 930–1744 de la referencia). No pisa los ajustes de fuentes (`var(--font-press-start)`, etc.) ni el `@import "tailwindcss"`.
- **No:** reemplazar `globals.css` por `styles.css`. La referencia usa las fuentes sin las variables de `next/font` y perdería esa integración.
- **Sí:** datos de la landing como constantes mock tipadas en `lib/home.ts`, con texto estático ("hace 2 min"). Evita hidratación y lógica extra.
- **No:** derivar actividad y top de `seededScores`/`av_scores`. Queda para un spec con backend o ranking real.
- **Sí:** conservar las cifras del prototipo ("12+ JUEGOS", etc.) aunque `GAMES` tenga 8; son copy de marketing ("Y CONTANDO"). Decisión por defecto, no discutida.
- **Sí:** la landing es un componente de servidor con las partes interactivas (reveal, formulario) en componentes cliente pequeños. Decisión por defecto, no discutida.
- **Sí:** `auth-form.tsx` sigue redirigiendo a `/` tras iniciar sesión. Decisión por defecto, no discutida.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| `.reveal` deja `opacity: 0` si el observador no corre (navegación cliente, `IntersectionObserver` ausente, JS desactivado) | El hook se ejecuta en cada montaje de página y observa los `.reveal` presentes; si no hay `IntersectionObserver`, se añade `in` directamente. |
| El hook consulta `document.querySelectorAll(".reveal")` y puede no ver nodos montados después | Montarlo en un componente cliente que envuelve las secciones de la página, o usar un componente cliente por sección con ref. |
| Renombrar rutas deja enlaces o redirecciones rotos | El paso 1 incluye `grep` de las cadenas antiguas y recorrer las 5 pantallas; los criterios cubren cada ruta nueva. |
| Mover la Biblioteca deja enlaces a `/` apuntando a la landing por error | Revisar con `grep` todos los `href="/"` y `push("/")` (lista en el paso 4) y cubrirlo en los criterios. |
| Colisión de selectores entre los estilos nuevos y los existentes (`.kicker`, `.btn`, `.pixel`, `.neon-*`) | Comparar las líneas 1–929 de la referencia con `globals.css` (hoy solo difieren en fuentes y `@import`) y portar únicamente desde la línea 930. |
| `cacheComponents: true` con componentes de servidor que usan `toLocaleString` o fechas | Los datos son constantes estáticas; no se usa `Date` ni `Math.random` en servidor. |
| Animaciones CSS pesadas (siluetas flotantes, `blink`, `pulse`) | Respetar `prefers-reduced-motion` si la referencia lo define; si no, añadirlo solo si el CSS lo necesita. |

## What is **not** in this spec

- Envío real del formulario de contacto, correo o backend.
- Autenticación real o cambios en `/login`.
- Datos dinámicos o en vivo para actividad y rankings de la landing.
- Planes de pago o suscripciones.
- Juegos jugables.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propio spec.
