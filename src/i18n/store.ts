import { PT } from "./pt";

/**
 * A língua da app.
 *
 * O estado vive **fora** do React de propósito. Metade do texto que o
 * utilizador lê não está num componente — são avisos (`toast.error(...)`) e
 * mensagens que nascem dentro de hooks e serviços. Se a língua fosse só um
 * contexto, esse texto ficava por traduzir ou obrigava a passar o `t` de mão
 * em mão por toda a aplicação.
 *
 * As chaves são o texto em inglês. Dá uma coisa rara num ficheiro de
 * traduções: lê-se o código e vê-se o que aparece no ecrã, sem saltar para
 * uma tabela de `auth.login.button.label`.
 */

export const LANGUAGES = ["en", "pt"] as const;
export type Language = (typeof LANGUAGES)[number];

const CHAVE = "chefxp.lang";

/**
 * Onde o inglês precisa de uma forma diferente da chave.
 *
 * Só existe por causa do plural: "day streak" e "days streak" são a mesma
 * frase em inglês e duas em português, e a chave tem de as distinguir.
 */
const EN: Record<string, string> = {
  "days streak": "day streak",
};

const DICIONARIOS: Record<Language, Record<string, string>> = { en: EN, pt: PT };

function inicial(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const guardada = window.localStorage.getItem(CHAVE);
    if (guardada === "pt" || guardada === "en") return guardada;
  } catch {
    // Modo privado ou armazenamento bloqueado: segue-se para o browser.
  }
  return navigator.language?.toLowerCase().startsWith("pt") ? "pt" : "en";
}

let lingua: Language = inicial();
const ouvintes = new Set<() => void>();

export function getLanguage() {
  return lingua;
}

export function setLanguage(nova: Language) {
  if (nova === lingua) return;
  lingua = nova;
  try {
    window.localStorage.setItem(CHAVE, nova);
  } catch {
    // Não poder guardar a escolha não impede de a usar nesta sessão.
  }
  // O `lang` do documento é o que diz ao browser e ao leitor de ecrã em que
  // língua está a página — e o que decide a hifenização e a tradução do
  // browser.
  if (typeof document !== "undefined") document.documentElement.lang = nova;
  for (const ouvinte of ouvintes) ouvinte();
}

export function subscribe(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/**
 * Traduz, e substitui `{nome}` pelos valores dados.
 *
 * Sem tradução, devolve a própria chave: um texto novo aparece em inglês em
 * vez de aparecer um `missing.key` ao utilizador.
 */
export function t(chave: string, valores?: Record<string, string | number>) {
  let texto = DICIONARIOS[lingua][chave] ?? EN[chave] ?? chave;
  if (valores) {
    for (const [nome, valor] of Object.entries(valores)) {
      texto = texto.replaceAll(`{${nome}}`, String(valor));
    }
  }
  return texto;
}

if (typeof document !== "undefined") document.documentElement.lang = lingua;
