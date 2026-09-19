import { DEFAULT_LANGUAGE, LANGUAGES } from "../domain/curriculum.js";

/**
 * A língua deste pedido.
 *
 * Vem em `?lang=`, posto pelo cliente em cada pedido. Podia vir num
 * cabeçalho, mas o service worker guarda as respostas por endereço: com um
 * cabeçalho, a lição guardada em português era servida a quem entretanto
 * mudou para inglês.
 *
 * Sem `lang` — um pedido feito à mão, ou um `curl` — vale o `Accept-Language`
 * do browser, e só depois o inglês.
 */
export function language(req, _res, next) {
  const pedida = String(req.query?.lang ?? "").toLowerCase();
  if (LANGUAGES.includes(pedida)) {
    req.lang = pedida;
  } else {
    const aceites = String(req.headers["accept-language"] ?? "").toLowerCase();
    req.lang = LANGUAGES.find((lingua) => aceites.startsWith(lingua)) ?? DEFAULT_LANGUAGE;
  }
  next();
}
