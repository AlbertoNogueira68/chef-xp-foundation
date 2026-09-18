-- 010: as fotografias da Google que ficaram guardadas como endereço.
--
-- Até aqui, uma conta criada pelo SSO guardava em `photo_url` o endereço que
-- a Google manda no `id_token` — um `https://lh3.googleusercontent.com/…`.
-- Isso nunca chegou a funcionar em produção: a CSP desta app tem `imgSrc` em
-- `'self'`, portanto o browser recusa-se a carregar a imagem. Em
-- desenvolvimento a CSP está desligada, e por isso a coisa parecia bem.
--
-- Agora a fotografia é descarregada uma vez e guardada em `/uploads`, como
-- todas as outras. Estas linhas ficam a nulo para serem adotadas no próximo
-- início de sessão com a Google — nenhuma fotografia se perde, porque a
-- Google continua a mandá-la em cada `id_token`.
--
-- Só as da Google. As do `images.unsplash.com` são do seed de demonstração e
-- a CSP deixa-as passar de propósito.

UPDATE users
   SET photo_url = NULL,
       updated_at = now()
 WHERE photo_url LIKE '%googleusercontent.com%';
