import { useCallback, useEffect, useRef, useState } from "react";
import { getLanguage } from "@/i18n";

type Command = "next" | "prev" | "repeat";

/**
 * As palavras que o reconhecedor procura, por língua.
 *
 * Tem de acompanhar a língua da app: um reconhecedor a ouvir português para
 * quem está a dizer "next" não percebe nada — e o contrário também não.
 */
const PHRASES: Record<string, Array<{ words: string[]; command: Command }>> = {
  en: [
    { words: ["next", "forward", "continue"], command: "next" },
    { words: ["back", "previous", "go back"], command: "prev" },
    { words: ["repeat", "again"], command: "repeat" },
  ],
  pt: [
    { words: ["próximo", "proximo", "seguinte", "avançar", "avancar"], command: "next" },
    { words: ["anterior", "voltar", "atrás", "atras"], command: "prev" },
    { words: ["repetir", "outra vez"], command: "repeat" },
  ],
};

const RECOGNIZER_LANG: Record<string, string> = { en: "en-US", pt: "pt-PT" };

/**
 * Três comandos e mais nada: próximo, anterior, repetir.
 *
 * Quem está a cozinhar tem as mãos sujas, e limpar as mãos para tocar no ecrã
 * é a fricção que faz as pessoas desistirem do passo a passo. Não tenta
 * perceber frases — procura palavras conhecidas no que ouviu, porque um
 * reconhecedor a tentar interpretar cozinha em português falha mais do que
 * acerta.
 *
 * Sem suporte no browser, `supported` é falso e os botões continuam lá.
 */
export function useVoiceControl(onCommand: (command: Command) => void) {
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognition | null>(null);
  const handler = useRef(onCommand);
  handler.current = onCommand;

  const Recognition =
    typeof window !== "undefined"
      ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
      : undefined;
  const supported = Boolean(Recognition);

  useEffect(() => {
    if (!listening || !Recognition) return;

    const engine = new Recognition();
    engine.lang = RECOGNIZER_LANG[getLanguage()] ?? "en-US";
    engine.continuous = true;
    engine.interimResults = false;

    engine.onresult = (event: SpeechRecognitionEvent) => {
      const said = event.results[event.results.length - 1][0].transcript.toLowerCase();
      const frases = PHRASES[getLanguage()] ?? PHRASES.en;
      const match = frases.find((p) => p.words.some((word) => said.includes(word)));
      if (match) handler.current(match.command);
    };

    // O reconhecedor desliga-se sozinho em silêncios longos — numa cozinha
    // isso é a norma, por isso volta a ligar enquanto o utilizador quiser.
    engine.onend = () => {
      if (recognition.current === engine) {
        try {
          engine.start();
        } catch {
          setListening(false);
        }
      }
    };
    engine.onerror = () => setListening(false);

    recognition.current = engine;
    try {
      engine.start();
    } catch {
      setListening(false);
    }

    return () => {
      recognition.current = null;
      engine.onend = null;
      engine.stop();
    };
  }, [listening, Recognition]);

  const toggle = useCallback(() => setListening((on) => !on), []);

  return { supported, listening, toggle };
}
