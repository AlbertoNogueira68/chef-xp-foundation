# ChefXP em 10 minutos

Uma folha para quem avalia o projeto. Não é preciso ler o `README.md` (724
linhas) nem o código (37 mil) para ver o que a aplicação faz e como está feita.

---

## Pôr a correr — um comando

```bash
docker compose -f docker-compose.dev.yml up
```

Abre em **http://localhost:5173**. A base de dados arranca, as migrations
aplicam-se e os dados de demonstração entram sozinhos.

Sem Docker: `npm ci && npm run db:migrate && npm run db:seed && npm run dev:all`
(precisa de Node 22.14+ e de um PostgreSQL 15 a correr).

**Conta de demonstração:** `demo@chef-xp.local` / `chef123`
(já tem nível 3, XP, receitas publicadas e gente a seguir — o ecrã não está
vazio). As outras contas estão no `README.md`.

---

## O percurso de 10 minutos

Por esta ordem. Cada passo mostra uma decisão diferente.

| #      | Faça isto                                                    | Repare nisto                                                                                                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | Crie uma conta nova (Sign up)                                | A password exige 8 caracteres, maiúscula, número e símbolo, e a lista fica verde enquanto escreve. A sessão é um cookie `HttpOnly` com CSRF double-submit: o token nunca chega ao JavaScript.                                                                                                            |
| **2**  | Faça a primeira lição até ao fim                             | **O gabarito nunca sai do servidor.** Abra as ferramentas de programador → Rede → veja a resposta de `GET /api/learning/lessons/u1-l1`: não tem `correctAnswer`, nem `explanation`, nem a ordem certa. Cada resposta é corrigida por `POST .../answer`. Não há maneira de ver as respostas pelo browser. |
| **3**  | Repare nos corações e no XP no fim                           | O XP é um **livro-razão** (`xp_events`), não um contador. Cada ponto tem origem e referência, e a mesma lição nunca paga duas vezes. É auditável e reconstruível: `users.xp` é sempre a soma dos eventos.                                                                                                |
| **4**  | Volte ao percurso e veja o cartão azul de **revisão**        | Só aparece quando há matéria em atraso. É repetição espaçada: o que se erra volta no mesmo dia, o que se acerta volta 1, 3, 7, 16 e 35 dias depois. É o que existe depois de as 19 lições acabarem.                                                                                                      |
| **5**  | Abra uma **missão de cozinha** (fim de uma unidade)          | Um passo por ecrã, temporizadores, comando por voz, e o ecrã não se apaga. **Sem fotografia não há missão acabada** — é a única verificação de que alguém cozinhou de facto.                                                                                                                             |
| **6**  | Publique uma receita com fotografia                          | A imagem é validada **pelos bytes**, não pela extensão. Renomear um `.exe` para `.jpg` não passa.                                                                                                                                                                                                        |
| **7**  | Veja o feed, dê um gosto, comente                            | Três vistas: Recentes, A seguir, Em alta. Bloquear alguém esconde-o nos dois sentidos — do feed, da pesquisa, dos comentários e das notificações.                                                                                                                                                        |
| **8**  | Entre como `demo@chef-xp.local` e abra a **Administração**   | Fila de denúncias, gestão de papéis, criação de desafios. Os desafios fecham-se sozinhos no prazo, e o pódio paga XP uma vez só.                                                                                                                                                                         |
| **9**  | Desligue o Wi-Fi e faça uma lição                            | A aplicação abre sem rede (é uma PWA instalável). A lição vai até ao fim e entra numa fila em IndexedDB; quando a rede volta, é enviada e o servidor corrige e paga. **Sem rede não há correção pergunta a pergunta** — o gabarito está no servidor, e é lá que fica.                                    |
| **10** | Definições → **Exportar os meus dados** e **Apagar a conta** | Sai tudo num ficheiro, e apagar apaga mesmo.                                                                                                                                                                                                                                                             |

---

## Como verificar que o que está escrito é verdade

Sem confiar em nada do que está acima:

```bash
npm run verify
```

