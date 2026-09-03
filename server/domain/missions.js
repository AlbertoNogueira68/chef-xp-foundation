import { CURRICULUM, LEARNING_CURRICULUM } from "./curriculum.js";

export const MISSIONS = CURRICULUM.missions;

const missionsById = new Map(MISSIONS.map((mission) => [mission.id, mission]));
const unitByMissionId = new Map(
  LEARNING_CURRICULUM.filter((unit) => unit.missionId).map((unit) => [unit.missionId, unit]),
);

/** XP de uma missão. Vale mais do que uma lição porque exige ir à cozinha. */
export const MISSION_BASE_XP = 100;

export function getMission(id) {
  return missionsById.get(id) ?? null;
}

export function getUnitOfMission(missionId) {
  return unitByMissionId.get(missionId) ?? null;
}

export function missionXp(mission) {
  return MISSION_BASE_XP + (mission.steps?.length ?? 0) * 5;
}

/**
 * Versão da missão para o cliente. Sai o texto das respostas de socorro:
 * ficam só os `kind`, para o painel saber que botões desenhar.
 *
 * Não é segredo nenhum — é para que pedir socorro seja um pedido ao servidor
 * e não uma expansão de acordeão. Se as respostas fossem no payload,
 * `mission_events` nunca saberia onde é que as pessoas se perdem, que é a
 * única razão pela qual esta tabela existe.
 */
export function toClientMission(mission) {
  return {
    ...mission,
    xpReward: missionXp(mission),
    steps: mission.steps.map((step, index) => ({
      ...step,
      index,
      rescues: (step.rescues ?? []).map(({ kind }) => ({ kind })),
    })),
  };
}

export function getStep(mission, index) {
  return mission.steps[index] ?? null;
}

export function findRescueAnswer(mission, stepIndex, kind) {
  const step = getStep(mission, stepIndex);
  if (!step) return null;
  return step.rescues?.find((rescue) => rescue.kind === kind)?.answer ?? null;
}

/** Índice do passo que pede foto. É por ele que passa a única verificação real. */
export function checkpointIndexes(mission) {
  return mission.steps.map((step, index) => (step.checkpoint ? index : -1)).filter((i) => i >= 0);
}

/**
 * Só se avança um passo de cada vez, e nunca para fora da missão. Recuar é
 * livre: quem está a cozinhar precisa de reler o passo anterior, e bloquear
 * isso não protege nada.
 */
export function validateStepMove(mission, current, next) {
  if (!Number.isInteger(next) || next < 0 || next >= mission.steps.length) {
    return { ok: false, reason: "Passo fora da missão" };
  }
  if (next > current + 1) {
    return { ok: false, reason: "Não se saltam passos" };
  }
  return { ok: true };
}
