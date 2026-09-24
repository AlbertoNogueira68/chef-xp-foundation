# ChefXP

Plataforma social gamificada para quem cozinha. Projeto Final de Licenciatura.

Stack própria (Vite SPA + Express + PostgreSQL). Sem runtime Lovable/Supabase.

## O que a aplicação faz

- **Autenticação** por email/password, com sessão em cookie HttpOnly e proteção CSRF.
  Criar conta é em dois tempos: escreve-se o email, confirma-se o link que chega,
  e só então se escolhe o nome e a password — duas vezes, com o olho para ver o
  que se escreveu. A password exige 8 caracteres, uma maiúscula, um número e um
  caractere especial, e a lista vai ficando verde enquanto se escreve.
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
- **Desafios** da comunidade, criados por moderadores e administradores: quem
  cria escolhe o XP de participação, quantas fotos cada pessoa pode publicar, a
  duração em dias e o que valem os três lugares do pódio. **Participar é
  cozinhar para o desafio**: abre o formulário de publicação de sempre com o
  desafio agarrado, e a receita que sai dali é publicada no feed como qualquer
  outra — com o selo do desafio a dizer de onde veio. O XP de participação é
  pago uma vez por desafio, e no fim do prazo o ranking fecha sozinho: ganha
  quem tiver mais gostos, e um empate paga o mesmo a quem empatar.
- **Notificações** de gostos, comentários e seguidores novos, no sino do
  cabeçalho.
- **Rankings** semanal e global, e cada desafio ordenado por gostos.
- **Moderação**: qualquer receita, comentário ou conta pode ser denunciada; o
  dono de uma receita apaga comentários na sua receita; bloquear alguém
  esconde-o do feed, da pesquisa, dos comentários e do sino, nos dois sentidos.
  As denúncias vão para uma fila que um moderador trata.
- **A tua conta é tua**: exportar todos os dados num ficheiro e apagar a conta
  de vez, sem cópias nossas.
- **Recuperação de password** por email, com link de uma hora e uso único, e
  **confirmação do endereço** — ambas ficam desligadas se o servidor não tiver
  SMTP configurado, em vez de oferecerem o que não podem cumprir.

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

### Email

A recuperação de password e a confirmação de endereço precisam de SMTP.

