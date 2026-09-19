import { TTL_MINUTES, PASSWORD_RESET, EMAIL_VERIFICATION, SIGNUP } from "./authTokens.js";
import { translate } from "../lib/i18n.js";

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

/**
 * Uma frase do email, na língua de quem o pediu, com os valores substituídos.
 *
 * A língua é a do pedido que desencadeou o envio — quem carregou em "recuperar
 * password" estava a olhar para a app numa língua, e o email que chega a
 * seguir tem de ser o mesmo idioma dessa app.
 */
function frase(chave, lang, valores = {}) {
  let texto = translate(chave, lang);
  for (const [nome, valor] of Object.entries(valores)) {
    texto = texto.replaceAll(`{${nome}}`, String(valor));
  }
  return texto;
}

/** Escapa o que vem da base de dados antes de entrar no HTML do email. */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function horas(minutos, lang) {
  if (minutos % (60 * 24) === 0) {
    const dias = minutos / (60 * 24);
    return dias === 1 ? frase("24 hours", lang) : frase("{days} days", lang, { days: dias });
  }
  if (minutos % 60 === 0) {
    const h = minutos / 60;
    return h === 1 ? frase("1 hour", lang) : frase("{hours} hours", lang, { hours: h });
  }
  return frase("{minutes} minutes", lang, { minutes: minutos });
}

/** Moldura comum: o mesmo cabeçalho, botão e rodapé para os dois emails. */
function layout({ titulo, corpo, link, textoBotao, rodape, lang }) {
  return `<!doctype html>
<html lang="${lang === "pt" ? "pt" : "en"}">
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
            <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#a8a29e;word-break:break-all">${frase("If the button doesn't work, copy this address into your browser:", lang)}<br>${escapeHtml(link)}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function passwordResetEmail({ username, link, lang }) {
  const validade = horas(TTL_MINUTES[PASSWORD_RESET], lang);

  return {
    subject: frase("Reset your password — ChefXP", lang),
    text: [
      frase("Hi {name},", lang, { name: username }),
      "",
      frase("You asked to reset the password for your ChefXP account. Open this address:", lang),
      link,
      "",
      frase("The link lasts {validity} and works once.", lang, { validity: validade }),
      "",
      frase("If this wasn't you, ignore this email — your password stays as it is.", lang),
    ].join("\n"),
    html: layout({
      lang,
      titulo: frase("Reset the password", lang),
      corpo: frase(
        "Hi <strong>{name}</strong>, you asked to reset your account's password.",
        lang,
        {
          name: escapeHtml(username),
        },
      ),
      link,
      textoBotao: frase("Choose a new password", lang),
      rodape: frase(
        "The link lasts {validity} and works once. If this wasn't you, ignore this email — your password stays as it is.",
        lang,
        { validity: validade },
      ),
    }),
  };
}

export function emailVerificationEmail({ username, link, lang }) {
  const validade = horas(TTL_MINUTES[EMAIL_VERIFICATION], lang);

  return {
    subject: frase("Confirm your email — ChefXP", lang),
    text: [
      frase("Hi {name},", lang, { name: username }),
      "",
      frase(
        "Confirm this address is yours so we can help you recover the account if you lose your password:",
        lang,
      ),
      link,
      "",
      frase("The link lasts {validity}.", lang, { validity: validade }),
      "",
      frase("If you didn't create a ChefXP account, ignore this email.", lang),
    ].join("\n"),
    html: layout({
      lang,
      titulo: frase("Confirm your email", lang),
      corpo: frase(
        "Hi <strong>{name}</strong>, confirm this address is yours — it's how you recover the account if you lose your password.",
        lang,
        { name: escapeHtml(username) },
      ),
      link,
      textoBotao: frase("Confirm email", lang),
      rodape: frase(
        "The link lasts {validity}. If you didn't create a ChefXP account, ignore this email.",
        lang,
        { validity: validade },
      ),
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
export function signupEmail({ link, lang }) {
  const validade = horas(TTL_MINUTES[SIGNUP], lang);

  return {
    subject: frase("Create your account — ChefXP", lang),
    text: [
      frase("Welcome to ChefXP!", lang),
      "",
      frase("Open this address to choose your username and password:", lang),
      link,
      "",
      frase("The link lasts {validity} and works once.", lang, { validity: validade }),
      "",
      frase("If you didn't ask for this, ignore this email — no account is created.", lang),
    ].join("\n"),
    html: layout({
      lang,
      titulo: frase("Create your account", lang),
      corpo: frase(
        "We've confirmed this address is yours. Now choose your username and password.",
        lang,
      ),
      link,
      textoBotao: frase("Choose username and password", lang),
      rodape: frase(
        "The link lasts {validity} and works once. If you didn't ask for this, ignore this email — no account is created.",
        lang,
        { validity: validade },
      ),
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
export function signupExistingAccountEmail({ username, link, lang }) {
  return {
    subject: frase("You already have a ChefXP account", lang),
    text: [
      frase("Hi {name},", lang, { name: username }),
      "",
      frase(
        "Someone (maybe you) asked to create an account with this address — but it already has one.",
        lang,
      ),
      "",
      frase("If it was you and you don't remember the password, reset it here:", lang),
      link,
      "",
      frase("If it wasn't you, you can ignore this email: nothing changed in your account.", lang),
    ].join("\n"),
    html: layout({
      lang,
      titulo: frase("You already have a ChefXP account", lang),
      corpo: frase(
        "Hi <strong>{name}</strong>, someone asked to create an account with this address — but it already has one. If it was you and you don't remember the password, you can reset it.",
        lang,
        { name: escapeHtml(username) },
      ),
      link,
      textoBotao: frase("Reset the password", lang),
      rodape: frase("If it wasn't you, ignore this email: nothing changed in your account.", lang),
    }),
  };
}
