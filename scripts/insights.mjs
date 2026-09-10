#!/usr/bin/env node
import "dotenv/config";
import { closePool } from "../server/db/index.js";
import { getMission } from "../server/domain/missions.js";
import {
  MIN_SAMPLE,
  asPercent,
  describeRate,
  median,
  rankRescues,
  rankSteps,
  summarizeAdherence,
  summarizeRuns,
} from "../server/domain/insights.js";
import {
  loadAdherenceByWeek,
  loadDurations,
  loadFeatureUse,
  loadRescueKinds,
  loadRunsByMission,
  loadRunsByStatus,
  loadScale,
  loadStallPoints,
  loadStepEvents,
} from "../server/lib/insights.js";

/**
 * O relatório da telemetria.
 *
 * Um script e não um painel na app: os números daqui vão para um documento
 * escrito, e um painel com contas agregadas de toda a gente obrigava a
 * inventar um conceito de administrador que este projeto não tem — mais
 * superfície de autenticação para servir uma pessoa.
 *
 *   npm run insights
 */

const BAR = "─".repeat(64);

function title(text) {
  console.log(`\n${text}\n${BAR}`);
}

function line(label, value, note = "") {
  console.log(`  ${label.padEnd(34)} ${String(value).padEnd(16)} ${note}`);
}

/** Datas do Postgres chegam como Date; num relatório escrito só interessa o dia. */
function day(value) {
  if (!value) return "—";
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

/** Uma taxa vem sempre com o denominador, e marcada quando a amostra é fina. */
function show(label, described, note = "") {
  const warn = described.thin && described.whole > 0 ? "⚠ amostra pequena" : "";
  line(label, described.text, [note, warn].filter(Boolean).join(" · "));
}

function missionLabel(id) {
  const mission = getMission(id);
  return mission ? `${mission.title}` : id;
}

function stepLabel(missionId, index) {
  const mission = getMission(missionId);
  const step = mission?.steps?.[index];
  const text = step?.title ?? step?.description ?? "";
  return text ? `passo ${index} — ${text.slice(0, 38)}` : `passo ${index}`;
}

async function main() {
  const scale = await loadScale();

  title("ESCALA");
  line("utilizadores registados", scale.users);
  line("já cozinharam pelo menos uma vez", scale.cooks);
  line("runs de missão", scale.runs);
  line("eventos registados", scale.events);
  line("compromissos assumidos", scale.plans);
  line("primeira run", day(scale.first_run));
  line("última run", day(scale.last_run));

  if (Number(scale.runs) === 0) {
    console.log(
      "\nSem runs não há nada para analisar. Este relatório precisa de uso real,\n" +
        "não de dados de seed — números inventados numa dissertação são piores\n" +
        "do que a ausência deles.\n",
    );
    return;
  }

  if (Number(scale.runs) < MIN_SAMPLE) {
    console.log(
      `\n⚠  ${scale.runs} runs no total. Tudo o que se segue descreve o acaso,\n` +
        "   não um comportamento. Serve para verificar que a recolha funciona.\n",
    );
  }

  /* ---------------------------------------------------------------- */
  title("CHEGAR AO FIM");
  const runs = summarizeRuns(await loadRunsByStatus());
  show("concluídas", runs.completion);
  show("nunca terminadas", runs.unfinished);
  show("…e que o disseram", runs.declared, "as outras fecharam a app e nunca voltaram");

  const byMission = await loadRunsByMission();
  console.log("");
  for (const row of byMission) {
    show(
      `  ${missionLabel(row.mission_id)}`.slice(0, 34),
      describeRate(row.completed, row.runs),
      `${row.open} por acabar`,
    );
  }

  /* ---------------------------------------------------------------- */
  title("ONDE SE DESISTE");
  const stalls = await loadStallPoints();
  if (stalls.length === 0) {
    console.log("  Nenhuma run por terminar.");
  }
  for (const row of stalls.slice(0, 8)) {
    const how = row.status === "abandoned" ? "abandonou" : "parou";
    line(`  ${stepLabel(row.mission_id, row.current_step)}`.slice(0, 36), `${row.runs} ${how}`);
  }

  /* ---------------------------------------------------------------- */
  title("ONDE CUSTA (atrito por passo)");
  console.log("  desistir pesa 5, pedir socorro 2, voltar atrás 1\n");
  const ranked = rankSteps(await loadStepEvents());
  if (ranked.length === 0) {
    console.log("  Sem eventos registados.");
  }
  for (const step of ranked.slice(0, 8)) {
    if (step.friction === 0) continue;
    line(
      `  ${stepLabel(step.missionId, step.stepIndex)}`.slice(0, 36),
      `atrito ${step.friction}`,
      `${step.abandon}× saiu · ${step.rescue}× socorro · ${step.back}× atrás · ${step.runs} runs`,
    );
  }

  /* ---------------------------------------------------------------- */
  title("QUE SOCORRO SE PEDE");
  const rescues = rankRescues(await loadRescueKinds());
  if (rescues.total === 0) console.log("  Nunca ninguém pediu socorro.");
  for (const kind of rescues.kinds) {
    line(`  ${kind.kind}`, kind.count, asPercent(kind.share));
  }

  /* ---------------------------------------------------------------- */
  title("QUANTO TEMPO NA COZINHA");
  const durations = await loadDurations();
  const overall = median(durations.map((row) => row.minutes));
  line("mediana geral", overall === null ? "—" : `${overall.toFixed(0)} min`);
  const missionIds = [...new Set(durations.map((row) => row.mission_id))];
  for (const id of missionIds) {
    const value = median(
      durations.filter((row) => row.mission_id === id).map((row) => row.minutes),
    );
    const n = durations.filter((row) => row.mission_id === id).length;
    line(`  ${missionLabel(id)}`.slice(0, 34), `${value.toFixed(0)} min`, `n=${n}`);
  }

  /* ---------------------------------------------------------------- */
  title("O QUE SE USA MESMO");
  const features = await loadFeatureUse();
  const totalRuns = Number(scale.runs);
  for (const kind of ["timer", "voice"]) {
    const row = features.find((f) => f.kind === kind);
    const label = kind === "timer" ? "temporizadores" : "comandos de voz";
    show(`  ${label} (runs que os usaram)`, describeRate(row?.runs ?? 0, totalRuns));
  }

  /* ---------------------------------------------------------------- */
  title("CUMPRIR O COMPROMISSO");
  const weeks = await loadAdherenceByWeek();
  const adherence = summarizeAdherence(weeks);
  show("promessas cumpridas", adherence.adherence, "só dias já passados");
  line("cozinhados fora do plano", adherence.spontaneous, "não entram na adesão");
  console.log("");
  for (const week of weeks) {
    show(`  semana de ${day(week.week)}`, describeRate(week.done, Number(week.done) + Number(week.missed)));
  }

  console.log("");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
