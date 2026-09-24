-- 020: filtro por orçamento e por preferências alimentares
--
-- `estimated_cost_eur` é uma estimativa dada por quem publica a receita, não
-- um preço calculado a partir dos ingredientes — a app não tem uma tabela de
-- preços. `dietary_tags` é um conjunto fechado, validado por CHECK, e não
-- texto livre: filtrar por "vegetariano" só funciona se todas as receitas
-- vegetarianas usarem exatamente a mesma palavra.

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS estimated_cost_eur NUMERIC(6,2);

ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_estimated_cost_eur_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_estimated_cost_eur_check
  CHECK (estimated_cost_eur IS NULL OR estimated_cost_eur >= 0);

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_dietary_tags_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_dietary_tags_check
  CHECK (dietary_tags <@ ARRAY[
    'vegetariano', 'vegano', 'sem_gluten', 'sem_lactose', 'sem_frutos_secos',
    'sem_ovo', 'sem_soja', 'sem_acucar', 'halal', 'kosher'
  ]::text[]);

CREATE INDEX IF NOT EXISTS recipes_cost_idx ON recipes (estimated_cost_eur);
CREATE INDEX IF NOT EXISTS recipes_dietary_tags_idx ON recipes USING gin (dietary_tags);
