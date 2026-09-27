# ChefXP — Funcionamento e Validação de Segurança

Relatório de auditoria e documentação técnica.
Data: 2026-09-27 · Âmbito: aplicação inteira (servidor, cliente, base de dados,
infraestrutura, cadeia de entrega) · Commit auditado: `6368505`

---

## Índice

1. [Sumário executivo](#1-sumário-executivo)
2. [O que a aplicação é e o que faz](#2-o-que-a-aplicação-é-e-o-que-faz)
3. [Como o código funciona](#3-como-o-código-funciona)
4. [Metodologia da validação de segurança](#4-metodologia-da-validação-de-segurança)
5. [Controlos verificados](#5-controlos-verificados-o-que-está-bem-e-porquê)
6. [Achados](#6-achados)
7. [Cobertura por categoria (OWASP)](#7-cobertura-por-categoria-owasp-top-10-2021)
8. [Plano de correção sugerido](#8-plano-de-correção-sugerido)
9. [O que não foi coberto](#9-o-que-não-foi-coberto)

---

## 1. Sumário executivo

O ChefXP é uma aplicação web full-stack (React 19 + Express 5 + PostgreSQL 15,
~40 000 linhas) para aprender a cozinhar de forma gamificada. Foi auditada na
totalidade: 83 endpoints HTTP, 21 migrations, 32 tabelas, o cliente React, o
service worker, os guiões de operação e o pipeline de CI/CD.

**Veredicto: postura de segurança acima da média para um projeto desta
dimensão. Zero achados críticos ou altos.**

A aplicação acerta, por construção, em quase tudo o que costuma correr mal:
sessão em cookie `HttpOnly` + `__Host-` + `SameSite=Strict`, CSRF double-submit
com comparação em tempo constante, 100 % das consultas SQL parametrizadas,
validação Zod em todas as rotas menos uma, autorização decidida sempre no
servidor e lida da base a cada pedido (nunca do JWT), XP como livro-razão
imutável e idempotente, tipo de imagem detetado pelos bytes e não pelo MIME
declarado, CSP restritiva em produção, e **zero vulnerabilidades nas
dependências de produção**.

| Severidade | Nº | Resumo |
|---|---|---|
| 🔴 Crítico | 0 | — |
| 🟠 Alto | 0 | — |
| 🟡 Médio | 2 | Seed sem travão de produção; ficheiros carregados nunca são apagados |
| 🔵 Baixo | 13 | Robustez de entrada, revogação de sessões, higiene de CI e operação |
| ⚪ Informativo | 4 | Notas de design e de abuso |

Nenhum achado permite, por si só, acesso não autorizado a dados de terceiros,
execução de código, ou tomada de conta. Os dois achados médios são **riscos
operacionais e de privacidade**, não falhas exploráveis remotamente.

---

## 2. O que a aplicação é e o que faz

O ChefXP ensina a cozinhar ao estilo Duolingo, com uma camada social por cima.

### 2.1 Aprendizagem

- **Trilhos** (`shared/trails/*.json`): nove percursos — principal, italiano,
  japonês, mexicano, português, vegan, saudável, universidade, gymbro — cada um
  em português e inglês. O currículo é **código versionado**, não conteúdo em
  base de dados: muda-se no repositório e vai com o deploy.
- **Lições** com preparação e quiz (escolha múltipla, ordenação de passos,
  estimativa numérica). Três corações; errar gasta um.
- **XP, níveis (1–50), streak diário e meta diária** configurável.
- **Competências** (`skills`) ligadas a lições, com pré-requisitos, sincronizadas
  para a base no arranque de forma idempotente.

### 2.2 Missões

Cada unidade termina num prato a sério: passos cronometrados, botões de socorro
("queimei", "falta um ingrediente"), fotografia de verificação no fim, e a opção
de partilhar o resultado no feed.

### 2.3 Social

Publicação de receitas com fotografia, gostos, comentários, seguir/deixar de
seguir, três vistas do feed (Recentes, A seguir, Em alta com decaimento
temporal), pesquisa com filtros (dificuldade, tempo, custo, etiquetas
alimentares), notificações no sino, e rankings semanal e global.

### 2.4 Desafios

Criados por moderadores. Quem cria define o XP de participação, o número de
submissões por pessoa, a duração e o pódio. Participar é publicar uma receita
com o desafio agarrado. No fim do prazo o ranking **fecha sozinho** (agendador
interno), ordenado por gostos, e paga o pódio pelo livro-razão.

### 2.5 Moderação e administração

Três papéis numa escada: `user` → `moderator` → `admin`. Denúncias de receitas,
comentários e contas vão para uma fila; bloquear alguém esconde-o nos dois
sentidos em todo o lado. Administradores veem métricas da plataforma e gerem
papéis — mas **não podem criar outro administrador pela aplicação** (só pela
linha de comandos, no servidor).

### 2.6 Conta e privacidade

Exportação completa dos dados (portabilidade, RGPD art. 20), eliminação
definitiva da conta com confirmação por nome e password, e bloqueio de
utilizadores.

### 2.7 PWA / offline

Instalável, com service worker escrito à mão. O "shell" e os assets ficam em
cache; os GET da API são rede-primeiro com cache de segurança; **nada que
escreva é enfileirado** — um POST offline falha e diz que falhou, porque o XP é
um livro-razão com ordem.

---

## 3. Como o código funciona

### 3.1 Arquitetura em camadas

```
shared/trails/*.json          currículo versionado (dados, não código)
        │
server/domain/*.js            REGRAS PURAS — sem I/O, sem base de dados
        │                     xp, curriculum, challenges, moderation,
        │                     authTokens, oauth, passwordPolicy
server/lib/*.js               LADO SUJO — base de dados, rede, disco
        │                     xpLedger, imageStore, mailer, blocks, i18n
server/services/*.js          ORQUESTRAÇÃO — trailService, challengeSettlement
        │
server/routes/*.js            HTTP — validar, autorizar, responder
        │
src/                          React: pages → features → components → services
```

A regra estrutural é consistente: **tudo o que é uma decisão está em
`server/domain/`, é uma função pura, e tem testes que correm em
milissegundos**. As rotas limitam-se a obedecer. É isto que permite 197 testes
unitários sem levantar base de dados nenhuma.

### 3.2 Arranque (`server/index.js`)

```
getPool() → runMigrations() → syncCurriculum() → ensureUploadDir()
          → createApp() → startChallengeScheduler() → listen()
```

As migrations correm no arranque, cada uma numa transação, registadas em
`applied_migrations`. O sync do currículo corre logo a seguir e é idempotente —
arrancar mil vezes dá o mesmo resultado que arrancar uma. `SIGTERM`/`SIGINT`
fecham o agendador, o servidor e o pool, por essa ordem.

### 3.3 Cadeia de middleware (`server/app.js`)

```
requestId → helmet → compression → cookieParser → cors
          → rateLimit (/api, 1000/15min)
          → express.json (6 MB em /recipes /missions /challenges, 1 MB no resto)
          → language (?lang=)  → csrfProtection
          → rotas → notFound → static(dist) → errorHandler
```

Detalhes que importam:

- `app.disable("x-powered-by")` e `trust proxy: 1` (há um Caddy à frente).
- O rate limit é **só em `/api`**: aplicado a tudo, cada ícone e cada ficheiro
  de `/assets` contava para o orçamento.
- O limite de 6 MB é cirúrgico — só nas três rotas que transportam imagem em
  base64. O resto da API fica em 1 MB.

### 3.4 Autenticação

**Sessão.** JWT HS256 com `{sub, email}`, TTL de 7 dias, em cookie
`HttpOnly`. Em produção o cookie chama-se `__Host-token`: o prefixo obriga a
`Secure`, `Path=/` e ausência de `Domain`, o que impede um subdomínio
comprometido de escrever por cima da sessão. O token **nunca** vai no corpo da
resposta, nem em desenvolvimento.

**Passwords.** bcrypt com 12 rondas. Política de 8 caracteres, uma maiúscula,
um número e um caractere especial — aplicada no servidor (`domain/passwordPolicy.js`)
e espelhada no cliente só para feedback visual.

**Criar conta em dois tempos.** Escreve-se o email → chega um link → só do outro
lado é que se escolhe nome e password. Enquanto o link não for aberto existe
apenas uma linha em `pending_signups`: nenhum nome tomado, nenhum email
ocupado. O `POST /auth/register` de uma vez só **desativa-se** (404) quando há
SMTP configurado, para não deixar uma porta ao lado que cria contas sem
confirmar nada.

**Tokens de email.** 32 bytes de `crypto.randomBytes` em hexadecimal; na base
fica só o SHA-256. Uma hora para redefinir password, 24 horas para confirmar
email e para criar conta. Pedir um link novo apaga o anterior. O consumo é feito
com `SELECT ... FOR UPDATE` dentro de uma transação, por isso dois pedidos com o
mesmo token não passam os dois.

**Google OAuth.** Fluxo Authorization Code do lado do servidor — o browser nunca
fala com a Google a partir da página, só é reencaminhado (foi assim para não ter
de abrir a CSP ao script do Google Identity Services). `state` de 32 bytes em
cookie `HttpOnly` + `SameSite=Lax` (Strict quebraria o regresso, que é uma
navegação de topo cross-site). O `id_token` é validado em
`domain/oauth.js`: emissor, `aud` igual ao nosso `client_id`, `exp`, `sub`, e
**`email_verified === true`** — sem isto, uma conta Google com o email de outra
pessoa dava acesso à conta dela. Uma conta local por confirmar nunca é ligada a
uma identidade Google.

### 3.5 Autorização

Duas camadas, ambas no servidor:

1. `requireAuth` — lê o cookie, verifica o JWT, põe `req.user`. Está no topo de
   **todos** os routers.
2. `requireModerator` / `requireAdmin` (`lib/moderation.js`) — vão buscar o papel
   **à base de dados a cada pedido**. Deliberadamente não está no JWT: um papel
   dentro do token ficava congelado até o cookie expirar, e retirar permissões a
   alguém passava a demorar uma semana.

As regras de quem pode o quê são funções puras em `domain/moderation.js`
(`roleChangeRefusal`, `accountDeletionRefusal`, `commentDeleterRole`,
`reportRefusal`), cada uma com o motivo da recusa por escrito.

### 3.6 CSRF

Double-submit: cookie `csrf` legível pelo JavaScript + header `X-CSRF-Token`,
comparados com `crypto.timingSafeEqual`. Aplicado a todos os métodos mutantes —
**exceto quando não há cookie de sessão**, porque sem autoridade ambiente não há
nada para roubar e o login tem de poder acontecer antes de existir token. É uma
decisão documentada no código, não uma omissão.

### 3.7 Validação

`middleware/validate.js` + `schemas/index.js`: Zod em `body`, `query` e `params`.
Os resultados ficam em `req.valid` (no Express 5 `req.query` é um getter e não
pode ser reatribuído). Como o Zod remove chaves desconhecidas por omissão, isto
é também a defesa contra *mass assignment* — verificada dinamicamente nesta
auditoria.

### 3.8 XP como livro-razão

`users.xp` **não é um contador que alguém incrementa**. É sempre
`SUM(amount) FROM xp_events`, recalculado a cada movimento. `UNIQUE (user_id,
source, source_ref)` torna a atribuição idempotente: repetir o pedido devolve
`awarded: false` em vez de somar outra vez. Apagar uma receita chama
`revokeXp()`, que desconta também o dia certo em `daily_activity` — sem isso,
publicar e apagar em ciclo era uma forma de somar XP por receitas que já não
existem.

Toda a correção de respostas é feita no servidor (`gradeAnswers`): o
`heartsLeft` que o cliente mostrou não é aceite como facto, e o cliente nunca
recebe o gabarito (`correctAnswer` e `explanation` são removidos de
`toClientLesson`).

### 3.9 Imagens

Só data URLs base64, e o tipo sai da **assinatura dos bytes** (`ff d8 ff`,
`89 50 4e 47`, `RIFF....WEBP`), nunca do MIME declarado. Máximo 3 MB. O nome do
ficheiro é um UUID gerado no servidor — o cliente nunca escolhe o caminho.
`saveRemoteImage` existe só para a fotografia de perfil da Google e **exige**
uma lista de anfitriões permitidos (não tem valor por omissão, de propósito),
recusa tudo o que não seja `https:` e impõe um timeout.

### 3.10 Base de dados

PostgreSQL 15, SQL puro, sem ORM. 32 tabelas. **Todas as consultas usam
placeholders `$1, $2, …`**; os poucos `UPDATE` com `SET` dinâmico constroem a
lista de colunas a partir de mapas fixos no código, nunca de entrada do
utilizador. Transações com `FOR UPDATE` em todos os pontos onde duas chamadas
concorrentes podiam pagar a dobrar (fecho de desafios, consumo de tokens,
conclusão de missões).

### 3.11 Cliente

React 19 + TanStack Query + React Hook Form + shadcn/ui. `services/api.ts`
centraliza o `fetch`: junta a língua ao URL, garante o token CSRF, distingue
"sem rede" de "servidor em baixo", e emite um evento quando a sessão expira.
O `ProtectedRoute` é conveniência — a autoridade é sempre o servidor.

### 3.12 Infraestrutura

- **Dockerfile** multi-stage, runtime a correr como utilizador `node` (não root),
  `npm ci --omit=dev`, healthcheck.
- **docker-compose.prod.yml**: o Postgres e o Express **não expõem portas**; só o
  Caddy tem 80/443. Os uploads vivem num volume.
- **Caddy**: TLS automático do Let's Encrypt, HSTS de um ano. Os restantes
  cabeçalhos ficam no helmet, num sítio só.
- **CI** (GitHub Actions): lint, typecheck, 197 testes de domínio, 150 de
  interface, build, hardening (proíbe CDNs), PWA, migrations idempotentes, seed,
  teste de offline com Chrome sem rede, 183 testes de integração contra Postgres
  real, e responsividade com Playwright. Deploy só com tudo verde, por SSH com
  chave presa a um único guião (`command="…"` no `authorized_keys`).

---

## 4. Metodologia da validação de segurança

A auditoria combinou análise estática com **verificação dinâmica contra uma
instância a correr**, porque um controlo que está escrito no código e não
funciona é pior do que um que não existe.

### 4.1 Análise estática

- Leitura integral de: `app.js`, `index.js`, os 5 middlewares, os 12 routers
  (83 endpoints), os 11 módulos de domínio, os 12 módulos de `lib/`, os
  serviços, o runner de migrations e todos os esquemas Zod.
- Varrimento dirigido: interpolação de strings em SQL, `dangerouslySetInnerHTML`,
  `innerHTML`, `eval`, `new Function`, `href={}` dinâmicos, uso direto de
  `req.body`/`req.query`, segredos comprometidos, chamadas a `fetch` do lado do
  servidor, escritas em disco.
- Revisão de `Dockerfile`, `Caddyfile`, os dois compose, `.gitignore`, os dois
  `.env.example`, `.github/workflows/ci.yml` e os guiões de `scripts/`.

### 4.2 Análise de dependências

`npm audit` sobre a árvore completa e sobre a árvore de produção isolada.

### 4.3 Verificação dinâmica

Levantou-se um PostgreSQL 16 efémero e arrancou-se o servidor em modo de
desenvolvimento **e** em modo de produção. Testes executados:

| # | Teste | Resultado |
|---|---|---|
| 1 | 9 endpoints protegidos sem sessão | 401 em todos |
| 2 | Cabeçalhos de segurança (helmet) | presentes; `X-Powered-By` ausente |
| 3 | CSP em `NODE_ENV=production` | presente e restritiva |
| 4 | POST sem header CSRF | 403 |
| 5 | POST com header CSRF errado | 403 |
| 6 | POST com header CSRF correto | passa |
| 7 | `user` comum em `/admin/metrics`, `/moderation/reports`, criar desafio | 403 nos três |
| 8 | Mass assignment (`role`, `xp`, `level`) via `PATCH /users/me` | ignorados; base inalterada |
| 9 | 3 payloads de SQL injection na pesquisa | 200 sem efeito; tabelas intactas |
| 10 | JWT com assinatura falsa | 401 |
| 11 | JWT com `alg: none` | 401 |
| 12 | Enumeração de contas no login | mensagem idêntica nos dois casos |
| 13 | HTML disfarçado de PNG no upload | 400 |
| 14 | SVG no upload | 400 |
| 15 | URL externo (`169.254.169.254`) como imagem | 400 |
| 16 | Path traversal em `/uploads/../…` (2 variantes) | 404 |
| 17 | IDOR: editar/apagar receita alheia | 403 |
| 18 | IDOR: ler email de outro utilizador | campo ausente |
| 19 | IDOR: apagar conta alheia | 403 |
| 20 | Política de passwords (4 variantes fracas) | recusadas com o motivo certo |
| 21 | Rate limit no login | 429 ao fim de ~19 tentativas |
| 22 | Fuga de stack trace em erro 4xx/5xx | nenhuma; só `requestId` |
| 23 | CORS de origem não autorizada | bloqueado |

### 4.4 Suíte de testes do projeto

Executada na íntegra: **197 unitários + 183 de integração + 150 de interface =
530 testes, todos a passar.** Lint: 0 erros, 6 avisos de `react-refresh`.
Typecheck: limpo.

> Nota digna de registo: o próprio harness de integração
> (`server/test/helpers.js`) recusa-se a correr contra uma base cujo nome não
> contenha "test", a menos que se defina `ALLOW_DESTRUCTIVE_TESTS=true`. É
> exatamente o tipo de travão que o `db:seed` não tem (achado M-1).

---

## 5. Controlos verificados: o que está bem, e porquê

### 5.1 Gestão de sessão — **forte**

`HttpOnly` + `Secure` + `SameSite=Strict` + prefixo `__Host-` em produção. O
token nunca é exposto ao JavaScript nem devolvido no corpo. A escolha de
`SameSite=Strict` também neutraliza, em produção, o *login CSRF* que a isenção
do `/auth/login` deixaria em aberto.

### 5.2 Injeção SQL — **nenhuma superfície encontrada**

Todas as 200+ consultas usam placeholders. Os quatro sítios com SQL construído
dinamicamente foram lidos um a um:

- `UPDATE challenges SET …` — colunas vêm de `EDITABLE_COLUMNS`, um mapa fixo.
- `UPDATE recipes SET …` — colunas passadas literalmente por uma função `set()`.
- `UPDATE users SET …` — idem.
- `notBlockedSql(meParam, authorExpr)` — **todos** os 10 call sites passam
  literais (`"$1"`, `"u.id"`). É um *footgun* teórico, não um bug.

### 5.3 Autorização — **forte**

O papel é lido da base a cada pedido, não do token. Os três degraus estão numa
escada de duas funções (`canModerate`, `canAdminister`), não espalhados por
dezenas de `role === "admin" ||` pelas rotas. Um admin não cria outro admin pela
aplicação — se pudesse, uma sessão roubada bastava para abrir uma porta
permanente. Todas as consultas de recursos por utilizador têm `AND user_id = $n`
(missões, notificações, submissões de desafio, exportação de dados).

### 5.4 XSS — **superfície mínima**

React escapa tudo. Zero `href={}` dinâmicos em todo o cliente (portanto zero
vetores `javascript:`). O único `dangerouslySetInnerHTML` é o componente de
gráficos do shadcn/ui, alimentado por configuração escrita no código, nunca por
dados de utilizador. Em produção, a CSP (`script-src 'self'`, `object-src
'none'`, `base-uri 'self'`, `frame-ancestors 'none'`) fecha o resto. `nosniff`
aplica-se também a `/uploads`, e só entram três formatos raster verificados por
assinatura — não há caminho para um SVG com script.

### 5.5 Upload de ficheiros — **forte**

Assinatura de bytes, limite de 3 MB, nome UUID gerado no servidor, servido de
uma pasta dedicada com `index: false` e `dotfiles: "deny"`. Traversal bloqueado
(confirmado dinamicamente).

### 5.6 SSRF — **bem contido**

Há exatamente uma função que vai à rede a partir de um valor externo
(`saveRemoteImage`) e ela **exige** a lista de anfitriões como argumento
obrigatório, só aceita `https:`, e o único chamador passa
`["googleusercontent.com"]`. O `googlePictureUrl` faz uma segunda verificação de
domínio antes disso. (Ver L-4 para a nuance dos redirecionamentos.)

### 5.7 Fuga de informação — **forte**

O `errorHandler` nunca devolve stack traces: devolve um `requestId` que aparece
no log do servidor. Emails só saem para o próprio (`includeEmail: isMe`). O
papel não é público. O `/forgot-password` e o `/signup` respondem sempre o mesmo,
exista ou não a conta — inclusive quando o SMTP falha, para que um erro de
infraestrutura não passe a dizer quem tem conta.

### 5.8 Segredos — **limpos**

`.gitignore` cobre `.env.*` com exceção dos exemplos. Nenhum segredo real
encontrado no repositório ou no histórico dos ficheiros auditados. O
`validateEnv` recusa arrancar sem `DATABASE_URL`, sem `JWT_SECRET`, com um
segredo com menos de 32 caracteres, ou com um dos segredos de exemplo conhecidos
em produção. Também exige que `GOOGLE_CLIENT_ID`/`SECRET` e
`SMTP_USER`/`PASSWORD` venham aos pares — meio configurado é pior do que não
configurado.

### 5.9 Dependências — **produção limpa**

`npm audit --omit=dev`: **0 vulnerabilidades.** (Ver L-13 para as de
desenvolvimento.)

### 5.10 Privacidade e RGPD — **bem pensada**

Exportação completa (art. 20) e eliminação definitiva (art. 17) com dupla
confirmação. O logout limpa a cache da API do service worker e a outbox —
sem isso, a pessoa seguinte no mesmo dispositivo via os dados da anterior sem
rede. (Ver M-2 para a lacuna que resta na eliminação.)

---

## 6. Achados

### 🟡 M-1 — `db:seed` não tem travão de produção

**Ficheiro:** `scripts/run-seed.mjs` · `server/db/seed.sql:42-60`
**Categoria:** credenciais por omissão / configuração insegura (CWE-1188, CWE-798)

O guião de seed lê `DATABASE_URL` do ambiente e executa `seed.sql` sem verificar
o `NODE_ENV` nem o nome da base. O seed insere contas de demonstração cuja
password (`chef123`) e respetivo hash bcrypt **estão escritos no repositório**, e
promove `demo@chef-xp.local` a `admin` e `sous@chef-xp.local` a `moderator`.

Pior: a cláusula de conflito é

```sql
ON CONFLICT (email) DO UPDATE SET
  level = …, xp = …, username = …, photo_url = …,
  password_hash = EXCLUDED.password_hash;
```

Um `npm run db:seed` executado por engano contra produção (num `.env` errado,
num runbook copiado, num contentor com as variáveis erradas) cria uma conta de
administrador com password pública **e sobrescreve a password** de qualquer
conta existente com um desses emails.

Hoje o que impede isto é uma frase no README e um comentário no SQL. O harness
de testes de integração do próprio projeto já faz melhor: recusa correr contra
uma base cujo nome não contenha "test".

**Correção sugerida** (o mesmo padrão que `server/test/helpers.js` já usa):

```js
// scripts/run-seed.mjs, antes de ler o ficheiro
const url = process.env.DATABASE_URL ?? "";
if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
  throw new Error(
    "O seed cria contas de demonstração com password pública e promove uma delas a admin.\n" +
    "Não corre em produção. Se é mesmo isso que queres: ALLOW_PRODUCTION_SEED=true",
  );
}
```

---

### 🟡 M-2 — Ficheiros carregados nunca são apagados

**Ficheiro:** `server/lib/imageStore.js` (não há nenhum `unlink` em todo o
servidor) · `server/routes/recipes.js:438`, `server/routes/users.js:305`,
`server/routes/moderation.js:145`
**Categoria:** retenção de dados / esgotamento de recursos (CWE-459, CWE-770)

**Confirmado dinamicamente:** publicou-se uma receita com imagem, apagou-se a
receita (200 OK), e o ficheiro continuou em disco e continuou a responder 200 em
`GET /uploads/<uuid>.png` **sem qualquer sessão**.

Duas consequências:

1. **Privacidade / direito ao apagamento.** Apagar a conta remove as linhas da
   base (`ON DELETE CASCADE`) mas deixa a fotografia de perfil e as fotografias
   das receitas publicamente alcançáveis para sempre. Quem tiver o URL — e ele
   esteve no feed, nas caches dos browsers, nos históricos — continua a vê-las.
   O mesmo vale para conteúdo removido por moderação: a imagem denunciada sai da
   aplicação mas não sai do servidor.
2. **Disponibilidade.** Não há quota por utilizador nem limpeza. Com o limite de
   3 MB por imagem e 1000 pedidos por 15 minutos por IP, uma conta autenticada
   pode escrever da ordem de gigabytes por hora, em ciclo publicar/apagar, até
   encher o volume. Com o disco cheio, o Postgres e o Express param.

**Correção sugerida:** duas peças, que se podem fazer em separado.

- *Curto prazo:* uma função `deleteStoredImage(publicPath)` em `imageStore.js`
  que valide que o caminho é `^/uploads/[0-9a-f-]{36}\.(jpg|png|webp)$`, resolva
  contra `UPLOAD_DIR`, confirme com `path.relative` que não escapa, e faça
  `fs.unlink` ignorando `ENOENT`. Chamá-la depois do `COMMIT` nos três sítios
  que apagam conteúdo (nunca dentro da transação — um rollback deixaria a linha
  viva e o ficheiro morto).
- *Médio prazo:* uma quota simples por utilizador (`SELECT count(*) FROM recipes
  WHERE author_id = $1 AND created_at > now() - interval '1 day'`) e uma tarefa
  periódica que apague ficheiros em `UPLOAD_DIR` sem referência em
  `recipes.image_url ∪ users.photo_url ∪ mission_runs.result_image ∪
  challenges.image_url`.

---

### 🔵 L-1 — `GET /api/missions/posts` é a única rota sem `validate()`

**Ficheiro:** `server/routes/missions.js:147-148`

```js
const userId = typeof req.query.userId === "string" ? req.query.userId : req.user.id;
const limit = Math.min(Number(req.query.limit) || 24, 50);
```

Todos os outros 82 endpoints passam por Zod. Aqui não: um `userId` que não seja
UUID chega ao Postgres, que rejeita a conversão e devolve **500** em vez de 400.
**Confirmado dinamicamente.** Não há injeção (a consulta é parametrizada) nem
fuga (a resposta é genérica), mas é ruído nos logs de erro e uma inconsistência
que esconde o próximo bug a sério.

**Correção:** `validate({ query: z.object({ userId: uuid.optional(), limit:
z.coerce.number().int().min(1).max(50).default(24) }) })`.

---

### 🔵 L-2 — Cursor de paginação desserializado sem validação

**Ficheiro:** `server/lib/mappers.js:164-171`, usado em `server/routes/recipes.js:127`

`decodeCursor` faz `JSON.parse(base64url)` e devolve o que vier. Os campos vão
para a consulta com `::timestamptz` e `::uuid`; um cursor forjado com
`{"createdAt":"nao-e-data","id":"nao-e-uuid"}` dá **500**. **Confirmado
dinamicamente.** Um cursor que não seja base64 válido dá 200 (é apanhado pelo
`catch`), o que torna o comportamento inconsistente.

**Correção:** passar o resultado do `JSON.parse` por um esquema Zod
(`z.object({ createdAt: z.coerce.date(), id: uuid }).or(z.object({ offset:
z.number().int().nonnegative() }))`) e devolver `null` se falhar.

---

### 🔵 L-3 — `resolveImageInput` aceita caminhos relativos arbitrários

**Ficheiro:** `server/lib/imageStore.js:98-106`

```js
if (input.startsWith(`${UPLOAD_ROUTE}/`)) return input;
```

Qualquer string que comece por `/uploads/` é devolvida tal e qual e guardada na
base. **Confirmado:** `/uploads/../../etc/passwd` é aceite e persistido.

O impacto é baixo — o valor acaba num `<img src>`, o browser normaliza para um
caminho same-origin, e o `express.static` bloqueia traversal do lado que serve
(404, confirmado). Mas permite guardar um `photo_url` que aponta para qualquer
rota da própria aplicação, e é uma validação que custa uma linha.

**Correção:** `if (/^\/uploads\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(input)) return input;`

---

### 🔵 L-4 — `saveRemoteImage`: redirecionamentos e leitura sem limite

**Ficheiro:** `server/lib/imageStore.js:120-165`

Dois pormenores na única função do servidor que vai à rede buscar um URL externo:

1. `fetch(alvo, { redirect: "follow" })` — a lista de anfitriões é verificada no
   URL inicial, mas **não** nos destinos dos redirecionamentos. Um
   `googleusercontent.com` que redirecionasse para um endereço interno levaria o
   servidor lá.
2. `await resposta.arrayBuffer()` lê o corpo inteiro para memória **antes** da
   verificação de tamanho. O `Content-Length` é verificado primeiro, mas é
   opcional: uma resposta em `chunked` sem esse cabeçalho é lida sem limite.

O risco real é baixo: só é alcançável pelo campo `picture` de um `id_token`
assinado pela Google, obtido pelo servidor por TLS com o nosso `client_secret`.
Mas a própria função tem no cabeçalho, escrito, o princípio que justifica
fechá-la — *"uma função que vai à rede buscar um endereço vindo de fora, sem
lista de anfitriões, é um pedido forjado à espera de acontecer"*.

**Correção:** `redirect: "manual"` com no máximo 2 saltos, revalidando o
anfitrião a cada um; e ler o corpo em `resposta.body` por pedaços, abortando
assim que passar `MAX_IMAGE_BYTES`.

---

### 🔵 L-5 — `X-Request-Id` aceite do cliente sem validação

**Ficheiro:** `server/middleware/errorHandler.js:6-10`

```js
req.id = req.get("X-Request-Id") || crypto.randomUUID();
```

O valor é devolvido no cabeçalho da resposta e escrito nas linhas de
`console.error`/`console.warn`. **Confirmado:** um valor arbitrário de 60
caracteres é refletido intacto. O Node bloqueia CR/LF em cabeçalhos, portanto
não há divisão de resposta nem injeção de linha no log — mas permite escrever
texto controlado pelo atacante no meio dos logs do servidor, sem limite de
comprimento, o que dificulta a leitura forense e pode ser usado para forjar
contexto.

**Correção:** aceitar o cabeçalho apenas se corresponder a um UUID
(`/^[0-9a-f-]{36}$/i`), e gerar um novo caso contrário.

---

### 🔵 L-6 — Origem CORS recusada produz 500 com stack trace no log

**Ficheiro:** `server/app.js:70-73`

```js
return callback(new Error("Origin not allowed by CORS"));
```

O erro não traz `status`, por isso o `errorHandler` classifica-o como 5xx: o
pedido é corretamente bloqueado, mas responde **500** e escreve um stack trace
completo nos logs. **Confirmado dinamicamente.** Qualquer pessoa pode gerar
ruído de nível `error` à vontade, o que enterra os erros a sério.

**Correção:** `const erro = new Error("Origin not allowed by CORS"); erro.status = 403;`

---

### 🔵 L-7 — Não há revogação de sessões

**Ficheiro:** `server/routes/auth.js:745-751` (já documentado no código)

Redefinir a password **não** invalida os JWT emitidos antes. Quem tiver uma
sessão ativa mantém-na até sete dias depois, mesmo que o dono da conta tenha
redefinido a password precisamente porque suspeita que a sessão foi roubada. O
mesmo vale para o logout: o cookie é limpo no browser, mas o token continua
válido se alguém o tiver copiado.

O código diz isto por escrito e explica o custo — é uma decisão consciente, não
um esquecimento. Fica registado porque é, ainda assim, a lacuna mais relevante
do modelo de sessão.

**Correção:** uma coluna `users.token_version INTEGER NOT NULL DEFAULT 0`,
incluída no payload do JWT e comparada em `requireAuth`; incrementada em
`reset-password` e no futuro botão "terminar sessão em todos os dispositivos".
É uma consulta que o `requireAuth` já não faz hoje, por isso vale a pena medir.

---

### 🔵 L-8 — `/auth/login` e `/auth/register` sem CSRF

**Ficheiro:** `server/middleware/csrf.js:43-45`

A isenção é deliberada e documentada (não há sessão para proteger). O efeito
colateral é o *login CSRF*: um site terceiro pode tentar iniciar sessão no
browser da vítima com credenciais do atacante, para que a vítima passe a
alimentar a conta dele.

Em **produção** isto não funciona, porque o `SameSite=Strict` do cookie de
sessão impede que ele seja aceite numa resposta a um pedido cross-site. Em
**desenvolvimento** (`SameSite=Lax`) funcionaria. Fica como nota de risco
residual, não como falha em produção.

---

### 🔵 L-9 — `style-src 'unsafe-inline'` na CSP

**Ficheiro:** `server/lib/cspConfig.js:11`

Necessário para os estilos inline do Tailwind v4 e dos primitivos Radix. Reduz o
valor da CSP contra exfiltração por CSS, mas não abre caminho a execução de
script (`script-src` continua `'self'`, sem `unsafe-inline` e sem
`unsafe-eval`). Resolver exigiria nonces por pedido e uma alteração
significativa no build. Documentado, não acionável a curto prazo.

---

### 🔵 L-10 — Canal lateral de tempo no login

**Ficheiro:** `server/routes/auth.js:154`

```js
const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
```

Quando o email não existe, o `bcrypt.compare` (12 rondas, ~250 ms) não corre. A
diferença é grande e mensurável, o que permite enumerar emails registados apesar
de a mensagem ser idêntica nos dois casos (confirmado: é mesmo idêntica). O rate
limiter (20 tentativas / 15 min) torna a enumeração em massa impraticável, mas
não a impede num alvo específico.

**Correção:** comparar sempre contra um hash de referência fixo quando o
utilizador não existe.

---

### 🔵 L-11 — Higiene do pipeline de CI/CD

**Ficheiro:** `.github/workflows/ci.yml`

Três notas, nenhuma explorável hoje:

1. Não há bloco `permissions:`. O `GITHUB_TOKEN` fica com o âmbito por omissão
   da organização, que pode ser de escrita. Acrescentar `permissions: contents:
   read` no topo custa uma linha e fecha a porta ao *supply-chain* via ação de
   terceiros.
2. O deploy faz `ssh root@$DEPLOY_HOST`. Está mitigado por
   `command="/opt/chef-xp/scripts/deploy.sh"` no `authorized_keys` (a chave não
   dá shell nem túneis, e está documentado), mas um utilizador de deploy sem
   privilégios seria uma camada a mais.
3. Não há análise de dependências no CI (nem `npm audit` nem Dependabot), pelo
   que uma vulnerabilidade nova numa dependência de produção passa despercebida
   até alguém correr `npm audit` à mão.

---

### 🔵 L-12 — `backup.sh` não restringe permissões das cópias

**Ficheiro:** `scripts/backup.sh`

O `pg_dump` inclui a tabela `users` inteira — hashes bcrypt, emails — e o tar
inclui todas as fotografias. Os ficheiros são criados com o `umask` por omissão
(tipicamente legíveis por todos) e o `mkdir -p "$DESTINO"` não define modo.

**Correção:** `umask 077` no topo do guião e `chmod 700 "$DESTINO"` a seguir ao
`mkdir`.

---

### 🔵 L-13 — Duas vulnerabilidades altas em dependências de desenvolvimento

`npm audit`:

| Pacote | Severidade | Problema | Origem |
|---|---|---|---|
| `brace-expansion` | Alta (7.5) | DoS por expansão sem limite (GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895) | `@typescript-eslint` |
| `js-yaml` | Alta | Consumo quadrático de CPU em `!!omap` (GHSA-5p4m-2wfm-xmqj) | toolchain do eslint |

**Ambas são exclusivamente de desenvolvimento.** `npm audit --omit=dev` devolve
**0 vulnerabilidades** — não chegam à imagem de produção, que é construída com
`npm ci --omit=dev`. `npm audit fix` resolve as duas.

---

### ⚪ Informativo

- **I-1 — Ranking de desafios vulnerável a Sybil.** O pódio é decidido por número
  de gostos e não há limite de velocidade por conta nas reações. Criar contas
  para votar em si próprio é possível. É um problema de abuso de produto, não de
  segurança técnica; a confirmação de email eleva um pouco o custo.
- **I-2 — `translate()` usa um objeto literal como dicionário.**
  `PT[mensagem]` sobre `{...}` herda `constructor`, `toString`, etc. As chaves
  são hoje todas escritas no código, portanto não é explorável. `Object.create(null)`
  ou `Object.hasOwn` fecham a porta de vez.
- **I-3 — `notBlockedSql(meParam, authorExpr)` recebe fragmentos de SQL crus.**
  Os 10 call sites passam literais e estão corretos. É um *footgun* documentado
  à espera do próximo contribuidor distraído; uma verificação
  `/^\$\d+$/.test(meParam)` custaria pouco.
- **I-4 — Imagens em `/uploads` são "capability URLs".** São servidas sem
  autenticação, protegidas apenas pela impossibilidade de adivinhar um UUIDv4.
  É a escolha certa para conteúdo de feed público (permite cache agressiva e
  funcionamento offline) e está documentada. Vale a pena tê-la presente se
  alguma vez existir conteúdo privado.

---

## 7. Cobertura por categoria (OWASP Top 10 2021)

| Categoria | Estado | Notas |
|---|---|---|
| **A01 — Quebra de controlo de acesso** | ✅ Forte | Papel lido da base a cada pedido; todas as consultas de recurso com `AND user_id = $n`; IDOR testado em 4 vetores, todos 403 |
| **A02 — Falhas criptográficas** | ✅ Forte | bcrypt 12 rondas; tokens de 256 bits com SHA-256 na base; TLS + HSTS; cookies `__Host-`/`Secure` |
| **A03 — Injeção** | ✅ Forte | 100 % parametrizado; SQLi testada; XSS sem superfície (React + CSP + zero `href` dinâmicos) |
| **A04 — Desenho inseguro** | ✅ Forte | XP como livro-razão idempotente; correção no servidor; admin só pela linha de comandos; regras puras e testadas |
| **A05 — Má configuração** | 🟡 Médio | helmet, CSP, CORS fechado, `validateEnv`, contentor não-root — **mas** o seed não tem travão (M-1) e o CI não fixa `permissions` (L-11) |
| **A06 — Componentes vulneráveis** | ✅ Bom | 0 em produção; 2 altas só em dev (L-13); sem varrimento automático no CI |
| **A07 — Falhas de identificação** | 🔵 Baixo | Política de passwords, rate limits por rota, confirmação de email, OAuth validado — **mas** sem revogação de sessão (L-7) e com canal lateral de tempo (L-10) |
| **A08 — Integridade de dados/software** | ✅ Bom | `package-lock` versionado; assinaturas de bytes nas imagens; migrations transacionais; deploy por chave presa a um guião |
| **A09 — Registo e monitorização** | 🔵 Baixo | `requestId` por pedido, `role_changes` e fila de denúncias como trilho de auditoria — **mas** o log é `console` sem agregação, e é poluível (L-5, L-6) |
| **A10 — SSRF** | ✅ Bom | Uma única superfície, com lista de anfitriões obrigatória; nuance dos redirecionamentos em L-4 |

---

## 8. Plano de correção sugerido

**Por ordem de retorno sobre esforço.**

| Prioridade | Achado | Esforço | Porquê primeiro |
|---|---|---|---|
| 1 | M-1 — travão no `db:seed` | ~10 linhas | Evita um incidente de conta-de-administrador-com-password-pública por um erro de operação |
| 2 | L-13 — `npm audit fix` | 1 comando | Grátis |
| 3 | L-11.1 — `permissions: contents: read` no CI | 2 linhas | Grátis, fecha o vetor de supply-chain mais comum |
| 4 | L-6 — `status = 403` no erro de CORS | 1 linha | Limpa os logs de erro, que é onde se vê tudo o resto |
| 5 | L-1, L-2 — validar `?userId` e o cursor | ~15 linhas | Elimina os dois únicos 500 conhecidos por entrada do utilizador |
| 6 | L-5 — validar `X-Request-Id` | 1 linha | Protege a integridade dos logs |
| 7 | L-3 — apertar o formato em `resolveImageInput` | 1 linha | — |
| 8 | L-12 — `umask 077` no `backup.sh` | 2 linhas | Os dumps contêm hashes de passwords |
| 9 | M-2 — apagar ficheiros órfãos | ~1 dia | Fecha a lacuna do direito ao apagamento e o risco de disco cheio |
| 10 | L-10 — hash de referência no login | ~5 linhas | Fecha a enumeração por tempo |
| 11 | L-4 — redirecionamentos e leitura por pedaços | ~20 linhas | Fecha a última nuance de SSRF |
| 12 | L-7 — `token_version` para revogação | ~meio dia | Maior valor de segurança, mas custa uma consulta por pedido autenticado |
| 13 | L-11.3 — Dependabot ou `npm audit` no CI | ~10 linhas | Mantém o A06 verde sozinho |

Os pontos 1 a 8 somam, no total, menos de cinquenta linhas.

---

## 9. O que não foi coberto

Por honestidade sobre os limites desta auditoria:

- **Não houve teste de intrusão contra a instância de produção.** Toda a
  verificação dinâmica correu contra uma instância local com um PostgreSQL
  efémero.
- **Não foi auditada a configuração real do servidor de produção** (sistema
  operativo, firewall, acesso SSH, rotação de segredos, retenção efetiva das
  cópias de segurança, permissões do `.env.prod` em disco).
- **Não foi feita análise de fuzzing** nem teste de carga/DoS sustentado.
- **Não foi revista a configuração da Google Cloud Console** (URIs de
  redirecionamento registados, estado do ecrã de consentimento, âmbito das
  credenciais) nem a do fornecedor de SMTP (SPF, DKIM, DMARC).
- **Não foi revisto o conteúdo do currículo** (`shared/trails/*.json`) do ponto
  de vista de segurança — é conteúdo versionado e revisto em PR, mas nunca foi
  passado por um validador de segurança.
- **A análise da árvore de dependências ficou-se pelo `npm audit`**; não houve
  revisão manual de pacotes quanto a *typosquatting* ou a manutenção
  abandonada.
