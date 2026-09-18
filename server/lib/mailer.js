import nodemailer from "nodemailer";

/**
 * Envio de email por SMTP.
 *
 * Uma função só — `sendMail` — e o transporte criado à primeira utilização.
 * O que cada email diz está em `domain/authEmails.js`; aqui só se trata de o
 * pôr na rede.
 *
 * Sem `SMTP_USER` e `SMTP_PASSWORD` o envio fica desligado e a app arranca na
 * mesma, como o SSO da Google: as rotas que dependem disto respondem 404 e o
 * frontend não oferece o que não existe. Um projeto acabado de clonar tem de
 * funcionar sem uma conta de email.
 *
 * A exceção é `SMTP_AUTH=none`: um servidor que aceita correio sem
 * credenciais. É assim que o Mailpit do `docker-compose.dev.yml` funciona —
 * apanha tudo o que sai e mostra numa caixa de correio em
 * http://localhost:8025, sem conta nenhuma e sem risco de mandar um email a
 * sério a alguém durante o desenvolvimento.
 */

/**
 * `true` quando o servidor de SMTP não pede credenciais.
 *
 * Credenciais definidas ganham sempre: o compose de desenvolvimento põe
 * `SMTP_AUTH=none` por omissão, e quem tiver o seu Gmail no `.env` não tem de
 * saber disso para que funcione.
 */
export function smtpAuthDisabled() {
  return process.env.SMTP_AUTH === "none" && !process.env.SMTP_USER;
}

export function isMailConfigured() {
  if (smtpAuthDisabled()) return Boolean(process.env.SMTP_HOST);
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

/**
 * O "De:" do email. Por omissão, o próprio utilizador de SMTP — que não
 * existe quando não há autenticação, e por isso o `validateEnv` exige
 * `MAIL_FROM` nesse caso.
 */
export function mailFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_USER || "";
}

let transport = null;

/**
 * Substitui o transporte. Existe para os testes, e é a razão de este módulo
 * guardar o transporte numa variável em vez de o criar a cada envio: a
 * bateria de integração corre o fluxo inteiro — token, email, link — sem
 * abrir uma ligação SMTP nem mandar correio a ninguém.
 */
export function setMailTransport(fake) {
  transport = fake;
}

function getTransport() {
  if (transport) return transport;

  const port = Number(process.env.SMTP_PORT || 587);

  if (smtpAuthDisabled()) {
    // Sem credenciais e sem cifra: é uma caixa de correio local, o correio
    // não sai da máquina, e insistir em STARTTLS contra o certificado que o
    // Mailpit gera sozinho só dava um erro de certificado a meio do envio.
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: false,
      ignoreTLS: true,
    });
    return transport;
  }

  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    // 465 é TLS desde o primeiro byte; 587 começa em claro e sobe a TLS com
    // STARTTLS. Errar isto dá um tempo-limite sem mensagem de erro útil.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });

  return transport;
}

/**
 * Envia. Devolve o que o transporte devolver.
 *
 * Não apanha erros: quem chama é que sabe se um envio falhado deve interromper
 * o pedido (verificação pedida pelo utilizador, que quer saber) ou apenas ficar
 * no registo (recuperação de password, que responde sempre o mesmo para não
 * dizer quem tem conta).
 */
export async function sendMail({ to, subject, text, html }) {
  if (!isMailConfigured()) {
    throw new Error("Envio de email não configurado (falta SMTP_USER/SMTP_PASSWORD)");
  }
  return getTransport().sendMail({ from: mailFrom(), to, subject, text, html });
}
