import { getMission, missionXp } from "./missions.js";

/**
 * O feed tem duas naturezas: um cozinhado (uma missão terminada e partilhada)
 * e uma receita publicada. Vêm de tabelas diferentes, com chaves de tipos
 * diferentes — BIGINT e UUID — por isso a lista precisa de uma chave própria
 * que seja única no conjunto. Daí o prefixo.
 *
 * Sem isto, um post com id 7 e uma receita com id 7 seriam a mesma linha para
 * a cache do cliente.
 */
export function feedItemKey(kind, id) {
  return `${kind}:${id}`;
}

export function parseFeedItemKey(key) {
  const separator = key.indexOf(":");
  if (separator < 1) return null;
  const kind = key.slice(0, separator);
  const id = key.slice(separator + 1);
  if (!id || (kind !== "cook" && kind !== "recipe")) return null;
  return { kind, id };
}

/** Minutos que a pessoa esteve mesmo na cozinha. Nunca menos de um. */
export function cookMinutes(startedAt, completedAt) {
  if (!startedAt || !completedAt) return 1;
  const elapsed = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(elapsed)) return 1;
  return Math.max(1, Math.round(elapsed / 60_000));
}

function author(row) {
  return {
    id: row.author_id,
    username: row.author_username,
    level: Number(row.author_level ?? 1),
    photoUrl: row.author_photo ?? null,
  };
}

function social(row) {
  return {
    likesCount: Number(row.likes_count ?? 0),
    commentsCount: Number(row.comments_count ?? 0),
    likedByMe: Boolean(row.liked_by_me),
  };
}

/**
 * Uma linha do UNION do feed em DTO.
 *
 * O título e o prato de um cozinhado saem do currículo e não da base: o post
 * guarda o `mission_id` e mais nada, para o texto poder ser corrigido sem
 * migration. É a mesma regra que o perfil já seguia.
 */
export function toFeedItem(row) {
  if (row.kind === "cook") {
    const mission = getMission(row.mission_id);
    return {
      kind: "cook",
      key: feedItemKey("cook", row.item_id),
      id: String(row.item_id),
      runId: row.run_id === null || row.run_id === undefined ? null : Number(row.run_id),
      missionId: row.mission_id,
      missionTitle: mission?.title ?? row.mission_id,
      dishName: mission?.dishName ?? "",
      imageUrl: row.image_url,
      caption: row.caption ?? null,
      // O nível de quem publicou, à data. É o que separa um cozinhado de uma
      // fotografia de comida: mostra o caminho, não o resultado.
      levelAt: Number(row.level_at ?? 1),
      minutes: cookMinutes(row.started_at, row.completed_at),
      xpReward: mission ? missionXp(mission) : 0,
      createdAt: row.created_at,
      author: author(row),
      ...social(row),
    };
  }

  return {
    kind: "recipe",
    key: feedItemKey("recipe", row.item_id),
    id: String(row.item_id),
    title: row.title,
    description: row.description,
    ingredients: row.ingredients,
    cookTimeMin: Number(row.cook_time_min ?? 0),
    difficulty: row.difficulty,
    xpReward: Number(row.xp_reward ?? 0),
    imageUrl: row.image_url ?? null,
    createdAt: row.created_at,
    author: author(row),
    ...social(row),
  };
}

/**
 * O cursor do feed é o tripleto que a ordenação usa: data, natureza e id.
 *
 * A data sozinha não chega — dois cozinhados publicados no mesmo instante
 * ficariam ambos de fora ou ambos repetidos na página seguinte. `kind` e
 * `item_id` só desempatam.
 */
export function feedCursorFrom(row) {
  return { createdAt: row.created_at, kind: row.kind, id: String(row.item_id) };
}

export function isValidFeedCursor(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.createdAt === "string" &&
      (value.kind === "cook" || value.kind === "recipe") &&
      typeof value.id === "string" &&
      value.id.length > 0,
  );
}

/** Deslocamento da página seguinte no scope "em alta", que não pagina por chave. */
export function nextOffset(cursor, limit) {
  const current = Math.max(0, Number(cursor?.offset ?? 0));
  return current + limit;
}
