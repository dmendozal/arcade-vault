# SPEC 04 — Integración base de Supabase

> **Status:** Implementado  
> **Depends on:** SPEC 03
> **Date:** 2026-11-23
> **Objective:** Conectar la app Next.js al proyecto Supabase existente (`emrhttofgulwnllfvvdn`) con clientes de navegador y servidor basados en `@supabase/ssr`, variables de entorno documentadas y una verificación de conectividad, sin crear tablas ni cambiar ninguna pantalla.

---

## Por qué existe este spec

Hasta ahora todo el estado vive en `localStorage` (`av_user`, `av_scores`) y los datos son mock. El producto necesitará Supabase para autenticación real, puntajes, Realtime y Edge Functions. Antes de abordar cada una, este spec deja la **infraestructura común** lista: dependencias, clientes y entorno. Cada capacidad posterior (Auth, puntajes, Realtime, Edge Functions, contacto) irá en su propio spec y partirá de esta base.

El proyecto Supabase está vacío: `list_tables` devuelve `[]` y `list_migrations` devuelve `[]`.

## Scope

**In:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` (valores obtenidos con el MCP de Supabase) y `.env.example` sin valores.
- Cliente de navegador `lib/supabase/client.ts` (`createBrowserClient`).
- Cliente de servidor `lib/supabase/server.ts` (`createServerClient` con el almacén de cookies de Next).
- Ruta temporal de verificación `app/api/health/supabase/route.ts` que hace una llamada de red mínima a Supabase y responde `{ ok: true }` o `{ ok: false, error }`.
- Documentar en `CLAUDE.md` los clientes, las variables de entorno y el proyecto Supabase vinculado (`.mcp.json`).
- Decidir si `.mcp.json` se trackea en git (hoy aparece sin trackear; no contiene secretos, solo `project_ref`).

**Out of scope (para futuros specs):**

- Supabase Auth: formularios de `/login`, métodos de acceso (email/contraseña, OAuth, magic link), `proxy`/middleware de refresco de sesión, sesión invitado, tabla `profiles` y reemplazo de `av_user`.
- Tablas, políticas RLS y migraciones de esquema (incluida la tabla de puntajes y la migración de `av_scores`).
- Realtime y Edge Functions (previstos para el futuro, cada uno con su spec).
- Formulario de contacto real (hoy usa `RESEND_API_KEY`/`CONTACT_TO_EMAIL` en `.env.local`, sin relación con este spec).
- Tipos generados (`database.types.ts`): sin tablas no aportan nada.
- Supabase CLI y entorno local (`supabase/`), ramas de base de datos, tests automatizados.

## Data model

Este spec no introduce datos ni tablas. Solo añade configuración y dos módulos de acceso:

```ts
// lib/supabase/client.ts — para componentes cliente
export function createClient(): SupabaseClient;            // createBrowserClient(url, publishableKey)

// lib/supabase/server.ts — para componentes de servidor, route handlers y server actions
export async function createClient(): Promise<SupabaseClient>; // createServerClient con cookies() de next/headers
```

```bash
# .env.example (sin valores)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Convenciones:

- Se usa la **publishable key** (no la `anon` legacy ni la `service_role`). Ninguna clave secreta entra en este spec.
- Los módulos fallan con un error claro si falta alguna variable de entorno.
- El cliente de servidor se crea por petición (no se comparte entre peticiones).
- `.env.local` sigue ignorado por git; solo `.env.example` se trackea.

## Implementation plan

1. Leer la guía relevante de `node_modules/next/dist/docs/` (route handlers, `cookies()` asíncrono y `cacheComponents`) y la documentación de Supabase para Next.js con `@supabase/ssr` (`search_docs` del MCP). Verificación: se anotan las diferencias frente al conocimiento previo antes de escribir código.
2. Instalar dependencias: `npm install @supabase/supabase-js @supabase/ssr`. Verificación: aparecen en `package.json` y `npm run lint` sigue pasando.
3. Obtener URL y publishable key con `get_project_url` y `get_publishable_keys` (MCP), añadirlas a `.env.local` y crear `.env.example` sin valores. Verificación: `git status` no muestra `.env.local` y `.env.example` aparece como archivo nuevo.
4. Crear `lib/supabase/client.ts` y `lib/supabase/server.ts` según el modelo anterior. Verificación: `npm run lint` y `npx tsc --noEmit` sin errores.
5. Crear `app/api/health/supabase/route.ts` (`GET`) que use el cliente de servidor y ejecute una llamada mínima que no dependa de tablas (p. ej. `GET {url}/auth/v1/health` con la cabecera `apikey`). Verificación: `npm run dev` y `curl http://localhost:3000/api/health/supabase` devuelve `{"ok":true}`; con una clave inválida devuelve `ok: false` sin lanzar excepción.
6. Importar el cliente de navegador desde un componente cliente de prueba o un script puntual para confirmar que se construye sin errores en el navegador (sin dejarlo en el código). Verificación: sin errores en la consola del navegador ni de hidratación.
7. Documentar en `CLAUDE.md` (sección propia "Supabase"): proyecto vinculado, variables, cuándo usar cada cliente y que Auth/RLS/Realtime/Edge Functions están pendientes. Decidir el estado de `.mcp.json`. Eliminar la ruta `app/api/health/supabase` una vez verificada (ver Decisions). Verificación final: `npm run lint` y `npm run build` sin errores; las pantallas del spec 02 se comportan igual.

