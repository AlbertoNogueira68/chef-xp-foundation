import test from "node:test";
import assert from "node:assert/strict";
import {
  cookMinutes,
  feedCursorFrom,
  feedItemKey,
  isValidFeedCursor,
  nextOffset,
  parseFeedItemKey,
  toFeedItem,
} from "./feed.js";

const authorColumns = {
  author_id: "11111111-1111-1111-1111-111111111111",
  author_username: "alberto",
  author_level: 4,
  author_photo: null,
};

function cookRow(overrides = {}) {
  return {
    kind: "cook",
    item_id: "7",
    run_id: "12",
    mission_id: "mission.ovo-estrelado",
    image_url: "/uploads/ovo.jpg",
    caption: "primeiro de sempre",
    level_at: 3,
    started_at: "2026-09-01T18:00:00.000Z",
    completed_at: "2026-09-01T18:12:00.000Z",
    created_at: "2026-09-01T18:12:00.000Z",
    likes_count: "2",
    comments_count: "1",
    liked_by_me: true,
    ...authorColumns,
    ...overrides,
  };
}

function recipeRow(overrides = {}) {
  return {
    kind: "recipe",
    item_id: "22222222-2222-2222-2222-222222222222",
    title: "Sopa de grão",
    description: "Uma sopa de inverno",
    ingredients: "grão, couve, azeite",
    cook_time_min: 45,
    difficulty: "medio",
    xp_reward: 50,
    image_url: null,
    created_at: "2026-09-02T10:00:00.000Z",
    likes_count: "0",
    comments_count: "0",
    liked_by_me: false,
    ...authorColumns,
    ...overrides,
  };
}

test("um cozinhado leva o título e o prato do currículo, não da base", () => {
  const item = toFeedItem(cookRow());

  assert.equal(item.kind, "cook");
  assert.equal(item.missionTitle, "O teu primeiro ovo");
  assert.equal(item.dishName, "Ovo estrelado");
  assert.equal(item.levelAt, 3);
  assert.equal(item.minutes, 12);
  assert.equal(item.likesCount, 2);
  assert.equal(item.likedByMe, true);
});

test("uma missão saída do currículo não parte o feed", () => {
  const item = toFeedItem(cookRow({ mission_id: "mission.que-ja-nao-existe" }));

  // Vale mais o cozinhado aparecer com o id cru do que a página inteira falhar
  // por causa de uma missão renomeada.
  assert.equal(item.missionTitle, "mission.que-ja-nao-existe");
  assert.equal(item.dishName, "");
  assert.equal(item.xpReward, 0);
});

test("uma receita mantém o formato que o feed já desenhava", () => {
  const item = toFeedItem(recipeRow());

  assert.equal(item.kind, "recipe");
  assert.equal(item.title, "Sopa de grão");
  assert.equal(item.cookTimeMin, 45);
  assert.equal(item.difficulty, "medio");
  assert.equal(item.likesCount, 0);
});

test("as chaves das duas naturezas nunca colidem", () => {
  const cook = toFeedItem(cookRow({ item_id: "7" }));
  const recipe = toFeedItem(recipeRow({ item_id: "7" }));

  assert.notEqual(cook.key, recipe.key);
  assert.deepEqual(parseFeedItemKey(cook.key), { kind: "cook", id: "7" });
  assert.deepEqual(parseFeedItemKey(recipe.key), { kind: "recipe", id: "7" });
});

test("uma chave de receita com dois pontos no id continua a partir-se no primeiro", () => {
  assert.deepEqual(parseFeedItemKey(feedItemKey("recipe", "a:b")), { kind: "recipe", id: "a:b" });
  assert.equal(parseFeedItemKey("outra:1"), null);
  assert.equal(parseFeedItemKey("cook:"), null);
  assert.equal(parseFeedItemKey("cook"), null);
});

test("o tempo na cozinha nunca é zero nem negativo", () => {
  assert.equal(cookMinutes("2026-09-01T18:00:00Z", "2026-09-01T18:00:10Z"), 1);
  assert.equal(cookMinutes(null, "2026-09-01T18:00:00Z"), 1);
  assert.equal(cookMinutes("2026-09-01T18:30:00Z", "2026-09-01T18:00:00Z"), 1);
});

test("o cursor guarda o tripleto da ordenação", () => {
  assert.deepEqual(feedCursorFrom(cookRow()), {
    createdAt: "2026-09-01T18:12:00.000Z",
    kind: "cook",
    id: "7",
  });
});

test("um cursor forjado é recusado em vez de entrar na consulta", () => {
  assert.equal(isValidFeedCursor(null), false);
  assert.equal(isValidFeedCursor({ createdAt: "2026-09-01T18:12:00.000Z", kind: "cook" }), false);
  assert.equal(
    isValidFeedCursor({ createdAt: "2026-09-01T18:12:00.000Z", kind: "outra", id: "7" }),
    false,
  );
  assert.equal(
    isValidFeedCursor({ createdAt: "2026-09-01T18:12:00.000Z", kind: "cook", id: "7" }),
    true,
  );
});

test("o deslocamento de \"em alta\" avança uma página de cada vez", () => {
  assert.equal(nextOffset(null, 12), 12);
  assert.equal(nextOffset({ offset: 12 }, 12), 24);
  assert.equal(nextOffset({ offset: -5 }, 12), 12);
});
