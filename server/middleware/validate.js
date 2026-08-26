import { ZodError } from "zod";

/**
 * Validação declarativa com Zod, igual em todas as rotas.
 *
 * Os resultados ficam em `req.valid` e não substituem `req.query` — no Express 5
 * `req.query` é um getter e não pode ser reatribuído.
 */
export function validate(shape) {
  return (req, res, next) => {
    req.valid = {};
    try {
      for (const key of ["body", "query", "params"]) {
        const schema = shape[key];
        if (!schema) continue;
        req.valid[key] = schema.parse(req[key] ?? {});
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Dados inválidos",
          details: error.issues.map((issue) => ({
            field: issue.path.join(".") || "(raiz)",
            message: issue.message,
          })),
        });
      }
      return next(error);
    }
  };
}
