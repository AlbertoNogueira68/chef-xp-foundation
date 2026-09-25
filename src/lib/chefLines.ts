import { t } from "@/i18n";
/**
 * O que o Chef Sapo diz.
 *
 * As frases estão aqui e não espalhadas pelos componentes por duas razões: dá
 * para as ler todas de seguida e perceber se ele soa a uma pessoa só, e dá
 * para as trocar sem mexer em ecrã nenhum.
 *
 * A escolha é **determinista** — a mesma semente dá sempre a mesma frase. Com
 * `Math.random()`, cada re-render do React trocava a frase a meio da lição, o
 * que faz o chef parecer avariado em vez de vivo.
 */

// Nem todas as lições são pratos: há "Bancada pronta" e "Faca com fio". As
// frases têm de servir a um título, e não só a um nome de comida.
const GREETINGS = [
  "Aprons on. Today: {dish}.",
  "Good pick — {dish}. One of those that pays off straight away.",
  "{dish}, then? Come on — I'm with you from start to finish.",
  "Today: {dish}. Read all the ingredients first — that's half the job.",
];

const PREP = [
  "No rush. This step is about doing it well, not fast.",
  "Read and do as you go — cooking is learnt with your hands.",
  "Pay attention to this one: it's where most people slip up.",
  "This is one of those small steps that changes the whole dish.",
];

const QUIZ = [
  "Now you tell me:",
  "Let's see if you were paying attention:",
  "One to think about:",
  "This one matters in a real kitchen:",
];

const CORRECT = [
  "That's it!",
  "Spot on!",
  "That's the way!",
  "You already cook better than yesterday.",
];

const WRONG = [
  "Not this time.",
  "Close.",
  "You got it wrong — and that's fine.",
  "Missed it by a little.",
];

const FAILED = [
  "We're out of lives. It happens to everyone — go again with me from the top.",
  "That one got away. Let's go again — now you know where the trick is.",
];

const COMPLETE = [
  "Well done! One more dish you know how to make.",
  "That's done. Now all that's left is taking it to the stove.",
  "Great lesson. Cook the dish today — that's how it sticks.",
];

const PATH = [
  "Ready for today's lesson?",
  "Cooking every day is what makes a chef.",
  "Pick a lesson — I'll explain the rest.",
  "One dish at a time, and in a month you won't recognise yourself.",
];

/**
 * Todas as frases, para o teste do dicionário.
 *
 * São traduzidas por variável — `t(frases[...])` — e o varredor de `t("…")`
 * não as vê. Sem esta lista, uma frase sem tradução passava o teste e o Chef
 * falava inglês a meio do português.
 */
export const CHEF_LINES = [
  ...GREETINGS,
  ...PREP,
  ...QUIZ,
  ...CORRECT,
  ...WRONG,
  ...FAILED,
  ...COMPLETE,
  ...PATH,
] as const;

/** Hash simples e estável: só precisa de espalhar, não de ser criptográfico. */
function semente(texto: string) {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * A frase, já traduzida.
 *
 * As listas guardam o inglês — que é também a chave do dicionário — e a
 * tradução é feita aqui, no momento de mostrar. Traduzir na lista era fixar a
 * língua no arranque da app, e o botão de idioma deixava o Chef a falar
 * sozinho na língua antiga.
 */
function escolher(frases: readonly string[], chave: string, valores?: Record<string, string>) {
  return t(frases[semente(chave) % frases.length], valores);
}

export function chefGreeting(dishName: string) {
  return escolher(GREETINGS, dishName, { dish: dishName });
}

export function chefPrepLine(dishName: string, stepIndex: number) {
  return escolher(PREP, `${dishName}#${stepIndex}`);
}

export function chefQuizLine(dishName: string, questionIndex: number) {
  return escolher(QUIZ, `${dishName}?${questionIndex}`);
}

export function chefFeedbackLine(isCorrect: boolean, chave: string) {
  return escolher(isCorrect ? CORRECT : WRONG, chave);
}

export function chefFailedLine(dishName: string) {
  return escolher(FAILED, dishName);
}

export function chefCompleteLine(dishName: string) {
  return escolher(COMPLETE, dishName);
}

/** A frase do trilho muda com o dia, não a cada visita à página. */
export function chefPathLine(dia = new Date().toISOString().slice(0, 10)) {
  return escolher(PATH, dia);
}
