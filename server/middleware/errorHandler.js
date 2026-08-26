import crypto from "node:crypto";

/** Um id por pedido, para ligar o que o utilizador vê ao que está no log. */
export function requestId(req, res, next) {
  req.id = req.get("X-Request-Id") || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

export function notFound(req, res) {
  res.status(404).json({ error: "Endpoint não encontrado", requestId: req.id });
}

/**
 * Tratamento de erros central. Nunca devolve o stack ao cliente: devolve um id
 * que aparece no log do servidor.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, _next) {
  const status = Number(error?.status || error?.statusCode || 500);

  if (status >= 500) {
    console.error(`[error] ${req.id} ${req.method} ${req.originalUrl}`, error);
  } else {
    console.warn(`[warn] ${req.id} ${req.method} ${req.originalUrl}: ${error?.message}`);
  }

  if (res.headersSent) return;

  res.status(status).json({
    error: status >= 500 ? "Erro interno do servidor" : error?.message || "Pedido inválido",
    requestId: req.id,
  });
}

/** Envolve handlers async para que uma rejeição chegue ao errorHandler. */
export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