**Em desenvolvimento não é preciso configurar nada.** O `docker-compose.dev.yml`
sobe um [Mailpit](https://mailpit.axllent.org/): um servidor de SMTP que aceita
tudo, não pede credenciais e não deixa sair nada para a Internet. A app aponta
para ele por omissão (`SMTP_AUTH=none`, porta 1025), e o que for enviado aparece
numa caixa de correio em **http://localhost:8025** em vez de ir parar à caixa de
alguém. Cria-se conta com qualquer endereço — `o-que-quiseres@teste.local` — e o
link de verificação está lá em segundos.

Quem corre o servidor na máquina em vez do contentor usa o mesmo Mailpit com
`SMTP_HOST=localhost`; a porta 1025 sai do compose para isso.

Para o envio a sério — produção, ou provar o Gmail em casa — preenche as
credenciais no `.env`. Elas ganham ao `SMTP_AUTH=none` do compose (com um aviso
no arranque), por isso basta preenchê-las para o Mailpit sair da frente. Sem
credenciais e sem Mailpit, tudo o resto funciona na mesma: as rotas respondem
404 e a interface não oferece o que não existe.

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587          # 587 = STARTTLS, 465 = TLS desde o início
SMTP_AUTH=login        # "none" para um servidor sem credenciais (Mailpit)
SMTP_USER=a-conta@exemplo.com
SMTP_PASSWORD=         # no Gmail, uma password de aplicação (2FA ligada)
MAIL_FROM=Chef XP <a-conta@exemplo.com>
```

O endereço do `MAIL_FROM` tem de ser o mesmo do `SMTP_USER` — o Gmail reescreve
ou recusa o que não for. Os links apontam para `FRONTEND_URL`, sempre do lado
do servidor: um link de recuperação que aceitasse o domínio de quem o pede era
entregar o token a quem o pedisse.

Para confirmar que as credenciais autenticam, sem enviar nada a ninguém:

```bash
node -e "import('dotenv/config').then(async()=>{const n=await import('nodemailer');const p=+(process.env.SMTP_PORT||587);await n.default.createTransport({host:process.env.SMTP_HOST,port:p,secure:p===465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}}).verify();console.log('SMTP ok')})"
```

- Health: http://localhost:3010/api/health

## Credenciais de seed (só em desenvolvimento)

| Email                 | Password  | Notas                                  |
| --------------------- | --------- | -------------------------------------- |
| `demo@chef-xp.local`  | `chef123` | chefdemo · nível 3 · **administrador** |
| `sous@chef-xp.local`  | `chef123` | souschef · **moderador**               |
| `maria@chef-xp.local` | `chef123` | mariacozinha · nível 5                 |
| `joao@chef-xp.local`  | `chef123` | joaoforno                              |

O seed inclui 6 receitas com fotografia, gostos e comentários reais, relações de
seguidor e 3 desafios.

## Scripts

| Script                                | Descrição                                              |
| ------------------------------------- | ------------------------------------------------------ |
| `npm run dev:all`                     | Vite + Express em paralelo                             |
| `npm run verify`                      | lint + tipos + testes + build (o mesmo que o CI corre) |
| `npm test`                            | Testes do servidor (`node --test`)                     |
| `npm run test:unit`                   | Só o domínio puro, sem base de dados                   |
| `npm run test:integration`            | API contra um Postgres real                            |
| `npm run test:ui`                     | Interface (Vitest + Testing Library)                   |
| `npm run typecheck`                   | `tsc --noEmit`                                         |
| `npm run build`                       | Build do frontend                                      |
| `npm start`                           | Serve a API (+ `dist` em produção)                     |
| `npm run db:migrate`                  | Aplica as migrations SQL                               |
| `npm run db:seed`                     | Popula dados de demonstração                           |
| `npm run role:set -- <email> <papel>` | Dá ou tira papéis: `user`, `moderator`, `admin`        |
| `npm run test:hardening`              | Build + bloqueia CDNs proibidas                        |
| `npm run check:responsive`            | Mede a app em 320–414px (ver `docs/RESPONSIVIDADE.md`) |
| `npm run lint`                        | ESLint                                                 |

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

**Duas línguas, e um botão no canto.** A app fala inglês e português, e
troca-se no botão que está sempre no canto superior direito. A língua é a
chave da árvore inteira (`key={lingua}` em `App.tsx`): trocar remonta tudo de
uma vez, em vez de pedir a cada componente que ouça a mudança. As chaves do
dicionário (`src/i18n/pt.ts`) são o próprio texto em inglês — lê-se o
componente e vê-se o que aparece no ecrã, sem saltar para uma tabela de
`auth.login.button.label`; uma chave em falta aparece em inglês em vez de
mostrar um código a quem está a usar a app, e há um teste que exige que não
falte nenhuma. Texto guardado em constantes de módulo é a armadilha desta
abordagem: `const X = t("…")` no topo do ficheiro fixa a língua do arranque,
por isso essas tabelas são funções.

**O servidor também fala as duas.** O currículo existe nas duas línguas com
os **mesmos ids** (`shared/curriculum.json` e `curriculum.pt.json`) — é isso
que permite traduzir sem tocar em lógica nenhuma, porque o progresso e o XP
andam sobre ids, e a correção compara a resposta com o gabarito da mesma
versão. A língua vai em `?lang=` no endereço de cada pedido e não num
cabeçalho: a cache do service worker é indexada pelo endereço, e com um
cabeçalho a lição guardada em português era servida a quem entretanto mudou
para inglês. As mensagens de erro nascem em inglês onde a regra é decidida e
são traduzidas num sítio só, à saída, no tratador de erros; os emails saem na
língua do pedido que os desencadeou.

**Quem ensina é uma personagem, não uma caixa de texto.** O Chef Sapo é a mesma
imagem em todo o lado — o ícone da app, a cara no cabeçalho e o avatar que
aparece nas lições. Durante uma lição é ele que dá as boas-vindas ao prato,
que explica cada passo da preparação, que faz as perguntas e que reage ao
acerto e ao erro; em modo cozinha aparece pequeno ao lado do passo, e é ele
que responde quando se pede socorro. O que ele diz está todo em
`src/lib/chefLines.ts`, e a escolha da frase é determinista: com
`Math.random()`, cada re-render do React trocava a frase a meio da lição.

**O gabarito nunca chega ao browser.** O currículo está em
`shared/curriculum.json`, lido apenas pelo servidor. A lição é enviada sem
`correctAnswer`; cada resposta é validada em
`POST /api/learning/lessons/:id/answer`, e no fim o servidor volta a corrigir
tudo antes de atribuir XP.

**Participar é publicar, e as duas coisas nascem na mesma transação.** Não há
rota que agarre uma receita já feita a um desafio: quem participa cozinha para
ele, e a receita e a participação são gravadas juntas em `POST /api/recipes`
com `challengeId`. Se o desafio recusar a entrada — acabou, ou a pessoa já
gastou as submissões que lhe cabiam — a receita não chega a ser publicada: quem
carregou em "participar" não pediu para publicar uma receita solta. Retirar a
participação faz o contrário do esperado e é de propósito: a receita fica
publicada, só perde o selo.

**Participar num desafio paga uma vez, não por submissão.** A entrada é um
evento de XP com `source_ref = challengeId`, portanto retirar a participação e
voltar a entrar não volta a pagar — e num desafio de três fotos, as três pagam
uma vez só. O evento fica no livro-razão mesmo depois de a participação ser
retirada: o livro-razão regista o que aconteceu, não o que é verdade agora.

**O fim de um desafio é uma tarefa agendada, não um botão.** Uma passagem de
cinco em cinco minutos (`server/lib/challengeScheduler.js`) fecha os desafios
cujo prazo passou: congela o ranking em `challenge_results`, paga o pódio pelo
livro-razão com a fonte `challenge_podium` e marca `settled_at`. O resultado é
congelado porque os gostos continuam a mudar depois do fim — sem isso, o pódio
que a aplicação mostra deixava de ser o que pagou o XP. Um moderador pode
forçar a passagem num desafio já terminado; o que não pode é fechar um que
ainda corre.

**Os gostos de uma pessoa somam-se, e um empate não desempata.** Num desafio de
três fotos, as três contam para a mesma pessoa — o limite é igual para toda a
gente, e avaliar só a melhor tornaria as outras decorativas. Duas pessoas com os
mesmos gostos ficam as duas no mesmo lugar e levam as duas o mesmo XP; o lugar
seguinte é o que o empate deixou livre (dois primeiros, e a seguir o terceiro).
Quem não teve um único gosto não sobe ao pódio, mesmo que tenha sido o único a
aparecer.

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

**O que vai no email de recuperação não existe no servidor.** `auth_tokens`
guarda o SHA-256 do token, nunca o token: uma cópia de segurança da base, ou um
SELECT indevido, dá hashes que não servem para redefinir nada. SHA-256 e não
bcrypt porque o segredo tem 256 bits de aleatoriedade — não é escolhido por uma
pessoa, não é reutilizado noutro sítio, e não há dicionário que o alcance.

**A conta só existe depois de o email estar provado.** Escrever o endereço não
cria nada: fica uma linha em `pending_signups`, que expira ao fim de um dia. O
nome de utilizador e a password escolhem-se do outro lado do link, e é aí que a
conta nasce — já confirmada, porque quem lá chegou leu aquela caixa de correio.
Um nome já tomado devolve 409 sem gastar o link, para quem se enganou no nome
não ter de voltar ao email.

Duas consequências que valem por si: ninguém consegue tomar o nome de
utilizador ou o endereço de outra pessoa sem confirmar nada, e **o registo
deixou de dizer quem tem conta aqui** — pedir o link para um email já
registado responde exatamente o mesmo, e o que muda é o email que sai (um
aviso, com o caminho para recuperar a password). Sem SMTP configurado nada
disto é possível, e aí fica de pé o registo antigo, de uma vez só: o
`/api/auth/providers` diz qual dos dois está ligado e o formulário desenha-se
em conformidade.

**A regra da password está nos dois lados.** O formulário mostra os quatro
requisitos a cumprir e recusa antes de ir à rede; o servidor volta a validar em
`server/domain/passwordPolicy.js`, porque quem faz o pedido pode ignorar o
formulário e falar diretamente com a API. A mesma regra vale para escolher uma
password nova pelo link do email — a porta das traseiras não pode ser mais
fraca do que a da frente. Contas antigas continuam a entrar com o que já
tinham: a regra aplica-se a quem escolhe uma password, não a quem faz login.

**Pedir um link de recuperação responde sempre o mesmo**, exista a conta ou
não, e um erro do servidor de email fica no registo em vez de ir na resposta —
senão a própria resposta passava a dizer quem tem conta aqui. Uma conta que só
entra pela Google não recebe link nenhum: dar-lhe uma password era abrir-lhe uma
segunda porta.

**Sem SMTP, a recuperação não existe** — as rotas respondem 404 e o ecrã de
entrada não mostra o link, tal como o botão da Google só aparece com
credenciais. `GET /api/auth/providers` é quem diz ao frontend o que está
ligado. Um projeto acabado de clonar tem de funcionar sem conta de email
nenhuma.

**A fotografia da Google é descarregada, não referenciada.** No primeiro
início de sessão com SSO, o servidor vai buscar a fotografia do `id_token`,
valida-lhe os bytes e grava-a em `/uploads` como qualquer outra imagem. Guardar
o endereço da Google era mais fácil e estava errado três vezes: a CSP de
produção bloqueia-o, punha o browser de quem vê o feed a pedir imagens à
Google, e esses endereços mudam. Só preenche quem não tem fotografia — a que
tu escolheres não é substituída a cada entrada. E o endereço é confrontado com
uma lista de anfitriões antes de o servidor lhe tocar: uma função que vai à
rede buscar o que lhe mandam, sem essa lista, é um pedido forjado à espera de
acontecer.

**As imagens são validadas pelos bytes, não pelo que o cliente diz.** O browser
redimensiona a fotografia num `<canvas>` antes de a enviar (o que dispensa
`sharp` no servidor), e o servidor confirma a assinatura do ficheiro antes de o
gravar com um nome UUID que só ele escolhe.

## Moderação

A aplicação aloja fotografias e comentários de outras pessoas. Durante muito
tempo não dava a ninguém maneira de reagir a eles: não havia denúncia, não
havia bloqueio, e o dono de uma receita não podia sequer apagar um comentário
na própria receita — só lhe restava apagar a receita inteira e perder o XP com
ela. Isto é o que existe agora.

**Denunciar** — uma rota só, `POST /api/reports`, para receitas, comentários e
contas: o que muda entre os três é a tabela onde se confirma que o alvo existe.
Cinco motivos fechados, e "perigoso" está entre eles porque isto é uma
aplicação sobre comida: uma receita que manda servir frango mal passado é um
problema diferente de um insulto, e quem modera precisa de os distinguir à
primeira vista. Denunciar duas vezes a mesma coisa não são duas denúncias (é um
índice único, não um `if`), e a resposta é a mesma da primeira vez à décima —
dizer o contrário era contar ao denunciante quantas outras pessoas já o tinham
feito.

**Apagar um comentário são três direitos e não um**: o autor apaga o que
escreveu, o dono da receita limpa a própria página, e o moderador age sobre uma
denúncia. A regra está numa função pura em `server/domain/moderation.js`, e a
rota limita-se a obedecer. De caminho, 404 e 403 deixaram de ser a mesma coisa:
não existe é 404, existe e não é teu é 403.

**Bloquear** é bidirecional e vale em todo o lado. Quem eu bloqueei desaparece
do feed, da pesquisa, da página de autor, dos comentários, das sugestões, das
listas de seguidores, das participações em desafios e dos cozinhados — e eu
desapareço-lhe a ele. Uma receita bloqueada responde 404 e não 403: dizer "não
podes ver esta" é dizer que ela existe. O bloqueio também desfaz o que já havia
— os dois sentidos do seguir caem, e as notificações entre as duas pessoas são
apagadas, porque o sino é precisamente o sítio onde não se quer voltar a ver o
nome de quem se acabou de bloquear. O que fica são os gostos e os comentários
já escritos: apagá-los mudava os contadores das receitas de terceiros por causa
de uma decisão privada entre dois.

A regra do bloqueio está escrita **uma vez**, em `server/lib/blocks.js`, e
entra como fragmento de SQL em cada consulta. Repetir o `NOT EXISTS` à mão em
cada uma era a receita para ficar escondido num ecrã e visível no outro.

**A fila** — `GET /api/moderation/reports` e
`POST /api/moderation/reports/:id/resolve` — é fechada a quem não tem
`role = 'moderator'`. O papel vive na base de dados e não no token de sessão:
dentro do JWT ficava congelado até o cookie expirar, e retirar permissões a
alguém passava a demorar uma semana. Cada linha da fila traz o conteúdo
denunciado ao lado, e fechar uma denúncia fecha todas as que apontam para o
mesmo alvo — cinco pessoas a denunciar a mesma fotografia são cinco linhas e
uma decisão só. Remover uma receita por aqui retira-lhe o XP, tal como o autor
a apagar na sua página: sem isso, a moderação era uma forma de ficar com os
pontos de uma receita que já não existe.

**O que fica de fora, e é deliberado:** contas não se suspendem nem se apagam
pela fila — a decisão é sobre conteúdo, uma peça de cada vez. É a única coisa
que um serviço a sério acrescentaria a seguir, e não se finge aqui.

### Administração

Três papéis numa escada, e não uma matriz de permissões por ação: a esta escala
uma matriz seria mais código para configurar do que para cumprir. Quem está
acima pode o que está abaixo, e isso está escrito em duas funções
(`canModerate`, `canAdminister`) em vez de espalhado por dez rotas.

| Papel       | O que pode                                                       |
| ----------- | ---------------------------------------------------------------- |
| `user`      | Denunciar e bloquear — o que qualquer pessoa pode                |
| `moderator` | A fila de denúncias e apagar conteúdo denunciado                 |
| `admin`     | Tudo o que o moderador pode, mais papéis e números da plataforma |

**O papel lê-se da base de dados a cada pedido**, e não do token de sessão.
Dentro do JWT ficaria congelado até o cookie expirar: retirar a moderação a
alguém passaria a demorar uma semana. Há um teste que prova exatamente isso —
despromover alguém fecha-lhe a fila no pedido seguinte, sem ele voltar a
entrar.

**Promover e despromover** é `PATCH /api/admin/users/:id/role`, com quatro
recusas que vivem em `domain/moderation.js`: o meu próprio papel não se muda
por aqui (um admin que se despromova pode ficar sem quem o volte a promover),
nenhum admin nasce dentro da aplicação (se um admin pudesse criar outro, uma
sessão roubada bastava para abrir uma porta permanente), um admin não é
despromovido por outro a um clique, e um papel que não existe não se atribui.
Cada mudança fica em `role_changes` — quem promoveu quem, e a partir de quê —
porque a coluna `role` sozinha só diz o estado de agora.

```bash
npm run role:set -- alguem@exemplo.com admin
```

O primeiro administrador nasce obrigatoriamente na linha de comandos, onde é
preciso ter acesso ao servidor — uma barreira de outra natureza. No seed de
desenvolvimento, o `chefdemo` já é administrador e o `souschef` moderador, para
a área existir num clone acabado de arrancar em vez de se ter de adivinhar que
há um guião de papéis.

**Os números** (`GET /api/admin/metrics`) são todos somados na hora sobre as
tabelas que já existem: nenhum é um contador guardado que alguém tenha de
manter sincronizado, pela mesma razão que o ranking não tem tabela própria.
"Ativos" é quem ganhou XP nos últimos sete dias e não quem abriu a aplicação —
isto não segue ninguém para saber a segunda coisa.

**A área `/admin`** é a interface de tudo isto, dentro da própria aplicação: a
fila com o conteúdo denunciado ao lado e os botões de remover e arquivar, as
contas com o que decide uma promoção (receitas, denúncias recebidas, email
confirmado), e os números. O moderador vê só a fila. Esconder não é proteger —
quem guarda as rotas é o servidor —, mas mostrar separadores que respondem 403
é oferecer portas fechadas.

**Uma denúncia sobrevive ao que a originou.** `reports.subject_id` não tem
chave estrangeira, e essa consequência é a mesma do livro-razão do XP: apagar o
conteúdo denunciado não apaga a denúncia. Uma fila que se esvazia sozinha
quando o autor apaga o que publicou não serve para nada.

Provado por 24 testes de domínio, 37 de integração e 13 de interface — o feed, a pesquisa, os
comentários, o sino, o seguir, as sugestões e a exportação de dados, todos
vistos do lado de quem bloqueou e do lado de quem foi bloqueado — e a escada
dos papéis, vista de cada um dos três degraus.

## Responsividade

A aplicação é de telemóvel e tem uma regra escrita para isso, em
[`docs/RESPONSIVIDADE.md`](docs/RESPONSIVIDADE.md): entre 320 e 414 px, nenhum
ecrã tem scroll horizontal, nada é cortado na margem, e tudo o que se carrega
tem pelo menos 32 px de altura.

A regra é verificada e não prometida — `npm run check:responsive` abre a
aplicação num browser e mede as nove rotas e os quatro diálogos em quatro
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

## App instalável, e o que sobrevive à falta de rede

A app instala-se no telemóvel como qualquer outra — ícone no ecrã inicial,
sem barra de endereço — e abre sem rede. Isto não é um enfeite: a app é usada
de mãos sujas ao pé do fogão, onde o wifi da casa costuma chegar mal.

**O que funciona offline:** a app abre, as rotas que já visitaste desenham-se,
e o que já leste continua a ler-se — receitas, passos de uma missão,
fotografias. Um `service worker` escrito à mão ([`public/sw.js`](public/sw.js))
guarda o shell na instalação, serve os ficheiros de `/assets/` da cache (têm o
hash no nome, são imutáveis) e trata os GET da API como rede primeiro e cache
como rede de segurança. As fotografias têm um teto de 60: a cozinha de alguém
não pode encher o disco do telemóvel.

**Uma lição respondida sem rede não se perde.** Responde-se às perguntas
todas, a lição vai até ao fim, e fica guardada no dispositivo até haver rede —
aí é enviada sozinha e o servidor corrige, paga o XP e atualiza o percurso.
Fechar a app pelo meio não muda nada: a fila sobrevive.

O que **não** acontece offline é a correção pergunta a pergunta. O gabarito
vive no servidor e é para lá que fica — mandá-lo para o browser para poder
corrigir sem rede seria pô-lo ao alcance de quem abrir as ferramentas de
programador. Por isso, offline, cada resposta diz "guardada" em vez de "certa"
ou "errada", e nenhum coração é descontado: descontar exigiria saber se a
resposta estava errada, que é exatamente o que não se sabe.

**A fila tem três regras**, todas em [`outbox.ts`](src/lib/offline/outbox.ts) e
[`sync.ts`](src/lib/offline/sync.ts): envia pela ordem por que as coisas
aconteceram e pára ao primeiro erro de rede (nunca salta um item para tentar o
seguinte, que num livro-razão de XP seria inventar uma história diferente);
recusa o que for grande demais para o armazenamento do browser; e tira da fila
o que o servidor recusar com um 4xx, avisando — insistir daria o mesmo amanhã.
Reenviar é seguro porque o XP está preso ao `sourceRef`: a mesma lição nunca é
paga duas vezes.

**As fotografias das missões também entram na fila.** A foto do checkpoint é
tirada no momento em que o prato está pronto — não é altura de ir procurar
wifi. Ela aparece logo no ecrã, servida do próprio dispositivo, e vai para o
servidor quando houver rede. É por isso que a fila vive em **IndexedDB** e não
em `localStorage`: uma fotografia tem megabytes e o `localStorage` tem cinco
para tudo. Há um teto por item (8 MB) e outro para a fila (50 itens), para uma
fila esquecida não encher o telemóvel de quem só queria cozinhar.

**A sincronização diz o que aconteceu, não que "enviou".** É a única altura em
que quem respondeu offline fica a saber o resultado: `"Lume brando": passaste!
+25 XP`, ou `"Lume brando": não passaste — 3 respostas erradas. A lição
continua aberta para repetires`. O chumbo fica mais tempo no ecrã do que o
sucesso, porque tem mais que ler. Acima de três itens, um resumo em vez de uma
pilha de avisos.

**Quando falha, diz porquê.** Há duas maneiras de não haver ligação e elas não
são a mesma coisa para quem está do outro lado: sem rede, a pessoa sabe o que
fazer; com rede mas com o servidor em baixo, não há nada que ela possa fazer e
mandá-la verificar a Internet que está a funcionar é a maneira mais rápida de
parecer que a app não sabe o que se passa. A barra do topo distingue os dois, e
nenhum pedido deixa escapar o `Failed to fetch` cru do browser — nem o pedido
de CSRF que precede qualquer escrita, que foi por onde esse erro escapou da
primeira vez.

**As atualizações não entram sozinhas.** Quando há uma versão nova, ela fica à
espera e a app pergunta. Trocar a aplicação por baixo dos pés de quem está a
meio de uma missão é a diferença entre um PWA e um susto.

Os ícones são gerados por código (`npm run icons`), sem dependências: a fonte é
um desenho só — `public/mascot/chef-frog.png`, o Chef Sapo — e o script
(que traz consigo um leitor e um escritor de PNG em `scripts/lib/png.mjs`)
tira dali os tamanhos do manifesto, o `favicon.ico` e os recortes redondos que
a app usa quando o chef aparece a falar. Muda-se o desenho, corre-se, e não
ficam seis binários no repositório que ninguém sabe refazer. E `npm run check:pwa` corre no CI a verificar que a build
continua instalável — um manifesto desligado do `index.html` ou um ícone que
não foi copiado não falha em lado nenhum, só faz desaparecer o botão de
instalar no telemóvel de quem estiver a avaliar.

### Como experimentar

Na app de sempre, em **http://localhost:5173**. Não há um segundo endereço para
o modo instalável: o service worker é registado também em desenvolvimento, e
está montado para que isso não atrapalhe — a página, a API e os módulos que o
Vite serve são todos _rede primeiro_, por isso com rede chega sempre o mais
recente e o hot reload não dá por nada. A cópia guardada só entra em jogo
quando a rede falha. (`VITE_DISABLE_SW=true` desliga o registo para quem
estiver mesmo a depurar cache.)

Instala pelo menu do browser, e depois `docker compose -f docker-compose.dev.yml
stop app` e recarrega: a app abre à mesma.

Para ver a build de produção tal como vai para o servidor:

```bash
npm run preview          # build + Express em http://localhost:4173
```

Abre, instala pelo menu do browser, e depois desliga o servidor e recarrega:
a app continua de pé. O `preview` existe porque `npm start` sozinho não serve
a build — o Express só a serve com `NODE_ENV=production` ou `SERVE_DIST=true`,
e arrancar em modo de produção sobre `http://localhost` impede o login (os
cookies passam a `Secure` e `__Host-`, que o browser recusa fora de HTTPS).

