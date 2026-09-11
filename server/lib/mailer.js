import nodemailer from "nodemailer";

/**
 * Envio de email.
 *
 * Três estados possíveis, e nenhum deles é "falha em silêncio":
 *
 *  - SMTP configurado: envia.
 *  - Nada configurado, fora de produção: escreve a mensagem na consola. Quem
 *    está a desenvolver vê o código e continua, sem precisar de um servidor de
 *    email — e nada se perde por engano, porque fica à vista.
 *  - Nada configurado, em produção: falha no arranque. Um registo que promete
 *    um código que nunca chega é pior do que um registo que não arranca: a
 *    pessoa fica com uma conta que não consegue confirmar e sem saber porquê.
 *
 * É a mesma regra do SSO da Google, pela mesma razão.
 */

const REQUIRED = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"];

export function smtpConfigured(env = process.env) {
  return REQUIRED.every((name) => Boolean(env[name]));
}

/** Meio configurado é o pior dos mundos: diz-se já, e diz-se o que falta. */
export function smtpConfigError(env = process.env) {
  const present = REQUIRED.filter((name) => Boolean(env[name]));
  if (present.length === 0 || present.length === REQUIRED.length) return null;

  const missing = REQUIRED.filter((name) => !env[name]);
  return `SMTP meio configurado: falta ${missing.join(", ")}. Define todas ou nenhuma.`;
}

export function mailFrom(env = process.env) {
  return env.SMTP_FROM || env.SMTP_USER || "ChefXP <nao-responder@chefxp.local>";
}

let transport = null;

function getTransport() {
  if (transport) return transport;

  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    // 465 é TLS implícito; 587 começa em claro e sobe com STARTTLS. Acertar
    // isto sozinho evita o erro de configuração mais comum com SMTP.
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  return transport;
}

/** Só para os testes: obriga a próxima chamada a construir o transporte outra vez. */
export function resetTransport() {
  transport = null;
}

/**
 * O que se escreve na consola quando não há SMTP.
 *
 * Separado do envio para os testes poderem ler o código sem espiar registos.
 */
export const outbox = [];

export async function sendMail({ to, subject, text, html }) {
  const isProd = process.env.NODE_ENV === "production";

  if (!smtpConfigured()) {
    if (isProd) {
      throw new Error("SMTP não configurado: não é possível enviar email em produção.");
    }

    outbox.push({ to, subject, text, sentAt: new Date().toISOString() });
    console.log(
      `\n[email] (sem SMTP — apenas consola)\n  para: ${to}\n  assunto: ${subject}\n  ${text}\n`,
    );
    return { delivered: false, logged: true };
  }

  await getTransport().sendMail({ from: mailFrom(), to, subject, text, html });
  return { delivered: true, logged: false };
}
