import type { ResultadoDeEnvio } from "./sync";

/**
 * O que se diz a quem respondeu offline, depois de o servidor ter visto as
 * respostas.
 *
 * Esta é a única altura em que a pessoa fica a saber se acertou: offline não
 * houve correção nenhuma. Um "enviámos o que tinhas em espera" não chega —
 * ela quer saber se passou a lição, e se não passou, porquê e o que fazer a
 * seguir.
 */

export type Aviso = {
  tom: "sucesso" | "erro" | "neutro";
  texto: string;
  /** Um chumbo precisa de tempo para ser lido; um "+40 XP" não. */
  demorado?: boolean;
};

/** "Lição: Massa fresca" → "Massa fresca". */
function nome(descricao: string) {
  return descricao.replace(/^[^:]+:\s*/, "");
}

type CorpoDeLicao = {
  passed?: boolean;
  xpEarned?: number;
  streakBonus?: number;
  heartsLeft?: number;
  results?: Array<{ correct: boolean }>;
};

export function avisoDoEnvio(envio: ResultadoDeEnvio): Aviso {
  if (envio.estado === "recusado") {
    return { tom: "erro", texto: `${envio.item.descricao}: ${envio.erro}`, demorado: true };
  }

  if (envio.item.tipo === "foto") {
    return { tom: "sucesso", texto: `${envio.item.descricao} enviada.` };
  }

  if (envio.item.tipo !== "licao") {
    return { tom: "sucesso", texto: `${envio.item.descricao}: enviado.` };
  }

  const corpo = (envio.resposta ?? {}) as CorpoDeLicao;
  const licao = nome(envio.item.descricao);

  if (corpo.passed === false) {
    const erradas = corpo.results?.filter((resultado) => !resultado.correct).length ?? 0;
    const quantas =
      erradas === 1
        ? "uma resposta errada"
        : erradas > 1
          ? `${erradas} respostas erradas`
          : "erros a mais";

    // Sem rede não houve correção nem corações a descontar: é aqui que a
    // pessoa descobre o resultado, e tem de perceber que pode repetir.
    return {
      tom: "erro",
      demorado: true,
      texto: `"${licao}": não passaste — ${quantas}. A lição continua aberta para repetires.`,
    };
  }

  const xp = (corpo.xpEarned ?? 0) + (corpo.streakBonus ?? 0);
  return {
    tom: "sucesso",
    demorado: true,
    texto: xp > 0 ? `"${licao}": passaste! +${xp} XP.` : `"${licao}": passaste!`,
  };
}

/** Muitos itens de uma vez: um resumo em vez de uma pilha de avisos. */
export function avisoDoResumo(enviados: ResultadoDeEnvio[]): Aviso {
  const licoes = enviados.filter((envio) => envio.item.tipo === "licao");
  const passadas = licoes.filter((envio) => (envio.resposta as CorpoDeLicao)?.passed !== false);
  const xp = enviados.reduce((total, envio) => {
    const corpo = envio.resposta as CorpoDeLicao | undefined;
    return total + (corpo?.xpEarned ?? 0) + (corpo?.streakBonus ?? 0);
  }, 0);

  const partes = [`Enviámos ${enviados.length} coisas que estavam em espera`];
  if (licoes.length > 0) partes.push(`${passadas.length} de ${licoes.length} lições passaram`);
  if (xp > 0) partes.push(`+${xp} XP`);

  return {
    tom: passadas.length === licoes.length ? "sucesso" : "neutro",
    texto: `${partes.join(" · ")}.`,
    demorado: true,
  };
}
