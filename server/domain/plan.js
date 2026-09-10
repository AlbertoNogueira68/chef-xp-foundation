import { addDays, dayInTimeZone } from "./xp.js";

/**
 * O compromisso: que dias, ou quantas vezes por semana.
 *
 * Lógica pura, sem I/O — o mesmo critério de "que dia é hoje" que o streak
 * usa (`dayInTimeZone`), e nenhum segundo conceito de dia. Um dia é sempre uma
 * string "YYYY-MM-DD" no fuso do utilizador.
 */

/** ISO: 1 = segunda … 7 = domingo. A semana começa à segunda, como em Portugal. */
export const WEEKDAY_LABELS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
export const WEEKDAY_NAMES = [
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
  "domingo",
];

export const MAX_PER_WEEK = 7;

export function weekdayLabel(iso) {
  return WEEKDAY_LABELS[iso - 1] ?? "";
}

export function weekdayName(iso) {
  return WEEKDAY_NAMES[iso - 1] ?? "";
}

/** Dia da semana em ISO a partir de "YYYY-MM-DD". */
export function isoWeekday(day) {
  const [y, m, d] = String(day).split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  return dow === 0 ? 7 : dow;
}

/** A segunda-feira da semana a que o dia pertence. */
export function startOfWeek(day) {
  return addDays(day, -(isoWeekday(day) - 1));
}

export function weekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/**
 * Dias válidos, sem repetidos e por ordem. Lixo à entrada não rebenta: sai
 * uma lista vazia, que é o modo "quando calhar".
 */
export function normalizeWeekdays(input) {
  if (!Array.isArray(input)) return [];
  const valid = input
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);
  return [...new Set(valid)].sort((a, b) => a - b);
}

/**
 * Quantas vezes por semana o plano pede.
 *
 * Com dias fixos, o alvo são os dias — não faria sentido dizer "às terças e
 * quintas" e "uma vez por semana" ao mesmo tempo. Sem dias, vale o número.
 */
export function resolveTarget({ weekdays = [], targetWeek = 2 } = {}) {
  const days = normalizeWeekdays(weekdays);
  if (days.length > 0) return days.length;
  const n = Number(targetWeek);
  if (!Number.isInteger(n)) return 2;
  return Math.min(MAX_PER_WEEK, Math.max(1, n));
}

/** As datas que um plano de dias fixos ocupa numa dada semana. */
export function plannedDatesForWeek(weekdays, weekStart) {
  const days = normalizeWeekdays(weekdays);
  return days.map((iso) => addDays(weekStart, iso - 1));
}

/**
 * O próximo dia de cozinhar, a contar de hoje inclusive. Null no modo "quando
 * calhar": aí não há um dia seguinte — há uma semana por cumprir.
 */
export function nextCookingDate(weekdays, today) {
  const days = normalizeWeekdays(weekdays);
  if (days.length === 0) return null;

  for (let i = 0; i < 7; i += 1) {
    const candidate = addDays(today, i);
    if (days.includes(isoWeekday(candidate))) return candidate;
  }
  return null;
}

/**
 * Sessões que já passaram do dia e continuam por cumprir.
 *
 * Falhar é uma consequência do tempo passar, não de uma ação — por isso é
 * calculado à leitura em vez de por um agendador, que este projeto não tem.
 * Hoje nunca conta: o dia ainda não acabou.
 */
export function overdueSessions(sessions, today) {
  return sessions.filter((s) => s.status === "planned" && s.plannedOn < today);
}

/**
 * O estado da semana, tal como a faixa o mostra.
 *
 * `done` conta tudo o que foi cozinhado na semana, esteja ou não em cima de um
 * dia planeado: quem cozinhou à quarta cozinhou mesmo. O dia prometido que
 * passou em branco continua a contar como falhado — as duas coisas são
 * verdade ao mesmo tempo, e esconder qualquer uma delas seria mentir sobre o
 * compromisso.
 */
export function summarizeWeek({ plan, sessions = [], today }) {
  const weekStart = startOfWeek(today);
  const dates = weekDates(weekStart);
  const byDate = new Map(sessions.map((s) => [s.plannedOn, s]));

  const target = resolveTarget(plan);
  const planned = new Set(plannedDatesForWeek(plan?.weekdays, weekStart));

  // Nada antes do dia em que o compromisso passou a existir conta como
  // falhado. Sem isto, quem se comprometesse a uma quinta-feira já começava a
  // dever a terça — falhar antes de prometer não é falhar. Mudar o plano a
  // meio da semana move esta fronteira, e está certo: o que se deve é o que se
  // prometeu agora.
  const since = plan?.startedOn ?? null;

  const days = dates.map((date) => {
    const session = byDate.get(date) ?? null;
    const isPlanned = planned.has(date);

    // A linha gravada manda. É o registo do que foi prometido naquela semana e
    // sobrevive a mudanças de plano — mudar de compromisso não pode apagar as
    // falhas do anterior, que são o dado que este projeto quer medir. A
    // derivação abaixo só cobre as datas que nunca chegaram a ter linha.
    let status = "free";
    if (session) {
      status = session.status === "moved" ? "free" : session.status;
    } else if (isPlanned && date < today && (!since || date >= since)) {
      status = "missed";
    } else if (isPlanned && date >= today) {
      status = "planned";
    }

    return {
      date,
      weekday: isoWeekday(date),
      label: weekdayLabel(isoWeekday(date)),
      isToday: date === today,
      status,
    };
  });

  const done = days.filter((d) => d.status === "done").length;
  const missed = days.filter((d) => d.status === "missed").length;
  const todayEntry = days.find((d) => d.isToday) ?? null;

  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    target,
    done,
    missed,
    remaining: Math.max(0, target - done),
    complete: done >= target,
    cookedToday: todayEntry?.status === "done",
    todayIsPlanned: todayEntry?.status === "planned",
    nextDate: nextCookingDate(plan?.weekdays, today),
    days,
  };
}

/**
 * A frase da faixa. Vive aqui e não no componente porque é a regra do
 * compromisso a falar, e é testável sem montar React.
 */
export function bannerMessage(summary) {
  if (!summary) return null;

  if (summary.complete) {
    return summary.target === 1
      ? "Cumpriste o teu compromisso desta semana."
      : `Cumpriste o teu compromisso: ${summary.done} de ${summary.target} esta semana.`;
  }

  if (summary.cookedToday) {
    const falta = summary.remaining === 1 ? "Falta 1" : `Faltam ${summary.remaining}`;
    return `Já cozinhaste hoje. ${falta} para fechar a semana.`;
  }

  if (summary.todayIsPlanned) {
    return "Hoje é dia de cozinhar.";
  }

  if (summary.nextDate) {
    const next = weekdayName(isoWeekday(summary.nextDate));
    return `Vais em ${summary.done} de ${summary.target}. O próximo dia é ${next}.`;
  }

  return `Vais em ${summary.done} de ${summary.target} esta semana.`;
}

/** Data de hoje no fuso do utilizador. Um único sítio a decidir isto. */
export function todayFor(timeZone, now = new Date()) {
  return dayInTimeZone(now, timeZone);
}
