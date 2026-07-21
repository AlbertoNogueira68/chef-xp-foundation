# ChefXP

> Plataforma social gamificada para quem cozinha.
> Projeto Final de Licenciatura.

ChefXP incentiva os utilizadores a cozinhar mais, descobrir novas receitas
e desenvolver hábitos alimentares mais saudáveis através de um sistema de
níveis, XP, desafios e interação social.

---

## MVP

Esta fase entrega **apenas a fundação** da aplicação:

- Configuração e estrutura de pastas
- Sistema de routing (público / privado)
- Layout com bottom navigation
- Autenticação (email/password + Google) e proteção de rotas
- Criação automática do registo de utilizador na base de dados
- Camada de acesso a dados abstraída (Data Provider substituível)

Fora de âmbito no MVP: receitas, XP real, desafios, comentários, likes,
notificações, upload de fotos, pesquisa.

---

## Stack

- **React 19** + **TypeScript** + **Vite**
- **TanStack Start** (SSR/roteamento file-based, equivalente moderno a React Router v7)
- **TanStack Query v5** (cache e estado servidor)
- **React Hook Form** + **Zod** (formulários e validação)
- **Tailwind CSS v4** + **shadcn/ui** (design system)
- **Lovable Cloud** (Auth + PostgreSQL + Storage) — provider **temporário**;
  substituível por backend próprio sem alterar a UI

### Migração futura planeada

O backend será substituído por **Node.js + TypeScript + Fastify + Prisma +
PostgreSQL** em **Docker**. Para minimizar alterações no frontend, toda a
comunicação passa por uma camada de repositórios (ver Arquitetura).

---

## Arquitetura

Camadas, de cima para baixo:

```text
UI  (routes + components)
     │  chamam apenas hooks
     ▼
Hooks  (wrappers React Query: useSignIn, useCurrentUser, …)
     │  chamam services
     ▼
Services  (regras de negócio, TypeScript puro)
     │  usam interfaces
     ▼
Repositories  (contratos: AuthRepository, UserRepository)
     │  implementados por
     ▼
Data Provider  (Lovable Cloud hoje; Fastify REST amanhã)
```

**Regra de ouro:** componentes React **nunca** importam
`@/integrations/supabase/*` nem fazem `fetch` direto. Tudo passa por
`services → repositories`. Trocar de provider = criar
`src/data/providers/rest/*` e reconfigurar `src/data/index.ts`.

---

## Estrutura de pastas

```text
src/
├── routes/                     # rotas TanStack file-based
│   ├── __root.tsx              # layout raiz + head + auth listener
│   ├── index.tsx               # landing pública
│   ├── auth.tsx                # login + registo
│   └── _authenticated/         # rotas protegidas
│       ├── route.tsx           # gate (redireciona para /auth)
│       ├── feed.tsx
│       ├── search.tsx
│       ├── publish.tsx
│       ├── challenges.tsx
│       └── profile.tsx
│
├── features/                   # arquitetura feature-first
│   ├── auth/
│   │   ├── components/         # LoginForm, RegisterForm
│   │   ├── hooks/              # useSignIn, useSignUp, useSignOut, useSignInWithGoogle
│   │   ├── services/           # authService
│   │   └── schemas.ts          # zod
│   ├── profile/                # userService + useCurrentUser
│   ├── feed/                   # placeholder
│   ├── recipes/                # placeholder
│   ├── search/                 # placeholder
│   ├── challenges/             # placeholder
│   └── xp/                     # placeholder
│
├── components/
│   ├── ui/                     # shadcn/ui
│   └── layout/                 # AppShell, BottomNav
│
├── data/                       # camada de dados
│   ├── contracts/              # interfaces + DTOs + erros de domínio
│   ├── providers/lovable/      # adapter atual (isola Supabase)
│   └── index.ts                # container: repositórios ativos
│
├── hooks/                      # hooks partilhados
├── lib/                        # utils
├── types/                      # tipos de domínio
└── styles.css                  # Tailwind v4 + tokens do tema
```

Aliases: `@/features`, `@/components`, `@/hooks`, `@/data`, `@/lib`, `@/types`.

---

## Modelo de dados

Tabela `public.users` (equivalente ao "profiles" no idioma Supabase, mas com
nomenclatura agnóstica ao provider):

| coluna       | tipo         | notas                                    |
| ------------ | ------------ | ---------------------------------------- |
| `id`         | uuid PK      | FK para `auth.users(id)`                 |
| `username`   | text unique  | derivado do email no signup              |
| `email`      | text         |                                          |
| `photo_url`  | text         | nullable                                 |
| `level`      | int          | default `1`                              |
| `xp`         | int          | default `0`                              |
| `created_at` | timestamptz  | default `now()`                          |
| `updated_at` | timestamptz  | mantido por trigger                      |

RLS ativo: qualquer autenticado consegue ler; apenas o próprio pode atualizar.
Trigger `on_auth_user_created` cria automaticamente o registo após o signup.

---

## Executar localmente

Pré-requisitos: **Node.js 20+** e **npm** (ou **bun**).

```bash
git clone <this-repository>
cd <repository>
npm install
npm run dev
```

Variáveis de ambiente (`.env`, geridas pelo Lovable Cloud enquanto usado):

```env
VITE_SUPABASE_URL="..."
VITE_SUPABASE_PUBLISHABLE_KEY="..."
SUPABASE_URL="..."
SUPABASE_PUBLISHABLE_KEY="..."
```

Scripts:

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção
- `npm run lint` — ESLint
- `npm run format` — Prettier

---

## Convenções de desenvolvimento

- **Feature-first**: cada funcionalidade contém apenas o que lhe pertence
  (`components/`, `hooks/`, `services/`, `schemas.ts`).
- **UI ≠ infra**: nenhum componente/hook importa clientes de rede/DB.
- **DTOs em camelCase**: mappers isolam o snake_case do Postgres.
- **Tipagem forte**: `strict: true`, sem `any` implícito, Zod nas fronteiras.
- **Imports por alias** (`@/...`), nunca caminhos relativos longos.
- **Ficheiros pequenos** e componentes reutilizáveis; extrair quando >200 LOC.
- **Design system**: cores/tokens vivem em `src/styles.css`; nada de
  `text-white`/`bg-[#...]` hardcoded.
- **Formatação**: Prettier + ESLint antes de commit.

---

## Estratégia de evolução

1. **Continuar features** sobre esta base (receitas, XP, desafios, feed).
2. **Migrar backend** quando o MVP estabilizar:
   - Criar API em Node.js + Fastify + Prisma + PostgreSQL (Docker).
   - Implementar `RestAuthRepository` e `RestUserRepository` em
     `src/data/providers/rest/` respeitando as interfaces existentes.
   - Trocar as duas linhas em `src/data/index.ts` para apontar aos novos
     repositórios.
   - Nenhum componente, hook ou service precisa de mudar.
3. **Deploy**: `docker-compose` para API + Postgres; frontend continua
   estático (Vite build) servido em qualquer CDN.

---

## Licença

Projeto académico. Todos os direitos reservados.
