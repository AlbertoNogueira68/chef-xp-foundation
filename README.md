# ChefXP

Plataforma social gamificada para quem cozinha. Projeto Final de Licenciatura.

Stack própria (Vite SPA + Express + PostgreSQL). Sem runtime Lovable/Supabase.

## O que a aplicação faz

- **Autenticação** por email/password, com sessão em cookie HttpOnly e proteção
  CSRF. A conta confirma-se por um código de seis dígitos enviado para o email,
  e a password recupera-se pela mesma via.
- **Percurso de aprendizagem** ao estilo Duolingo: unidades, lições diárias com
  preparação e quiz, corações, XP, streak e meta diária. Toda a progressão vive
  no servidor — o browser não guarda nem decide nada.
- **Feed social**: cozinhados (missões terminadas e partilhadas) e receitas na
  mesma lista, com gostos, comentários, seguidores e três vistas (Recentes,
  A seguir, Em alta).
- **Compromisso semanal**: dias certos («às terças e quintas») ou um número
  («três vezes, quando calhar»). A semana mostra o que foi cozinhado e o que
  ficou por cozinhar.
- **Perfil** com XP, nível, streak, conquistas e estatísticas, todas derivadas de
  dados reais.
- **Desafios** da comunidade.

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
| `npm test` | Testes do domínio (`node --test`, sem base de dados) |
| `npm run test:api` | Testes de rota contra Postgres a sério |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Build do frontend |
| `npm start` | Serve a API (+ `dist` em produção) |
| `npm run db:migrate` | Aplica as migrations SQL |
| `npm run db:seed` | Popula dados de demonstração |
| `npm run insights` | Relatório da telemetria (só leituras) |
| `npm run mail:check` | Diagnostica o SMTP (`-- tu@exemplo.pt` envia um teste) |
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

**O caminho para o feed é cozinhar.** `GET /api/feed` é a união de duas coisas
com o mesmo peso: um post — uma missão terminada e partilhada — e uma receita
publicada. Partilham a moldura inteira do cartão porque valem o mesmo; um
cozinhado não é um aviso de progresso ao lado das publicações a sério. Só as
runs partilhadas entram: o que se cozinhou sem publicar continua a contar no
perfil de quem o fez e não aparece a mais ninguém.

**O compromisso é a única parte da app que fala do futuro.** Lições, missões e
feed registam o que já aconteceu; nada disso traz a pessoa de volta na
quinta-feira. `cooking_plans` guarda a promessa e `cooking_sessions` o que
sucedeu a cada dia. Duas regras sustentam-no: falhar antes de prometer não é
falhar — nada anterior ao dia em que o compromisso passou a existir conta como
falha; e a linha gravada manda sobre a derivação, para que mudar de plano não
apague as falhas do plano anterior, que são o dado que este projeto quer medir.

Cozinhar num dia que não estava prometido conta na semana, e o dia prometido
que ficou em branco continua falhado: as duas coisas são verdade, e a faixa
mostra as duas. Falhar é consequência do tempo passar, não de uma ação, por
isso a varredura acontece à leitura — não há agendador neste projeto, e
inventar um para isto seria infraestrutura a mais.

**A telemetria é recolhida por inteiro e lida.** `mission_events` regista onde
se pede socorro, onde se volta atrás, onde se desiste, e agora também quando um
temporizador arranca e quando um comando de voz é entendido — dois tipos que o
CHECK previa e que nenhum código escrevia. `npm run insights` transforma isso
no relatório que responde às perguntas do projeto: em que passo se desiste, que
socorro se pede, quanto tempo se está mesmo na cozinha, quantas promessas se
cumprem.

Três regras sustentam a análise. Nenhuma percentagem sai sem o denominador de
onde veio — 100% sobre duas runs não é uma taxa, é uma coincidência, e amostras
abaixo de cinco vêm marcadas. Desistir e desaparecer são contados à parte,
porque quem fecha a app a meio de cozinhar não carrega em «abandonar» e essa é
a desistência comum. E o cliente só pode registar o que só ele sabe:
`rescue`, `back` e `abandon` continuam a ser escritos pelo servidor a partir
das ações verdadeiras, para não se poder forjar os dados em que a análise
assenta.

É um script e não um painel na app: os números vão para um documento escrito, e
um painel com agregados de toda a gente obrigava a inventar um conceito de
administrador que este projeto não tem.

**Os testes estão em duas camadas, e a divisão é deliberada.** `npm test` cobre
o domínio puro — curvas de XP, streaks, semanas, análise — sem I/O nenhum, e
corre em qualquer máquina em menos de um segundo. `npm run test:api` levanta a
app numa porta efémera e fala com um Postgres a sério.

A segunda camada existe porque o que ela cobre não é simulável: transações, o
`UNIQUE` que torna o XP idempotente, cursores compostos, `ON CONFLICT`,
varreduras por data. Um duplo em memória não reproduz nada disso — um teste que
finge a base não testa aquilo que aqui pode partir.

Sem `DATABASE_URL` os testes de rota saltam com um aviso em vez de falharem,
para quem clona o projeto não precisar de um Postgres à mão. No CI a variável
`REQUIRE_TEST_DATABASE=1` transforma essa ausência em erro: correr zero testes
e ficar verde é pior do que não ter testes, porque parece que estão a correr.

**Os códigos por email são guardados em hash, nunca em claro.** Um código por
usar vale tanto como a password — quem leia a tabela `email_codes` não pode
entrar em contas alheias nem confirmar endereços que não são seus. Seis dígitos
são cem mil hipóteses, por isso o que faz deles um segredo é a moldura: quinze
minutos de validade, cinco tentativas, um código vivo de cada vez, e um
intervalo de um minuto entre pedidos.

Nenhuma recusa diz porquê. Errado, expirado, já usado e inexistente respondem a
mesma frase — distingui-los diria a quem adivinha se vale a pena insistir. Pela
mesma razão, pedir um código de recuperação responde o mesmo exista ou não a
conta: caso contrário a rota passava a ser um verificador de endereços
registados.

**Confirmar o email não tranca a app.** A conta funciona por confirmar e há uma
faixa que pede o código. Trancar a entrada faria desistir quem ainda não sabe se
vale a pena ficar, e o que o código prova — que o endereço existe — só é mesmo
preciso no dia em que for necessário recuperar a conta.

**Mudar a password termina as outras sessões.** Os cookies são JWT de sete dias
e nada no servidor os podia cancelar, o que tornava a recuperação um gesto vazio:
quem tivesse entrado na conta ficava lá mais uma semana depois de a password ser
mudada precisamente para o expulsar. `users.session_epoch` entra no token e é
comparado a cada pedido. Custa uma leitura por pedido — é o preço de um token
que se pode revogar.

**Sem SMTP, o código vai para a consola em desenvolvimento e o arranque falha em
produção.** É a mesma regra do SSO da Google: meio configurado é pior do que não
configurado. Uma conta que se cria e nunca se consegue confirmar, sem a pessoa
perceber porquê, é pior do que um servidor que não sobe.

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
`comments`, `lesson_progress`, `daily_activity`, `xp_events`, `mission_runs`,
`posts`, `post_likes`, `post_comments`, `cooking_plans`, `cooking_sessions`,
`auth_identities`, `email_codes`.

Os cozinhados têm tabelas de gostos e comentários próprias, e não uma coluna
polimórfica nas das receitas: `posts.id` é BIGINT e `recipes.id` é UUID, e uma
coluna que servisse os dois obrigava a largar a chave estrangeira — que é
exactamente o que garante que um gosto não sobrevive ao que gostou.

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