Corre lint, verificação de tipos, **431 testes de servidor**, **204 de
interface**, a build, e duas verificações de que a app é instalável e não usa
CDNs proibidas. Demora poucos minutos.

E o percurso da tabela acima, automatizado num browser a sério:

```bash
npm run check:journey
```

Criar conta → primeira lição → publicar receita → vê-la no feed, 17 passos
verificados. É o mesmo caminho da demonstração.

Outras verificações que valem a pena:

| Comando                    | O que prova                                                                |
| -------------------------- | -------------------------------------------------------------------------- |
| `npm run check:responsive` | A app não parte em nenhuma largura de telemóvel, medido num Chrome a sério |
| `npm run check:offline`    | A app abre com a rede cortada                                              |
| `npm run metrics`          | As cinco contas de utilização, direto da base                              |
| `npm test`                 | O domínio puro e a API contra um PostgreSQL real                           |

---

## Como está feito, em sete linhas

- **Frontend** React 19 + TypeScript + Vite, Tailwind v4, TanStack Query, shadcn/ui.
- **Backend** Express 5 (ESM) + PostgreSQL 15 com SQL escrito à mão. **Sem ORM.**
- **Sessão** JWT em cookie `HttpOnly` + CSRF double-submit + bcrypt.
- **Domínio puro** separado das rotas (`server/domain/`): XP, currículo,
  revisão, desafios e moderação são funções sem base de dados, e é por isso que
  se testam em milissegundos.
- **Migrations** idempotentes e versionadas; o currículo sincroniza-se no arranque.
- **Infra** Docker Compose (dev e produção), Caddy, CSP, `helmet`,
  limites de pedidos por rota, cópias de segurança com retenção.
- **CI** GitHub Actions: lint, tipos, testes, build, migrations contra Postgres,
  responsividade, offline e a jornada completa num browser.

---

## Limitações, declaradas

Estão aqui porque foram decididas, não por terem passado despercebidas.

| Limitação                                          | Porquê, e o que custaria mudar                                                                                                                                                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Uma instância**                                  | O agendador que fecha os desafios é um `setInterval` dentro do processo. O que impede pagamento a dobrar não é o agendador — é o `FOR UPDATE ... settled_at IS NULL` na liquidação, que já está lá. Com duas instâncias continua correto; o que muda é haver duas passagens em vez de uma. |
| **Imagens em disco local**                         | Um volume do Docker, servido pelo próprio Express. Escala até onde um servidor escala. Passar para S3 é trocar `imageStore.js` — está isolado num módulo por essa razão.                                                                                                                   |
| **Sem CDN**                                        | As imagens saem do servidor. Para o número de utilizadores previsto, um CDN seria custo de operação sem benefício.                                                                                                                                                                         |
| **Sem avaliação com utilizadores até à data**      | O instrumento está pronto em `docs/AVALIACAO.md` (protocolo, tarefas, SUS, consentimento). As sessões são o passo seguinte.                                                                                                                                                                |
| **Português e inglês apenas**                      | A chave do dicionário é o texto em inglês, e um teste falha se faltar uma tradução. Acrescentar uma língua é acrescentar um ficheiro.                                                                                                                                                      |
| **A landing e o /auth trazem imagens do Unsplash** | São decorativas. Sem internet a aplicação funciona à mesma, mas esses dois ecrãs perdem a fotografia de fundo.                                                                                                                                                                             |

---

## Onde olhar no código

Se só houver tempo para cinco ficheiros:

| Ficheiro                                           | Porquê                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| `server/domain/xp.js`                              | A curva de níveis, o streak e as badges — domínio puro, testado exaustivamente |
| `server/domain/review.js`                          | A repetição espaçada: a escada de intervalos e a ordem de prioridade           |
| `server/routes/learning.js`                        | Como o gabarito é mantido do lado do servidor                                  |
| `server/lib/xpLedger.js`                           | O livro-razão idempotente do XP                                                |
| `src/features/challenges/hooks/useLessonPlayer.ts` | Como a lição continua sem rede sem inventar correções                          |

Os comentários do código explicam **porquê**, não o quê. É de propósito: o que
o código faz lê-se no código.
