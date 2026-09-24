import type { DietaryTag } from "@/types/recipe";

/**
 * Mantido em sincronia à mão com `server/domain/dietaryTags.js` — o
 * frontend não importa módulos do servidor, por isso a lista vive duplicada
 * nos dois lados. A etiqueta é o que aparece nos filtros e no formulário de
 * publicar; o servidor só conhece o `id`.
 */
export const DIETARY_TAGS: Array<{ id: DietaryTag; label: string }> = [
  { id: "vegetariano", label: "Vegetariano" },
  { id: "vegano", label: "Vegano" },
  { id: "sem_gluten", label: "Sem glúten" },
  { id: "sem_lactose", label: "Sem lactose" },
  { id: "sem_frutos_secos", label: "Sem frutos secos" },
  { id: "sem_ovo", label: "Sem ovo" },
  { id: "sem_soja", label: "Sem soja" },
  { id: "sem_acucar", label: "Sem açúcar" },
  { id: "halal", label: "Halal" },
  { id: "kosher", label: "Kosher" },
];

export function dietaryTagLabel(id: DietaryTag): string {
  return DIETARY_TAGS.find((tag) => tag.id === id)?.label ?? id;
}
