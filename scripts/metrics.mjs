/**
 * As cinco contas que dizem se a aplicação está a ser usada.
 *
 *   npm run metrics            — para ler
 *   npm run metrics -- --json  — para colar no relatório
 *
 * Não há aqui telemetria nenhuma: tudo isto sai de tabelas que a aplicação já
 * escrevia para funcionar — o livro-razão do XP, o progresso das lições, as
 * corridas de missão, as receitas — mais `question_attempts`, que existe
 * desde a migration 028 precisamente porque o funil das lições não era
 * mensurável sem ela.
 *
 * A diferença entre isto e um painel de analytics é a diferença entre medir e
 * vigiar: não há aqui um único dado que a aplicação não precisasse de ter para
 * fazer o que faz.
 *
 * Um aviso de leitura, para quem levar estes números para a defesa: com
 * poucos utilizadores, uma percentagem não é uma percentagem — é uma anedota
 * com um sinal de percentagem ao lado. O `n` vem sempre ao lado de cada conta,
 * e é o `n` que decide se a conta quer dizer algo.
 */

import "dotenv/config";
import { getPool, closePool } from "../server/db/index.js";

const JSON_MODE = process.argv.includes("--json");

/* ---------------------------------------------------------------- *
 * 1. O funil das lições
 * ---------------------------------------------------------------- */

/**
 * Quantas lições se começam e não se acabam.
 *
 * "Começada" é uma lição com pelo menos uma resposta de quiz gravada (a
 * origem `lesson`, não a revisão). "Acabada" é uma linha em
 * `lesson_progress`. A diferença é desistência — e é a única métrica desta
 * lista que aponta para um sítio concreto do currículo a corrigir.
 */
async function funilDeLicoes(pool) {
  const { rows: global } = await pool.query(
    `WITH comecadas AS (
       SELECT DISTINCT user_id, trail_id, lesson_id
         FROM question_attempts
        WHERE origin = 'lesson'
     ),
     acabadas AS (
       SELECT DISTINCT user_id, trail_id, lesson_id FROM lesson_progress
     )
     SELECT COUNT(*)::int AS comecadas,
            COUNT(a.lesson_id)::int AS acabadas
       FROM comecadas c
       LEFT JOIN acabadas a USING (user_id, trail_id, lesson_id)`,
  );

  const { rows: porLicao } = await pool.query(
    `WITH comecadas AS (
       SELECT DISTINCT user_id, trail_id, lesson_id
         FROM question_attempts
        WHERE origin = 'lesson'
     ),
     acabadas AS (
       SELECT DISTINCT user_id, trail_id, lesson_id FROM lesson_progress
     )
     SELECT c.trail_id                                    AS trilho,
            c.lesson_id                                   AS licao,
            COUNT(*)::int                                 AS comecadas,
            COUNT(a.lesson_id)::int                       AS acabadas,
            (COUNT(*) - COUNT(a.lesson_id))::int          AS desistencias
       FROM comecadas c
       LEFT JOIN acabadas a USING (user_id, trail_id, lesson_id)
      GROUP BY c.trail_id, c.lesson_id
     HAVING COUNT(*) - COUNT(a.lesson_id) > 0
      ORDER BY desistencias DESC, comecadas DESC
      LIMIT 10`,
  );

  const { comecadas, acabadas } = global[0];
  return {
    comecadas,
    acabadas,
    desistencias: comecadas - acabadas,
    taxaDeConclusao: comecadas > 0 ? acabadas / comecadas : null,
    piores: porLicao,
  };
}

/* ---------------------------------------------------------------- *
 * 2. Retorno ao dia 2 e ao dia 7
 * ---------------------------------------------------------------- */

/**
 * Quem voltou.
 *
 * `daily_activity` tem uma linha por dia com XP, portanto um dia ativo é um
 * dia em que a pessoa fez algo que valeu pontos. O dia 1 é o primeiro dia
 * ativo de cada pessoa, não o dia em que a conta foi criada: contar do registo
 * punha quem se inscreveu e nunca começou a estragar o denominador de uma
 * pergunta que é sobre quem começou.
 *
 * "Voltou ao dia 2" é ter atividade no dia seguinte ao primeiro. "Ao dia 7" é
 * ter atividade entre o segundo e o sétimo dia — uma janela e não um dia
 * exato, porque ninguém usa uma aplicação exatamente à sétima madrugada.
 *
 * Só conta gente com idade suficiente para a pergunta fazer sentido: quem se
 * registou ontem não pode ter voltado ao dia 7, e contá-lo como não-retorno
 * era inventar uma desistência.
 */
