-- Dev-only seed data.
-- Password for all users: chef123

INSERT INTO users (id, username, email, password_hash, level, xp)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'chefdemo',
    'demo@chef-xp.local',
    '$2b$10$ybR5NV4X4MnE0F3JclMsaecIQO4oU76FCArJkrxP97rTsomfUUkN6',
    3,
    420
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'souschef',
    'sous@chef-xp.local',
    '$2b$10$ybR5NV4X4MnE0F3JclMsaecIQO4oU76FCArJkrxP97rTsomfUUkN6',
    2,
    180
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'mariacozinha',
    'maria@chef-xp.local',
    '$2b$10$ybR5NV4X4MnE0F3JclMsaecIQO4oU76FCArJkrxP97rTsomfUUkN6',
    4,
    760
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'joaoforno',
    'joao@chef-xp.local',
    '$2b$10$ybR5NV4X4MnE0F3JclMsaecIQO4oU76FCArJkrxP97rTsomfUUkN6',
    2,
    210
  )
ON CONFLICT (email) DO UPDATE SET
  level = EXCLUDED.level,
  xp = EXCLUDED.xp,
  username = EXCLUDED.username,
  password_hash = EXCLUDED.password_hash;

INSERT INTO recipes (id, author_id, title, description, ingredients, cook_time_min, difficulty, xp_reward, likes_count, created_at)
VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    'Bacalhau à Brás express',
    'Clássico português em versão rápida para noite de semana. Crocante, cremoso e confort food total.',
    '400g bacalhau desfiado\n2 cebolas\n3 ovos\nbatata palha\nazeite\nsalsinha',
    35,
    'medio',
    40,
    28,
    now() - interval '2 hours'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'Bowl de quinoa e legumes assados',
    'Almoço saudável com crocância e molho de iogurte e limão.',
    '1 chávena quinoa\nabóbora\nbrócolos\ngrão-de-bico\niogurte grego\nlimão',
    40,
    'facil',
    30,
    17,
    now() - interval '5 hours'
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '44444444-4444-4444-4444-444444444444',
    'Pão de banana sem açúcar',
    'Perfeito para o pequeno-almoço. Doce natural da banana e canela.',
    '3 bananas\n2 ovos\nfarinha de aveia\ncanela\nfermento\nnozes',
    55,
    'facil',
    25,
    41,
    now() - interval '1 day'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '11111111-1111-1111-1111-111111111111',
    'Risotto de cogumelos',
    'Cremoso, aromático e ideal para impressionar sem stress.',
    'arroz arborio\ncogumelos mistos\ncaldo de legumes\nvinho branco\nparmesão\nmanteiga',
    45,
    'dificil',
    60,
    12,
    now() - interval '30 minutes'
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '33333333-3333-3333-3333-333333333333',
    'Salada de grão com atum',
    'Refeição fresca em 15 minutos. Ideal para meal prep.',
    '1 lata grão\n1 lata atum\ntomate cherry\npepino\nazeite\noreganos',
    15,
    'facil',
    20,
    9,
    now() - interval '3 days'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO challenges (id, title, description, xp_reward, ends_at, created_at)
VALUES
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Semana sem frituras',
    'Publica 3 refeições saudáveis sem fritar nada. Foco em forno, vapor e grelhador.',
    150,
    now() + interval '5 days',
    now() - interval '2 days'
  ),
  (
    '99999999-9999-9999-9999-999999999999',
    'Clássicos portugueses',
    'Reinventa um prato típico português com um twist moderno e partilha no feed.',
    200,
    now() + interval '9 days',
    now() - interval '1 day'
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    'Desafio 20 minutos',
    'Cozinha uma receita completa em 20 minutos ou menos. Cronometra e prova!',
    100,
    now() + interval '3 days',
    now() - interval '6 hours'
  )
ON CONFLICT (id) DO NOTHING;
