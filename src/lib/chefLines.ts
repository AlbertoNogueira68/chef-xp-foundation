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

const GREETINGS = [
  "Aventais vestidos? Hoje fazemos {prato}.",
  "Boa escolha. {prato} é daqueles pratos que impressionam sem dar trabalho.",
  "{prato}, então? Anda daí — eu vou contigo do início ao fim.",
  "Vamos ao {prato}. Lê primeiro os ingredientes todos, é meio caminho andado.",
];

const PREP = [
  "Sem pressa. Este passo é para fazer bem, não é para fazer depressa.",
  "Vai lendo e vai fazendo — a cozinha aprende-se com as mãos.",
  "Repara bem neste: é aqui que a maioria se atrapalha.",
  "Este é dos que parecem pequenos e mudam o prato todo.",
];

const QUIZ = [
  "Agora diz-me tu:",
  "Vamos lá ver se ficaste atento:",
  "Uma para pensar:",
  "Esta é importante na cozinha a sério:",
];

const CORRECT = ["Isso mesmo!", "Certinho!", "É por aí!", "Já cozinhas melhor do que ontem."];

const WRONG = ["Não foi desta.", "Quase.", "Enganaste-te — e não faz mal.", "Falhou por pouco."];

const FAILED = [
  "Ficámos sem corações. Acontece a toda a gente — repete comigo do início.",
  "Esta fugiu-nos. Vamos outra vez, agora já sabes onde é o truque.",
];

const COMPLETE = [
  "Muito bem! Mais um prato que já sabes fazer.",
  "Está feito. Agora só falta levares isto ao fogão.",
  "Excelente lição. Faz o prato hoje, que é assim que fica na cabeça.",
];

const PATH = [
  "Pronto para a lição de hoje?",
  "Cozinhar todos os dias é o que faz um chef.",
  "Escolhe uma lição — eu explico o resto.",
  "Um prato de cada vez, e daqui a um mês nem te reconheces.",
];

/** Hash simples e estável: só precisa de espalhar, não de ser criptográfico. */
function semente(texto: string) {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function escolher(frases: readonly string[], chave: string) {
  return frases[semente(chave) % frases.length];
}

export function chefGreeting(dishName: string) {
  return escolher(GREETINGS, dishName).replace("{prato}", dishName);
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