E, para não depender de ninguém se lembrar de testar isto à mão:

```bash
npm run check:offline           # Chrome sem interface, rede cortada, app tem de abrir
npm run check:offline-lesson    # e uma lição respondida offline tem de chegar ao servidor
```

O segundo faz o percurso inteiro num Chrome verdadeiro: entra com a conta de
demonstração, abre a lição seguinte, **corta a rede**, responde às perguntas
todas, confirma que ficaram guardadas e que nenhum coração se perdeu, lê a fila
no IndexedDB, **repõe a rede**, e só dá o teste por bom quando a fila se
esvazia, a app diz se a lição passou, e o XP do dia sobe — ou seja, quando o
servidor recebeu mesmo. Os testes em jsdom cobrem cada peça; isto cobre o
conjunto.

O que este script **não** cobre é o mesmo percurso com a fotografia de uma
missão: precisa de uma missão a meio e de injetar um ficheiro no seletor de
imagem, e automatizá-lo de forma estável dava um teste que falharia por razões
que não são o código. Foi verificado à mão pelo mesmo método (Chrome sem
interface, rede cortada, ficheiro injetado): a foto fica na fila em IndexedDB,
aparece logo no ecrã, e segue quando a rede volta. A fila e o envio em si são
os mesmos da lição, e esses estão cobertos.

