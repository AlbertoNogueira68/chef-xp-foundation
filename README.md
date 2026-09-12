# ChefXP

Plataforma social gamificada para quem cozinha. Projeto Final de Licenciatura.

Stack própria (Vite SPA + Express + PostgreSQL). Sem runtime Lovable/Supabase.

## O que a aplicação faz

- **Autenticação** por email/password, com sessão em cookie HttpOnly e proteção CSRF.
- **Percurso de aprendizagem** ao estilo Duolingo: unidades, lições diárias com
  preparação e quiz, corações, XP, streak e meta diária. Toda a progressão vive
  no servidor — o browser não guarda nem decide nada.
- **Feed social**: publicação de receitas com fotografia, gostos, comentários,
  seguidores, e três vistas (Recentes, A seguir, Em alta).
- **Perfil** com XP, nível, streak, conquistas e estatísticas, todas derivadas de
  dados reais.
- **Desafios** da comunidade: participa-se com uma receita própria, vê-se quem
  participou, e o XP do desafio é pago uma vez por desafio.

## Stack

- React 19 + TypeScript + Vite + React Router
- Tailwind CSS v4 (`@tailwindcss/vite`, local)
- TanStack Query + React Hook Form + Zod + shadcn/ui
- Express 5 (ESM) + PostgreSQL 15 (`pg`, SQL-first, sem ORM)
- JWT em cookie HttpOnly + CSRF double-submit + bcrypt
- Docker Compose (dev/prod)
- Testes com o runner nativo do Node (`node --test`), CI no GitHub Actions

## Pré-requisitos

- Node.js 20+ (o CI corre em 22)
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
| `npm test` | Testes do domínio (`node --test`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Build do frontend |
| `npm start` | Serve a API (+ `dist` em produção) |
| `npm run db:migrate` | Aplica as migrations SQL |
| `npm run db:seed` | Popula dados de demonstração |
| `npm run test:hardening` | Build + bloqueia CDNs proibidas |
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

**O streak é calculado no fuso do utilizador**, a partir de `daily_activity`, e
só quebra depois de um dia civil inteiro sem atividade.

**As imagens são validadas pelos bytes, não pelo que o cliente diz.** O browser
redimensiona a fotografia num `<canvas>` antes de a enviar (o que dispensa
`sharp` no servidor), e o servidor confirma a assinatura do ficheiro antes de o
gravar com um nome UUID que só ele escolhe.

## Base de dados

Migrations em `server/db/migrations/`, aplicadas no arranque e por
`npm run db:migrate`. São idempotentes — o CI corre-as duas vezes de propósito.

Tabelas principais: `users`, `recipes`, `challenges`, `recipe_likes`, `follows`,
`comments`, `lesson_progress`, `daily_activity`, `xp_events`,
`challenge_entries`.

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
