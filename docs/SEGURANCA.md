# ChefXP — Funcionamento e Segurança

Documentação técnica e registo da validação de segurança da aplicação.

Última auditoria: 2026-09-28 · Âmbito: aplicação inteira (servidor, cliente,
base de dados, infraestrutura, cadeia de entrega)

---

## Índice

1. [Estado](#1-estado)
2. [O que a aplicação é e o que faz](#2-o-que-a-aplicação-é-e-o-que-faz)
3. [Como o código funciona](#3-como-o-código-funciona)
4. [Os controlos de segurança, um a um](#4-os-controlos-de-segurança-um-a-um)
5. [Como isto é verificado](#5-como-isto-é-verificado)
6. [Riscos assumidos](#6-riscos-assumidos)
7. [Cobertura OWASP Top 10](#7-cobertura-owasp-top-10-2021)
8. [O que uma auditoria futura deve cobrir](#8-o-que-uma-auditoria-futura-deve-cobrir)

---

## 1. Estado

O ChefXP é uma aplicação web full-stack (React 19 + Express 5 + PostgreSQL 15,
~41 000 linhas) para aprender a cozinhar de forma gamificada. Foi auditada na
totalidade — 83 endpoints HTTP, 22 migrations, 32 tabelas, o cliente React, o
service worker, os guiões de operação e o pipeline de CI/CD — com análise
estática e com verificação dinâmica contra instâncias a correr em modo de
desenvolvimento e de produção.

**Não há achados de segurança em aberto.** Os três riscos que restam são
escolhas assumidas, estão descritos na [secção 6](#6-riscos-assumidos), e
nenhum deles é uma falha explorável.

|                                       |                                                              |
| ------------------------------------- | ------------------------------------------------------------ |
| Vulnerabilidades nas dependências     | **0** (produção e desenvolvimento)                           |
| Testes                                | **549** — 205 unitários, 194 de integração, 150 de interface |
| Lint / typecheck                      | 0 erros                                                      |
| Verificações automáticas de segurança | hardening (CDNs), CSP num browser real, `npm audit` no CI    |

A postura geral acerta, por construção, em quase tudo o que costuma correr
mal: sessão em cookie `HttpOnly` + `__Host-` + `SameSite=Strict` com
revogação, CSRF em todas as escritas com comparação em tempo constante, 100 %
das consultas SQL parametrizadas, validação Zod em todos os endpoints,
autorização decidida sempre no servidor e lida da base a cada pedido, XP como
livro-razão imutável e idempotente, tipo de imagem detetado pelos bytes, e uma
CSP restritiva cuja eficácia é medida num Chrome a sério em cada build do CI.

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
- **Competências** ligadas a lições, com pré-requisitos, sincronizadas para a
  base no arranque de forma idempotente.

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
definitiva da conta com confirmação por nome e password — que leva atrás as
fotografias em disco, não só as linhas na base — e bloqueio de utilizadores.

### 2.7 PWA / offline

Instalável, com service worker escrito à mão. O "shell" e os assets ficam em
cache; os GET da API são rede-primeiro com cache de segurança; **nada que
escreva é enfileirado** — um POST offline falha e diz que falhou, porque o XP é
um livro-razão com ordem. Terminar sessão limpa a cache da API e a outbox.

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
        │                     xpLedger, imageStore, imageCleanup, mailer,
        │                     blocks, i18n, moderation
server/services/*.js          ORQUESTRAÇÃO — trailService, challengeSettlement
        │
server/routes/*.js            HTTP — validar, autorizar, responder
        │
src/                          React: pages → features → components → services
```

A regra estrutural é consistente: **tudo o que é uma decisão está em
`server/domain/`, é uma função pura, e tem testes que correm em
milissegundos**. As rotas limitam-se a obedecer. É isto que permite 205 testes
unitários sem levantar base de dados nenhuma.

### 3.2 Arranque (`server/index.js`)

```
getPool() → runMigrations() → syncCurriculum() → ensureUploadDir()
          → createApp() → startChallengeScheduler() → listen()
```

As migrations correm no arranque, cada uma numa transação, registadas em
`applied_migrations`. O sync do currículo corre logo a seguir e é idempotente.
`SIGTERM`/`SIGINT` fecham o agendador, o servidor e o pool, por essa ordem.

### 3.3 Cadeia de middleware (`server/app.js`)

```
requestId → helmet → compression → cookieParser → cors
          → rateLimit (/api, 1000/15min)
          → express.json (6 MB em /recipes /missions /challenges, 1 MB no resto)
          → language (?lang=)  → csrfProtection
          → rotas → notFound → static(dist) → errorHandler
```

- `app.disable("x-powered-by")` e `trust proxy: 1` (há um Caddy à frente).
- O rate limit é **só em `/api`**: aplicado a tudo, cada ícone e cada ficheiro
  de `/assets` contava para o orçamento.
- O limite de 6 MB é cirúrgico — só nas três rotas que transportam imagem em
  base64. O resto da API fica em 1 MB.

### 3.4 Autenticação

**Sessão.** JWT HS256 com `{sub, email, ver}`, TTL de 7 dias, em cookie
`HttpOnly`. Em produção o cookie chama-se `__Host-token`: o prefixo obriga a
`Secure`, `Path=/` e ausência de `Domain`, o que impede um subdomínio
comprometido de escrever por cima da sessão. O token **nunca** vai no corpo da
resposta, nem em desenvolvimento.

**Revogação.** `ver` é o `token_version` da conta. O `requireAuth` compara-o
com o valor guardado a cada pedido, e incrementar a coluna fecha todas as
sessões dessa conta de uma vez — é o que o `/reset-password` faz. Custa uma
consulta por chave primária em cada pedido autenticado; é o preço de poder
expulsar quem não devia lá estar sem esperar uma semana pelo fim do JWT.

**Passwords.** bcrypt com 12 rondas. Política de 8 caracteres, uma maiúscula,
um número e um caractere especial — aplicada no servidor
(`domain/passwordPolicy.js`) e espelhada no cliente só para feedback visual.
O login compara sempre contra um hash, mesmo quando a conta não existe, para
que as duas respostas custem o mesmo tempo.

**Criar conta em dois tempos.** Escreve-se o email → chega um link → só do outro
lado é que se escolhe nome e password. Enquanto o link não for aberto existe
apenas uma linha em `pending_signups`: nenhum nome tomado, nenhum email
ocupado. O `POST /auth/register` de uma vez só **desativa-se** (404) quando há
SMTP configurado.

**Tokens de email.** 32 bytes de `crypto.randomBytes` em hexadecimal; na base
fica só o SHA-256. Uma hora para redefinir password, 24 horas para confirmar
email e para criar conta. Pedir um link novo apaga o anterior. O consumo é feito
com `SELECT ... FOR UPDATE` dentro de uma transação, por isso dois pedidos com o
mesmo token não passam os dois.

**Google OAuth.** Fluxo Authorization Code do lado do servidor — o browser nunca
fala com a Google a partir da página, só é reencaminhado. `state` de 32 bytes em
cookie `HttpOnly` + `SameSite=Lax` (Strict quebraria o regresso, que é uma
navegação de topo cross-site). O `id_token` é validado em `domain/oauth.js`:
emissor, `aud` igual ao nosso `client_id`, `exp`, `sub`, e **`email_verified ===
true`** — sem isto, uma conta Google com o email de outra pessoa dava acesso à
conta dela. Uma conta local por confirmar é ligada, porque a Google acabou de provar que
a caixa de correio é de quem entra — mas perde a password e todas as sessões
abertas (`token_version + 1`), para que quem a registou sem ser dono do email
não fique com acesso. Recupera-se uma password pelo fluxo normal, por email.

### 3.5 Autorização

Duas camadas, ambas no servidor:

1. `requireAuth` — lê o cookie, verifica o JWT, confirma a versão do token
   contra a base, põe `req.user`. Está no topo de **todos** os routers.
2. `requireModerator` / `requireAdmin` (`lib/moderation.js`) — vão buscar o papel
   **à base de dados a cada pedido**. Deliberadamente não está no JWT: um papel
   dentro do token ficava congelado até o cookie expirar, e retirar permissões a
   alguém passava a demorar uma semana.

As regras de quem pode o quê são funções puras em `domain/moderation.js`
(`roleChangeRefusal`, `accountDeletionRefusal`, `commentDeleterRole`,
`reportRefusal`), cada uma com o motivo da recusa por escrito.

### 3.6 CSRF

Double-submit em **todas** as escritas, com ou sem sessão: cookie `csrf`
legível pelo JavaScript + header `X-CSRF-Token`, comparados com
`crypto.timingSafeEqual`. Incluir o login e o registo fecha o _login CSRF_ —
um site terceiro a iniciar sessão no browser de alguém com as credenciais do
atacante, para que essa pessoa passe a alimentar uma conta que não é dela. Não
custa nada a quem chega: o cliente pede `GET /api/auth/csrf` antes da primeira
escrita.

### 3.7 Validação

`middleware/validate.js` + `schemas/index.js`: Zod em `body`, `query` e `params`
em todos os 83 endpoints. Os resultados ficam em `req.valid` (no Express 5
`req.query` é um getter e não pode ser reatribuído). Como o Zod remove chaves
desconhecidas por omissão, isto é também a defesa contra _mass assignment_.
O cursor de paginação, que é base64 nosso mas volta pela mão de quem quiser,
passa pelo mesmo tratamento: um cursor que não valide é tratado como ausente.

### 3.8 XP como livro-razão

`users.xp` **não é um contador que alguém incrementa**. É sempre
`SUM(amount) FROM xp_events`, recalculado a cada movimento.
`UNIQUE (user_id, source, source_ref)` torna a atribuição idempotente. Apagar
uma receita chama `revokeXp()`, que desconta também o dia certo em
`daily_activity` — sem isso, publicar e apagar em ciclo era uma forma de somar
XP por receitas que já não existem.

Toda a correção de respostas é feita no servidor (`gradeAnswers`): o
`heartsLeft` que o cliente mostrou não é aceite como facto, e o cliente nunca
recebe o gabarito.

### 3.9 Imagens

Só data URLs base64, e o tipo sai da **assinatura dos bytes** (`ff d8 ff`,
`89 50 4e 47`, `RIFF....WEBP`), nunca do MIME declarado. Máximo 3 MB. O nome do
ficheiro é um UUID gerado no servidor; `isStoredImagePath` só reconhece essa
forma exata, por isso nada além do que a aplicação gerou entra na base como
caminho de imagem.

**Ciclo de vida.** Apagar conteúdo apaga o ficheiro: uma receita apagada, uma
fotografia substituída, uma conta eliminada e uma imagem removida por moderação
levam o ficheiro atrás (`lib/imageCleanup.js`). A recolha é feita dentro da
transação e o `unlink` depois do `COMMIT` — ao contrário, um ROLLBACK deixava a
linha viva e o ficheiro morto, e dessas duas metades só uma se recupera. Um
tecto de 60 imagens por hora e por conta (`middleware/uploadLimit.js`) impede
que uma conta encha o disco, e só as 5 primeiras receitas de cada 24 horas pagam
XP (`RECIPES_PAID_PER_DAY`, `XP_RULES.recipesPaidPerDay`), para que publicar em
série não seja a via mais rápida de subir de nível; `npm run uploads:prune` mostra (e, com `--apply`,
apaga) o que possa ter escapado.

`saveRemoteImage` existe só para a fotografia de perfil da Google e **exige**
uma lista de anfitriões permitidos, revalidada a cada redirecionamento, recusa
tudo o que não seja `https:`, impõe um timeout, e lê o corpo por pedaços com um
tecto em vez de o carregar inteiro para memória.

### 3.10 Base de dados

PostgreSQL 15, SQL puro, sem ORM. 32 tabelas. **Todas as consultas usam
placeholders `$1, $2, …`**; os `UPDATE` com `SET` dinâmico constroem a lista de
colunas a partir de mapas fixos no código, nunca de entrada do utilizador.
Transações com `FOR UPDATE` em todos os pontos onde duas chamadas concorrentes
podiam pagar a dobrar (fecho de desafios, consumo de tokens, conclusão de
missões).

### 3.11 Cliente

React 19 + TanStack Query + React Hook Form + shadcn/ui. `services/api.ts`
centraliza o `fetch`: junta a língua ao URL, garante o token CSRF, distingue
"sem rede" de "servidor em baixo", e emite um evento quando a sessão expira.
O `ProtectedRoute` é conveniência — a autoridade é sempre o servidor.
Não há nenhum `dangerouslySetInnerHTML` nem nenhum `href` dinâmico em toda a
aplicação.

### 3.12 Infraestrutura

- **Dockerfile** multi-stage, runtime a correr como utilizador `node` (não root),
  `npm ci --omit=dev`, healthcheck.
- **docker-compose.prod.yml**: o Postgres e o Express **não expõem portas**; só o
  Caddy tem 80/443. Os uploads vivem num volume.
- **Caddy**: TLS automático do Let's Encrypt, HSTS de um ano. Os restantes
  cabeçalhos ficam no helmet, num sítio só.
- **Cópias de segurança** (`scripts/backup.sh`): `umask 077` e `chmod 700` na
  pasta de destino, porque o dump traz a tabela `users` inteira.
- **O seed nunca corre em produção**: `scripts/run-seed.mjs` recusa-se a arrancar
  com `NODE_ENV=production` ou contra uma base cujo nome contenha "prod". O seed
  cria contas com uma password que está escrita no repositório e promove uma
  delas a administrador — o que era uma frase no README é agora um `throw`.

---

## 4. Os controlos de segurança, um a um

### 4.1 Gestão de sessão

`HttpOnly` + `Secure` + `SameSite=Strict` + prefixo `__Host-` em produção, com
revogação por `token_version`. O token nunca é exposto ao JavaScript nem
devolvido no corpo. Redefinir a password fecha todas as sessões abertas dessa
conta, no mesmo instante e sem o cookie ter mudado.

### 4.2 Injeção SQL

Todas as 200+ consultas usam placeholders. Os quatro sítios com SQL construído
dinamicamente montam-no a partir de mapas fixos, e `notBlockedSql` — a única
função que recebe fragmentos de SQL como argumento — atira se o que lhe passam
não for um placeholder (`$n`) e uma coluna (`tabela.coluna`).

### 4.3 Autorização

O papel é lido da base a cada pedido, não do token. Os três degraus estão numa
escada de duas funções, não espalhados por dezenas de `role === "admin" ||`.
Um admin não cria outro admin pela aplicação — se pudesse, uma sessão roubada
bastava para abrir uma porta permanente. Todas as consultas de recursos por
utilizador têm `AND user_id = $n`.

### 4.4 XSS

React escapa tudo. Zero `href` dinâmicos (portanto zero vetores `javascript:`)
e zero `dangerouslySetInnerHTML` em toda a aplicação. Em produção, a CSP
(`script-src 'self'`, `script-src-attr 'none'`, `object-src 'none'`,
`base-uri 'self'`, `frame-ancestors 'none'`) fecha o resto, e há um teste com
um Chrome a sério que confirma que nenhum ecrã a viola. `nosniff` aplica-se
também a `/uploads`, e só entram três formatos raster verificados por
assinatura — não há caminho para um SVG com script.

### 4.5 Upload de ficheiros

Assinatura de bytes, limite de 3 MB, nome UUID gerado no servidor, tecto de
escrita por conta, apagamento ao apagar o conteúdo, e pasta servida com
`index: false` e `dotfiles: "deny"`.

### 4.6 SSRF

Há exatamente uma função que vai à rede a partir de um valor externo
(`saveRemoteImage`). A lista de anfitriões é argumento obrigatório e é
reverificada a cada redirecionamento; só `https:`; timeout; leitura com tecto.

### 4.7 Fuga de informação

O `errorHandler` nunca devolve stack traces: devolve um `requestId` que aparece
no log do servidor — e que só é aceite do cliente se for mesmo um UUID, para
que ninguém escreva o que quiser dentro dos nossos registos. Emails só saem
para o próprio. O papel não é público. O `/forgot-password` e o `/signup`
respondem sempre o mesmo, exista ou não a conta, inclusive quando o SMTP falha.
Entrada malformada dá 400, e uma origem CORS recusada dá 403 — nunca 500, que
enterraria os erros a sério debaixo de ruído que qualquer pessoa pode gerar.

### 4.8 Segredos

`.gitignore` cobre `.env.*` com exceção dos exemplos. O `validateEnv` recusa
arrancar sem `DATABASE_URL`, sem `JWT_SECRET`, com um segredo com menos de 32
caracteres, ou com um dos segredos de exemplo conhecidos em produção. Também
exige que `GOOGLE_CLIENT_ID`/`SECRET` e `SMTP_USER`/`PASSWORD` venham aos pares.

### 4.9 Dependências

`npm audit` limpo na árvore completa e na de produção. O CI reprova um build
com uma vulnerabilidade alta em produção e avisa (sem reprovar) nas de
desenvolvimento, que não entram na imagem.

### 4.10 Privacidade e RGPD

Exportação completa (art. 20) e eliminação definitiva (art. 17) com dupla
confirmação — e a eliminação leva os ficheiros em disco, não só as linhas. O
logout limpa a cache da API do service worker e a outbox, sem o que a pessoa
seguinte no mesmo dispositivo via os dados da anterior sem rede.

---

## 5. Como isto é verificado

Três camadas, todas automáticas.

### 5.1 Testes

**549 testes**, todos a passar:

| Bateria                    | Nº  | O que prova                                                                                                                                  |
| -------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:unit`        | 205 | Regras puras: XP, currículo, tokens, política de passwords, papéis, caminhos de imagem, fragmentos de SQL, tradução                          |
| `npm run test:integration` | 194 | A API inteira contra um Postgres real: CSRF, cookies, transações, livro-razão, revogação de sessões, limpeza de imagens, robustez da entrada |
| `npm run test:ui`          | 150 | Componentes e ecrãs                                                                                                                          |

O harness de integração recusa-se a correr contra uma base cujo nome não
contenha "test": um `TRUNCATE` em tudo não deve depender de quem o corre se
lembrar de trocar a variável.

### 5.2 Verificações no CI

| Verificação                                                           | O que apanha                                                                      |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `scripts/hardening-check.mjs`                                         | Uma CDN externa que se tenha infiltrado na build                                  |
| `scripts/check-csp.mjs`                                               | Qualquer ecrã que viole a CSP, num Chromium a sério, com diálogos e menus abertos |
| `npm audit --omit=dev`                                                | Vulnerabilidade alta numa dependência que vai para produção                       |
| `scripts/check-pwa.mjs`, `check-offline*.mjs`, `check-responsive.mjs` | Regressões de PWA, offline e layout                                               |

O workflow corre com `permissions: contents: read`: nada nele escreve no
repositório, e um âmbito de leitura é o que impede que uma ação de terceiros
comprometida escreva no `main` com o nosso próprio token.

### 5.3 Verificação dinâmica manual

A auditoria correu estes testes contra instâncias em modo de desenvolvimento e
de produção. Repetem-se a cada revisão de segurança:

| #   | Teste                                                  | Esperado                               |
| --- | ------------------------------------------------------ | -------------------------------------- |
| 1   | 9 endpoints protegidos sem sessão                      | 401                                    |
| 2   | Cabeçalhos de segurança; `X-Powered-By`                | presentes; ausente                     |
| 3   | CSP em `NODE_ENV=production`                           | presente e restritiva                  |
| 4   | POST sem header CSRF, e com header errado              | 403                                    |
| 5   | Login sem CSRF                                         | 403                                    |
| 6   | `user` comum em `/admin`, `/moderation`, criar desafio | 403                                    |
| 7   | `role`/`xp`/`level` num `PATCH /users/me`              | ignorados                              |
| 8   | Payloads de SQL injection na pesquisa                  | sem efeito                             |
| 9   | JWT com assinatura falsa e com `alg: none`             | 401                                    |
| 10  | Sessão aberta depois de a password ser redefinida      | 401                                    |
| 11  | Enumeração de contas: mensagem **e** tempo de resposta | idênticos (~0,30 s)                    |
| 12  | HTML disfarçado de PNG, SVG, URL externo no upload     | 400                                    |
| 13  | Apagar receita / conta                                 | ficheiros saem do disco                |
| 14  | Tecto de escrita por conta                             | 429 acima do limite, leituras intactas |
| 15  | Path traversal em `/uploads`                           | nunca serve o ficheiro                 |
| 16  | IDOR: editar, apagar, ler email, apagar conta alheia   | 403 / campo ausente                    |
| 17  | `?userId=` malformado, cursor forjado                  | 400 / 200, nunca 500                   |
| 18  | `X-Request-Id` que não é UUID                          | substituído                            |
| 19  | Origem CORS não autorizada                             | 403                                    |
| 20  | Rate limit no login                                    | 429                                    |
| 21  | Fuga de stack trace                                    | nenhuma                                |

---

## 6. Riscos assumidos

O que não está fechado, porque fechá-lo custaria mais do que vale — ou porque
não é uma decisão de engenharia. Estão aqui para serem revistos, não para
serem esquecidos.

### 6.1 `style-src 'unsafe-inline'` na CSP

O CSP3 separa folhas de estilo injetadas (`style-src-elem`) de atributos
`style=` (`style-src-attr`), e só a segunda é precisa nesta app. Apertar a
primeira foi tentado e **medido**: o `react-remove-scroll`, que vem com os
diálogos do Radix, injeta um `<style>` quando um diálogo abre, e com
`style-src-elem 'self'` a aplicação abre com o scroll partido. Fechar isto
exigiria nonces por pedido e mudar a forma como a build serve a página.

Vale o que vale: um estilo injetado permite exfiltrar o conteúdo de um
formulário com seletores de atributo, mas **não executa código** —
`script-src` continua `'self'` sem `unsafe-inline` nem `unsafe-eval`, e
`script-src-attr` é `'none'`. E a exploração pressupõe uma injeção de HTML que
a aplicação, hoje, não tem por onde sofrer.

### 6.2 O pódio dos desafios pode ser manipulado com contas falsas

O vencedor de um desafio é decidido por número de gostos, e não há limite de
velocidade por conta nas reações. Criar contas para votar em si próprio é
possível; a confirmação obrigatória do email eleva o custo, não o elimina.

Isto é um problema de abuso de produto, não uma falha técnica, e a correção —
descontar gostos de contas novas, exigir email confirmado para votar, limitar
reações por hora — muda como os desafios funcionam para toda a gente. É uma
decisão de quem desenha o produto, não da segurança, e por isso fica por tomar
em vez de ser tomada aqui.

### 6.3 O deploy entra como `root`

`ssh root@$DEPLOY_HOST` no workflow. A chave está presa a um único guião no
`authorized_keys` (`command="/opt/chef-xp/scripts/deploy.sh"`): quem a tiver faz
deploy e mais nada — nem shell, nem túneis, nem ler o `.env.prod`. Um
utilizador de deploy sem privilégios seria uma camada a mais, mas exige criar
esse utilizador no servidor e dar-lhe acesso ao Docker, e essa mudança tem de
ser feita na máquina antes de o workflow mudar, senão o primeiro deploy a
seguir falha.

### 6.4 As imagens em `/uploads` são endereços-capacidade

São servidas sem autenticação, protegidas apenas pela impossibilidade de
adivinhar um UUIDv4. É a escolha certa para conteúdo de feed público — permite
cache agressiva e funcionamento offline — e deixa de o ser no dia em que
existir conteúdo privado. Fica registado para esse dia.

---

## 7. Cobertura OWASP Top 10 (2021)

| Categoria                               | Estado | Notas                                                                                                                                                           |
| --------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A01 — Quebra de controlo de acesso**  | ✅     | Papel lido da base a cada pedido; todas as consultas de recurso com `AND user_id = $n`; IDOR testado em 4 vetores                                               |
| **A02 — Falhas criptográficas**         | ✅     | bcrypt 12 rondas; tokens de 256 bits com SHA-256 na base; TLS + HSTS; cookies `__Host-`/`Secure`                                                                |
| **A03 — Injeção**                       | ✅     | 100 % parametrizado; XSS sem superfície (React + CSP verificada + zero sinks)                                                                                   |
| **A04 — Desenho inseguro**              | ✅     | XP como livro-razão idempotente; correção no servidor; admin só pela linha de comandos; regras puras e testadas                                                 |
| **A05 — Má configuração**               | ✅     | helmet, CSP medida, CORS fechado, `validateEnv`, contentor não-root, seed travado em produção, CI com âmbito mínimo                                             |
| **A06 — Componentes vulneráveis**       | ✅     | 0 vulnerabilidades; `npm audit` reprova o build                                                                                                                 |
| **A07 — Falhas de identificação**       | ✅     | Política de passwords, rate limits por rota, confirmação de email, OAuth validado, revogação de sessões, login em tempo constante                               |
| **A08 — Integridade de dados/software** | ✅     | `package-lock` versionado; assinaturas de bytes nas imagens; migrations transacionais; deploy por chave presa a um guião                                        |
| **A09 — Registo e monitorização**       | 🟨     | `requestId` por pedido (à prova de injeção), `role_changes` e fila de denúncias como trilho de auditoria — mas o log é `console`, sem agregação nem alarmística |
| **A10 — SSRF**                          | ✅     | Uma única superfície, com lista de anfitriões obrigatória revalidada a cada salto                                                                               |

---

## 8. O que uma auditoria futura deve cobrir

Os limites desta, por honestidade:

- **Não houve teste de intrusão contra a instância de produção.** Toda a
  verificação dinâmica correu contra instâncias locais.
- **Não foi auditada a configuração real do servidor** (sistema operativo,
  firewall, acesso SSH, rotação de segredos, retenção efetiva das cópias de
  segurança, permissões do `.env.prod` em disco).
- **Não houve fuzzing** nem teste de carga/DoS sustentado.
- **Não foi revista a configuração da Google Cloud Console** (URIs de
  redirecionamento, ecrã de consentimento, âmbito das credenciais) nem a do
  fornecedor de SMTP (SPF, DKIM, DMARC).
- **Não há agregação de logs nem alarmística.** O A09 acima fica a amarelo por
  isto: há trilho de auditoria, não há quem o veja quando algo corre mal.
- **A análise de dependências ficou-se pelo `npm audit`**; não houve revisão
  manual de pacotes quanto a _typosquatting_ ou a manutenção abandonada.
