"use server";

import { Resend } from "resend";

export interface ContactState {
  status: "idle" | "success" | "error";
  name?: string;
  error?: string;
}

const MAX_NAME = 60;
const MAX_EMAIL = 120;
const MAX_MSG = 2000;
const FROM = "onboarding@resend.dev";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENERIC_ERROR = "No pudimos enviar tu mensaje. Inténtalo de nuevo más tarde.";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// Strips control characters (incl. CR/LF) to avoid header injection in subject/name.
function singleLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
}

export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name = singleLine(field(formData, "name"));
  const email = field(formData, "email");
  const msg = field(formData, "msg");

  // Honeypot: bots fill the hidden field. Fake success, send nothing.
  if (field(formData, "website") !== "") {
    return { status: "success", name: name.slice(0, MAX_NAME) || "VISITANTE" };
  }

  if (!name || !email || !msg) {
    return { status: "error", error: "Completa todos los campos." };
  }
  if (name.length > MAX_NAME) {
    return { status: "error", error: `El nombre no puede superar ${MAX_NAME} caracteres.` };
  }
  if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return { status: "error", error: "Introduce un correo electrónico válido." };
  }
  if (msg.length > MAX_MSG) {
    return { status: "error", error: `El mensaje no puede superar ${MAX_MSG} caracteres.` };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    console.error("[contact] Missing RESEND_API_KEY or CONTACT_TO_EMAIL");
    return { status: "error", error: GENERIC_ERROR };
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: FROM,
      to,
      replyTo: email,
      subject: `[Arcade Vault] Mensaje de ${name}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${msg}`,
    });
    if (error) {
      console.error("[contact] Resend error:", error);
      return { status: "error", error: GENERIC_ERROR };
    }
  } catch (err) {
    console.error("[contact] Unexpected error sending email:", err);
    return { status: "error", error: GENERIC_ERROR };
  }

  return { status: "success", name };
}