Levanta o servidor (ou usa um que já esteja de pé, com
`CHECK_URL=http://localhost:4173`), abre um Chrome sem interface, espera pelo
service worker,
**corta a rede pelo protocolo de DevTools** e recarrega a página. Se aparecer o
dinossauro em vez da aplicação, falha. Corre no CI, e fala com o Chrome por
WebSocket — sem Puppeteer nem Playwright em `node_modules`.

### Uma armadilha que custou caro, deixada aqui por escrito

O `.env` deste projeto tem `NODE_ENV=development`, que o servidor Express
precisa. **O Vite lê o mesmo `.env`** — e com isso punha
`import.meta.env.PROD` a `false` até numa build de produção. Resultado: tudo o
que estivesse atrás de `if (import.meta.env.PROD)` — o registo do service
worker, entre outras coisas — era apagado do bundle como código morto. Sem
erro, sem aviso: o `sw.js` estava na build, o manifesto estava certo, os testes
passavam, e a app simplesmente não funcionava offline.

A correção está no [`vite.config.ts`](vite.config.ts): `PROD` e `DEV` passaram a
vir do `mode` da build, que é o que a linha de comandos diz, e não de uma
variável de ambiente que pertence ao servidor. E o `check:pwa` passou a
procurar o `"/sw.js"` dentro do JavaScript da build — porque foi exatamente
essa a verificação que faltava.

