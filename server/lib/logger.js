/**
 * O log do servidor, em JSON por linha.
 *
 * Havia `console.error` espalhado por doze sítios, com o texto interpolado na
 * mensagem. Funciona para ler ao vivo e não serve para mais nada: não dá para
 * filtrar por utilizador, não dá para contar erros por rota, e não dá para
 * ligar duas linhas do mesmo pedido sem as procurar à mão.
 *
 * Uma linha de JSON resolve isso, e um `grep` continua a funcionar.
 *
 * **Sem `pino` nem `winston`, de propósito.** O resto do projeto é assim: sem
 * ORM, com o runner de testes do Node, com o CSRF escrito à mão. Um logger é
 * sessenta linhas e uma dependência nova é uma peça a manter para sempre —
 * incluindo as suas próprias dependências, num projeto que tem de ser
 * defendido por uma pessoa que o escreveu todo.
 *
 * Em desenvolvimento escreve-se uma linha legível; em produção, JSON. Quem lê
 * o log ao vivo não quer chaves e chavetas, e quem o processa não quer cores.
 */

const NIVEIS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

/**
 * Campos que nunca entram no log.
 *
 * Passwords e tokens são óbvios. O email não é óbvio e é o mais importante: é
 * o identificador pessoal da aplicação inteira, e um log é a maneira mais
 * comum de dados pessoais saírem de um sistema sem ninguém decidir que saíam.
 * Para ligar uma linha a uma pessoa há o `userId`, que é um UUID interno.
 */
const SEGREDOS = new Set([
  "password",
  "passwordConfirm",
  "token",
  "refreshToken",
  "csrfToken",
  "authorization",
  "cookie",
  "email",
  "secret",
  "jwt",
]);

function nivelAtivo() {
  const pedido = (process.env.LOG_LEVEL ?? "").toLowerCase();
  if (pedido in NIVEIS) return NIVEIS[pedido];
  // Os testes correm em silêncio: uma bateria de 400 testes que escreve o log
  // todo esconde o que interessa, que é o resultado deles.
  if (process.env.NODE_ENV === "test") return NIVEIS.silent;
  return NIVEIS.info;
}

/** Tira os segredos e achata o que não é serializável. */
function limpar(valor, profundidade = 0) {
  if (valor === null || valor === undefined) return valor;
  if (profundidade > 4) return "[fundo]";

  if (valor instanceof Error) {
    return { message: valor.message, name: valor.name, stack: valor.stack };
  }
  if (Array.isArray(valor)) return valor.slice(0, 50).map((v) => limpar(v, profundidade + 1));

  if (typeof valor === "object") {
    const saida = {};
    for (const [chave, v] of Object.entries(valor)) {
      saida[chave] = SEGREDOS.has(chave) ? "[removido]" : limpar(v, profundidade + 1);
    }
    return saida;
  }

  return valor;
}

function escrever(nivel, campos, mensagem) {
  if (NIVEIS[nivel] < nivelAtivo()) return;

  const linha = { ts: new Date().toISOString(), level: nivel, msg: mensagem, ...limpar(campos) };
  const destino = NIVEIS[nivel] >= NIVEIS.error ? process.stderr : process.stdout;

  if (process.env.NODE_ENV === "production") {
    destino.write(`${JSON.stringify(linha)}\n`);
    return;
  }

  // Em desenvolvimento: a mensagem primeiro, e os campos só se existirem.
  const { ts, level, msg, ...resto } = linha;
  const extra = Object.keys(resto).length > 0 ? ` ${JSON.stringify(resto)}` : "";
  destino.write(`${ts} ${level.toUpperCase().padEnd(5)} ${msg}${extra}\n`);
}

/**
 * `log.info({ userId }, "mensagem")` — os campos primeiro, como no pino, para a
 * mensagem ficar sempre no fim e legível.
 *
 * Aceita também `log.info("mensagem")` quando não há nada a acompanhar.
 */
function metodo(nivel) {
  return (campos, mensagem) =>
    typeof campos === "string"
      ? escrever(nivel, {}, campos)
      : escrever(nivel, campos ?? {}, mensagem ?? "");
}

export const log = {
  debug: metodo("debug"),
  info: metodo("info"),
  warn: metodo("warn"),
  error: metodo("error"),

  /**
   * Um logger com campos fixos — o pedido, por exemplo, que os carrega para
   * todas as linhas que nasçam dentro dele.
   */
  child(fixos) {
    const comFixos = (nivel) => (campos, mensagem) =>
      typeof campos === "string"
        ? escrever(nivel, fixos, campos)
        : escrever(nivel, { ...fixos, ...(campos ?? {}) }, mensagem ?? "");

    return {
      debug: comFixos("debug"),
      info: comFixos("info"),
      warn: comFixos("warn"),
      error: comFixos("error"),
      child: (mais) => log.child({ ...fixos, ...mais }),
    };
  },
};

/** Exportado para os testes: a lista de campos removidos é uma regra, não um detalhe. */
export const CAMPOS_REMOVIDOS = SEGREDOS;
