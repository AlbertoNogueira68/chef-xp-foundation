# Roadmap

Estado do produto face ao que o README promete, e a ordem por que o resto vai
ser feito. Atualizar este ficheiro faz parte de fechar cada ponto.

## Feito

| Área         | Detalhe                                                                                                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação | Email/password, cookie HttpOnly, CSRF double-submit, bcrypt, Google OAuth                                                                                                                             |
| XP           | Livro-razão `xp_events` idempotente, curva de níveis pura e testada, badges derivadas                                                                                                                 |
| Aprendizagem | Currículo no servidor, gabarito nunca sai do servidor, corações, meta diária, streak no fuso do utilizador                                                                                            |
| Missões      | Ciclo completo `start → step → rescue → checkpoint → complete/abandon`, temporizadores, wake lock, voz, câmara                                                                                        |
| Feed social  | Publicar receita com foto validada por bytes, gostos, comentários, seguir, três vistas                                                                                                                |
| Perfil       | XP, nível, streak, badges, separadores Cozinhados / Receitas / Atividade                                                                                                                              |
| Pesquisa     | Query e filtros (dificuldade, tempo) aplicados pela API                                                                                                                                               |
| Email        | Recuperação de password e confirmação de endereço por SMTP, desligáveis                                                                                                                               |
| Infra        | Migrations idempotentes, Docker dev/prod, CSP e hardening, CI com lint, tipos, testes e build                                                                                                         |
| PWA          | App instalável, abre sem rede, cache por tipo de recurso, atualização com consentimento, `check:pwa` no CI                                                                                            |
| Offline      | Lições e fotografias de missões feitas sem rede ficam em fila (IndexedDB) no dispositivo e são enviadas por ordem quando a ligação volta, com aviso do resultado; verificado num Chrome a sério no CI |

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
- [x] Recuperação de password — desbloqueado: `nodemailer` por SMTP, com as
      credenciais em `SMTP_USER` / `SMTP_PASSWORD`
- [x] Verificação de email — a mesma mecânica, distinguida por `kind`

## Listas de seguidores

- [x] `GET /api/users/:id/followers` e `/following`
- [x] Diálogo com as duas listas, aberto pelo contador do perfil
- [x] Cada linha mostra se sou eu que sigo aquela pessoa — nunca o estado de
      quem estou a visitar

## Responsividade

- [x] Regra escrita em `docs/RESPONSIVIDADE.md`
- [x] `npm run check:responsive`: mede 13 ecrãs em 4 larguras, num browser
- [x] Corre no CI contra a build de produção
- [x] Os 112 alvos de toque pequenos da primeira medição, resolvidos em cinco
      alterações — todas em componentes base, nenhuma ecrã a ecrã

## Depois da análise geral

- [x] Testes de interface: 40 testes em 7 ficheiros, a cobrir a cache do feed,
      o PATCH parcial das definições, o sino, o ranking, o menu da receita e o
      cliente HTTP (CSRF, 401 e 403)
- [x] Bundle dividido por rota e por biblioteca: a landing passou de 820 kB
      para 515 kB
- [x] Os dois botões que não faziam nada: partilhar passou a partilhar, e o de
      mensagens saiu

## Email

Última coisa que faltava do plano. `auth_tokens` guarda o SHA-256 do token e
nunca o token; o de recuperação vale uma hora e serve uma vez, o de confirmação
vale um dia.

- [x] `nodemailer` por SMTP, com o transporte substituível (é o que permite
      testar os fluxos inteiros sem mandar correio a ninguém)
- [x] `POST /api/auth/forgot-password` — resposta igual exista ou não a conta,
      contas de SSO não recebem link, erro de envio fica no registo
- [x] `POST /api/auth/reset-password` — `FOR UPDATE` para o token não valer
      duas vezes em pedidos simultâneos; confirma o email de caminho
- [x] `POST /api/auth/verify-email/send` e `/verify-email`, este último sem
      exigir sessão e idempotente para o duplo clique
- [x] `GET /api/auth/providers` diz se a recuperação existe; sem SMTP o link
      não aparece no ecrã de entrada
- [x] Três ecrãs públicos: pedir, redefinir, confirmar
- [x] Aviso de "email por confirmar" nas definições, que informa e não tranca
- [x] 18 testes de integração, 20 de domínio e 7 de interface

## Fotografia de perfil da Google

- [x] Descarregada uma vez para `/uploads`, com os bytes validados, em vez de
      guardada como endereço — que a CSP de produção bloqueava
- [x] Também para quem já tinha conta local com o mesmo email, e não só para
      contas novas
- [x] Nunca substitui uma fotografia escolhida pelo utilizador
- [x] Lista de anfitriões obrigatória antes de qualquer pedido à rede, com
      testes para os endereços internos e para os domínios que só acabam
      parecidos
- [x] Migration 010 põe a nulo as que ficaram guardadas como endereço; são
      readotadas no início de sessão seguinte

## Moderação

Fora do plano original, e a primeira coisa que faltava a uma aplicação que
aloja conteúdo de terceiros: não havia denúncia, não havia bloqueio, e o dono
de uma receita não podia apagar um comentário na própria receita.

- [x] `reports` — receitas, comentários e contas na mesma rota; cinco motivos
      fechados; uma denúncia por pessoa e por alvo (índice único)
- [x] A denúncia sobrevive ao conteúdo: `subject_id` sem chave estrangeira, de
      propósito, como no livro-razão do XP
- [x] Apagar um comentário são três direitos — autor, dono da receita,
      moderador — numa função pura, e 403 deixou de ser 404
- [x] `user_blocks` bidirecional: feed, pesquisa, página de autor, comentários,
      sugestões, listas de seguidores, participações em desafios, cozinhados e
      sino, todos filtrados a partir de um só fragmento em `lib/blocks.js`
- [x] Bloquear desfaz os dois sentidos do seguir e limpa as notificações entre
      as duas pessoas; a lista nas definições é o caminho de volta
- [x] `users.role` e a fila em `/api/moderation/reports` — o papel lê-se da
      base a cada pedido, não do token; remover uma receita retira-lhe o XP

## Administração

- [x] Terceiro papel, numa escada (`user` → `moderator` → `admin`) escrita em
      duas funções puras, e não numa matriz de permissões por ação
- [x] Promover e despromover moderadores pela aplicação, com quatro recusas:
      o meu próprio papel, criar admins, despromover admins, papéis que não
      existem
- [x] `role_changes` — quem promoveu quem, e a partir de quê. A coluna `role`
      sozinha só diz o estado de agora
- [x] Números da plataforma somados na hora sobre as tabelas que já existem,
      sem contadores novos para manter sincronizados
- [x] Área `/admin` dentro da aplicação: a fila com o conteúdo ao lado, as
      contas com o que decide uma promoção, e os números. O moderador vê só a
      fila — a fila deixou de ser uma API que na prática ninguém trataria
- [x] `npm run role:set -- <email> <papel>`; o primeiro admin nasce na linha de
      comandos e nunca dentro da aplicação
- [x] Seed de desenvolvimento com um administrador e um moderador, para a área
      existir num clone acabado de arrancar
- [x] 24 testes de domínio, 37 de integração e 13 de interface

Fica de fora, dito e não escondido: suspender contas.

## O que falta

Nada deste plano. As duas linhas que estavam bloqueadas por não haver email
estão fechadas.