## Tamanho do que chega ao telemóvel

As rotas são carregadas à medida que se visitam, e as bibliotecas ficam em
ficheiros próprios para sobreviverem na cache entre deploys. Medido na build de
produção, a 390 px:

|                                    | Antes  | Agora  |
| ---------------------------------- | ------ | ------ |
| Landing                            | 820 kB | 515 kB |
| Percurso completo até aos desafios | 820 kB | 704 kB |

O percurso de aprendizagem é a rota mais pesada (67 kB) porque arrasta o leitor
de lições e o ecrã de missões — e agora só quem lá vai é que a paga.

## Base de dados

Migrations em `server/db/migrations/`, aplicadas no arranque e por
`npm run db:migrate`. São idempotentes — o CI corre-as duas vezes de propósito.

Tabelas principais: `users`, `recipes`, `challenges`, `recipe_likes`, `follows`,
`comments`, `lesson_progress`, `daily_activity`, `xp_events`,
`challenge_entries`, `notifications`, `user_blocks`, `reports`, `role_changes`.

## Produção

A aplicação corre atrás de um Caddy, que termina o TLS e pede o certificado ao
Let's Encrypt sozinho. O Express deixa de expor porta ao exterior: só é
alcançável pela rede interna do compose.

### Antes do primeiro arranque

