import { t } from "@/i18n";
import type { DietaryTag } from "@/types/recipe";

/**
 * Mantido em sincronia à mão com `server/domain/dietaryTags.js` — o
 * frontend não importa módulos do servidor, por isso a lista vive duplicada
 * nos dois lados. O servidor só conhece o `id`.
 *
 * O `label` é a chave do dicionário, em inglês, e não o texto final: a
 * tradução é feita em `dietaryTagLabel`, no momento de desenhar. Guardar aqui
 * o texto já traduzido fixava a língua no arranque da app, e as etiquetas
 * ficavam na língua antiga depois de se carregar no botão de idioma.
 */
export const DIETARY_TAGS: Array<{ id: DietaryTag; label: string }> = [
  { id: "vegetariano", label: "Vegetarian" },
  { id: "vegano", label: "Vegan" },
  { id: "sem_gluten", label: "Gluten-free" },
  { id: "sem_lactose", label: "Lactose-free" },
  { id: "sem_frutos_secos", label: "Nut-free" },
  { id: "sem_ovo", label: "Egg-free" },
  { id: "sem_soja", label: "Soy-free" },
  { id: "sem_acucar", label: "Sugar-free" },
  { id: "halal", label: "Halal" },
  { id: "kosher", label: "Kosher" },
];

/** A etiqueta como aparece no ecrã, já na língua da app. */
export function dietaryTagLabel(id: DietaryTag): string {
  const etiqueta = DIETARY_TAGS.find((tag) => tag.id === id);
  return etiqueta ? t(etiqueta.label) : id;
}