async function retorno(pool) {
  const { rows } = await pool.query(
    `WITH primeiro AS (
       SELECT user_id, MIN(day) AS d1
         FROM daily_activity
        WHERE xp > 0
        GROUP BY user_id
     )
     SELECT
       COUNT(*) FILTER (WHERE p.d1 <= CURRENT_DATE - 1)::int AS elegiveis_d2,
       COUNT(*) FILTER (
         WHERE p.d1 <= CURRENT_DATE - 1
           AND EXISTS (
             SELECT 1 FROM daily_activity a
              WHERE a.user_id = p.user_id AND a.xp > 0 AND a.day = p.d1 + 1
           )
       )::int AS voltaram_d2,
       COUNT(*) FILTER (WHERE p.d1 <= CURRENT_DATE - 7)::int AS elegiveis_d7,
       COUNT(*) FILTER (
         WHERE p.d1 <= CURRENT_DATE - 7
           AND EXISTS (
             SELECT 1 FROM daily_activity a
              WHERE a.user_id = p.user_id AND a.xp > 0
                AND a.day BETWEEN p.d1 + 2 AND p.d1 + 7
           )
       )::int AS voltaram_d7,
       COUNT(*)::int AS com_atividade
       FROM primeiro p`,
  );

  const r = rows[0];
  return {
    comAtividade: r.com_atividade,
    dia2: {
      elegiveis: r.elegiveis_d2,
      voltaram: r.voltaram_d2,
      taxa: r.elegiveis_d2 > 0 ? r.voltaram_d2 / r.elegiveis_d2 : null,
    },
    dia7: {
      elegiveis: r.elegiveis_d7,
      voltaram: r.voltaram_d7,
      taxa: r.elegiveis_d7 > 0 ? r.voltaram_d7 / r.elegiveis_d7 : null,
    },
  };
}

/* ---------------------------------------------------------------- *
 * 3. As missões
 * ---------------------------------------------------------------- */

/**
 * Uma missão é a parte da aplicação em que se cozinha a sério, e é por isso a
 * que mais custa acabar: exige ingredientes, tempo e uma cozinha. A taxa de
 * conclusão daqui é a medida mais honesta de "isto saiu do ecrã".
 *
 * `in_progress` não é desistência: pode ser um tacho ao lume neste momento.
 * Aparece à parte, e só se conta como abandono o que o utilizador abandonou.
 */
