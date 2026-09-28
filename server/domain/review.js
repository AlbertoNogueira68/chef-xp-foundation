/**
 * Revisão espaçada: o que fazer quando as lições acabam.
 *
 * O percurso tem 19 lições. Quem as faz todas fica com um trilho cheio de
 * círculos verdes e nada para lá voltar — e aprender a cozinhar não é uma
 * coisa que se acabe. Este módulo escolhe, do que a pessoa já respondeu, as
 * perguntas que vale a pena voltar a fazer hoje.
 *
 * A regra é a de sempre na repetição espaçada: o que se erra volta depressa,
 * o que se acerta volta cada vez mais tarde. Não é SM-2 — não há aqui notas
 * de qualidade de 0 a 5 nem fatores de facilidade, porque um quiz de escolha
 * múltipla não dá informação para os calibrar. É a caixa de Leitner: uma
 * escada de intervalos, sobe-se um degrau por acerto e cai-se ao primeiro
 * erro.
 *
 * Tudo aqui é puro: entra o histórico e a data, sai a lista. Nenhuma função
 * deste ficheiro sabe que existe uma base de dados, e é por isso que se
 * consegue testar o calendário todo sem esperar seis meses.
 */

/**
 * A escada de intervalos, em dias.
 *
 * Índice = acertos seguidos. Zero acertos seguidos (acabou de errar) volta no
 * mesmo dia; um acerto volta amanhã; e daí em diante 3, 7, 16 e 35 dias. Os
 * números são aproximadamente o dobro do anterior — o espaçamento expansivo
 * que a literatura descreve — arredondados para valores que caem em dias da
 * semana diferentes, para a revisão não aterrar sempre à segunda-feira.
 *
 * Cinco degraus e não mais: ao sexto acerto seguido a pergunta está sabida, e
 * continuar a pedi-la é gastar a paciência de quem está a estudar.
 */
export const REVIEW_INTERVALS_DAYS = [0, 1, 3, 7, 16, 35];

/** Ao fim de quantos acertos seguidos uma pergunta sai da rotação. */
export const REVIEW_MASTERED_STREAK = REVIEW_INTERVALS_DAYS.length;

/** Quantas perguntas tem uma sessão de revisão. */
export const REVIEW_SESSION_SIZE = 8;

/** XP por sessão de revisão completa, e o bónus por sessão sem erros. */
export const REVIEW_XP = { session: 15, perfect: 10 };

/**
 * Quantos dias faltam até uma pergunta voltar a aparecer.
 *
 * Um erro põe o contador a zero, e zero acertos seguidos significa hoje: a
 * pergunta que se errou é a que mais precisa de voltar, e adiá-la um dia era
 * dar tempo ao esquecimento de fazer o trabalho dele.
 */
export function intervalForStreak(correctStreak) {
  if (correctStreak <= 0) return REVIEW_INTERVALS_DAYS[0];
  const degrau = Math.min(correctStreak, REVIEW_INTERVALS_DAYS.length - 1);
  return REVIEW_INTERVALS_DAYS[degrau];
}

/** Uma pergunta está sabida quando subiu a escada até ao fim. */
export function isMastered(historico) {
  return (historico?.correctStreak ?? 0) >= REVIEW_MASTERED_STREAK;
}

/**
 * Quantos dias inteiros passaram entre duas datas.
 *
 * Conta em dias de calendário no fuso de quem estuda, e não em períodos de 24
 * horas: quem responde às 23h e volta às 8h do dia seguinte passou um dia, e
 * uma conta em milissegundos dizia que não tinha passado nenhum. O fuso vem
 * de fora porque a pessoa é que tem um, não o servidor.
 */
export function daysBetween(desde, ate, timeZone = "UTC") {
  const dia = (d) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(new Date(d));
  const [a, b] = [new Date(`${dia(desde)}T00:00:00Z`), new Date(`${dia(ate)}T00:00:00Z`)];
  return Math.round((b - a) / 86_400_000);
}

/**
 * Uma pergunta está pronta a ser revista?
 *
 * Nunca respondida não conta: a revisão é para consolidar o que já se
 * aprendeu, e mandar para lá matéria nova seria saltar a lição.
 */
