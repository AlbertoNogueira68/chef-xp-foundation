import { TTL_MINUTES, PASSWORD_RESET, EMAIL_VERIFICATION, SIGNUP } from "./authTokens.js";

/**
 * O texto dos emails.
 *
 * Funções puras: recebem o nome e o link, devolvem assunto, texto e HTML.
 * Estão separadas do transporte para poderem ser lidas e testadas sem
 * levantar SMTP nenhum — e porque o que um email diz é uma decisão de
 * produto, não de infraestrutura.
 *
 * Cada email vai em texto e em HTML. Nem todos os clientes mostram HTML, e
 * um email de recuperação que chega vazio é um utilizador trancado à porta.
 */

/** Escapa o que vem da base de dados antes de entrar no HTML do email. */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function horas(minutos) {
  if (minutos % (60 * 24) === 0) {
    const dias = minutos / (60 * 24);
    return dias === 1 ? "24 hours" : `${dias} days`;
  }
  if (minutos % 60 === 0) {
    const h = minutos / 60;
    return h === 1 ? "1 hour" : `${h} hours`;
  }
  return `${minutos} minutes`;
}

/** Moldura comum: o mesmo cabeçalho, botão e rodapé para os dois emails. */
function layout({ titulo, corpo, link, textoBotao, rodape }) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#faf7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
          <tr><td>
            <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#d97706">Chef XP</p>
            <h1 style="margin:0 0 16px;font-size:18px;font-weight:600">${escapeHtml(titulo)}</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#44403c">${corpo}</p>
            <a href="${escapeHtml(link)}" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:999px">${escapeHtml(textoBotao)}</a>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#78716c">${rodape}</p>
            <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#a8a29e;word-break:break-all">If the button doesn't work, copy this address into your browser:<br>${escapeHtml(link)}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function passwordResetEmail({ username, link }) {
  const validade = horas(TTL_MINUTES[PASSWORD_RESET]);

  return {
    subject: "Reset your password — ChefXP",
    text: [
      `Hi ${username},`,
      "",
      "You asked to reset the password for your ChefXP account. Open this address:",
      link,
      "",
      `The link lasts ${validade} and works once.`,
      "",
      "If this wasn't you, ignore this email — your password stays as it is.",
    ].join("\n"),
    html: layout({
      titulo: "Reset the password",
      corpo: `Hi <strong>${escapeHtml(username)}</strong>, you asked to reset your account's password.`,
      link,
      textoBotao: "Choose a new password",
      rodape: `The link lasts ${validade} and works once. If this wasn't you, ignore this email — your password stays as it is.`,
    }),
  };
}

export function emailVerificationEmail({ username, link }) {
  const validade = horas(TTL_MINUTES[EMAIL_VERIFICATION]);

  return {
    subject: "Confirm your email — ChefXP",
    text: [
      `Hi ${username},`,
      "",
      "Confirm this address is yours so we can help you recover the account if you lose your password:",
      link,
      "",
      `The link lasts ${validade}.`,
      "",
      "If you didn't create a ChefXP account, ignore this email.",
    ].join("\n"),
    html: layout({
      titulo: "Confirm your email",
      corpo: `Hi <strong>${escapeHtml(username)}</strong>, confirm this address is yours — it's how you recover the account if you lose your password.`,
      link,
      textoBotao: "Confirm email",
      rodape: `The link lasts ${validade}. If you didn't create a ChefXP account, ignore this email.`,
    }),
  };
}

/**
 * O link que abre a criação de conta.
 *
 * Não diz "olá <nome>" como os outros: nesta altura só sabemos o endereço —
 * o nome de utilizador é escolhido do outro lado do link, já com o email
 * confirmado.
 */
export function signupEmail({ link }) {
  const validade = horas(TTL_MINUTES[SIGNUP]);

  return {
    subject: "Create your account — ChefXP",
    text: [
      "Welcome to ChefXP!",
      "",
      "Open this address to choose your username and password:",
      link,
      "",
      `The link lasts ${validade} and works once.`,
      "",
      "If you didn't ask for this, ignore this email — no account is created.",
    ].join("\n"),
    html: layout({
      titulo: "Create your account",
      corpo:
        "We've confirmed this address is yours. Now choose your username and password.",
      link,
      textoBotao: "Choose username and password",
      rodape: `The link lasts ${validade} and works once. If you didn't ask for this, ignore this email — no account is created.`,
    }),
  };
}

/**
 * O email para quem pede uma conta com um endereço que já tem uma.
 *
 * Existe para a resposta da API poder ser sempre a mesma: se um email já
 * registado desse um erro e um novo desse ok, bastava o formulário de registo
 * para descobrir quem tem conta aqui. Quem for mesmo dono da caixa fica a
 * saber o que se passa; quem estiver a sondar não fica a saber nada.
 */
export function signupExistingAccountEmail({ username, link }) {
  return {
    subject: "You already have a ChefXP account",
    text: [
      `Hi ${username},`,
      "",
      "Someone (maybe you) asked to create an account with this address — but it already has one.",
      "",
      "If it was you and you don't remember the password, reset it here:",
      link,
      "",
      "If it wasn't you, you can ignore this email: nothing changed in your account.",
    ].join("\n"),
    html: layout({
      titulo: "You already have a ChefXP account",
      corpo: `Hi <strong>${escapeHtml(username)}</strong>, someone asked to create an account with this address — but it already has one. If it was you and you don't remember the password, you can reset it.`,
      link,
      textoBotao: "Reset the password",
      rodape: "If it wasn't you, ignore this email: nothing changed in your account.",
    }),
  };
}
