# Imagens das lições e dos quizzes

Faltam **29** imagens. 69 já aprovadas e fora desta lista.

O inventário completo, incluindo as aprovadas, está nos `README.md` de cada pasta.

## Como ligar

1. Coloque cada foto em `public/lessons/<pasta>/` com o nome da coluna **Ficheiro**.
2. Corra `npm run images:wire`.
3. Confirme com `npm run check:images`.
4. Se a base de dados já foi semeada, corra `npm run db:sync-curriculum`.

Extensões aceites: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`.
Pode juntar um sufixo a seguir a `--`: `u1-l5--cebola.jpg` liga na mesma.
Pode correr `images:wire` quantas vezes quiser — só liga o que já existe.

## Nota sobre os quizzes

As perguntas com foto são do tipo `judge`: o utilizador avalia a imagem.
A maioria tem de mostrar deliberadamente o estado **errado** (a panela em
fervura quando se pergunta se é lume brando, a pega de faca incorreta).
Uma foto bonita do estado certo torna a pergunta impossível de responder.

## Main Course (curso base) — `public/lessons/main-course/`

| Ficheiro | Lição | Tipo | A foto mostra |
| --- | --- | --- | --- |
| `u1-l1-q4.jpg` | Quiz: esta bancada está pronta? | quiz — resposta certa: NÃO | Bancada APERTADA: a tábua encurralada entre taças, embalagens, um tacho. Sem espaço livre à volta. **Tem de mostrar o estado ERRADO. Se a bancada parecer arrumada, a pergunta fica sem resposta.** |
| `u1-l2-q2.jpg` | Quiz: esta faca está pronta? | quiz — resposta certa: NÃO | Lâmina pousada sobre um tomate a afundar/enrugar a pele SEM a cortar. **Estado ERRADO. A pele tem de ceder sem romper — é isso que se avalia.** |
| `u1-l3.jpg` | Pegar na faca | lição | Mão em pinch grip: polegar e indicador a apertar a lâmina à frente da virola, restantes três dedos no cabo. Plano próximo e nítido. **Os dedos têm de estar na LÂMINA, não só no cabo.** |
| `u1-l3-q4.jpg` | Quiz: esta pega está correta? | quiz — resposta certa: NÃO | Pega ERRADA: mão toda à volta do cabo e indicador esticado ao longo do dorso da lâmina. **O indicador esticado por cima tem de ser inequívoco na foto.** |
| `u1-l4-q3.jpg` | Quiz: pode cortar-se assim? | quiz — resposta certa: NÃO | ERRADO: dedos esticados e espalmados a segurar uma cenoura, pontas expostas junto à lâmina. **O contraste com u1-l4 é a lição toda — mesma cenoura, mesmo enquadramento, mão errada.** |
| `u1-l5-q4.jpg` | Quiz: serve para um refogado? | quiz — resposta certa: NÃO | Cebola picada IRREGULAR: pedaços do tamanho de uma ervilha misturados com tiras finas, na mesma tábua. **A disparidade de tamanhos tem de saltar à vista.** |
| `u1-l6-q5.jpg` | Quiz: as taças estão bem colocadas? | quiz — resposta certa: NÃO | Fogão com frigideira ao lume; taças de ingredientes colocadas à DIREITA do fogão; mão direita a segurar a colher sobre a frigideira. **Foto difícil mas específica: o erro é a taça estar do lado da mão que mexe.** |
| `u2-l1-q4.jpg` | Quiz: pode continuar? | quiz — resposta certa: NÃO | Frigideira VAZIA com o óleo claramente a FUMEGAR, fios de fumo a subir. Nada dentro. **O fumo tem de ser óbvio e a frigideira tem de estar vazia.** |
| `u2-l2-q2.jpg` | Quiz: certo ou errado para suar cebola? | quiz — resposta certa: ERRADO | Cebola numa frigideira em lume VIOLENTO: chama alta a lamber os lados, fumo, bordos da cebola já a tostar/queimar. **Tem de parecer agressivo. Cebola dourada e calma anula a pergunta.** |
| `u2-l3.jpg` | Cada gordura tem o seu calor | lição | As gorduras lado a lado e identificáveis: azeite virgem extra, manteiga, óleo neutro. **Comparação entre gorduras, não uma frigideira.** |
| `u2-l3-q2.jpg` | Quiz: serve para acabar o molho? | quiz — resposta certa: NÃO | Manteiga numa frigideira com partículas CASTANHO-ESCURAS/PRETAS e líquido escuro. Queimada, passou do noisette. **Manteiga dourada cor de avelã é a resposta contrária — tem de estar visivelmente além disso.** |
| `u2-l4.jpg` | Dourado, não escuro | lição | Cebola numa frigideira cor de mel, reduzida a metade do volume, brilhante. **Cor de mel. Nem pálida nem castanha escura.** |
| `u2-l4-q2.jpg` | Quiz: tirar ou deixar mais? | quiz — resposta certa: TIRAR | Mesmo estado de u2-l4 — cor de mel, reduzida a metade, brilhante — mas enquadramento diferente (picado sobre a frigideira). **Estado CERTO. Foto distinta de u2-l4, não a mesma imagem.** |
| `u3-l2.jpg` | O ovo cozinha com o calor que já tem | lição | Ovos mexidos na frigideira, brilhantes, acabados de coalhar e ainda ligeiramente moles. **Nunca ovos secos ou granulados.** |
| `u3-l3-q2.jpg` | Quiz: correu mal? | quiz — resposta certa: NÃO | Beringela às fatias, salgada, com gotas de água claramente puxadas à superfície, num escorredor ou tábua. **A água à superfície tem de ser visível — é a resposta.** |
| `u4-l2-q4.jpg` | Quiz: serve o arroz? | quiz — resposta certa: NÃO | Arroz no tacho com água ainda visivelmente parada à superfície. **A água à superfície é o que se avalia.** |
| `u4-l3-q2.jpg` | Quiz: está al dente? | quiz — resposta certa: SIM | MACRO de um fio de esparguete partido ao meio, com o fio branco FINO visível no centro. **Estado CERTO. Tem de ser macro — o fio branco é minúsculo.** |
| `u5-l1.jpg` | Começa pelo que demora mais | lição | Bancada calma a meio da preparação: um tacho em lume brando e tudo o resto já cortado em taças. **Transmitir ordem e sequência, não azáfama.** |
| `u5-l1-q3.jpg` | Quiz: isto é boa organização? | quiz — resposta certa: NÃO | CAOS: três tachos/frigideiras ao lume ao mesmo tempo e legumes ainda inteiros por cortar na tábua. **Estado ERRADO. Os três tachos e os legumes por cortar têm de aparecer na mesma foto.** |
| `u5-l3-q2.jpg` | Quiz: serve-se assim? | quiz — resposta certa: NÃO | Prato DESLEIXADO: comida espalhada até ao aro e salpicos de molho por cima do bordo. **Estado ERRADO — contraste direto com u5-l3.** |

## Gymbro — `public/lessons/gymbro/`

| Ficheiro | Lição | Tipo | A foto mostra |
| --- | --- | --- | --- |
| `gymbro-porcionar.jpg` | Pesar e porcionar | lição | Peito de frango cru numa balança de cozinha com o peso legível, ou várias porções iguais alinhadas. **A balança/porção é o assunto, não um prato pronto.** |
| `gymbro-proteina-dia.jpg` | Proteína ao longo do dia | lição | Três ou quatro refeições do dia alinhadas — pequeno-almoço, almoço, snack, jantar — cada uma com proteína visível: ovos, iogurte, frango, atum. **Tem de haver MAIS do que uma refeição na foto. Um prato único não transmite "ao longo do dia".** |

## Italiano — `public/lessons/italian/`

| Ficheiro | Lição | Tipo | A foto mostra |
| --- | --- | --- | --- |
| `pasta-agua-cozedura.jpg` | A água da cozedura é um ingrediente | lição | Concha ou caneca a tirar água turva e amidalada do tacho da massa. **A turvação tem de se ver. Água transparente anula a lição.** |

## Japonês — `public/lessons/japanese/`

| Ficheiro | Lição | Tipo | A foto mostra |
| --- | --- | --- | --- |
| `jp-u1-l3-q1.jpg` | Quiz: técnica correta? | quiz — resposta certa: NÃO | Tacho de sopa de miso turva em FERVURA FORTE, a borbulhar intensamente. **Estado ERRADO. A fervura tem de ser inequívoca.** |
| `japones-oleo.jpg` | Óleo quente q.b., não a mais | lição | Migalhas de panko largadas em óleo quente, a chiar e a subir à superfície, em plano próximo. **O teste da migalha tem de ser reconhecível. Óleo com comida já lá dentro não serve.** |

## Mexicano — `public/lessons/mexican/`

| Ficheiro | Lição | Tipo | A foto mostra |
| --- | --- | --- | --- |
| `mx-u1-l1-q2.jpg` | Quiz: estão tostados que chegue? | quiz — resposta certa: SIM | Tomates com manchas pretas empoladas bem visíveis, mas não queimados por igual. **Estado CERTO. Manchado, não uniformemente carbonizado.** |

## Português — `public/lessons/portuguese/`

| Ficheiro | Lição | Tipo | A foto mostra |
| --- | --- | --- | --- |
| `portuguesa-demolha.jpg` | Demolhar o bacalhau | lição | Postas de bacalhau salgado submersas em água numa taça ou tabuleiro. **A demolha, não um prato cozinhado.** |
| `portuguesa-arroz.jpg` | Malandrinho, não seco | lição | Arroz de marisco num tacho de barro, visivelmente CALDOSO e solto, com marisco à vista. **O caldo tem de se ver. Arroz seco e solto contradiz a lição inteira.** |

## Universitário — `public/lessons/university/`

| Ficheiro | Lição | Tipo | A foto mostra |
| --- | --- | --- | --- |
| `uni-congelar.jpg` | O congelador é a segunda despensa | lição | Recipientes ou sacos de porções individuais, etiquetados, arrumados no congelador. **Porções individuais E o congelador. Recipientes na bancada não transmitem a lição.** |

