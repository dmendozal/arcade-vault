# SPEC 03 — Envío real del formulario de contacto con Resend

> **Status:** Implementado  
> **Depends on:** SPEC 02
> **Date:** 2026-11-23
> **Objective:** Reemplazar la simulación del formulario de contacto de `/about` por un envío real de correo mediante Resend, usando una Server Action, sin cambiar la UI existente de la página.

---

## Por qué existe este spec

El spec 02 portó `/about` (hero, destacados, divisor y formulario) desde `references/home-about/`, pero dejó el formulario simulado en cliente y el envío real fuera de alcance. La página ya existe y es idéntica a la referencia; falta que "ENVIAR MENSAJE" entregue el mensaje al equipo. Este spec solo cubre esa pieza.

## Scope

**In:**

- Server Action `sendContactMessage` en `app/about/actions.ts` (`"use server"`) que valida los datos en servidor y envía el correo con el SDK `resend`.
- Integrar la acción en `components/contact-form.tsx` con `useActionState`, conservando el markup, las clases (`contact-form`, `field`, `terminal-success`, `shake`) y el texto de éxito de la referencia.
- Validación en servidor: `name`, `email` (formato válido) y `msg` no vacíos tras `trim()`, con longitudes máximas.
- Campo honeypot oculto: si llega relleno, la acción responde éxito sin enviar nada.
- Estado de error visible en el formulario cuando falla la validación o Resend; no se muestra la terminal de éxito.
- Variables de entorno `RESEND_API_KEY` y `CONTACT_TO_EMAIL`; remitente fijo `onboarding@resend.dev`; `replyTo` = correo del visitante.
- Archivo `.env.example` (sí versionado) con las variables sin valores reales; documentarlas en `README.md`.
- Estilo mínimo para el mensaje de error en `app/globals.css`, solo si ninguna clase existente sirve.

**Out of scope (para futuros specs):**

- Dominio propio verificado en Resend y remitente personalizado.
- Rate limiting por IP, captcha o almacenamiento (Upstash/KV).
- Correo de confirmación al visitante, plantillas con React Email o HTML elaborado.
- Guardar los mensajes en base de datos o panel de administración.
- Rehacer o modificar el resto de `/about` (hero, destacados, divisor).
- Tests automatizados, analítica, i18n.

## Data model

No introduce datos persistentes. Tipos locales de la acción:

```ts
// app/about/actions.ts
export interface ContactState {
  status: "idle" | "success" | "error";
  name?: string;      // nombre saneado, usado en "GRACIAS, {NAME}."
  error?: string;     // mensaje en español mostrado en la UI
}

export async function sendContactMessage(
  prev: ContactState,
  formData: FormData,
): Promise<ContactState>;
// campos de formData: name, email, msg, website (honeypot, debe llegar vacío)
```

Convenciones:

- Límites: `name` ≤ 60, `email` ≤ 120, `msg` ≤ 2000 caracteres.
- El asunto del correo es `[Arcade Vault] Mensaje de {name}`; el cuerpo es texto plano con nombre, correo y mensaje. El contenido del visitante se envía como texto (`text`), nunca interpolado en HTML.
- `RESEND_API_KEY` y `CONTACT_TO_EMAIL` se leen solo en servidor; nunca con prefijo `NEXT_PUBLIC_`.
- Si falta alguna variable, la acción responde `status: "error"` con un mensaje genérico y registra el motivo con `console.error` (sin exponerlo al cliente).

## Implementation plan

1. Leer en `node_modules/next/dist/docs/01-app/` las guías de `forms.md`, `07-mutating-data.md` y `environment-variables.md`, y comprobar cómo interactúan las Server Actions con `cacheComponents: true`. Verificación: notas aplicadas en los pasos siguientes.
2. Instalar `resend` (`npm i resend`) y crear `.env.example` con `RESEND_API_KEY=` y `CONTACT_TO_EMAIL=`; añadir una sección "Contacto por correo" al `README.md` (crear API key en Resend, `CONTACT_TO_EMAIL` debe ser el correo de la cuenta Resend al usar `onboarding@resend.dev`). Crear `.env.local` local (ignorado por git) para probar. Verificación: `git status` no muestra `.env.local`; `npx tsc --noEmit` sin errores.
3. Crear `app/about/actions.ts` con `sendContactMessage`: honeypot, validación y saneamiento, lectura de variables, `new Resend(key).emails.send({ from, to, replyTo, subject, text })`, y manejo del resultado (`error` de Resend → `status: "error"`). Verificación: `npm run lint` y `npx tsc --noEmit`.
4. Adaptar `components/contact-form.tsx`: `useActionState(sendContactMessage, { status: "idle" })`, `<form action={formAction}>`, inputs con `name`, campo honeypot `website` oculto (fuera de pantalla, `tabIndex={-1}`, `autoComplete="off"`, `aria-hidden`), botón con `useFormStatus`/`isPending` ("ENVIANDO…" y deshabilitado), `shake` 400 ms cuando `status === "error"`, mensaje de error en el formulario y terminal de éxito con `state.name`. `ENVIAR OTRO MENSAJE` vuelve a `idle` y limpia los campos. Mantener la limpieza del `setTimeout`. Verificación: lint y typecheck.
5. Probar el flujo real en el navegador con una API key de Resend: envío correcto (llega el correo con `replyTo` del visitante), campos vacíos, correo inválido, variable ausente y fallo simulado de Resend. Verificación final: `npm run lint` y `npm run build` sin errores; `/about` sin errores de hidratación.

