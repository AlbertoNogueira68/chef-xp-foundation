# ChefXP

Plataforma social gamificada para quem cozinha. Projeto Final de Licenciatura.

Export Lovable convertido para stack própria (Vite SPA + Express + PostgreSQL). Sem runtime Lovable/Supabase.

## MVP

- Landing pública + autenticação email/password
- Rotas protegidas com bottom navigation
- Perfil de utilizador (username, email, level, xp)
- Feed de receitas, pesquisa, publicação e desafios (dados seed + API)

Fora de âmbito: Google OAuth, upload de fotos, likes persistentes por utilizador, ranking global.

## Stack

- React 19 + TypeScript + Vite + React Router
- Tailwind CSS v4 (`@tailwindcss/vite`, local)
- TanStack Query + React Hook Form + Zod + shadcn/ui
- Express (ESM) + PostgreSQL 15 (`pg`, SQL-first)
- JWT HttpOnly cookie + CSRF double-submit + bcrypt
- Docker Compose (dev/prod)

## Pré-requisitos

- Node.js 20+
- Docker / Docker Compose (recomendado para Postgres)

## Setup local

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d postgres
npm install
npm run db:migrate
npm run dev:all
```

- Frontend: http://localhost:5173
- API: http://localhost:3010
- Health: http://localhost:3010/api/health

## Setup Docker (app + Postgres)

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

Vite fica em `:5173`, API em `:3010`.

## Credenciais de seed (dev only)

| Email | Password | Notas |
| --- | --- | --- |
| `demo@chef-xp.local` | `chef123` | chefdemo · nível 3 |
| `sous@chef-xp.local` | `chef123` | souschef |
| `maria@chef-xp.local` | `chef123` | mariacozinha |
| `joao@chef-xp.local` | `chef123` | joaoforno |

Seed inclui 5 receitas e 3 desafios. Se a base já existir:

```bash
npm run db:migrate
npm run db:seed
```

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev:all` | Vite + Express em paralelo |
| `npm run build` | Build do frontend |
| `npm start` | Serve API (+ `dist` em produção) |
| `npm run db:migrate` | Aplica migrations SQL |
| `npm run db:seed` | Popula dados de demonstração |
| `npm run test:hardening` | Build + bloqueia CDNs proibidas |
| `npm run lint` | ESLint |

## Produção

```bash
# criar .env.prod a partir de .env.example (JWT_SECRET >= 32 chars)
docker compose -f docker-compose.prod.yml up --build -d
# ou
docker build -t chef-xp:local .
```

Em produção o Express serve `dist/` e a API em `/api` (same-origin).

## Arquitetura

```text
UI → hooks → services → repositories → Express API → PostgreSQL
```

Trocar provider = editar `src/data/index.ts`. O cliente usa `src/services/api.ts` (credentials + CSRF).
