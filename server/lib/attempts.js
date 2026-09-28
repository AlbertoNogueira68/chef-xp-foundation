import { log } from "./logger.js";

/**
 * O rasto das respostas de quiz.
 *
 * Uma linha por resposta em `question_attempts`. Serve duas coisas que antes
 * não eram possíveis: medir quantas lições começam e não acabam, e saber em
 * que perguntas é que cada pessoa erra — que é o que a revisão espaçada
 * precisa de saber para decidir o que repetir primeiro.
 *
 * Fica num módulo próprio, e não dentro das rotas, porque a escrita é de uma
 * rota (`POST /lessons/:id/answer`) e a leitura é de outra (a fila de
 * revisão), e a forma da tabela não devia estar espalhada pelas duas.
 */

/**
 * Grava uma resposta.
 *
 * Nunca atira. Quem chama isto está a meio de corrigir um quiz, e a correção
 * vale mais do que o registo dela: um Postgres com um problema qualquer não
 * pode ser a razão por que alguém deixa de conseguir responder a uma
 * pergunta. O erro vai para o log e a vida continua.
 */
export async function recordQuestionAttempt(
  pool,
  { userId, trailId, lessonId, questionId, correct, origin = "lesson" },
) {
  try {
    await pool.query(
      `INSERT INTO question_attempts (user_id, trail_id, lesson_id, question_id, correct, origin)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, trailId, lessonId, questionId, correct, origin],
    );
  } catch (err) {
    // Uma nota de rodapé, não o acontecimento principal: o pedido correu bem e
    // quem estava a responder ao quiz recebeu a correção. O que se perdeu foi
    // uma linha de medição, e o log diz qual.
    log.warn(
      { err, userId, trailId, lessonId, questionId },
      "não foi possível gravar a resposta do quiz",
    );
  }
}

/**
 * O histórico de cada pergunta que uma pessoa já respondeu, num trilho.
 *
 * Devolve uma linha por pergunta — não por resposta — com o que a revisão
 * precisa: quantas vezes foi respondida, quando foi a última, se a última
 * estava certa, e quantas certas houve seguidas até agora. O `DISTINCT ON`
 * faz o trabalho de "a última" no próprio Postgres; contar em JavaScript
 * obrigava a trazer o histórico todo para a memória do servidor.
 */
export async function loadQuestionHistory(pool, userId, trailId) {
  const { rows } = await pool.query(
    `WITH ordenadas AS (
       SELECT lesson_id,
              question_id,
              correct,
              created_at,
              ROW_NUMBER() OVER (
                PARTITION BY lesson_id, question_id ORDER BY created_at DESC
              ) AS recencia
         FROM question_attempts
        WHERE user_id = $1 AND trail_id = $2
     )
     SELECT lesson_id                                              AS "lessonId",
            question_id                                            AS "questionId",
            COUNT(*)::int                                           AS attempts,
            MAX(created_at)                                         AS "lastAnsweredAt",
            BOOL_AND(CASE WHEN recencia = 1 THEN correct END)       AS "lastCorrect",
            -- Acertos seguidos a contar do fim: soma das respostas certas
            -- que estão antes do primeiro erro, olhando de trás para a
            -- frente. É o número que decide o intervalo até à próxima vez.
            COALESCE(
              MIN(CASE WHEN correct = false THEN recencia END) - 1,
              COUNT(*)
            )::int                                                  AS "correctStreak"
       FROM ordenadas
      GROUP BY lesson_id, question_id`,
    [userId, trailId],
  );

  return rows.map((r) => ({
    lessonId: r.lessonId,
    questionId: r.questionId,
    attempts: r.attempts,
    lastAnsweredAt: r.lastAnsweredAt,
    lastCorrect: r.lastCorrect === true,
    correctStreak: r.correctStreak,
  }));
}
