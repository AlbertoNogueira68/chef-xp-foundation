
# ChefXP — Fundação (revista para migração futura)

Ajustes chave: tabela `users`, sem roles, camada de abstração de dados com **Data Provider swappable** (Lovable Cloud agora → Fastify/Prisma/Postgres depois), README profissional.

## 1. Modelo de dados

Migration única:

- `public.users`
  - `id uuid pk` (= `auth.users.id`, FK `on delete cascade`)
  - `username text unique not null`
  - `email text not null`
  - `photo_url text`
  - `level int not null default 1`
  - `xp int not null default 0`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- GRANTs a `authenticated` (+ `service_role`).
- RLS ON: `select/update` onde `auth.uid() = id`; `insert` onde `auth.uid() = id`.
- Trigger `handle_new_user` (SECURITY DEFINER) em `auth.users` → cria linha em `public.users` com username derivado do email.
- Trigger `set_updated_at` para manter `updated_at`.

Sem `user_roles`, sem `app_role`, sem `has_role`.

## 2. Camadas (Data Provider swappable)

```text
UI (routes + components)
  │  usa apenas
  ▼
Hooks  (React Query wrappers: useCurrentUser, useSignIn, …)
  │  chamam
  ▼
Services  (regras de negócio orquestrando repositórios; puros TS)
  │  usam
  ▼
Repositories  (interfaces por domínio: UserRepository, AuthRepository)
  │  implementadas por
  ▼
Data Provider  (adapter Lovable Cloud hoje; futuramente adapter Fastify REST)
```

Regras:
- **Componentes nunca importam** `@/integrations/supabase/*` nem `fetch` direto.
- Hooks só falam com **services**; services só falam com **repositórios** (interfaces).
- Troca futura = substituir apenas `src/data/providers/lovable/*` por `src/data/providers/rest/*` e reconfigurar o container.

### Estrutura de `src/data/`

```text
src/data/
├── contracts/                 # interfaces + DTOs (independentes de infra)
│   ├── AuthRepository.ts
│   ├── UserRepository.ts
│   └── errors.ts              # AppError, NotFoundError, AuthError…
├── providers/
│   └── lovable/               # adapter atual (Supabase client isolado aqui)
│       ├── client.ts          # único sítio que importa @/integrations/supabase/client
│       ├── LovableAuthRepository.ts
│       ├── LovableUserRepository.ts
│       └── mappers.ts         # row snake_case → DTO camelCase
└── index.ts                   # container: exporta repos escolhidos via env/flag
```

Futuro: `src/data/providers/rest/` com `RestAuthRepository`/`RestUserRepository` usando `fetch` contra a API Fastify. `src/data/index.ts` é o único ficheiro a trocar.

DTOs em camelCase (`User { id, username, email, photoUrl, level, xp, createdAt }`) — o mapper isola o snake_case do Postgres.

## 3. Estrutura Feature-First final

```text
src/
├── routes/
│   ├── __root.tsx
│   ├── index.tsx              # landing pública
│   ├── auth.tsx               # login + registo (tabs)
│   └── _authenticated/
│       ├── route.tsx          # gate (integração)
│       ├── feed.tsx
│       ├── search.tsx
│       ├── publish.tsx
│       ├── challenges.tsx
│       └── profile.tsx
│
├── features/
│   ├── auth/
│   │   ├── components/ LoginForm.tsx, RegisterForm.tsx
│   │   ├── hooks/      useSignIn.ts, useSignUp.ts, useSignOut.ts, useSignInWithGoogle.ts
│   │   ├── services/   authService.ts        # orquestra AuthRepository + UserRepository
│   │   └── schemas.ts                        # zod
│   ├── profile/
│   │   ├── hooks/ useCurrentUser.ts
│   │   └── services/ userService.ts
│   ├── feed/         (placeholder)
│   ├── recipes/      (placeholder)
│   ├── search/       (placeholder)
│   ├── challenges/   (placeholder)
│   └── xp/           (placeholder)
│
├── components/
│   ├── ui/                                    # shadcn
│   └── layout/ AppShell.tsx, BottomNav.tsx
│
├── data/                                       # ver secção 2
├── hooks/                                      # partilhados
├── lib/  query-client.ts, utils.ts
├── types/  user.ts
└── styles.css
```

Aliases: `@/features`, `@/components`, `@/hooks`, `@/services` (via features), `@/data`, `@/lib`, `@/types`.

## 4. Auth (fluxo através das camadas)

- `LovableAuthRepository`: `signInWithEmail`, `signUpWithEmail`, `signInWithGoogle` (usa `lovable.auth.signInWithOAuth`), `signOut`, `getCurrentUserId`, `onAuthStateChange`.
- `LovableUserRepository`: `getById`, `ensureExists(id, defaults)`, `update`.
- `authService.signUp(email, password, username)`: cria conta → aguarda sessão → garante linha em `users` (trigger já cria; service faz upsert defensivo do `username`).
- Hooks React Query invocam apenas serviços; erros normalizados via `AppError`.
- Listener único de `onAuthStateChange` em `__root.tsx` chama `router.invalidate()` + `queryClient.invalidateQueries()` (filtrado a `SIGNED_IN/OUT/USER_UPDATED`).
- Rotas privadas em `_authenticated/` (gate gerido `ssr:false` redireciona a `/auth`).

## 5. UI

- `AppShell` dentro de `_authenticated/route.tsx`: `<Outlet />` + `BottomNav` (5 tabs: Feed, Pesquisa, Publicar, Desafios, Perfil).
- Páginas placeholder mínimas (título + 1 linha).
- Perfil expõe botão "Sign out" (via `useSignOut` → `authService` → `AuthRepository`).
- `/auth`: shadcn Tabs (Login | Registo) com RHF + Zod; botão Google.
- `styles.css`: paleta primária culinária quente (oklch âmbar), mantendo dark mode e tokens semânticos.

## 6. README.md profissional

Secções:
1. **ChefXP** — descrição (plataforma social gamificada de culinária).
2. **MVP** — objetivos e âmbito atual.
3. **Stack** — React 19, TS, Vite, Tailwind v4, shadcn/ui, TanStack Router, TanStack Query v5, RHF, Zod, Lovable Cloud (temporário).
4. **Arquitetura** — diagrama das camadas + explicação do Data Provider swappable.
5. **Estrutura de pastas** — árvore comentada.
6. **Executar localmente** — `npm i`, `npm run dev`, variáveis `VITE_SUPABASE_*`.
7. **Convenções** — feature-first, componentes não chamam infra, DTOs camelCase, imports por alias, commits, ficheiros pequenos.
8. **Evolução futura** — plano de migração para backend próprio Node.js + TypeScript + Fastify + Prisma + PostgreSQL + Docker: só trocar `src/data/providers/lovable/` por `src/data/providers/rest/`; schema Postgres já usa nomes agnósticos (`users`); auth passa a JWT emitido pela API.

## 7. Não incluído (fora de âmbito)

Receitas, XP real, desafios, comentários, likes, notificações, upload de fotos, pesquisa real, roles.

## Verificação

- Build/typecheck ok.
- `grep` confirma que nenhum ficheiro fora de `src/data/providers/lovable/` importa `@/integrations/supabase/*`.
- Fluxo: `/` → `/auth` → registo cria linha em `users` → redirect `/feed` com BottomNav → logout volta a `/auth`.