> Antes de escribir código de Next (pasos 4, 5 y 7), leer la guía relevante en `node_modules/next/dist/docs/` según `AGENTS.md` (en particular `cacheComponents` y APIs dinámicas como `cookies()`). Este spec no toca UI, así que `/frontend-design` no aplica.

## Acceptance criteria

- [ ] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr`.
- [ ] `.env.local` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y no está trackeado; `.env.example` existe con ambas claves vacías y sin valores reales.
- [ ] Existen `lib/supabase/client.ts` y `lib/supabase/server.ts`, ambos exportan `createClient`, y lanzan un error descriptivo si falta una variable de entorno.
- [ ] Con el servidor de desarrollo activo, `GET /api/health/supabase` responde HTTP 200 con `{"ok":true}`.
- [ ] Con una clave o URL inválida, la misma ruta responde `{"ok":false,...}` sin error 500 no controlado.
- [ ] El repositorio no contiene ninguna clave `service_role` ni secreto de Supabase; solo la publishable key en `.env.local`.
- [ ] Tras el paso 7, la ruta `app/api/health/supabase` ya no existe.
- [ ] `CLAUDE.md` documenta clientes, variables de entorno y alcance pendiente.
- [ ] No se crearon tablas ni migraciones: `list_tables` y `list_migrations` siguen devolviendo vacío.
- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `/`, `/library`, `/games/[id]`, `/login`, `/hall-of-fame` y `/about` se comportan igual que antes (sesión y puntajes siguen en `localStorage`), sin errores de hidratación.

## Decisions

- **Sí:** spec de "solo base" (clientes + entorno + verificación). Auth, puntajes, Realtime y Edge Functions son dominios distintos; juntarlos haría un spec demasiado grande.
- **No:** incluir Auth ni la tabla `profiles` aquí. El usuario indicó que Auth es otro spec; las decisiones previas sobre invitado sin sesión + `profiles` y descartar `av_user` quedan **diferidas** a ese spec (se registran como intención, no se implementan).
- **Sí:** `@supabase/ssr` con cliente de navegador y de servidor. Es el patrón recomendado para App Router y evita rehacer los clientes al llegar Auth y Realtime.
- **No:** un único cliente con solo `@supabase/supabase-js`. Habría que reemplazarlo al añadir sesión basada en cookies.
- **Sí:** variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key actual, no `anon`).
- **Sí:** verificar con una ruta de health check basada en una llamada que no requiere tablas. Es la única forma de probar la conexión real con el proyecto vacío.
- **Sí:** eliminar la ruta de health check al finalizar el spec, para no exponer un endpoint público innecesario. Decisión por defecto, no discutida; si se quiere conservarla, cambiarla antes de implementar.
- **No:** generar `database.types.ts` ahora. No hay esquema; se generará con el primer spec que cree tablas.
- **No:** `proxy`/middleware de refresco de sesión ahora. Solo tiene sentido con Auth.
- **Sí:** `av_scores` y `av_user` siguen intactos en `localStorage` hasta sus specs respectivos.
- **Sí:** el proyecto se gestiona con el MCP de Supabase (`.mcp.json`, `project_ref=emrhttofgulwnllfvvdn`); no se instala Supabase CLI en este spec.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| `NEXT_PUBLIC_*` se incrusta en el bundle del cliente | Solo se usa la publishable key, pensada para ser pública; la seguridad real vendrá de RLS en los specs con tablas. Nunca poner `service_role` en variables `NEXT_PUBLIC_`. |
| `cookies()` en el cliente de servidor choca con `cacheComponents: true` (acceso dinámico fuera de `Suspense`) | Usar `createClient()` solo en route handlers o componentes dentro de `Suspense`; leer la guía de Next antes del paso 4. En este spec solo lo usa la ruta de health check. |
| `@supabase/ssr` puede haber cambiado su API (p. ej. `getAll`/`setAll` de cookies) | Consultar la documentación actual con `search_docs` (paso 1) en lugar de asumir el patrón conocido. |
| Falta de variables de entorno en otros entornos (CI, despliegue) | `.env.example` documenta los nombres y los módulos fallan con un mensaje claro. |
| `.mcp.json` trackeado expone el `project_ref` | El `project_ref` no es un secreto, pero se decide explícitamente en el paso 7 si se versiona. |
| El health check depende de un endpoint interno de Supabase (`/auth/v1/health`) que podría cambiar | Es solo verificación temporal y se elimina al terminar; si falla, usar otra llamada mínima documentada. |

## What is **not** in this spec

- Autenticación, sesiones, `profiles` ni cambios en `/login`.
- Tablas, RLS, migraciones o tipos generados.
- Puntajes persistidos ni migración de `localStorage`.
- Realtime y Edge Functions.
- Envío real del formulario de contacto.
- Supabase CLI / entorno local y tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propio spec.