async function missoes(pool) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int                                                AS arrancadas,
            COUNT(*) FILTER (WHERE status = 'completed')::int            AS concluidas,
            COUNT(*) FILTER (WHERE status = 'abandoned')::int            AS abandonadas,
            COUNT(*) FILTER (WHERE status = 'in_progress')::int          AS a_decorrer,
            COUNT(DISTINCT user_id)::int                                 AS pessoas,
            ROUND(AVG(
              EXTRACT(EPOCH FROM (completed_at - started_at)) / 60
            ) FILTER (WHERE status = 'completed'))::int                  AS minutos_medios
       FROM mission_runs`,
  );

  const m = rows[0];
  const decididas = m.concluidas + m.abandonadas;
  return { ...m, taxaDeConclusao: decididas > 0 ? m.concluidas / decididas : null };
}

/* ---------------------------------------------------------------- *
 * 4. Receitas por pessoa
 * ---------------------------------------------------------------- */

/**
 * A distribuição, e não a média.
 *
 * Numa rede social a média mente sempre: uma pessoa com trinta receitas e
 * nove com zero dão uma média de três, que não descreve ninguém. A mediana e
 * o p90 dizem a verdade, e a fração de contas com zero receitas é a pergunta
 * que interessa mesmo — quantas pessoas nunca publicaram nada.
 */
async function receitasPorPessoa(pool) {
  const { rows } = await pool.query(
    `WITH por_pessoa AS (
       SELECT u.id, COUNT(r.id)::int AS receitas
         FROM users u
         LEFT JOIN recipes r ON r.author_id = u.id
        GROUP BY u.id
     )
     SELECT COUNT(*)::int                                          AS pessoas,
            COALESCE(SUM(receitas), 0)::int                        AS receitas,
            COUNT(*) FILTER (WHERE receitas = 0)::int              AS sem_nenhuma,
            COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY receitas), 0) AS mediana,
            COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY receitas), 0) AS p90,
            COALESCE(MAX(receitas), 0)::int                        AS maximo
       FROM por_pessoa`,
  );

  const r = rows[0];
  return {
    ...r,
    mediana: Number(r.mediana),
    p90: Number(r.p90),
    fracaoSemNenhuma: r.pessoas > 0 ? r.sem_nenhuma / r.pessoas : null,
  };
}

/* ---------------------------------------------------------------- *
 * 5. De onde vem o XP
 * ---------------------------------------------------------------- */

/**
 * A mistura das fontes de XP é a resposta à pergunta que a tese faz: as
 * pessoas ficam pelo percurso de aprendizagem, ou pela parte social?
 *
 * Sai do livro-razão, que é imune a interpretação: cada ponto que alguém tem
 * está lá com a origem ao lado.
 */
async function origemDoXp(pool) {
  const { rows } = await pool.query(
    `SELECT source                        AS origem,
            COUNT(*)::int                 AS eventos,
            SUM(amount)::int              AS xp,
            COUNT(DISTINCT user_id)::int  AS pessoas
       FROM xp_events
      GROUP BY source
      ORDER BY xp DESC`,
  );

  const total = rows.reduce((soma, r) => soma + r.xp, 0);
  return {
    total,
    fontes: rows.map((r) => ({ ...r, fracao: total > 0 ? r.xp / total : null })),
  };
}

/* ---------------------------------------------------------------- *
 * Apresentação
 * ---------------------------------------------------------------- */

const pct = (v) => (v === null || v === undefined ? "n/d" : `${(v * 100).toFixed(1)}%`);
const linha = (rotulo, valor) => `  ${rotulo.padEnd(34, ".")} ${valor}`;

function imprimir({ funil, retornos, missoesDados, receitas, xp }) {
  console.log("\n══ ChefXP — as cinco contas ═══════════════════════════════\n");

  console.log("1. Funil das lições");
  console.log(linha("lições começadas", funil.comecadas));
  console.log(linha("lições concluídas", funil.acabadas));
  console.log(linha("desistências", funil.desistencias));
  console.log(linha("taxa de conclusão", pct(funil.taxaDeConclusao)));
  if (funil.piores.length > 0) {
    console.log("  onde se desiste mais:");
    for (const l of funil.piores) {
      console.log(`    ${l.trilho}/${l.licao}: ${l.desistencias} de ${l.comecadas}`);
    }
  }

  console.log("\n2. Retorno");
  console.log(linha("pessoas com atividade", retornos.comAtividade));
  console.log(
    linha(
      "voltaram ao dia 2",
      `${retornos.dia2.voltaram}/${retornos.dia2.elegiveis} (${pct(retornos.dia2.taxa)})`,
    ),
  );
  console.log(
    linha(
      "voltaram na 1ª semana",
      `${retornos.dia7.voltaram}/${retornos.dia7.elegiveis} (${pct(retornos.dia7.taxa)})`,
    ),
  );

  console.log("\n3. Missões de cozinha");
  console.log(linha("arrancadas", missoesDados.arrancadas));
  console.log(linha("concluídas", missoesDados.concluidas));
  console.log(linha("abandonadas", missoesDados.abandonadas));
  console.log(linha("a decorrer agora", missoesDados.a_decorrer));
  console.log(linha("taxa de conclusão", pct(missoesDados.taxaDeConclusao)));
  console.log(linha("duração média (min)", missoesDados.minutos_medios ?? "n/d"));

  console.log("\n4. Receitas por pessoa");
  console.log(linha("contas", receitas.pessoas));
  console.log(linha("receitas", receitas.receitas));
  console.log(linha("mediana", receitas.mediana));
  console.log(linha("p90", receitas.p90));
  console.log(linha("máximo", receitas.maximo));
  console.log(
    linha("contas sem nenhuma", `${receitas.sem_nenhuma} (${pct(receitas.fracaoSemNenhuma)})`),
  );

  console.log("\n5. De onde vem o XP");
  console.log(linha("XP total no livro-razão", xp.total));
  for (const f of xp.fontes) {
    console.log(linha(`  ${f.origem}`, `${f.xp} (${pct(f.fracao)}) · ${f.pessoas} pessoas`));
  }

  const n = receitas.pessoas;
  console.log("");
  if (n < 10) {
    console.log(
      `⚠ ${n} conta${n === 1 ? "" : "s"} na base. Com este n, estas percentagens não\n` +
        "  sustentam nenhuma afirmação no relatório — servem para verificar que as\n" +
        "  contas funcionam, não para concluir nada. Ver docs/AVALIACAO.md.",
    );
  }
  console.log("");
}

/* ---------------------------------------------------------------- *
 * Arranque
 * ---------------------------------------------------------------- */

try {
  const pool = getPool();
  const [funil, retornos, missoesDados, receitas, xp] = await Promise.all([
    funilDeLicoes(pool),
    retorno(pool),
    missoes(pool),
    receitasPorPessoa(pool),
    origemDoXp(pool),
  ]);

  const dados = {
    funil,
    retornos,
    missoes: missoesDados,
    receitas,
    xp,
    geradoEm: new Date().toISOString(),
  };

  if (JSON_MODE) console.log(JSON.stringify(dados, null, 2));
  else imprimir({ funil, retornos, missoesDados, receitas, xp });
} finally {
  await closePool();
}