1. **Uma máquina alcançável da internet**, com as portas 80 e 443 a chegarem
   lá. Um VPS, um servidor, ou uma ligação com reencaminhamento de portas — o
   Caddy precisa da 80 para o desafio do certificado e da 443 para servir.
2. **Um nome a apontar para o IP dessa máquina**, e a resolver _antes_ de
   levantares os contentores. Serve um domínio próprio ou um subdomínio
   gratuito (o `dedyn.io` do deSEC, por exemplo). Se o nome ainda não
   resolver, o Let's Encrypt recusa o certificado e o Caddy fica a tentar.
3. **O URI de redirecionamento da Google**, acrescentado à mesma credencial:
   `https://o-teu-nome/api/auth/google/callback`. E o ecrã de consentimento
   publicado — enquanto estiver "Em teste", só entram as contas que listares.

### Arrancar

```bash
cp .env.prod.example .env.prod
# preencher: SITE_DOMAIN, ACME_EMAIL, passwords, SMTP, Google
# e um JWT_SECRET novo:  openssl rand -hex 32

docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
curl -f https://o-teu-nome/api/health
```

O `--env-file` não é opcional: há variáveis que o próprio compose lê
(`SITE_DOMAIN`, `ACME_EMAIL`, `POSTGRES_*`), e não apenas o contentor.

