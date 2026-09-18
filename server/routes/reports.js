import { Router } from "express";
import { query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { reportCreateSchema } from "../schemas/index.js";
import { subjectOwner } from "../lib/moderation.js";
import { reportRefusal } from "../domain/moderation.js";

const router = Router();

router.use(requireAuth);

/**
 * Denunciar uma receita, um comentário ou uma pessoa.
 *
 * Uma rota só, e não uma por tipo de conteúdo: o que muda entre os três é a
 * tabela onde se confirma que o alvo existe, e isso está numa função.
 *
 * Denunciar duas vezes a mesma coisa não são duas denúncias — o índice único
 * da migration 012 trata disso, e a resposta é a mesma nas duas vezes. Quem
 * denuncia não precisa de saber se foi o primeiro, e dizer-lho contava quantas
 * pessoas já tinham denunciado aquilo.
 */
router.post(
  "/",
  validate({ body: reportCreateSchema }),
  asyncHandler(async (req, res) => {
    const { subjectType, subjectId, reason, details } = req.valid.body;

    const owner = await subjectOwner(subjectType, subjectId);
    if (!owner) return res.status(404).json({ error: "Isso já não existe" });

    const refusal = reportRefusal({
      reporterId: req.user.id,
      subjectType,
      subjectOwnerId: owner,
    });
    if (refusal) return res.status(400).json({ error: refusal });

    await query(
      `INSERT INTO reports (reporter_id, subject_type, subject_id, reason, details)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (reporter_id, subject_type, subject_id) DO NOTHING`,
      [req.user.id, subjectType, subjectId, reason, details ?? null],
    );

    res.status(201).json({ reported: true });
  }),
);

export default router;
