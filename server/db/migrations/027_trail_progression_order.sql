-- 027: os trilhos por ordem de dificuldade, do mais fácil para o mais difícil
--
-- Quem usa isto são estudantes universitários, a maioria sem experiência
-- nenhuma de cozinha. A lista tinha o italiano — 25 horas, massa fresca,
-- risotto e fermentação — logo a seguir ao curso base, e o trilho de cozinha
-- de estudante, que é o mais barato e o mais simples, em quinto lugar.
--
-- A ordem passa a ser uma progressão: os três trilhos de nível principiante
-- primeiro, com o de estudante à cabeça, depois os intermédios por peso
-- crescente, e o italiano no fim, onde o conteúdo dele o põe.
--
-- `difficulty` também se acerta: o italiano estava marcado como
-- `intermediate` ao lado de trilhos com um terço das horas.

UPDATE trails SET order_index = 1, difficulty = 'beginner'     WHERE id = 'university';
UPDATE trails SET order_index = 2, difficulty = 'beginner'     WHERE id = 'healthy';
UPDATE trails SET order_index = 3, difficulty = 'beginner'     WHERE id = 'gymbro';
UPDATE trails SET order_index = 4, difficulty = 'intermediate' WHERE id = 'portuguese';
UPDATE trails SET order_index = 5, difficulty = 'intermediate' WHERE id = 'vegan';
UPDATE trails SET order_index = 6, difficulty = 'intermediate' WHERE id = 'mexican';
UPDATE trails SET order_index = 7, difficulty = 'intermediate' WHERE id = 'japanese';
UPDATE trails SET order_index = 8, difficulty = 'advanced'     WHERE id = 'italian';

-- `main-course` fica em 0: é o pré-requisito de todos os outros.
UPDATE trails SET order_index = 0, difficulty = 'beginner' WHERE id = 'main-course';

-- O italiano começava em massa fresca amassada e esticada à mão, e a seguir
-- pedia massa de pizza: para quem nunca cozinhou, a primeira coisa que fazia
-- era a mais difícil do trilho. O currículo passa a abrir em massa seca — água
-- salgada, água de cozedura e acabar na frigideira — e a descrição acompanha.
UPDATE trails
   SET description = 'Dried pasta done properly, the sauces, fresh pasta by hand, risotto and pizza.'
 WHERE id = 'italian';

-- O mesmo problema no português: a primeira receita era bacalhau com natas, que
-- exige um dia inteiro de demolha antes de se poder começar e é a entrada mais
-- caras de todos os trilhos. Passa a abrir na sopa de legumes — batata, água e
-- o que estiver no frigorífico.
UPDATE trails
   SET description = 'Soup the way every Portuguese kitchen makes it, cod, refogado, saucy rice and pork with clams.'
 WHERE id = 'portuguese';
