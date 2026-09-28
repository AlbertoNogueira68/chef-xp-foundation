import { log } from "../lib/logger.js";

/**
 * Uma linha por pedido, quando ele acaba.
 *
 * Isto não existia, e era a lacuna mais prática de todas: quando alguém dizia
 * "não deu", não havia nada para ver. O erro dava uma linha — se chegasse a
 * haver erro. Um 403 silencioso, um pedido que demorou nove segundos, uma
 * rota chamada trinta vezes num minuto: nada disso deixava rasto.
 *
 * Escreve-se no fim e não no início, por duas razões: uma linha por pedido em
 * vez de duas, e só no fim é que se sabe o que interessa (o estado e o tempo).
 *
 * O `requestId` é o mesmo que vai no cabeçalho `X-Request-Id` e na resposta de
 * erro, portanto um utilizador que mande o id do erro leva a conversa
 * directamente à linha certa do log.
 */
export function httpLog(req, res, next) {
  // O health check é chamado a cada poucos segundos por quem vigia o serviço.
  // Registá-lo era afogar o log no único pedido que não diz nada sobre ninguém.
  if (req.path === "/api/health") return next();

  const inicio = process.hrtime.bigint();

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    const campos = {
      requestId: req.id,
      method: req.method,
      // `route.path` em vez do caminho pedido: `/api/recipes/:id` agrupa, e
      // `/api/recipes/<uuid>` dava uma rota diferente por receita — inútil
      // para contar e uma maneira de pôr ids de conteúdo no log.
      path: req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path,
      status: res.statusCode,
      ms: Math.round(ms),
      userId: req.user?.id,
    };

    const mensagem = `${req.method} ${campos.path} ${res.statusCode}`;

    // O 5xx já foi registado com o erro inteiro pelo `errorHandler`; aqui fica
    // a linha de acesso, em `warn`, para o tempo e o estado não se perderem.
    if (res.statusCode >= 500) log.warn(campos, mensagem);
    else if (res.statusCode >= 400) log.info(campos, mensagem);
    else log.info(campos, mensagem);
  });

  next();
}
