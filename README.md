# ChefXP

Plataforma social gamificada para quem cozinha. Projeto Final de Licenciatura.

Stack própria (Vite SPA + Express + PostgreSQL). Sem runtime Lovable/Supabase.

## O que a aplicação faz

- **Autenticação** por email/password, com sessão em cookie HttpOnly e proteção CSRF.
- **Percurso de aprendizagem** ao estilo Duolingo: cinco unidades, 19 lições
  com preparação e quiz, corações, XP, streak e meta diária. Toda a progressão
  vive no servidor — o browser não guarda nem decide nada.
- **Missões de cozinha**: cada unidade acaba num prato a sério, com passos
  cronometrados, socorros e foto de verificação.
- **Feed social**: publicação de receitas com fotografia, gostos, comentários,
  seguidores, e três vistas (Recentes, A seguir, Em alta).
- **Perfil** com XP, nível, streak, conquistas e estatísticas, todas derivadas de
  dados reais — próprio (com definições: nome, fotografia, fuso e meta diária) e
  público, o de qualquer outro chef.
- **Detalhe de receita** com ingredientes, gostos e comentários, num link que se
  pode partilhar.
- **Desafios** da comunidade: participa-se com uma receita própria, vê-se quem
  participou, e o XP do desafio é pago uma vez por desafio.
- **Notificações** de gostos, comentários e seguidores novos, no sino do
  cabeçalho.
- **Rankings** semanal e global, e cada desafio ordenado por gostos.
- **A tua conta é tua**: exportar todos os dados num ficheiro e apagar a conta
  de vez, sem cópias nossas.

## Stack

- React 19 + TypeScript + Vite + React Router
- Tailwind CSS v4 (`@tailwindcss/vite`, local)
- TanStack Query + React Hook Form + Zod + shadcn/ui
- Express 5 (ESM) + PostgreSQL 15 (`pg`, SQL-first, sem ORM)
- JWT em cookie HttpOnly + CSRF double-submit + bcrypt
- Docker Compose (dev/prod)
- Testes com o runner nativo do Node (`node --test`): domínio puro e
  integração contra a API e o Postgres reais. CI no GitHub Actions

## Pré-requisitos

- Node.js 22.14+ — exigido pelo Vitest e pelo jsdom, e declarado em `engines`
- Docker / Docker Compose (recomendado para o Postgres)

## Setup local

```bash
cp .env.example .env
# gera um segredo real — o .env NUNCA vai para o git
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env

docker compose -f docker-compose.dev.yml up -d postgres
npm install
npm run db:migrate
npm run db:seed
npm run dev:all
```

- Frontend: http://localhost:5173
- API: http://localhost:3010
- Health: http://localhost:3010/api/health

## Credenciais de seed (só em desenvolvimento)

| Email | Password | Notas |
| --- | --- | --- |
| `demo@chef-xp.local` | `chef123` | chefdemo · nível 3 |
| `sous@chef-xp.local` | `chef123` | souschef |
| `maria@chef-xp.local` | `chef123` | mariacozinha · nível 5 |
| `joao@chef-xp.local` | `chef123` | joaoforno |

