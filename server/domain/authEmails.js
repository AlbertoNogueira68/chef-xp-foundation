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
    return dias === 1 ? "24 horas" : `${dias} dias`;
  }
  if (minutos % 60 === 0) {
    const h = minutos / 60;
    return h === 1 ? "1 hora" : `${h} horas`;
  }
  return `${minutos} minutos`;
}

/** Moldura comum: o mesmo cabeçalho, botão e rodapé para os dois emails. */
function layout({ titulo, corpo, link, textoBotao, rodape }) {
  return `<!doctype html>
<html lang="pt">
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
            <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#a8a29e;word-break:break-all">Se o botão não funcionar, copia este endereço para o browser:<br>${escapeHtml(link)}</p>
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
    subject: "Redefinir a tua password — Chef XP",
    text: [
      `Olá ${username},`,
      "",
      "Pediste para redefinir a password da tua conta Chef XP. Abre este endereço:",
      link,
      "",
      `O link vale ${validade} e só pode ser usado uma vez.`,
      "",
      "Se não foste tu, ignora este email — a tua password fica como está.",
    ].join("\n"),
    html: layout({
      titulo: "Redefinir a password",
      corpo: `Olá <strong>${escapeHtml(username)}</strong>, pediste para redefinir a password da tua conta.`,
      link,
      textoBotao: "Escolher password nova",
      rodape: `O link vale ${validade} e só pode ser usado uma vez. Se não foste tu, ignora este email — a tua password fica como está.`,
    }),
  };
}

export function emailVerificationEmail({ username, link }) {
  const validade = horas(TTL_MINUTES[EMAIL_VERIFICATION]);

  return {
    subject: "Confirma o teu email — Chef XP",
    text: [
      `Olá ${username},`,
      "",
      "Confirma que este endereço é teu para podermos ajudar-te a recuperar a conta se perderes a password:",
      link,
      "",
      `O link vale ${validade}.`,
      "",
      "Se não criaste conta no Chef XP, ignora este email.",
    ].join("\n"),
    html: layout({
      titulo: "Confirma o teu email",
      corpo: `Olá <strong>${escapeHtml(username)}</strong>, confirma que este endereço é teu — é por aqui que recuperas a conta se perderes a password.`,
      link,
      textoBotao: "Confirmar o email",
      rodape: `O link vale ${validade}. Se não criaste conta no Chef XP, ignora este email.`,
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
    subject: "Criar a tua conta — Chef XP",
    text: [
      "Bem-vindo ao Chef XP!",
      "",
      "Abre este endereço para escolheres o teu nome de utilizador e a tua password:",
      link,
      "",
      `O link vale ${validade} e só pode ser usado uma vez.`,
      "",
      "Se não foste tu a pedir, ignora este email — não fica conta nenhuma criada.",
    ].join("\n"),
    html: layout({
      titulo: "Criar a tua conta",
      corpo:
        "Confirmámos que este endereço é teu. Falta escolheres o nome de utilizador e a password.",
      link,
      textoBotao: "Escolher nome e password",
      rodape: `O link vale ${validade} e só pode ser usado uma vez. Se não foste tu a pedir, ignora este email — não fica conta nenhuma criada.`,
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
    subject: "Já tens conta no Chef XP",
    text: [
      `Olá ${username},`,
      "",
      "Alguém (talvez tu) pediu para criar uma conta com este endereço — mas ele já tem uma.",
      "",
      "Se foste tu e não te lembras da password, redefine-a aqui:",
      link,
      "",
      "Se não foste tu, podes ignorar este email: não mudou nada na tua conta.",
    ].join("\n"),
    html: layout({
      titulo: "Já tens conta no Chef XP",
      corpo: `Olá <strong>${escapeHtml(username)}</strong>, alguém pediu para criar uma conta com este endereço — mas ele já tem uma. Se foste tu e não te lembras da password, podes redefini-la.`,
      link,
      textoBotao: "Redefinir a password",
      rodape: "Se não foste tu, ignora este email: não mudou nada na tua conta.",
    }),
  };
}