> Usar `/frontend-design` solo para el estilo del mensaje de error, según `CLAUDE.md`; el resto de la UI no cambia.

## Acceptance criteria

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `resend` figura en `dependencies` y no hay ninguna API route nueva (`app/api/` no existe).
- [ ] `.env.example` está versionado con `RESEND_API_KEY` y `CONTACT_TO_EMAIL` vacías; `.env.local` no aparece en `git status`.
- [ ] Enviar nombre, correo válido y mensaje desde `/about` entrega un correo a `CONTACT_TO_EMAIL` desde `onboarding@resend.dev`, con asunto `[Arcade Vault] Mensaje de {name}` y `replyTo` igual al correo del visitante.
- [ ] Tras un envío correcto se muestra la terminal `VAULT-OS // TERMINAL` con "MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, PX_KAI." para el nombre `px_kai`; `ENVIAR OTRO MENSAJE` vuelve al formulario vacío.
- [ ] Con algún campo vacío o un correo sin formato válido, el formulario hace `shake`, muestra un mensaje de error y no se envía ningún correo (verificado también llamando a la acción sin pasar por la validación del navegador).
- [ ] Un `msg` de más de 2000 caracteres es rechazado con mensaje de error.
- [ ] Con el honeypot `website` relleno, la UI muestra éxito pero no se envía ningún correo.
- [ ] Si Resend devuelve error (clave inválida) o faltan las variables, se muestra un mensaje de error genérico en el formulario, no se muestra la terminal de éxito y el cuerpo del error de Resend no llega al cliente.
- [ ] Durante el envío el botón queda deshabilitado y muestra "ENVIANDO…"; no se pueden enviar dos mensajes con doble clic.
- [ ] `RESEND_API_KEY` no aparece en el bundle de cliente (`grep` en `.next/static` sin coincidencias).
- [ ] El resto de `/about` (título, misión, 3 destacados, divisor de 24 píxeles) y las demás rutas no cambian.
- [ ] No hay errores de hidratación en la consola de `/about`.

## Decisions

- **Sí:** limitar el spec al envío real; `/about` ya está implementada en el spec 02. Rehacer la página duplicaría trabajo.
- **Sí:** Server Action con `useActionState` en vez de Route Handler. Sin endpoint público extra, encaja con Next 16 y es menos código; el único consumidor es el formulario.
- **No:** `app/api/contact/route.ts`. Solo tendría sentido si otro cliente consumiera la API.
- **Sí:** remitente `onboarding@resend.dev` y destino en `CONTACT_TO_EMAIL`. No requiere dominio; en Resend este remitente solo entrega al correo dueño de la cuenta, aceptable para un proyecto de aprendizaje.
- **No:** dominio verificado por ahora. Requiere DNS y queda para cuando el producto tenga dominio.
- **Sí:** `replyTo` con el correo del visitante, para poder responderle directamente desde el buzón del equipo.
- **Sí:** validación en servidor además de la del cliente; el navegador no es una barrera de confianza.
- **Sí:** honeypot como única protección anti-spam, respondiendo éxito falso para no dar pistas a bots.
- **No:** rate limit ni captcha. Requieren almacenamiento o servicios externos; se abordan en un spec propio si hay abuso real.
- **Sí:** contenido del visitante enviado como `text` plano, sin HTML, para evitar inyección de marcado en el correo.
- **Sí:** la UI, las clases CSS y los textos del formulario se mantienen idénticos a la referencia; solo se añaden el estado de error y el estado "ENVIANDO…".

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| `onboarding@resend.dev` solo entrega a la cuenta dueña de la API key; otro destino devuelve error | Documentarlo en `README.md` y `.env.example`; el criterio de aceptación usa el correo de la cuenta. |
| `RESEND_API_KEY` filtrada al cliente o al repo | Sin prefijo `NEXT_PUBLIC_`, solo en `"use server"`, `.env*` ya está en `.gitignore`, verificación con `grep` en `.next/static`. |
| Spam o abuso del endpoint de la Server Action sin rate limit | Honeypot, límites de longitud y quota gratuita de Resend como tope; rate limit queda para un spec futuro. |
| `cacheComponents: true` y Server Actions: acceso a `process.env` o `FormData` fuera de lo permitido | El paso 1 revisa la guía; la acción solo lee entorno y `FormData` dentro de su propia ejecución. |
| La acción fallida deja el formulario vacío y el visitante pierde el mensaje | Los inputs se mantienen como no controlados con `defaultValue` tomado del estado devuelto, o se conserva el estado local; verificar en el paso 4. |
| Fallo de Resend deja al usuario sin saber qué pasó | Mensaje de error genérico en la UI y `console.error` con el detalle en servidor. |

## What is **not** in this spec

- Dominio propio, remitente personalizado ni correo de confirmación al visitante.
- Rate limiting, captcha o persistencia de mensajes.
- Cambios en el resto de `/about` o en otras rutas.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propio spec.
