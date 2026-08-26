-- Seed de demonstração (dev).
-- Password de todos os utilizadores: chef123
--
-- Os níveis batem certo com a curva em server/domain/xp.js
-- (limiares: nv2=100, nv3=250, nv4=450, nv5=700).

INSERT INTO users (id, username, email, password_hash, photo_url, level, xp)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'chefdemo',
    'demo@chef-xp.local',
    '$2b$10$ybR5NV4X4MnE0F3JclMsaecIQO4oU76FCArJkrxP97rTsomfUUkN6',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
    3,
    420
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'souschef',
    'sous@chef-xp.local',
    '$2b$10$ybR5NV4X4MnE0F3JclMsaecIQO4oU76FCArJkrxP97rTsomfUUkN6',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
    2,
    180
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'mariacozinha',
    'maria@chef-xp.local',
    '$2b$10$ybR5NV4X4MnE0F3JclMsaecIQO4oU76FCArJkrxP97rTsomfUUkN6',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    5,
    760
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'joaoforno',
    'joao@chef-xp.local',
    '$2b$10$ybR5NV4X4MnE0F3JclMsaecIQO4oU76FCArJkrxP97rTsomfUUkN6',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    2,
    210
  )
ON CONFLICT (email) DO UPDATE SET
  level = EXCLUDED.level,
  xp = EXCLUDED.xp,
  username = EXCLUDED.username,
  photo_url = EXCLUDED.photo_url,
  password_hash = EXCLUDED.password_hash;

-- O XP de seed precisa de existir no livro-razão, senão a primeira
-- recomputação (xp = SUM(xp_events)) apagava-o.
INSERT INTO xp_events (user_id, source, source_ref, amount)
SELECT id, 'legacy', 'baseline', xp FROM users WHERE xp > 0
ON CONFLICT (user_id, source, source_ref) DO NOTHING;

INSERT INTO recipes (id, author_id, title, description, ingredients, cook_time_min, difficulty, xp_reward, image_url, created_at)
VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    'Bacalhau à Brás express',
    'Clássico português em versão rápida para noite de semana. Crocante, cremoso e confort food total.',
    '400g bacalhau desfiado\n2 cebolas\n3 ovos\nbatata palha\nazeite\nsalsinha',
    35, 'medio', 40,
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=800&fit=crop',
    now() - interval '2 hours'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'Bowl de quinoa e legumes assados',
    'Almoço saudável com crocância e molho de iogurte e limão.',
    '1 chávena quinoa\nabóbora\nbrócolos\ngrão-de-bico\niogurte grego\nlimão',
    40, 'facil', 30,
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=800&fit=crop',
    now() - interval '5 hours'
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '44444444-4444-4444-4444-444444444444',
    'Pão de banana sem açúcar',
    'Perfeito para o pequeno-almoço. Doce natural da banana e canela.',
    '3 bananas\n2 ovos\nfarinha de aveia\ncanela\nfermento\nnozes',
    55, 'facil', 25,
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=800&fit=crop',
    now() - interval '1 day'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '11111111-1111-1111-1111-111111111111',
    'Risotto de cogumelos',
    'Cremoso, aromático e ideal para impressionar sem stress.',
    'arroz arborio\ncogumelos mistos\ncaldo de legumes\nvinho branco\nparmesão\nmanteiga',
    45, 'dificil', 60,
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=800&fit=crop',
    now() - interval '30 minutes'
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '33333333-3333-3333-3333-333333333333',
    'Salada de grão com atum',
    'Refeição fresca em 15 minutos. Ideal para meal prep.',
    '1 lata grão\n1 lata atum\ntomate cherry\npepino\nazeite\noreganos',
    15, 'facil', 20,
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=800&fit=crop',
    now() - interval '3 days'
  ),
  (
    'ffffffff-ffff-ffff-ffff-fffffffffffe',
    '22222222-2222-2222-2222-222222222222',
    'Tacos de frango crocante',
    'Textura irresistível com molho de iogurte picante e lima.',
    'peito de frango\ntortillas\nrepolho roxo\niogurte\nlima\npáprica',
    25, 'medio', 35,
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=800&fit=crop',
    now() - interval '8 hours'
  )
ON CONFLICT (id) DO NOTHING;

-- Gostos reais: cada linha tem dono, por isso a contagem é verificável
-- e o botão de gosto sabe se já gostaste.
INSERT INTO recipe_likes (user_id, recipe_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN recipes r
WHERE u.id <> r.author_id
  AND (abs(hashtext(u.id::text || r.id::text)) % 3) <> 0
ON CONFLICT DO NOTHING;

INSERT INTO follows (follower_id, followee_id)
VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

INSERT INTO comments (recipe_id, author_id, body)
SELECT r.id, u.id, c.body
FROM (VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Fiz ontem e a batata palha ficou mesmo crocante. Obrigado!'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Acrescentei azeitonas pretas e resultou muito bem.'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'O truque do caldo quente faz toda a diferença.'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Substituí as nozes por avelãs, ficou ótimo.')
) AS c(recipe_id, author_id, body)
JOIN recipes r ON r.id = c.recipe_id
JOIN users u ON u.id = c.author_id
ON CONFLICT DO NOTHING;

INSERT INTO challenges (id, title, description, xp_reward, image_url, ends_at, created_at)
VALUES
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Semana sem frituras',
    'Publica 3 refeições saudáveis sem fritar nada. Foco em forno, vapor e grelhador.',
    150,
    'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=500&fit=crop',
    now() + interval '5 days',
    now() - interval '2 days'
  ),
  (
    '99999999-9999-9999-9999-999999999999',
    'Clássicos portugueses',
    'Reinventa um prato típico português com um twist moderno e partilha no feed.',
    200,
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=500&fit=crop',
    now() + interval '9 days',
    now() - interval '1 day'
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    'Desafio 20 minutos',
    'Cozinha uma receita completa em 20 minutos ou menos. Cronometra e prova!',
    100,
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop',
    now() + interval '3 days',
    now() - interval '6 hours'
  )
ON CONFLICT (id) DO UPDATE SET image_url = EXCLUDED.image_url;
