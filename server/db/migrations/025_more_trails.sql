-- 018: mais trilhos como base
--
-- Cinco trilhos a mais, para dar variedade real antes de haver utilizadores
-- a sério: cozinha portuguesa, cozinha de estudante, alimentação saudável,
-- vegan e "gymbro" (proteína, macros, meal prep). Cada um vem com o
-- currículo em `shared/trails/<id>.json`, tal como "italian" já vinha.

INSERT INTO trails (id, name, description, icon, color, difficulty, published_at, order_index)
VALUES (
  'portuguese',
  'Portuguese Cuisine',
  'Desalting cod, building a refogado, and rice that''s meant to be saucy.',
  '🇵🇹',
  'emerald',
  'intermediate',
  now(),
  4
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO trails (id, name, description, icon, color, difficulty, published_at, order_index)
VALUES (
  'university',
  'Student Cooking',
  'A pantry that lasts the month, one-pot meals, and leftovers reinvented.',
  '🎓',
  'slate',
  'beginner',
  now(),
  5
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO trails (id, name, description, icon, color, difficulty, published_at, order_index)
VALUES (
  'healthy',
  'Healthy Cooking',
  'Steaming, a balanced plate, good fats, and dessert without added sugar.',
  '🥗',
  'green',
  'beginner',
  now(),
  6
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO trails (id, name, description, icon, color, difficulty, published_at, order_index)
VALUES (
  'vegan',
  'Vegan Cooking',
  'Plant protein, real tofu texture, replacing egg, and umami without meat.',
  '🌱',
  'green',
  'intermediate',
  now(),
  7
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO trails (id, name, description, icon, color, difficulty, published_at, order_index)
VALUES (
  'gymbro',
  'Gymbro Cooking',
  'Portioning protein, juicy chicken breast, and meal prep that isn''t bland.',
  '🍗',
  'red',
  'beginner',
  now(),
  8
)
ON CONFLICT (id) DO NOTHING;
