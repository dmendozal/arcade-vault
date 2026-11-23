## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Contacto por correo

El formulario de `/about` envía el mensaje con [Resend](https://resend.com) mediante una Server Action.

1. Crea una API key en https://resend.com/api-keys.
2. Copia `.env.example` a `.env.local` y completa las variables:

   | Variable           | Descripción                                                                                                  |
   | ------------------ | ------------------------------------------------------------------------------------------------------------ |
   | `RESEND_API_KEY`   | API key de Resend (solo servidor, nunca con prefijo `NEXT_PUBLIC_`).                                          |
   | `CONTACT_TO_EMAIL` | Correo que recibe los mensajes. Con el remitente `onboarding@resend.dev` debe ser el correo de tu cuenta Resend. |

3. Reinicia `npm run dev` tras cambiar las variables.

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```