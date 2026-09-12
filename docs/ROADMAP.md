# Roadmap

Estado do produto face ao que o README promete, e a ordem por que o resto vai
ser feito. Atualizar este ficheiro faz parte de fechar cada ponto.

## Feito

| Área | Detalhe |
| --- | --- |
| Autenticação | Email/password, cookie HttpOnly, CSRF double-submit, bcrypt, Google OAuth |
| XP | Livro-razão `xp_events` idempotente, curva de níveis pura e testada, badges derivadas |
| Aprendizagem | Currículo no servidor, gabarito nunca sai do servidor, corações, meta diária, streak no fuso do utilizador |
| Missões | Ciclo completo `start → step → rescue → checkpoint → complete/abandon`, temporizadores, wake lock, voz, câmara |
| Feed social | Publicar receita com foto validada por bytes, gostos, comentários, seguir, três vistas |
| Perfil | XP, nível, streak, badges, separadores Cozinhados / Receitas / Atividade |
| Pesquisa | Query e filtros (dificuldade, tempo) aplicados pela API |
| Infra | Migrations idempotentes, Docker dev/prod, CSP e hardening, CI com lint, tipos, testes e build |

## Por fazer, por ordem

### 1. Desafios de ponta a ponta

Hoje existe só `GET /api/challenges`: um mural que não se pode usar. Falta
participar com uma receita, ver quem participou e receber o XP do desafio.

- [x] `challenge_entries` com uma participação por utilizador e por desafio
- [x] `GET /api/challenges` com contagem de participações e a minha entrada
- [x] `GET /api/challenges/:id` com a lista de participações
- [x] `POST /api/challenges/:id/entries` — submeter uma receita própria, XP idempotente
- [x] `DELETE /api/challenges/:id/entries` — retirar a participação
- [x] Regras de entrada como módulo puro e testado (`server/domain/challenges.js`)
- [x] Cartão com ação de participar, escolha de receita e galeria de participações

### 2. Ecrãs em falta para endpoints que já existem

- [x] Detalhe de receita (`/recipe/:id`) com ingredientes, gostos e comentários
- [x] Perfil público de outro chef (`/chef/:id`), com seguir e reencaminhamento
      para `/profile` quando é o próprio
- [x] Editar perfil e definições: nome, fotografia, fuso e meta diária
- [x] Partilhar o perfil (folha de partilha do sistema, ou copiar o link)
- [x] Ligações a partir do feed, da pesquisa e dos comentários

### 3. Gerir a própria receita

- [x] `PATCH /api/recipes/:id` e `DELETE /api/recipes/:id`, só para o autor
- [x] Apagar revoga o XP da publicação (`revokeXp` no livro-razão)
- [x] Menu de editar e apagar no feed e no detalhe, só para o autor

### 4. Testes de integração — *a seguir*

Hoje só há testes de domínio puro. Falta cobrir o que o júri vai perguntar:

- [ ] Auth: registo, login, CSRF, cookie, 401
- [ ] Idempotência do XP por rota, não só no módulo
- [ ] Upload de imagens: assinatura de ficheiro inválida é recusada
- [ ] Desafios: participação duplicada, desafio terminado, receita de outro autor

### 5. Notificações

- [ ] Tabela `notifications` alimentada por gostos, comentários e novos seguidores
- [ ] `GET /api/notifications` e marcação de lidas
- [ ] Indicador na navegação

### 6. Rankings

- [ ] Leaderboard semanal e global a partir de `xp_events`, sem contadores novos
- [ ] Ranking por desafio

### 7. Conteúdo do currículo

Só existe a Unidade 1 (segurança, faca, mise en place): 6 lições, 5 missões,
21 competências.

- [ ] Unidade 2 — calor: pré-aquecer, selar, refogar
- [ ] Unidade 3 — tempero e provar
- [ ] Missões novas para cada unidade

### 8. Conta

- [ ] Recuperação de password
- [ ] Verificação de email
- [ ] Apagar conta e exportar dados (RGPD)

## Listas de seguidores

- [ ] Ecrã de seguidores e de seguidos a partir dos contadores que já existem
