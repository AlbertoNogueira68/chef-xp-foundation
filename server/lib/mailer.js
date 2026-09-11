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

/**
 * É o `SMTP_HOST` que decide se há servidor de email. A autenticação é
 * separada e opcional.
 *
 * Nem todo o servidor de SMTP pede credenciais: uma caixa de correio de
 * desenvolvimento como o Mailpit aceita tudo sem autenticação nenhuma, e o
 * mesmo vale para relés internos. Exigir utilizador e password para se poder
 * enviar era proibir o caso mais útil de todos — ver os emails a sair sem
 * precisar de uma conta a sério.
 */
export function smtpConfigured(env = process.env) {
  return Boolean(env.SMTP_HOST);
}

export function smtpAuthConfigured(env = process.env) {
  return Boolean(env.SMTP_USER && env.SMTP_PASSWORD);
}

/**
 * Meio configurado é o pior dos mundos: diz-se já, e diz-se o que falta.
 *
 * Utilizador e password andam aos pares — um sem o outro é sempre engano. E
 * credenciais sem servidor não são um servidor.
 */
export function smtpConfigError(env = process.env) {
  const hasUser = Boolean(env.SMTP_USER);
  const hasPassword = Boolean(env.SMTP_PASSWORD);

  if (hasUser !== hasPassword) {
    const missing = hasUser ? "SMTP_PASSWORD" : "SMTP_USER";
    return `SMTP meio configurado: falta ${missing}. Define as duas, ou nenhuma.`;
  }

  if (!env.SMTP_HOST && hasUser) {
    return "SMTP_USER e SMTP_PASSWORD definidas sem SMTP_HOST: falta dizer para onde enviar.";
  }

  return null;
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
    // Sem limites explícitos, um SMTP inacessível não dá erro — fica pendurado.
    // E como o código é enviado dentro do pedido de registo, quem se estivesse
    // a registar ficava a olhar para um botão a girar até desistir. Falhar ao
    // fim de dez segundos é muito melhor do que não falhar: o registo já
    // aconteceu e há um botão para reenviar o código.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    // 465 é TLS implícito; 587 começa em claro e sobe com STARTTLS. Acertar
    // isto sozinho evita o erro de configuração mais comum com SMTP.
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    // Sem credenciais não se manda `auth` nenhum: o nodemailer tentaria
    // autenticar-se com valores vazios e o servidor recusava. Um servidor que
    // não pede autenticação tem de ser usado sem ela.
    //
    // A Google mostra as palavras-passe de app em grupos de quatro, e quem
    // copia leva os espaços com ela. O `.trim()` só apara as pontas; os
    // espaços do meio ficam, e o `npm run mail:check` avisa — apagá-los em
    // silêncio era adivinhar qual é a password verdadeira de alguém.
    ...(smtpAuthConfigured()
      ? {
          auth: {
            user: process.env.SMTP_USER.trim(),
            pass: process.env.SMTP_PASSWORD.trim(),
          },
        }
      : {}),
  });
  return transport;
}

/** Só para os testes: obriga a próxima chamada a construir o transporte outra vez. */
export function resetTransport() {
  transport = null;
}

/**
 * Liga-se ao servidor e autentica, sem enviar nada.
 *
 * Serve para separar "as credenciais estão erradas" de "o email não chegou",
 * que são problemas diferentes e costumam ser confundidos.
 */
export async function verifyTransport() {
  if (!smtpConfigured()) throw new Error("SMTP não configurado");
  await getTransport().verify();
  return true;
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