export function isDue(historico, agora, timeZone = "UTC") {
  if (!historico || historico.attempts <= 0) return false;
  if (isMastered(historico)) return false;
  return (
    daysBetween(historico.lastAnsweredAt, agora, timeZone) >=
    intervalForStreak(historico.correctStreak)
  );
}

/**
 * Monta a sessão de revisão de hoje.
 *
 * @param {object} args
 * @param {Array}  args.lessons   lições do trilho, com `questions`, na ordem do currículo
 * @param {Array}  args.history   uma entrada por pergunta já respondida (ver `loadQuestionHistory`)
 * @param {Set|Array} args.completedLessonIds lições concluídas
 * @param {Date}   args.now
 * @param {string} args.timeZone
 * @param {number} args.size      quantas perguntas no máximo
 *
 * A ordem de prioridade é: o que se errou na última vez primeiro, depois o
 * que está atrasado há mais tempo, e só depois o resto. Quem tem 200
 * perguntas em atraso não precisa de as ver todas — precisa de ver as oito
 * que lhe fazem mais falta.
 */
export function buildReviewQueue({
  lessons = [],
  history = [],
  completedLessonIds = [],
  now = new Date(),
  timeZone = "UTC",
  size = REVIEW_SESSION_SIZE,
} = {}) {
  const concluidas = new Set(completedLessonIds);
  const porChave = new Map(history.map((h) => [`${h.lessonId}::${h.questionId}`, h]));

  const candidatas = [];

  for (const licao of lessons) {
    // Só se revê o que já se aprendeu. Uma lição a meio (respostas dadas mas
    // nunca concluída) não entra: o sítio para a acabar é a lição.
    if (!concluidas.has(licao.id)) continue;

    for (const pergunta of licao.questions ?? []) {
      const historico = porChave.get(`${licao.id}::${pergunta.id}`);
      if (!isDue(historico, now, timeZone)) continue;

      candidatas.push({
        lessonId: licao.id,
        lessonTitle: licao.title ?? null,
        question: pergunta,
        atrasoDias:
          daysBetween(historico.lastAnsweredAt, now, timeZone) -
          intervalForStreak(historico.correctStreak),
        errouNaUltima: historico.lastCorrect === false,
        correctStreak: historico.correctStreak,
      });
    }
  }

  candidatas.sort((a, b) => {
    // 1. Errar na última vez é o sinal mais forte que existe.
    if (a.errouNaUltima !== b.errouNaUltima) return a.errouNaUltima ? -1 : 1;
    // 2. Depois, quem está em atraso há mais tempo.
    if (a.atrasoDias !== b.atrasoDias) return b.atrasoDias - a.atrasoDias;
    // 3. E por fim quem está mais atrás na escada — mais perto de se perder.
    if (a.correctStreak !== b.correctStreak) return a.correctStreak - b.correctStreak;
    // Desempate estável, para a mesma entrada dar sempre a mesma sessão.
    return a.question.id < b.question.id ? -1 : a.question.id > b.question.id ? 1 : 0;
  });

  return candidatas.slice(0, Math.max(0, size));
}

/**
 * Quantas perguntas estão à espera, para o cartão do percurso poder dizer
 * "tens 12 para rever" sem montar a sessão inteira.
 */
export function countDue({
  lessons = [],
  history = [],
  completedLessonIds = [],
  now = new Date(),
  timeZone = "UTC",
} = {}) {
  return buildReviewQueue({
    lessons,
    history,
    completedLessonIds,
    now,
    timeZone,
    size: Number.POSITIVE_INFINITY,
  }).length;
}

/**
 * O XP de uma sessão de revisão.
 *
 * Menos do que uma lição nova, de propósito: rever o que já se sabe não vale
 * o mesmo que aprender de novo, e se valesse, o caminho mais rápido para
 * subir de nível era nunca avançar. O bónus de sessão perfeita existe porque
 * é o único sítio onde acertar tudo tem consequência — na revisão não há
 * corações a perder.
 */
export function reviewXp({ total, correct }) {
  if (!total || correct < 0) return 0;
  const proporcao = Math.max(0, Math.min(1, correct / total));
  const base = Math.round(REVIEW_XP.session * proporcao);
  return correct === total ? base + REVIEW_XP.perfect : base;
}
