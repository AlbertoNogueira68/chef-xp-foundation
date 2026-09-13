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

### 4. Testes de integração

55 testes contra a API e um Postgres reais, em `server/test/`.

- [x] Harness: app numa porta efémera, base limpa por teste, cliente com
      cookies e CSRF (`server/test/helpers.js`)
- [x] Auth: registo, login, cookie HttpOnly, double-submit, 401, logout
- [x] Receitas: propriedade, edição parcial, apagar com revogação de XP
- [x] Idempotência do XP por rota (gostos, lições, desafios, ciclo publicar/apagar)
- [x] Imagens: assinatura de ficheiro, nome escolhido pelo servidor, URL externo recusado
- [x] Desafios: duplicados, desafio fechado, receita de outro autor, sair e voltar
- [x] Aprendizagem: o gabarito não sai do servidor, lições trancadas, correção no servidor
- [x] CI corre-os contra Postgres; sem `DATABASE_URL` saltam com a razão à vista

### 5. Notificações

- [x] `notifications` alimentada por gostos, comentários e novos seguidores
- [x] Gostar e seguir dão uma notificação por pessoa, não uma por clique
      (índices parciais únicos)
- [x] Ninguém é notificado de si próprio — regra do esquema, não de um `if`
- [x] `GET /api/notifications`, `/unread-count`, `POST /read` e `/:id/read`
- [x] Sino do cabeçalho com contagem, caixa e marcação ao abrir
- [x] 13 testes de integração

### 6. Rankings

- [x] `GET /api/leaderboard?scope=weekly|global`, sem contadores novos: sai do
      livro-razão e de `daily_activity`
- [x] `RANK()` com empates — dois primeiros são os dois primeiros
- [x] A minha posição vem à parte, para quem fica fora do top
- [x] Participações de um desafio ordenadas por gostos
- [x] Separador Ranking com medalhas e a minha linha destacada
- [x] 7 testes de integração

### 7. Conteúdo do currículo

As cinco missões apontavam para `unit-2` a `unit-5`, que nunca tinham sido
escritas: 13 das 21 competências eram praticadas em missões que nenhuma lição
destrancava.

- [x] Unidade 2 — o lume: pré-aquecer, níveis, gordura, douramento (4 lições)
- [x] Unidade 3 — ovos e lume brando, e o momento do sal (3 lições)
- [x] Unidade 4 — água salgada, rácio do arroz, al dente (3 lições)
- [x] Unidade 5 — sequenciar, temperar em camadas, empratar (3 lições)
- [x] As cinco missões que já existiam ficam ligadas às suas unidades
- [x] Teste que joga as 19 lições de ponta a ponta com as respostas do
      currículo — protege o conteúdo, não o código

### 8. Conta

- [x] Exportar os dados: `GET /api/users/me/export` devolve o conteúdo das
      tabelas, livro-razão incluído, num ficheiro
- [x] Apagar a conta: `DELETE /api/users/me`, com o nome escrito à mão e a
      password quando a conta tem uma. A linha desaparece e as cascatas levam
      tudo — não há `deleted_at` nenhum
- [ ] Recuperação de password — **bloqueado**: precisa de envio de email, e não
      existe SMTP nem cliente de email no projeto (procurado em `package.json`,
      `.env.example`, `docker-compose` e no código)
- [ ] Verificação de email — bloqueado pelo mesmo motivo

## Listas de seguidores

- [x] `GET /api/users/:id/followers` e `/following`
- [x] Diálogo com as duas listas, aberto pelo contador do perfil
- [x] Cada linha mostra se sou eu que sigo aquela pessoa — nunca o estado de
      quem estou a visitar

## O que falta

Só o envio de email (recuperação de password e verificação de conta). Tudo o
resto deste plano está feito.