O seed inclui 6 receitas com fotografia, gostos e comentários reais, relações de
seguidor e 3 desafios.

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev:all` | Vite + Express em paralelo |
| `npm run verify` | lint + tipos + testes + build (o mesmo que o CI corre) |
| `npm test` | Testes do servidor (`node --test`) |
| `npm run test:unit` | Só o domínio puro, sem base de dados |
| `npm run test:integration` | API contra um Postgres real |
| `npm run test:ui` | Interface (Vitest + Testing Library) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Build do frontend |
| `npm start` | Serve a API (+ `dist` em produção) |
| `npm run db:migrate` | Aplica as migrations SQL |
| `npm run db:seed` | Popula dados de demonstração |
| `npm run test:hardening` | Build + bloqueia CDNs proibidas |
| `npm run check:responsive` | Mede a app em 320–414px (ver `docs/RESPONSIVIDADE.md`) |
| `npm run lint` | ESLint |

## Arquitetura

```text
UI → hooks → services → API Express → PostgreSQL
```

Autenticação e utilizadores passam ainda por um `Repository` explícito
(`src/data/`), que permite trocar o provider num só ficheiro. Os restantes
domínios (receitas, desafios, aprendizagem) falam com a API através dos seus
serviços em `src/features/*/services/`.

### Decisões que vale a pena conhecer

**O XP é um livro-razão, não um contador.** Nenhuma parte do código faz
`xp = xp + n`. Cada ganho é uma linha em `xp_events` com
`UNIQUE (user_id, source, source_ref)`, e `users.xp` é sempre a soma dessas
linhas. Repetir um pedido não paga duas vezes, e a origem de cada ponto é
auditável.

**A curva de níveis vive num só sítio.** `server/domain/xp.js` é um módulo puro,
sem I/O, testado com `node --test`. O frontend recebe `nextLevelXp` já calculado
e nunca reimplementa a fórmula.

**O gabarito nunca chega ao browser.** O currículo está em
`shared/curriculum.json`, lido apenas pelo servidor. A lição é enviada sem
`correctAnswer`; cada resposta é validada em
`POST /api/learning/lessons/:id/answer`, e no fim o servidor volta a corrigir
tudo antes de atribuir XP.

**Participar num desafio paga uma vez, não por submissão.** A entrada é um
evento de XP com `source_ref = challengeId`, portanto retirar a participação e
voltar a entrar não volta a pagar. O evento fica no livro-razão mesmo depois de
a participação ser retirada: o livro-razão regista o que aconteceu, não o que é
verdade agora.

**Apagar uma receita leva o XP atrás.** Gostos, comentários e participações em
desafios caem por `ON DELETE CASCADE`, mas `xp_events.source_ref` é texto e não
uma chave estrangeira: sem o `revokeXp` explícito, publicar e apagar em ciclo
somava XP por receitas que já não existem. A revogação desconta também o dia em
que o ponto foi ganho, para `daily_activity` continuar a bater certo com o
livro-razão.

**Uma notificação não guarda texto.** Guarda quem fez, o quê e sobre o quê; a
frase é montada na interface. Quem mudar de nome não fica com notificações a
dizer o nome antigo. Gostar e seguir dão uma notificação por pessoa, não uma
por clique — índices parciais únicos, não um `if` na rota — e o `CHECK
(user_id <> actor_id)` garante que ninguém é notificado de si próprio.

**O ranking não tem tabela própria.** O global é a soma que já está em
`users.xp` — ou seja, o livro-razão — e o semanal agrega `daily_activity`, que
existe desde o streak. Usa `RANK()` e não `ROW_NUMBER()`: quem empata fica na
mesma posição. Um ranking com contadores próprios seria mais uma verdade para
manter sincronizada com a primeira.

**Apagar a conta apaga mesmo.** Não há coluna `deleted_at`: a linha de `users`
desaparece e as chaves estrangeiras em cascata levam receitas, comentários,
gostos, missões, progresso e livro-razão consigo — incluindo as notificações
que essa pessoa causou a outras. Antes disso, a exportação devolve o conteúdo
das tabelas e não um resumo, porque é isso que o direito de portabilidade
significa.

**O streak é calculado no fuso do utilizador**, a partir de `daily_activity`, e
só quebra depois de um dia civil inteiro sem atividade.

**As imagens são validadas pelos bytes, não pelo que o cliente diz.** O browser
redimensiona a fotografia num `<canvas>` antes de a enviar (o que dispensa
`sharp` no servidor), e o servidor confirma a assinatura do ficheiro antes de o
gravar com um nome UUID que só ele escolhe.

## Responsividade

A aplicação é de telemóvel e tem uma regra escrita para isso, em
[`docs/RESPONSIVIDADE.md`](docs/RESPONSIVIDADE.md): entre 320 e 414 px, nenhum
ecrã tem scroll horizontal, nada é cortado na margem, e tudo o que se carrega
tem pelo menos 32 px de altura.

A regra é verificada e não prometida — `npm run check:responsive` abre a
aplicação num browser e mede as sete rotas e os quatro diálogos em quatro
larguras. O CI corre-a contra a build de produção.

## Testes

Três camadas:

- **Domínio** (`server/domain/*.test.js`): as regras puras — curva de XP,
  streaks, validação do currículo, quem pode entrar num desafio. Sem I/O,
  correm em milissegundos.
- **Integração** (`server/test/*.integration.test.js`): a API inteira numa
  porta efémera, contra um Postgres real. É aqui que se prova o CSRF, o cookie
  de sessão, os códigos de estado, as transações e a idempotência do
  livro-razão — coisas que um teste de função pura não alcança.
- **Interface** (`src/**/*.test.tsx`, com Vitest): o que o browser faz com a
  cache, com os formulários e com os erros da API. Não usa o runner do Node
  porque ele não transforma TSX; o Vitest reutiliza a configuração do Vite que
  a aplicação já tem.

Os testes de integração precisam de `DATABASE_URL`. Sem ela saltam com a razão
à vista, para `npm test` funcionar em qualquer clone; no CI a base existe
sempre, portanto correm lá a sério.

**Apontam para uma base de teste, não para a de desenvolvimento.** Cada teste
começa com um `TRUNCATE` a todas as tabelas — apontá-los para a base onde estão
os dados de demonstração apaga-os. O harness recusa-se a arrancar se o nome da
base não contiver `test`.

```bash
docker compose -f docker-compose.dev.yml up -d postgres
createdb chef_xp_test   # ou: psql -c 'CREATE DATABASE chef_xp_test'
DATABASE_URL=postgresql://chef:chefdev@localhost:5432/chef_xp_test npm test
```

## Tamanho do que chega ao telemóvel

As rotas são carregadas à medida que se visitam, e as bibliotecas ficam em
ficheiros próprios para sobreviverem na cache entre deploys. Medido na build de
produção, a 390 px:

| | Antes | Agora |
| --- | --- | --- |
| Landing | 820 kB | 515 kB |
| Percurso completo até aos desafios | 820 kB | 704 kB |

O percurso de aprendizagem é a rota mais pesada (67 kB) porque arrasta o leitor
de lições e o ecrã de missões — e agora só quem lá vai é que a paga.

## Base de dados

Migrations em `server/db/migrations/`, aplicadas no arranque e por
`npm run db:migrate`. São idempotentes — o CI corre-as duas vezes de propósito.

Tabelas principais: `users`, `recipes`, `challenges`, `recipe_likes`, `follows`,
`comments`, `lesson_progress`, `daily_activity`, `xp_events`,
`challenge_entries`, `notifications`.

## Produção

```bash
# criar .env.prod a partir do .env.example (JWT_SECRET >= 32 chars, aleatório)
docker compose -f docker-compose.prod.yml up --build -d
```

Em produção o Express serve `dist/` e a API em `/api` (same-origin), o CORS está
fechado à `FRONTEND_URL`, e os cookies usam o prefixo `__Host-` com
`SameSite=strict` — o que exige HTTPS. Para demonstrar uma build de produção em
`http://localhost`, define `COOKIE_SECURE=false`.

As imagens carregadas ficam em `/app/uploads`, montado como volume.
