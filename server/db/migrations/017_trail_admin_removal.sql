-- 017: acabar com os trilhos escritos pelo painel
--
-- `curriculum_json` nunca chegou a ser usado a sério: os dois trilhos que
-- existiam eram sempre de ficheiro. Em vez de manter um caminho de criação
-- que ninguém usava — currículo inteiro escrito à mão numa textarea, sem
-- editor nem validação visual — os trilhos passam a nascer todos como
-- ficheiro em `shared/trails/`, com uma migration a dar-lhes a linha de
-- metadados, exactamente como "italian" já fazia.
--
-- A coluna cai porque um currículo por vir da base de dados deixou de ser um
-- caminho que o código sabe percorrer.
ALTER TABLE trails DROP COLUMN IF EXISTS curriculum_json;

-- Cozinha japonesa. O currículo está em `shared/trails/japanese.json`.
INSERT INTO trails (id, name, description, icon, color, difficulty, published_at, order_index)
VALUES (
  'japanese',
  'Japanese Cuisine',
  'Rice, dashi, miso, knife cuts and donburi assembly.',
  '🇯🇵',
  'rose',
  'intermediate',
  now(),
  2
)
ON CONFLICT (id) DO NOTHING;

-- Cozinha mexicana. O currículo está em `shared/trails/mexican.json`.
INSERT INTO trails (id, name, description, icon, color, difficulty, published_at, order_index)
VALUES (
  'mexican',
  'Mexican Cuisine',
  'Roasted salsas, fresh masa, seared meat and taco assembly.',
  '🇲🇽',
  'amber',
  'intermediate',
  now(),
  3
)
ON CONFLICT (id) DO NOTHING;
