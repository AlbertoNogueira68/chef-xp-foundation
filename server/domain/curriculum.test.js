import test from "node:test";
import assert from "node:assert/strict";

import {
  CURRICULUM,
  LEARNING_CURRICULUM,
  MISSIONS,
  SKILLS,
  gradeAnswers,
  getAllLessons,
  getLesson,
  getLessonIndex,
  getLessonOrder,
  isAnswerCorrect,
  toClientLesson,
} from "./curriculum.js";
import { findSkillCycles, validateCurriculum } from "./curriculumValidation.js";

const lessons = getAllLessons();

/* -------------------------------------------------------------------- */
/* Integridade do currículo real                                        */
/* -------------------------------------------------------------------- */

test("o currículo real passa em todas as regras de integridade", () => {
  const { ok, errors } = validateCurriculum(CURRICULUM);
  assert.ok(ok, `currículo inválido:\n${errors.join("\n")}`);
});

test("o currículo carrega e tem conteúdo", () => {
  assert.ok(LEARNING_CURRICULUM.length > 0);
  assert.ok(lessons.length > 0);
  assert.ok(SKILLS.length > 0);
  assert.ok(MISSIONS.length > 0);
});

test("os ids das lições são únicos", () => {
  const ids = lessons.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("cada lição está completa e é jogável", () => {
  for (const lesson of lessons) {
    assert.ok(lesson.title, `${lesson.id} sem título`);
    assert.ok(lesson.xpReward > 0, `${lesson.id} sem XP`);
    assert.ok(lesson.preparationSteps.length > 0, `${lesson.id} sem passos de preparação`);
    assert.ok(lesson.questions.length > 0, `${lesson.id} sem perguntas`);
  }
});

test("cada lição ensina pelo menos uma competência", () => {
  for (const lesson of lessons) {
    assert.ok((lesson.teaches ?? []).length > 0, `${lesson.id} não ensina nada`);
  }
});

test("todos os quatro tipos de exercício estão em uso", () => {
  const used = new Set(lessons.flatMap((l) => l.questions.map((q) => q.type)));
  for (const type of ["choice", "order", "judge", "estimate"]) {
    assert.ok(used.has(type), `nenhum exercício do tipo ${type}`);
  }
});

/* -------------------------------------------------------------------- */
/* As regras apanham mesmo o erro                                       */
/* -------------------------------------------------------------------- */

/** Currículo mínimo e válido, para depois se estragar uma coisa de cada vez. */
function fixture(overrides = {}) {
  return {
    version: 2,
    skills: [
      { id: "a", name: "A", category: "faca", description: "d", requires: [] },
      { id: "b", name: "B", category: "calor", description: "d", requires: ["a"] },
    ],
    missions: [
      {
        id: "m1",
        title: "M",
        practices: ["a", "b"],
        ingredients: ["x"],
        steps: [
          { id: "p1", title: "T", description: "D", rescues: [{ kind: "pronto", answer: "R" }] },
          { id: "p2", title: "T", description: "D", rescues: [{ kind: "cola", answer: "R" }] },
          {
            id: "p3",
            title: "T",
            description: "D",
            checkpoint: true,
            rescues: [{ kind: "falta", answer: "R" }],
          },
        ],
      },
    ],
    units: [
      {
        id: "u1",
        lessons: [
          {
            id: "l1",
            title: "L1",
            xpReward: 10,
            teaches: ["a"],
            requires: [],
            questions: [
              {
                id: "q1",
                type: "choice",
                skills: ["a"],
                prompt: "p",
                options: ["x", "y"],
                correctAnswer: "x",
                explanation: "e",
                explainWrong: "w",
              },
            ],
          },
          {
            id: "l2",
            title: "L2",
            xpReward: 10,
            teaches: ["b"],
            requires: ["a"],
            questions: [
              {
                id: "q2",
                type: "choice",
                skills: ["b"],
                prompt: "p",
                options: ["x", "y"],
                correctAnswer: "y",
                explanation: "e",
                explainWrong: "w",
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function errorsOf(mutate) {
  const c = fixture();
  mutate(c);
  return validateCurriculum(c).errors.join("\n");
}

test("a fixture de referência é válida", () => {
  assert.ok(validateCurriculum(fixture()).ok);
});

test("apanha ciclos no grafo de pré-requisitos", () => {
  const errors = errorsOf((c) => {
    c.skills[0].requires = ["b"]; // a → b → a
  });
  assert.match(errors, /ciclo de pré-requisitos/);
});

test("findSkillCycles apanha um ciclo de três e ignora um grafo acíclico", () => {
  const cyclic = [
    { id: "a", requires: ["b"] },
    { id: "b", requires: ["c"] },
    { id: "c", requires: ["a"] },
  ];
  assert.equal(findSkillCycles(cyclic).length, 1);

  const acyclic = [
    { id: "a", requires: [] },
    { id: "b", requires: ["a"] },
    { id: "c", requires: ["a", "b"] },
  ];
  assert.deepEqual(findSkillCycles(acyclic), []);
});

test("apanha uma lição que exige o que ainda não foi ensinado", () => {
  const errors = errorsOf((c) => {
    c.units[0].lessons[0].requires = ["b"]; // b só é ensinada na lição seguinte
  });
  assert.match(errors, /só é ensinada mais à frente/);
});

test("apanha uma competência ensinada que nenhuma missão pratica", () => {
  const errors = errorsOf((c) => {
    c.missions[0].practices = ["a"];
  });
  assert.match(errors, /ensinada mas nunca praticada/);
});

test("apanha um exercício sem competência associada", () => {
  const errors = errorsOf((c) => {
    c.units[0].lessons[0].questions[0].skills = [];
  });
  assert.match(errors, /não mapeia nenhuma competência/);
});

test("apanha um exercício sem explainWrong", () => {
  const errors = errorsOf((c) => {
    c.units[0].lessons[0].questions[0].explainWrong = "   ";
  });
  assert.match(errors, /sem explainWrong/);
});

test("apanha uma resposta certa que não está entre as opções", () => {
  const errors = errorsOf((c) => {
    c.units[0].lessons[0].questions[0].correctAnswer = "z";
  });
  assert.match(errors, /não está entre as opções/);
});

test("apanha referências a competências inexistentes", () => {
  const errors = errorsOf((c) => {
    c.units[0].lessons[0].teaches = ["fantasma"];
  });
  assert.match(errors, /competência inexistente/);
});

test("apanha ids duplicados", () => {
  const errors = errorsOf((c) => {
    c.units[0].lessons[1].id = "l1";
  });
  assert.match(errors, /lição duplicada/);
});

test("apanha um exercício de estimar sem tolerância", () => {
  const errors = errorsOf((c) => {
    Object.assign(c.units[0].lessons[0].questions[0], {
      type: "estimate",
      correctAnswer: 10,
      unit: "ml",
      tolerance: 0,
    });
  });
  assert.match(errors, /tolerância positiva/);
});

/* -------------------------------------------------------------------- */
/* O gabarito não sai do servidor                                       */
/* -------------------------------------------------------------------- */

test("toClientLesson não deixa escapar o gabarito de nenhuma lição", () => {
  for (const lesson of lessons) {
    const payload = JSON.stringify(toClientLesson(lesson));
    assert.ok(!payload.includes("correctAnswer"), `${lesson.id}: correctAnswer no payload`);
    assert.ok(!payload.includes("correctOrder"), `${lesson.id}: correctOrder no payload`);
    assert.ok(!payload.includes("explanation"), `${lesson.id}: explanation no payload`);
    assert.ok(!payload.includes("explainWrong"), `${lesson.id}: explainWrong no payload`);
  }
});

test("os passos de ordenar vão baralhados, mas sempre da mesma maneira", () => {
  const lesson = lessons.find((l) => l.questions.some((q) => q.type === "order"));
  const question = lesson.questions.find((q) => q.type === "order");
  const first = toClientLesson(lesson).questions.find((q) => q.id === question.id);
  const second = toClientLesson(lesson).questions.find((q) => q.id === question.id);

  assert.deepEqual(first.items, second.items, "a ordem mudou entre pedidos");
  assert.deepEqual([...first.items].sort(), [...question.correctOrder].sort());
  assert.notDeepEqual(first.items, question.correctOrder, "os passos saíram por ordem");
});

/* -------------------------------------------------------------------- */
/* Correção por tipo                                                    */
/* -------------------------------------------------------------------- */

test("isAnswerCorrect: escolha compara texto exato", () => {
  const q = { type: "choice", correctAnswer: "x" };
  assert.equal(isAnswerCorrect(q, "x"), true);
  assert.equal(isAnswerCorrect(q, "X"), false);
  assert.equal(isAnswerCorrect(q, null), false);
});

test("isAnswerCorrect: ordenar exige a sequência inteira", () => {
  const q = { type: "order", correctOrder: ["a", "b", "c"] };
  assert.equal(isAnswerCorrect(q, ["a", "b", "c"]), true);
  assert.equal(isAnswerCorrect(q, ["a", "c", "b"]), false);
  assert.equal(isAnswerCorrect(q, ["a", "b"]), false);
  assert.equal(isAnswerCorrect(q, "a,b,c"), false);
});

test("isAnswerCorrect: estimar aceita dentro da tolerância e recusa fora", () => {
  const q = { type: "estimate", correctAnswer: 200, tolerance: 30 };
  assert.equal(isAnswerCorrect(q, 200), true);
  assert.equal(isAnswerCorrect(q, 170), true, "o limite inferior conta");
  assert.equal(isAnswerCorrect(q, 230), true, "o limite superior conta");
  assert.equal(isAnswerCorrect(q, 169), false);
  assert.equal(isAnswerCorrect(q, "185"), true, "texto numérico é aceite");
  assert.equal(isAnswerCorrect(q, "muito"), false);
});

test("respostas todas certas dão zero erros", () => {
  const lesson = lessons[0];
  const answers = lesson.questions.map((q) => ({
    questionId: q.id,
    answer: q.type === "order" ? q.correctOrder : q.correctAnswer,
  }));
  const result = gradeAnswers(lesson, answers);
  assert.equal(result.wrong, 0);
  assert.equal(result.correct, lesson.questions.length);
});

test("não responder conta como errado — não se ganha XP por silêncio", () => {
  const lesson = lessons[0];
  const result = gradeAnswers(lesson, []);
  assert.equal(result.wrong, lesson.questions.length);
});

test("o explainWrong só aparece quando se erra", () => {
  const lesson = lessons[0];
  const question = lesson.questions[0];

  const right = gradeAnswers(lesson, [
    { questionId: question.id, answer: question.correctAnswer },
  ]).results.find((r) => r.questionId === question.id);
  assert.equal(right.explainWrong, null);

  const wrong = gradeAnswers(lesson, [
    { questionId: question.id, answer: "resposta errada" },
  ]).results.find((r) => r.questionId === question.id);
  assert.equal(wrong.explainWrong, question.explainWrong);
});

test("gradeAnswers ignora perguntas que não pertencem à lição", () => {
  const lesson = lessons[0];
  const result = gradeAnswers(lesson, [{ questionId: "inventada", answer: "x" }]);
  assert.equal(result.total, lesson.questions.length);
});

test("gradeAnswers aguenta entrada malformada", () => {
  const lesson = lessons[0];
  assert.doesNotThrow(() => gradeAnswers(lesson, null));
  assert.doesNotThrow(() => gradeAnswers(lesson, [null]));
});

test("a ordem das lições é estável e conhecida", () => {
  const order = getLessonOrder();
  assert.equal(order.length, lessons.length);
  assert.equal(getLessonIndex(order[0]), 0);
  assert.equal(getLessonIndex("nao-existe"), -1);
  assert.equal(getLesson("nao-existe"), null);
});

test("apanha uma missão sem passo de verificação", () => {
  const errors = errorsOf((c) => {
    for (const step of c.missions[0].steps) delete step.checkpoint;
  });
  assert.match(errors, /nenhum passo pede foto/);
});

test("apanha um passo de missão sem socorros", () => {
  const errors = errorsOf((c) => {
    c.missions[0].steps[0].rescues = [];
  });
  assert.match(errors, /sem respostas de socorro/);
});

test("apanha um socorro de tipo inventado", () => {
  const errors = errorsOf((c) => {
    c.missions[0].steps[0].rescues = [{ kind: "explodiu", answer: "R" }];
  });
  assert.match(errors, /tipo de socorro inválido/);
});

test("apanha uma missão sem ingredientes", () => {
  const errors = errorsOf((c) => {
    c.missions[0].ingredients = [];
  });
  assert.match(errors, /sem ingredientes/);
});