As migrations correm no arranque. O currículo é sincronizado no arranque.

**O seed não corre, e não deve correr.** `npm run db:seed` cria o
`demo@chef-xp.local` com a password que está neste README — em produção isso é
uma conta aberta a quem passar.

### O que fica em disco

| O quê         | Onde                         | Perder isto significa                                       |
| ------------- | ---------------------------- | ----------------------------------------------------------- |
| Base de dados | volume `chef_xp_pgdata_prod` | Contas, receitas, XP, tudo                                  |
| Imagens       | volume `chef_xp_uploads`     | Fotografias de receitas e avatares                          |
| Certificados  | volume `caddy_data`          | Pedir tudo de novo — e o Let's Encrypt tem limites semanais |

Os dois primeiros não se reconstroem a partir do repositório. Há um guião
para eles:

```bash
./scripts/backup.sh /var/backups/chef-xp
```

Numa tarefa do cron, todas as noites:

```bash
0 3 * * * cd /opt/chef-xp && ./scripts/backup.sh /var/backups/chef-xp
```

### Notas

O CORS está fechado à `FRONTEND_URL`, e os cookies usam o prefixo `__Host-`
com `SameSite=strict` — o que exige HTTPS, e é a razão de isto não funcionar
em `http://` sem mais nada. Para demonstrar uma build de produção em
`http://localhost`, define `COOKIE_SECURE=false`.
