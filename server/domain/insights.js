/**
 * Análise da telemetria das missões.
 *
 * Lógica pura: recebe contagens já agregadas pela base de dados e transforma-as
 * nas respostas que o projeto quer dar. Fica separada do SQL para as decisões
 * de análise — o que é uma taxa, sobre que denominador, o que conta como
 * desistência — poderem ser testadas sem base de dados.
 *
 * A regra que atravessa tudo: nenhuma percentagem sai daqui sem o número de
 * onde veio. Uma taxa de conclusão de 100% sobre duas runs não é uma taxa, é
 * uma coincidência, e num relatório escrito isso tem de estar à vista.
 */

/** Abaixo disto uma percentagem descreve o acaso, não um comportamento. */
export const MIN_SAMPLE = 5;

export function rate(part, whole) {
  const n = Number(whole);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number(part) / n;
}

export function asPercent(value, digits = 0) {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * Uma taxa só se lê acompanhada do denominador, e marcada quando a amostra é
 * pequena de mais para significar seja o que for.
 */
export function describeRate(part, whole, { digits = 0 } = {}) {
  const value = rate(part, whole);
  return {
    part: Number(part) || 0,
    whole: Number(whole) || 0,
    value,
    text: `${asPercent(value, digits)} (${Number(part) || 0}/${Number(whole) || 0})`,
    thin: (Number(whole) || 0) < MIN_SAMPLE,
  };
}

/**
 * Estado de uma run do ponto de vista da análise.
 *
 * Desistir explicitamente e desaparecer a meio são coisas diferentes e a
 * segunda é a comum: quem fecha a app a cozinhar não carrega em "abandonar".
 * Juntá-las escondia o caso mais frequente; separá-las é o que permite dizer
 * "X% nunca chegaram ao fim, e destes só Y o disseram".
 */
export function summarizeRuns(rows = []) {
  const total = rows.reduce((sum, row) => sum + Number(row.runs ?? 0), 0);
  const byStatus = new Map(rows.map((row) => [row.status, Number(row.runs ?? 0)]));

  const completed = byStatus.get("completed") ?? 0;
  const abandoned = byStatus.get("abandoned") ?? 0;
  const open = byStatus.get("in_progress") ?? 0;

  return {
    total,
    completed,
    abandoned,
    open,
    completion: describeRate(completed, total),
    // Tudo o que não acabou, dito e não dito.
    unfinished: describeRate(abandoned + open, total),
    declared: describeRate(abandoned, abandoned + open),
  };
}

/**
 * O passo mais problemático de uma missão.
 *
 * Pontua-se cada passo pelo que aconteceu nele: desistir pesa mais do que
 * pedir socorro, e pedir socorro mais do que voltar atrás — a ordem é a da
 * gravidade do sinal, não a da frequência. Sem pesos, um passo com muitos
 * "voltar atrás" tapava o passo onde as pessoas se vão embora.
 */
export const STEP_WEIGHTS = { abandon: 5, rescue: 2, back: 1 };

export function rankSteps(rows = []) {
  const steps = new Map();

  for (const row of rows) {
    const key = `${row.mission_id}#${row.step_index}`;
    const entry = steps.get(key) ?? {
      missionId: row.mission_id,
      stepIndex: Number(row.step_index),
      abandon: 0,
      rescue: 0,
      back: 0,
      timer: 0,
      voice: 0,
      runs: Number(row.runs ?? 0),
    };
    const kind = row.kind;
    if (kind in entry) entry[kind] += Number(row.events ?? 0);
    entry.runs = Math.max(entry.runs, Number(row.runs ?? 0));
    steps.set(key, entry);
  }

  return [...steps.values()]
    .map((entry) => ({
      ...entry,
      friction:
        entry.abandon * STEP_WEIGHTS.abandon +
        entry.rescue * STEP_WEIGHTS.rescue +
        entry.back * STEP_WEIGHTS.back,
    }))
    .sort((a, b) => b.friction - a.friction || a.stepIndex - b.stepIndex);
}

/**
 * O socorro mais pedido, por tipo. É o que diz que parte do guião está mal
 * escrita: muitos "falta" num passo é uma lista de ingredientes incompleta,
 * muitos "queimei" é uma indicação de lume vaga.
 */
export function rankRescues(rows = []) {
  const total = rows.reduce((sum, row) => sum + Number(row.events ?? 0), 0);
  return {
    total,
    kinds: rows
      .map((row) => ({
        kind: row.detail ?? "(sem tipo)",
        count: Number(row.events ?? 0),
        share: rate(row.events, total),
      }))
      .sort((a, b) => b.count - a.count),
  };
}

/**
 * Mediana a partir de uma lista de números.
 *
 * `null` e `""` são descartados em vez de virarem zero. `Number(null)` é 0 e é
 * finito, por isso uma duração em falta entrava na conta como uma missão
 * instantânea e puxava a mediana para baixo sem ninguém dar por isso.
 */
export function median(values = []) {
  const sorted = values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Adesão ao compromisso.
 *
 * O denominador são os dias prometidos que já passaram — não a semana inteira.
 * Contar um dia que ainda não chegou como falhado dava uma adesão que só
 * melhora ao domingo à noite e piora à segunda de manhã, sem ninguém ter
 * feito nada.
 */
export function summarizeAdherence(rows = []) {
  const done = rows.reduce((sum, row) => sum + Number(row.done ?? 0), 0);
  const missed = rows.reduce((sum, row) => sum + Number(row.missed ?? 0), 0);
  const settled = done + missed;

  return {
    done,
    missed,
    settled,
    adherence: describeRate(done, settled),
    // Cozinhados fora de qualquer dia prometido: contam para a semana da
    // pessoa e não entram na adesão, que é sobre promessas cumpridas.
    spontaneous: rows.reduce((sum, row) => sum + Number(row.spontaneous ?? 0), 0),
  };
}
