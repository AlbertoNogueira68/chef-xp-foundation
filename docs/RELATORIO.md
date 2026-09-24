# ChefXP: Desenvolvimento de uma aplicação de aprendizagem culinária gamificada através de Vibe Coding

> **Estado deste documento:** os Capítulos 1 e 2 foram atualizados com o texto já escrito e entregue ao orientador em `Projeto1_R1_Correção.docx` (o texto entretanto reestruturado para "Estudo do estado da arte" → 2.1 aplicações → 2.2 gamificação → 2.3 comunidade, conforme a nota do orientador). Os restantes capítulos continuam gerados a partir do código, do `README.md`, do `docs/ROADMAP.md` e do histórico Git (2026-09-22) — descrevem a aplicação tal como existe hoje no repositório, e não o texto já submetido. Os capítulos 4 (comparação de apps — já coberta em 2.1, ver nota abaixo), 7 e 8 dependem de avaliação com utilizadores que ainda não foi feita, e estão marcados com `[A PREENCHER]`. Corrige à vontade — isto continua a ser um ponto de junção, não o texto final.
>
> **Nota importante para reconciliar com o código:** a secção "A Aplicação" do documento entregue (conceito, funcionalidades, público-alvo) descrevia funcionalidades que ainda não existiam no código — em particular um filtro de pesquisa por orçamento/budget e um filtro por preferências alimentares/alergias. **Isso já foi corrigido** (2026-09-22): ambos os filtros estão implementados, testados (testes de domínio e de integração) e verificados na app a correr — ver `server/db/migrations/020_recipe_budget_and_diet.sql`, `server/domain/dietaryTags.js`, `server/routes/recipes.js` e as páginas de pesquisa/publicar/editar receita. A única discrepância que continua por resolver é a framing de "cada nível = uma receita", que já não corresponde à separação atual entre lições/quiz (percurso de aprendizagem) e missões de cozinha (aplicação prática). Ver o quadro de reconciliação no final do Capítulo 2 e as notas no Capítulo 5/6.

---

## Elementos pré-textuais

- Capa — `[A PREENCHER]` (nome, instituição, curso, orientador, data)
- Folha de rosto — `[A PREENCHER]`
- Declaração de honra — `[A PREENCHER, se exigida pelo IPCB/curso]`
- Agradecimentos — `[A PREENCHER, opcional]`
- Resumo / Abstract / Palavras-chave — ver esboço no final deste documento
- Índice geral, índice de figuras, índice de tabelas, lista de abreviaturas — gerar no final, quando o texto estabilizar

---

## Capítulo 1 — Introdução

> Texto conforme entregue ao orientador (`Projeto1_R1_Correção.docx`), com pequenas notas de reconciliação com o código assinaladas em `>`.

### Introdução

A transição para a vida universitária está frequentemente associada a uma deterioração dos hábitos alimentares dos jovens. A falta de tempo, o stress académico e os orçamentos limitados, aliados ao fácil acesso a refeições prontas e fast-food, levam muitos jovens adultos a cozinhar cada vez menos, recorrendo com maior frequência a serviços de entrega de refeições e a restaurantes de fast-food, que oferecem opções nutricionalmente pobres.

Diversos estudos indicam que a ausência de competências básicas de culinária está diretamente relacionada com escolhas alimentares menos saudáveis. Paralelamente, muitos estudantes reconhecem que gostariam de cozinhar mais, mas sentem falta de motivação, orientação e apoio contínuo para criar hábitos sustentáveis na cozinha.

Embora existam recursos digitais dedicados à culinária, a maioria não consegue manter os utilizadores envolvidos a longo prazo, apresentando conteúdos passivos, pouco personalizados e desprovidos de mecanismos que promovam consistência. Assim, identifica-se uma lacuna evidente: a necessidade de uma solução que torne o processo de aprender a cozinhar mais motivador, acessível e integrado no quotidiano dos estudantes.

A utilização de elementos de gamificação, como progressão, recompensas, desafios e feedback imediato, tem demonstrado um elevado potencial para aumentar o envolvimento e promover mudanças comportamentais. Esta abordagem revela-se promissora para transformar a aprendizagem culinária numa experiência interativa e mais apelativa.

É neste contexto que se propõe o desenvolvimento de uma aplicação móvel gamificada, concebida para incentivar os estudantes universitários a cozinhar com maior frequência, desenvolver competências culinárias e adotar práticas alimentares mais equilibradas.

### 1.1. Enquadramento do Projeto

A entrada no ensino superior marca um período de profundas transformações na vida dos jovens adultos, caracterizado por uma maior independência, orçamentos limitados, rotinas académicas instáveis e pressões sociais. Estas mudanças frequentemente resultam em padrões alimentares menos saudáveis, uma vez que muitos estudantes tendem a preparar menos refeições em casa, optando por alternativas rápidas e nutricionalmente desequilibradas. De acordo com um estudo sobre estudantes do ensino superior, verificou-se um consumo inferior ao recomendado de frutas, vegetais e laticínios, evidenciando hábitos alimentares inadequados entre esta população [1].

Em Portugal, a transição para a universidade também está associada a dificuldades alimentares. Segundo a iniciativa UPFIT da Universidade do Porto, fatores como o stress, a ansiedade e a falta de competências culinárias contribuem para escolhas alimentares desequilibradas [2]. Adicionalmente, um estudo piloto realizado com estudantes da Universidade Lusófona revelou uma ingestão média elevada de macronutrientes, nomeadamente proteínas e lípidos, sugerindo que os jovens adultos podem não estar a adotar uma alimentação ideal para a sua saúde durante esta fase de transição [3].

Além dos problemas relacionados com os hábitos alimentares, muitos estudantes universitários carecem de competências culinárias. A literacia nutricional, por si só, nem sempre é suficiente para promover mudanças comportamentais sustentáveis, especialmente quando os jovens não se sentem confiantes para planear, preparar e cozinhar refeições saudáveis. Estudos realizados em universidades demonstraram que programas de formação em "life skills" culinárias podem ser eficazes. Por exemplo, um programa de 10 semanas numa cozinha universitária, focado numa abordagem prática para ensinar a planear, comprar e cozinhar refeições saudáveis e sustentáveis, registou uma boa adesão por parte dos participantes [4]. De forma semelhante, uma intervenção qualitativa de longo prazo (Programa Nutrição e Culinária na Cozinha) com estudantes universitários revelou que os participantes ganharam maior autonomia, aumentaram o consumo de frutas e vegetais, reduziram o consumo de alimentos ultraprocessados e relataram maior motivação para cozinhar regularmente [5].

Paralelamente, a gamificação — ou seja, a aplicação de mecânicas de jogo em contextos não lúdicos — tem-se mostrado uma estratégia eficaz na promoção de comportamentos saudáveis. Uma revisão sistemática recente demonstrou que os serious games focados em dietas saudáveis e atividade física podem influenciar positivamente o conhecimento nutricional, a motivação e até a composição corporal [6]. No contexto da nutrição, a gamificação tem sido utilizada para apoiar intervenções educativas, incentivando os utilizadores a fazer escolhas alimentares mais saudáveis de forma divertida e envolvente [7].

Adicionalmente, estudos que combinam a avaliação de mudanças comportamentais com medidas cognitivas em jogos persuasivos de saúde têm mostrado resultados promissores. Por exemplo, investigações que mediram atitudes e conhecimentos sobre nutrição antes e depois da utilização de jogos revelaram melhorias significativas na perceção e nos comportamentos alimentares [8]. Estas abordagens sugerem que uma aplicação bem desenhada, que integre elementos como progressão (XP, níveis), desafios, recompensas e feedback, pode não apenas ensinar receitas, mas também reforçar a adoção de hábitos alimentares mais saudáveis.

> `[A PREENCHER]`: as referências [1]–[8] estão citadas no texto mas não encontrei a lista bibliográfica correspondente no documento entregue — falta compilá-la (autores, título, ano, fonte) para o capítulo de Referências.

### 1.2. Justificação para a Plataforma Proposta

Diante do cenário apresentado, a criação de uma aplicação móvel gamificada para ensinar culinária a estudantes universitários revela-se uma solução pertinente e inovadora, sustentada por várias razões que destacam a sua relevância, impacto e potencial para promover mudanças comportamentais sustentáveis. Estas razões incluem a relevância do público-alvo, o potencial motivacional da gamificação, a aprendizagem de competências práticas e a promoção de hábitos alimentares equilibrados e sustentáveis.

**Relevância do Público-Alvo.** Os estudantes universitários representam um grupo particularmente vulnerável a hábitos alimentares inadequados, devido às mudanças significativas que enfrentam ao ingressar no ensino superior. A independência recém-adquirida, a gestão de orçamentos limitados, as rotinas académicas irregulares e o stress associado ao ambiente universitário contribuem para escolhas alimentares menos saudáveis. Este público-alvo, além de enfrentar dificuldades em manter uma dieta equilibrada, muitas vezes carece de competências culinárias básicas, o que agrava ainda mais o problema. Assim, uma plataforma direcionada especificamente para este grupo tem o potencial de responder a uma necessidade real e urgente.

**Potencial Motivacional da Gamificação.** A gamificação, ao integrar elementos de jogo como progressão, recompensas, desafios e feedback imediato, tem demonstrado ser uma abordagem eficaz para aumentar o envolvimento e a motivação dos utilizadores em diversas áreas, incluindo a saúde e a educação. No contexto da culinária, a gamificação pode transformar o processo de aprendizagem, tornando-o mais interativo, divertido e apelativo. A possibilidade de acompanhar o progresso, desbloquear conquistas e participar em desafios culinários pode incentivar os estudantes a cozinhar com maior frequência e a adotar práticas alimentares mais saudáveis.

**Aprendizagem de Competências Práticas.** A aplicação proposta não se limita a fornecer receitas ou informações nutricionais; o seu objetivo principal é capacitar os estudantes com competências práticas de culinária. Estas competências incluem planear refeições, gerir orçamentos, selecionar ingredientes saudáveis e preparar pratos equilibrados. Ao oferecer uma abordagem prática e acessível, a plataforma pode ajudar os utilizadores a superar a falta de confiança e de experiência na cozinha, promovendo a autonomia e a literacia alimentar.

**Promoção de Hábitos Sustentáveis.** A criação de hábitos alimentares equilibrados e sustentáveis é essencial para a saúde a longo prazo. A aplicação proposta visa não apenas ensinar receitas, mas também fomentar uma mudança comportamental duradoura. Através de uma combinação de conteúdos educativos, desafios regulares e reforço positivo, a plataforma pode ajudar os estudantes a integrar a culinária saudável nas suas rotinas diárias, reduzindo a dependência de refeições prontas e fast-food. Além disso, ao promover o consumo de alimentos frescos e a redução do desperdício alimentar, a aplicação contribui para um estilo de vida mais sustentável, alinhado com as preocupações ambientais atuais.

Em suma, a proposta de uma aplicação móvel gamificada para ensinar culinária a estudantes universitários é justificada pela sua capacidade de responder a uma necessidade concreta e de oferecer uma solução prática, motivadora e sustentável. Ao combinar a aprendizagem de competências culinárias com os benefícios da gamificação, a plataforma tem o potencial de transformar os hábitos alimentares dos estudantes, promovendo uma alimentação mais saudável e equilibrada, com impacto positivo na sua qualidade de vida e bem-estar.

### 1.3. Objetivos

#### Objetivo Geral

O principal objetivo deste projeto é desenvolver uma aplicação móvel gamificada que incentive os jovens universitários a confecionar refeições de forma mais frequente, promovendo a adoção de um estilo de vida saudável. A aplicação visa transformar a experiência culinária num processo interativo, divertido e acessível, utilizando elementos de gamificação para motivar os utilizadores a cozinhar e a melhorar os seus hábitos alimentares.

#### Objetivos Específicos

De acordo com o enquadramento apresentado, os objetivos específicos do projeto incluem:

1. **Promover a confeção de refeições caseiras** — incentivar os estudantes universitários a cozinhar mais frequentemente, reduzindo a dependência de refeições prontas e fast-food, através de uma abordagem prática e motivadora.
2. **Incorporar elementos de gamificação** — tornar o processo de aprendizagem culinária mais apelativo e interativo, utilizando um sistema de progressão baseado em níveis de dificuldade, ganho de pontos (XP) e participação em desafios culinários. Estes elementos visam aumentar o envolvimento e a motivação dos utilizadores.
3. **Fomentar a partilha e a interação social** — criar uma vertente social na aplicação, permitindo que os utilizadores partilhem as suas receitas e pratos com a comunidade. Através de um feed dinâmico, semelhante ao das redes sociais, os utilizadores poderão explorar novas receitas, interagir com outros membros (através de gostos e comentários) e criar um ambiente colaborativo e divertido.
4. **Facilitar a descoberta de novos conteúdos** — disponibilizar uma ferramenta de pesquisa que permita aos utilizadores encontrar receitas específicas ou perfis de outros membros da comunidade, incentivando a exploração de novos estilos de cozinha e a diversificação das suas práticas culinárias.
5. **Promover hábitos alimentares equilibrados e sustentáveis** — contribuir para a melhoria dos hábitos alimentares dos estudantes, incentivando o consumo de refeições equilibradas e a redução do sedentarismo. A aplicação também visa sensibilizar para a importância de escolhas alimentares mais saudáveis e sustentáveis.
6. **Criar uma experiência apelativa para o público-alvo** — desenvolver uma aplicação que combine funcionalidades práticas e sociais, tornando-a mais atrativa e alinhada com os interesses e necessidades dos jovens universitários.

A aplicação proposta não só procura promover uma alimentação mais equilibrada e saudável, como também integra uma componente social que incentiva a partilha e a interação entre os utilizadores. A combinação de gamificação, funcionalidades práticas e um ambiente colaborativo torna a plataforma mais apelativa e adequada ao público-alvo, contribuindo para a criação de hábitos alimentares mais sustentáveis e para a melhoria da qualidade de vida dos estudantes universitários.

> **Reconciliação com o código (mapeamento objetivo → implementação):**
>
> | Objetivo específico | Estado no ChefXP hoje | Onde |
> | --- | --- | --- |
> | 1. Promover confeção de refeições caseiras | Implementado via missões de cozinha (prato real, passos cronometrados, foto de checkpoint) | `server/domain/missions.js`, `src/features/missions/` |
> | 2. Elementos de gamificação (níveis, XP, desafios) | Implementado — livro-razão de XP idempotente, curva de níveis, badges, desafios da comunidade | `server/domain/xp.js`, `server/domain/challenges.js` |
> | 3. Partilha e interação social | Implementado — feed, gostos, comentários, seguir | `server/routes/recipes.js` |
> | 4. Pesquisa e descoberta de conteúdos | Implementado — pesquisa por texto, filtros de tempo e dificuldade | `src/features/search/` |
> | 5. Hábitos alimentares equilibrados e sustentáveis | Parcial — a app não dá feedback nutricional nem mede "sedentarismo"; a promoção é indireta, via frequência de confeção e progressão | — |
> | 6. Experiência apelativa (funcionalidades práticas + sociais) | Implementado | toda a app |
>
> Isto ainda não inclui um objetivo específico sobre a **avaliação da aplicação junto de utilizadores** nem sobre o uso de **Vibe Coding** como metodologia — ambos fazem parte do teu projeto (ver Capítulos 3 e 7) mas não estavam no texto entregue como objetivos formais. Considera acrescentá-los aqui na próxima revisão, para o Capítulo 9 poder "fechar o ciclo" com eles.

### 1.4. Metodologia de desenvolvimento

O desenvolvimento seguiu um ciclo iterativo, não um modelo em cascata clássico:

1. **Levantamento de requisitos** informal, a partir da experiência pessoal do autor como estudante e da análise de aplicações existentes (Capítulo 4).
2. **Arranque a partir de um protótipo gerado por IA** (Lovable): um MVP com landing page, autenticação simples e navegação, sem lógica de negócio real nem persistência própria.
3. **Extração e reconstrução da base técnica**: remoção de todas as dependências da plataforma de origem, criação de uma stack própria (Docker, PostgreSQL, Express, autenticação real), documentada no `prompt.md` do repositório como um plano de migração explícito.
4. **Desenvolvimento incremental por funcionalidade**, através de Vibe Coding: cada funcionalidade (XP, missões, feed social, moderação, notificações, offline/PWA...) foi especificada em linguagem natural, gerada, testada e revista antes de avançar para a seguinte — refletido nos 64 commits do repositório entre 21 de julho e 19 de setembro de 2026.
5. **Testes contínuos**: testes de domínio (regras puras), de integração (API + PostgreSQL reais) e de interface, mantidos e corridos a par do desenvolvimento — não como fase final.
6. **Testes e avaliação com utilizadores**. `[A PREENCHER — a planear, ver Capítulo 7]`
7. **Análise dos resultados e reflexão crítica** sobre o processo de Vibe Coding. `[A PREENCHER — Capítulo 8]`

### 1.5. Estrutura do relatório

`[A PREENCHER depois de o texto estabilizar]` — parágrafo-tipo:

> O presente relatório organiza-se em nove capítulos. O Capítulo 2 apresenta a fundamentação teórica sobre aprendizagem digital, aprendizagem culinária e gamificação. O Capítulo 3 introduz o Vibe Coding e a sua aplicação prática ao desenvolvimento do ChefXP. O Capítulo 4 analisa aplicações existentes e posiciona o ChefXP face a elas. O Capítulo 5 especifica os requisitos e a arquitetura da aplicação. O Capítulo 6 descreve o processo de design e desenvolvimento. O Capítulo 7 apresenta os testes e a avaliação da experiência de utilização. O Capítulo 8 reflete criticamente sobre o processo e as competências mobilizadas. O Capítulo 9 conclui o trabalho.

---

## Capítulo 2 — Estudo do estado da arte

> Texto conforme entregue ao orientador (`Projeto1_R1_Correção.docx`), já com a estrutura pedida por ele: "Estudo do estado da arte" como capítulo, com 2.1 (aplicações) → 2.2 (gamificação) → 2.3 (comunidade) → síntese. As figuras referenciadas (Figura 1–29) existem no documento original como capturas de ecrã das aplicações analisadas — precisam de ser re-inseridas aqui ou nos anexos (ver `docs/FOTOS-LICOES.md` e a lista de capturas do ChefXP a produzir).

Neste capítulo será apresentado o estado da arte, com o objetivo principal de analisar as soluções existentes no mercado e a literatura relevante, de forma a identificar lacunas, limitações e oportunidades que fundamentem e justifiquem a proposta do ChefXP.

Na primeira parte do capítulo, será realizada uma análise das aplicações e plataformas digitais relacionadas com culinária, alimentação saudável e partilha de receitas, destacando as suas funcionalidades, limitações e o espaço para inovação. De seguida, será explorada a utilização da gamificação como ferramenta de aprendizagem e motivação, evidenciando o seu potencial para transformar o processo de aprendizagem culinária numa experiência interativa e envolvente. Por fim, será analisada a integração de elementos sociais e comunitários em plataformas digitais, com foco na forma como estas funcionalidades podem fomentar a interação entre utilizadores, promover a partilha de conhecimentos e criar um ambiente colaborativo e dinâmico.

### 2.1. Análise das aplicações e plataformas digitais relacionadas

Nos últimos anos, tem-se assistido a uma proliferação de aplicações e plataformas digitais centradas na promoção de estilos de vida saudáveis, incluindo ferramentas dedicadas à culinária, planeamento alimentar, educação nutricional e mudança de comportamentos. Estas soluções digitais procuram responder a desafios contemporâneos como a falta de tempo, a diminuição das competências culinárias entre jovens adultos e a crescente dependência de refeições preparadas ou processadas. No contexto dos estudantes universitários, este problema torna-se particularmente evidente, sendo frequente a combinação de autonomia recente, limitações financeiras e ausência de hábitos consolidados de preparação de refeições.

Neste cenário, diversas aplicações procuram motivar os utilizadores através de funcionalidades como catálogos de receitas, instruções visuais passo a passo, planeadores semanais, listas de compras automatizadas e mecanismos de monitorização de hábitos alimentares. Paralelamente, tem crescido o interesse em integrar elementos de gamificação — tais como recompensas, progressão, desafios e interação social — com o objetivo de aumentar o envolvimento e promover comportamentos consistentes ao longo do tempo. No entanto, apesar da diversidade de ofertas existentes, muitas destas aplicações apresentam limitações significativas: pouca adaptação ao contexto universitário, ausência de estratégias de mudança comportamental validadas, fraca personalização, e modelos de interação que privilegiam o consumo passivo de conteúdo em vez da participação ativa na confeção das refeições. A análise das aplicações e plataformas digitais atualmente disponíveis é, assim, essencial para compreender o panorama existente, identificar boas práticas e evidenciar lacunas que justificam o desenvolvimento de uma solução mais eficaz.

Existem várias aplicações relacionadas com culinária e alimentação, mas poucas combinam gamificação, comunidade e hábitos saudáveis num só ambiente. Entre os exemplos mais relevantes, da pesquisa efetuada temos:

- **Tasty (BuzzFeed)** — apresenta vídeos curtos e apelativos de receitas, promovendo o entretenimento culinário. No entanto, não oferece interação entre utilizadores nem qualquer sistema de progressão ou recompensas.
- **Cookpad** — centra-se na partilha de receitas entre utilizadores, fomentando uma comunidade colaborativa. Contudo, a interface é simples e carece de elementos motivacionais que incentivem o progresso contínuo.
- **Gronda** — dirigida a profissionais da gastronomia, a aplicação permite partilhar criações e técnicas culinárias. Apesar de ter um forte apelo visual e comunitário, é direcionada a um público especializado, afastando-se do utilizador comum.
- **ReciMe** — plataforma moderna que combina receitas curtas, fotos e vídeos num formato social semelhante ao TikTok. Embora promova a partilha e interação entre utilizadores, não integra um sistema de progressão por níveis, recompensas ou desafios, limitando o potencial de gamificação.
- **Duolingo** (referência externa ao tema da culinária) — demonstra o sucesso da gamificação através de níveis, XP, desafios e recompensas.

A nossa aplicação inspira-se neste modelo para aplicar os mesmos princípios ao contexto culinário. Assim, o ChefXP diferencia-se das aplicações estudadas ao unir culinária, comunidade e gamificação num mesmo ecossistema, valorizando tanto receitas saudáveis quanto criativas ou indulgentes, promovendo equilíbrio em vez de restrição.

#### Tasty (BuzzFeed)

A aplicação Tasty `[ref]`, desenvolvida pela BuzzFeed, constitui uma das plataformas digitais de culinária mais populares a nível global. A sua proposta de valor assenta na disponibilização de um vasto conjunto de receitas acompanhadas por vídeos curtos e visualmente apelativos, apresentados maioritariamente em formato top-down, que permitem ao utilizador observar todo o processo de preparação de forma clara e intuitiva.

A página inicial apresenta receitas organizadas por categorias temáticas ("rápidas e fáceis", "vegetarianas", "sobremesas"). Todo o conteúdo é desenvolvido e publicado exclusivamente pela equipa editorial da BuzzFeed — não existe a possibilidade de os utilizadores criarem ou partilharem as suas próprias receitas, o que garante curadoria mas limita a participação da comunidade. O Tasty permite pesquisas refinadas por tipo de prato, ingrediente ou categoria. Cada receita apresenta descrição, vídeo, ingredientes, guia passo a passo e comentários; numa aba "Community" os utilizadores partilham fotos e opiniões das receitas que experimentaram.

`[A PREENCHER]`: re-inserir aqui as Figuras 1–4 (página inicial, pesquisa, receita, aba Community) do documento original.

#### Cookpad

O Cookpad `[ref]` é uma aplicação focada na partilha colaborativa de receitas entre utilizadores — o conteúdo é maioritariamente gerado pela comunidade. A página de pesquisa organiza-se em "Ingredientes Mais Buscados", "Premium" (funcionalidades como "Top Receitas com Cooksnaps" e "Receitas Mais Vistas", só para subscritores), "Buscas Recentes" e "Receitas publicadas recentemente". Cada receita tem fotografia, ingredientes, instruções sequenciais, autor e comentários. É possível guardar favoritos, criar coleções, seguir perfis e pesquisar por prato/ingrediente/categoria/utilizador. Cada utilizador tem um perfil com foto, descrição, seguidores/seguidos e receitas publicadas. A criação de receita passa por um "Assistente de Criação de Receitas" que pré-preenche o formulário a partir de perguntas guiadas.

Apesar de incorporar elementos de interação social, o Cookpad mantém uma interface simples orientada para a consulta e partilha de receitas — sem qualquer sistema de progressão ou gamificação.

`[A PREENCHER]`: re-inserir Figuras 5–14 do documento original.

#### Gronda

O Gronda é uma aplicação e plataforma digital direcionada para o setor gastronómico profissional, permitindo a partilha de criações culinárias por chefs, cozinheiros e estudantes de cozinha. Apresenta um feed de publicações (pratos, aulas, outros utilizadores), pesquisa por tipo de prato/ingrediente/técnica/chef, perfis com coleções pessoais, e uma ferramenta de IA ("AI Recipe Creator") que gera variações de receitas a partir de ingredientes. Disponibiliza ainda conteúdos exclusivos de técnicas avançadas e materiais formativos para profissionais — o forte rigor técnico afasta, no entanto, o utilizador iniciante.

`[A PREENCHER]`: re-inserir Figuras 15–19 do documento original.

#### ReciMe

O ReciMe é uma aplicação para guardar, organizar e criar receitas de forma simples e visual, com uma funcionalidade central de **importação** de receitas a partir de Instagram, TikTok, Pinterest, YouTube, websites ou documentos pessoais, centralizando-as num único espaço. Permite também criar receitas próprias (imagem, ingredientes, passos). A subscrição paga "ReciMe Plus" desbloqueia macronutrientes e calorias por receita, planeamento semanal de refeições e listas de compras, com sincronização na nuvem entre dispositivos. A versão gratuita limita o número de receitas importadas. Não integra progressão por níveis, recompensas nem desafios.

`[A PREENCHER]`: re-inserir Figuras 20–23 do documento original.

#### Duolingo

O Duolingo é uma plataforma de aprendizagem de línguas fortemente orientada para a gamificação, combinando exercícios curtos com pontos de experiência, níveis, recompensas diárias e ligas competitivas. O percurso principal apresenta-se como uma sequência vertical de unidades desbloqueáveis, com indicadores de série diária, moeda virtual e energia (corações) no topo. Um ecrã de recompensas diárias desbloqueia baús numa linha temporal semanal, e uma "Missão dos amigos" sugere perfis a seguir. Cada lição mostra uma barra de progresso e um contador de energia/erros permitidos, combinando personagem, balão de fala e botões de resposta. O perfil mostra identidade, estatísticas e um convite a completá-lo; um ecrã de liga ("Divisão Prata") classifica os participantes por XP semanal, com promoção para a divisão seguinte. Uma aba de "Novidades" complementa as lições com conteúdo editorial em cartões.

`[A PREENCHER]`: re-inserir Figuras 24–29 do documento original.

#### Comparação das aplicações

Tabela comparativa das funcionalidades presentes nas aplicações analisadas face às planeadas para o ChefXP:

| Funcionalidade | Tasty | Cookpad | Gronda | ReciMe | Duolingo | ChefXP |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Sistema de utilizadores registados | X | X | X | X | X | X |
| Receitas adaptadas a preferências e restrições | X | X | X | X | | X |
| Progressão estruturada por níveis | | | | | X | X |
| Gamificação (pontos, níveis, badges) | | | | | X | X |
| Feedback de progresso ao utilizador | | | | X | X | X |
| Aprendizagem progressiva de competências | | | X | | X | X |
| Conteúdo acessível a utilizadores iniciantes | X | X | | X | X | X |
| Promoção de hábitos alimentares saudáveis | X | X | | X | | X |
| Elementos sociais (partilha/desafios) | | X | | | X | X |
| Desafios ou tarefas orientadas ao utilizador | | | X | | X | X |
| Integração de culinária + aprendizagem | | | X | | | X |
| Motivação contínua baseada em consistência | | | | | X | X |

A análise comparativa evidencia que, embora as aplicações analisadas apresentem funcionalidades relevantes de forma isolada, nenhuma integra de forma consistente culinária, aprendizagem progressiva, gamificação e motivação contínua numa só aplicação.

Aplicações como o Tasty e o Cookpad focam-se essencialmente na disponibilização de receitas, oferecendo pouca orientação ao nível do desenvolvimento de competências. O Gronda, apesar do elevado rigor técnico, dirige-se a um público profissional restrito, afastando utilizadores iniciantes. Já o Duolingo, embora não pertença ao domínio alimentar, demonstra a eficácia da gamificação e da progressão por níveis na aprendizagem, servindo de inspiração conceptual para o modelo adotado no ChefXP.

Neste contexto, o ChefXP diferencia-se por combinar os pontos fortes identificados nas restantes aplicações, adaptando-os ao domínio da culinária. A integração de receitas personalizadas, desafios práticos, progressão por níveis e elementos sociais permite não só apoiar o utilizador na execução de tarefas culinárias, mas também promover a aquisição gradual de competências e a adoção de hábitos alimentares mais saudáveis de forma motivadora.

### 2.2. Utilização da gamificação como ferramenta de aprendizagem e motivação

#### 2.2.1. Definição e Conceitos Fundamentais

A gamificação define-se como a aplicação estratégica de elementos de design de jogos, como pontos, níveis, badges e desafios, em contextos não-lúdicos com objetivos específicos. Diferencia-se da aprendizagem baseada em jogos, que utiliza jogos completos como veículos pedagógicos. No contexto educacional, a gamificação permite converter tarefas tradicionais em experiências interativas, contribuindo para o aumento da motivação e do nível de envolvimento do utilizador.

No contexto educacional e formativo, a gamificação tem sido utilizada como uma abordagem para transformar tarefas tradicionais, frequentemente percecionadas como monótonas, em experiências mais interativas e envolventes. Através da definição de objetivos claros, feedback contínuo e progressão, esta abordagem contribui para o aumento da motivação e do envolvimento do utilizador no processo de aprendizagem.

A eficácia da gamificação depende da forma como os seus elementos são concebidos e articulados, devendo estar alinhados com princípios psicológicos que expliquem o comportamento humano e os mecanismos de motivação, tema aprofundado a seguir.

#### 2.2.2. Fundamentação Psicológica da Gamificação

A gamificação baseia-se na aplicação de elementos típicos dos jogos em contextos não lúdicos, com o objetivo de influenciar comportamentos, aumentar o envolvimento e promover a motivação dos utilizadores. No entanto, a eficácia de sistemas gamificados não depende apenas da utilização de mecânicas como pontos, níveis ou recompensas, mas sim da sua fundamentação em teorias psicológicas que explicam o comportamento humano e os mecanismos motivacionais.

**Self-Determination Theory (SDT).** A SDT defende que a motivação humana é influenciada pela satisfação de três necessidades psicológicas: autonomia, competência e relacionamento. A autonomia refere-se à perceção de controlo sobre as próprias decisões e o percurso individual, podendo ser promovida, em sistemas gamificados, através da possibilidade de escolha, como a seleção de tarefas, receitas ou o ritmo de aprendizagem. A competência está associada ao sentimento de domínio e eficácia na realização de atividades, sendo estimulada por desafios progressivos e feedback imediato. O relacionamento diz respeito ao sentimento de pertença e ligação social, frequentemente reforçado através de comunidades, partilha de conquistas e interações entre utilizadores. Quando um sistema gamificado consegue satisfazer simultaneamente estas três necessidades, promove uma motivação mais autónoma e duradoura.

**Flow Theory.** Descreve um estado psicológico de envolvimento ótimo, no qual o utilizador se encontra imerso numa atividade, experienciando elevados níveis de concentração e satisfação. Este estado ocorre quando existe um equilíbrio entre o nível de desafio proposto e as habilidades do utilizador, evitando tanto o tédio como a frustração. A gamificação pode facilitar a experiência de flow através de objetivos claros, progressão ajustada ao desempenho, feedback contínuo e uma interface focada.

#### 2.2.3. Elementos Gamificados e a sua Efetividade

| Elemento | Efetividade | Aplicação / nota |
| --- | --- | --- |
| Progressão por níveis | Muito alta | Receitas com dificuldade crescente; visibilidade clara de percurso |
| Pontos/XP | Alta (curto prazo) | Feedback imediato; requer variação para evitar efeito de novidade |
| Badges | Alta | Reconhecimento de conquistas |
| Feedback instantâneo | Muito alta | Validação imediata; crítico para aprendizagem e Flow |
| Desafios progressivos | Muito alta | Tarefas estruturadas; incentivam consistência |

A progressão por níveis destaca-se como um dos elementos mais eficazes, uma vez que permite estruturar o percurso do utilizador, tornando visível a sua evolução e promovendo o sentimento de competência. Os pontos de experiência (XP) funcionam como mecanismos de feedback imediato, reforçando comportamentos desejados — mas a sua eficácia tende a ser mais elevada a curto prazo, sendo necessária a introdução de variação para evitar o efeito de novidade (ver 2.2.5). Os badges assumem um papel importante no reconhecimento de conquistas, com eficácia reforçada quando associados a uma narrativa clara e a objetivos significativos. O feedback instantâneo e os desafios progressivos apresentam efetividade muito elevada, sendo essenciais para a aprendizagem e para a promoção do estado de flow.

#### 2.2.4. Casos de Sucesso da Aplicação de Gamificação

**Duolingo.** Um estudo conduzido por Vesselinov e Grego (2012) analisou a eficácia do Duolingo na aprendizagem de línguas, concluindo que os utilizadores demonstraram progressos significativos num curto espaço de tempo — cerca de 34 horas de utilização podem equivaler a um semestre universitário de ensino de línguas. A estrutura gamificada do Duolingo está fortemente alinhada com a SDT: autonomia (flexibilidade no ritmo e escolha das lições), competência (feedback constante, progressão visível, desafios ajustados) e persistência reforçada por metas diárias e recompensas simbólicas.

**Khan Academy.** Um estudo de eficácia do Long Beach Unified School District (2018) analisou o impacto da Khan Academy no desempenho de alunos do ensino básico em matemática, encontrando melhorias significativas em utilizadores regulares face a não-utilizadores. O estudo conclui que a eficácia não se deve a elementos gamificados isolados, mas à forma como são integrados num sistema pedagógico centrado no aluno.

**Classcraft.** Transforma a sala de aula num ambiente de role-playing (pontos de experiência, níveis, poderes, missões, desafios colaborativos). Parody, Santos, Trujillo-Cayado e Ceballos (2022) encontraram, em contexto de engenharia, níveis significativamente mais elevados de motivação, envolvimento e desempenho académico face a métodos tradicionais.

#### 2.2.5. Limitações Conhecidas

**Efeito de Novidade.** Rodrigues et al. (2022), num estudo de 14 semanas com um sistema gamificado em unidades curriculares de programação, observaram que o efeito positivo da gamificação (medido por interações, tentativas e tempo de utilização) começou a diminuir após cerca de quatro semanas de utilização contínua, antes de estabilizar — o impacto da gamificação não é constante ao longo do tempo.

**Crowding-Out Effect.** Deci, Koestner e Ryan (1999), numa meta-análise, mostraram que incentivos tangíveis aplicados a tarefas originalmente motivadas intrinsecamente tendem a reduzir o interesse e o empenho espontâneo. Em aplicações gamificadas, se pontos, badges ou níveis se tornarem o objetivo principal, os utilizadores podem tornar-se dependentes dessas recompensas externas e perder envolvimento natural. Mitigação: os elementos extrínsecos devem funcionar como feedback visual/reforço complementar, mantendo o foco em autonomia, narrativa e sentido de progresso.

**Variabilidade Contexto-Dependente.** Hamari, Koivisto e Sarsa (2014), numa revisão de estudos empíricos, indicam que a eficácia da gamificação é altamente dependente do contexto — tipo de serviço, características dos utilizadores e ambiente de implementação. A adaptação do design às preferências específicas dos utilizadores é essencial.

#### 2.2.6. Síntese

A investigação indica que a gamificação, quando implementada de forma estruturada e fundamentada, pode aumentar significativamente a motivação, o envolvimento e a aprendizagem dos utilizadores. Casos globais como Duolingo, Khan Academy e Classcraft demonstram a aplicação bem-sucedida de princípios teóricos sólidos, especialmente da SDT e da Flow Theory. Contudo, a sua efetividade não é garantida e depende de um alinhamento claro com os objetivos pedagógicos, de um design cuidadoso e de inovação contínua. A gamificação não substitui um ensino de qualidade, mas amplifica a capacidade de motivar e envolver os utilizadores de forma significativa e sustentável.

### 2.3. Integração de elementos sociais e comunitários em plataformas digitais

#### 2.3.1. Definição e Tipos de Elementos Sociais

Elementos sociais e comunitários referem-se a funcionalidades que permitem aos utilizadores interagir, partilhar conteúdos, acompanhar pares e construir identidade dentro de uma plataforma. Diferem de gamificação individual (progressão, pontos, badges) por focarem na dinâmica entre utilizadores em vez de mecanismos de recompensa pessoal. Os principais tipos são: feed e partilha de conteúdos; perfis, seguidores e rede social; feedback social direto (likes, comentários, reações); grupos e desafios comunitários; e moderação e normas comunitárias.

#### 2.3.2. Casos de Sucesso: Plataformas Focadas em Comunidade

**Strava.** Rede social de exercício físico onde utilizadores partilham registos de corrida/ciclismo, recebem "kudos" de amigos, comentam e competem em segmentos locais. Um relatório da Strava (2025) indica que 55% dos atletas da Geração Z citam a conexão social como razão principal para participar em grupos de fitness.

**Goodreads.** Permite catalogar livros lidos, escrever reviews, seguir leitores com gosto similar e participar em clubs temáticos. A validação social ("útil/não útil" em reviews) e o sentimento de pertença sustentam participação mesmo sem sistema de pontos/badges formal.

**Reddit.** Subreddits funcionam através de moderação comunitária, upvotes/downvotes e discussão aberta; comunidades bem-moderadas com normas claras têm retenção de utilizadores documentada como muito superior a comunidades não-moderadas.

#### 2.3.3. Benefícios Específicos de Elementos Sociais

Ver amigos e colegas ativos cria pressão positiva para não abandonar a plataforma (accountability e consistência). A aprendizagem colaborativa ocorre naturalmente através de comentários, reviews e variações de receitas publicadas por outros, funcionando como "laboratório público" de dicas e técnicas. Identificar-se como "membro de comunidade culinária" ou "chef em progresso" motiva comportamento sustentado — a construção de identidade social é reconhecida na literatura como crítica para engajamento duradouro.

#### 2.3.4. Riscos de Design e Mitigação

Rankings públicos de "mais ativo" ou "melhor receita" podem desmotivar utilizadores menos ativos ou experientes, contribuindo para segregação social; mitigação: rankings privados (entre amigos), múltiplas dimensões de sucesso, rotação de destaques, feed por interesse em vez de popularidade. Pressão social e FOMO são riscos quando notificações excessivas criam expectativa de resposta contínua; mitigação: controlo total sobre visibilidade/notificações e um "modo silencioso". Moderação inadequada pode gerar dinâmicas tóxicas; mitigação: normas de comunidade claras, denúncias acessíveis, moderadores treinados, bloqueio entre utilizadores. Privacidade e proteção de dados são preocupação crítica, sobretudo para menores; mitigação: controlo granular de privacidade, participação anónima opcional, conformidade com o RGPD.

> **Nota de reconciliação com o código:** o ChefXP já implementa a maioria destas mitigações — bloqueio bidirecional (`server/lib/blocks.js`), denúncias e fila de moderação (`server/domain/moderation.js`, `server/routes/moderation.js`), notificações sem excesso (uma por pessoa, não por clique) e exportação/eliminação de dados próprios. Isto é material direto para esta secção: em vez de ficar só na literatura, o texto pode mostrar como cada risco identificado foi mitigado na prática — ver Capítulo 5/6.

#### 2.3.5. Gamificação + Comunidade

Enquanto a gamificação fornece uma estrutura individual e clara de progresso, os elementos sociais adicionam contexto, aspiração e responsabilidade coletiva — plataformas que combinam ambos mostram resultados superiores: o Duolingo combina gamificação (níveis, XP) com ligas sociais, resultando em retenção superior a usar apenas um elemento; o Classcraft combina narrativa partilhada com rankings entre equipas, gerando maior engajamento colaborativo. A gamificação motiva a ação individual e mede o progresso; a comunidade fornece significado social, inspiração e um tipo de validação diferente.

#### 2.3.6. Síntese

Elementos sociais e comunitários são um complemento essencial, mas distinto da gamificação. Enquanto a gamificação estrutura a aprendizagem individual, a comunidade fornece validação social, inspiração, sentido de pertença e satisfaz necessidades psicológicas críticas para comportamento sustentado. O design responsável — considerando privacidade, inclusão, moderação e bem-estar digital — é fundamental para maximizar benefícios e minimizar riscos.

### Resumo do capítulo

Neste capítulo foi apresentada uma análise do panorama atual de soluções digitais em culinária, educação e comunidade, explorando três dimensões fundamentais que sustentam o desenvolvimento do ChefXP.

Na secção 2.1, analisaram-se cinco plataformas digitais relevantes (Tasty, Cookpad, Gronda, ReciMe e Duolingo), provando que nenhuma combina de forma equilibrada culinária, gamificação, progressão estruturada e comunidade ativa numa só aplicação. Esta lacuna identificada justifica a proposta do ChefXP, que integra receitas personalizadas, desafios práticos, progressão por níveis e dinâmica comunitária.

A secção 2.2 aprofundou a gamificação como ferramenta de aprendizagem e motivação, sustentando-se em teorias psicológicas robustas (SDT e Flow Theory). A análise de elementos gamificados revelou efetividades comprovadas, e casos de sucesso globais (Duolingo, Khan Academy, Classcraft) demonstram impacto significativo quando a gamificação é alinhada com princípios pedagógicos — com limitações conhecidas que exigem design cuidado e inovação contínua.

A secção 2.3 explorou a integração de elementos sociais e comunitários, demonstrando que plataformas como Strava, Goodreads e Reddit proporcionam benefícios distintos: accountability, aprendizagem entre pares, construção de identidade e validação social — com um design responsável necessário para mitigar segregação social, pressão excessiva, moderação inadequada e riscos de privacidade. A sinergia entre gamificação e comunidade demonstrou-se superior a usar apenas um dos elementos isoladamente.

Concluindo, este estado da arte estabelece uma fundação teórica e empírica para o ChefXP. A combinação de progressão estruturada, feedback contínuo, comunidade ativa e design responsável alinha-se com evidência internacional, posicionando a aplicação para um impacto potencial significativo em motivação sustentada, engajamento duradouro e adoção de hábitos culinários saudáveis em população estudantil universitária.

`[A PREENCHER]`: falta a lista de referências completa (Referências 2.1 não está no documento entregue; Referências 2.2 está completa — ver abaixo; Referências 2.3 está sem entradas). Compilar tudo no capítulo de Referências bibliográficas, num estilo consistente.

**Referências já compiladas (secção 2.2):**

Deterding, S., Dixon, D., Khaled, R., & Nacke, L. (2011). From game design elements to gamefulness: defining "gamification". *Proceedings of the 15th International Academic MindTrek Conference.*
Prensky, M. (2007). Digital Game-Based Learning. *Computers in Entertainment*, 5(1), 21.
McGonigal, J. (2011). *Reality is Broken: Why Games Make Us Better and How They Can Change the World.* Penguin Press.
Ryan, R. M., & Deci, E. L. (2000). Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being. *American Psychologist*, 55(1), 68–78.
Csikszentmihalyi, M. (1990). *Flow: The Psychology of Optimal Experience.* Harper & Row.
Pink, D. H. (2009). *Drive: The Surprising Truth About What Motivates Us.* Riverhead Books.
Deci, E. L., Koestner, R., & Ryan, R. M. (1999). A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. *Psychological Bulletin*, 125(6), 627–668.
Hattie, J. (2008). *Visible Learning: A Synthesis of Over 800 Meta-Analyses Relating to Achievement.* Routledge.
Kayımbaşıoğlu, D., Sözer, H., Şamşu, B., & Sayan, H. (2016). Assessment of gamification and learning analytics in educational contexts. *Journal of Educational Computing Research*, 55(6), 767–786.
Hamari, J., Koivisto, J., & Sarsa, H. (2014). Does gamification work? A literature review of empirical studies on gamification. *2014 47th Hawaii International Conference on System Sciences*, 3025–3034.
Sardi, L., Idri, A., & Fernández-Alemán, J. L. (2017). A systematic review of gamification in e-Health. *Journal of Biomedical Informatics*, 71, 31–48.
Nacke, L. E., & Deterding, S. (2017). The all-game-All-play: Ubiquitous gamification. *Computer Games Journal*, 6(1), 53–62.
Lally, P., Van Jaarsveld, C. H., Potts, H. W., & Wardle, J. (2010). How are habits formed: Modelling habit formation in the real world. *European Journal of Social Psychology*, 40(6), 998–1009.
Duolingo Research Team. (2013). *The Effectiveness of Gamification in Language Learning.* Internal research report. Disponível em: https://investor.duolingo.com/
Classcraft Corporation. (2019). *Implementation Results: 23 Classrooms, 617 Students.* Case study. Disponível em: https://www.classcraft.com/
Editor Realize. (2024). Gamificação: Impulsionando o Engajamento e a Motivação. *Anais do CONEDU 2024* (Congresso Nacional de Educação).

### 2.4. Aplicação dos princípios de gamificação no ChefXP (código atual)

Tabela adicional, cruzando cada conceito teórico do capítulo com a implementação real, para servir de ponte para os Capítulos 5–6:

| Conceito teórico | Aplicação no ChefXP | Onde no código |
| --- | --- | --- |
| XP (pontos) | Ganho por publicar receita (+25), lição perfeita (+10 de bónus), marco de streak a cada 7 dias (+20), lições e missões concluídas; registado como livro-razão idempotente (`xp_events`), nunca um contador simples | `server/domain/xp.js`, `server/lib/xpLedger.js` |
| Níveis | Curva de progressão com passo base de 100 XP + 50 XP por nível adicional, até ao nível 50; calculada num módulo puro e testado, partilhada por cliente e servidor | `server/domain/xp.js` (`xpToAdvance`, `levelForXp`, `progressForXp`) |
| Badges | 8 conquistas derivadas do estado real do utilizador: primeira receita, 10 receitas, primeira lição, semana de lições, semana ativa (streak ≥7), mês ativo (streak ≥30), nível ≥3, 100 gostos recebidos | `badgesFor()` em `server/domain/xp.js` |
| Corações / vidas | Sistema de 3 corações por lição, ao estilo Duolingo, para tornar o erro visível mas não impeditivo | `MAX_HEARTS` em `server/domain/xp.js`, `server/routes/learning.js` |
| Streak (sequência) | Calculado no fuso horário do próprio utilizador a partir de `daily_activity`, só quebra após um dia civil inteiro sem atividade | `server/domain/xp.js`, tabela `daily_activity` |
| Meta diária | Objetivo configurável de XP por dia (por omissão 50), visível no perfil | `DEFAULT_DAILY_XP_GOAL`, `dailyXpGoal` em `users` |
| Feedback / personagem | O "Chef Sapo" acompanha lições e missões, com falas deterministas por contexto (boas-vindas, explicação de passo, pergunta, acerto, erro, pedido de socorro) — não um texto genérico | `src/lib/chefLines.ts`, `src/components/ChefMascot.tsx` |
| Missões práticas | Cada unidade termina numa "missão de cozinha": receita real com passos cronometrados, pedido de socorro e foto de verificação no fim | `server/domain/missions.js`, `src/features/missions/` |
| Autonomia | Escolha livre de que lição/unidade seguir dentro do percurso desbloqueado, escolha da receita a publicar ou a submeter a um desafio | `src/features/challenges`, `src/features/learning` |
| Competência | Progressão visível (XP, nível, corações, barra de progresso) e feedback imediato de correção no fim de cada lição/missão | `progressForXp()`, ecrã de resultado de missão |
| Relacionamento social | Feed com receitas de outros utilizadores, gostos, comentários, seguir, notificações, desafios coletivos, ranking semanal/global | `server/routes/recipes.js`, `server/routes/challenges.js`, `server/routes/leaderboard.js` |
| Rankings | Semanal (agregado de `daily_activity`) e global (soma de `users.xp`), com `RANK()` para tratar empates de forma justa | `server/routes/leaderboard.js` |

`[A PREENCHER]`: para cada linha, acrescentar a justificação teórica (porquê esta forma de XP e não outra, porquê corações e não "vidas infinitas", etc.), com referências do ponto 2.3.4.

---

## Capítulo 3 — Vibe Coding e desenvolvimento assistido por IA

### 3.1. Introdução ao Vibe Coding

- 3.1.1. Definição de Vibe Coding — `[A PREENCHER, com referência à origem do termo (Andrej Karpathy, 2025) e definições académicas/industriais entretanto publicadas]`
- 3.1.2. Diferenças entre desenvolvimento tradicional e Vibe Coding — `[A PREENCHER]`
- 3.1.3. Vibe Coding como abordagem de desenvolvimento — no ChefXP, o programador (autor) funcionou como especificador, revisor e integrador: escreveu requisitos e decisões de arquitetura em linguagem natural (ver `prompt.md` e as instruções dadas ao longo do projeto), reviu o código gerado, correu e escreveu testes, e tomou as decisões de segurança e de modelo de dados. `[A PREENCHER — desenvolver]`

### 3.2. Inteligência Artificial no desenvolvimento de software

- 3.2.1. Ferramentas de IA generativa para programação — `[A PREENCHER, panorama geral: GitHub Copilot, Cursor, Claude Code, Lovable, etc.]`
- 3.2.2. Geração de código através de linguagem natural — `[A PREENCHER]`
- 3.2.3. Vantagens — no projeto, permitiu prototipagem muito rápida do MVP inicial (Lovable) e, depois, geração e iteração rápida de funcionalidades complexas (livro-razão de XP, sincronização offline, moderação) sem sacrificar cobertura de testes.
- 3.2.4. Limitações e riscos — o próprio ponto de partida do projeto é um exemplo: o MVP gerado pelo AI builder trazia dependências, CDNs e um backend não-definitivo que tiveram de ser removidos por completo antes de a aplicação poder ser considerada uma base de produção séria (ver `prompt.md`). Isto ilustra, em concreto, os riscos de aceitar código gerado sem revisão crítica.

### 3.3. Vibe Coding aplicado ao desenvolvimento do ChefXP

#### 3.3.1. Motivos para a escolha da abordagem

`[A PREENCHER]` — esboço: rapidez de iteração como estudante com tempo limitado; interesse pessoal/curricular em avaliar até que ponto uma aplicação de produção (com segurança, testes e uma arquitetura defensável) pode ser construída com esta abordagem; oportunidade de comparar criticamente com desenvolvimento tradicional.

#### 3.3.2. Ferramentas utilizadas

| Categoria | Ferramenta |
| --- | --- |
| Prototipagem inicial (MVP) | Lovable (AI app builder) |
| Assistente de desenvolvimento principal | Claude Code (Anthropic) |
| Controlo de versões | Git / GitHub |
| Frontend | React 19, TypeScript, Vite, React Router, Tailwind CSS v4, TanStack Query, React Hook Form, Zod, shadcn/ui (Radix) |
| Backend | Node.js, Express 5, PostgreSQL 15 (`pg`, SQL-first, sem ORM) |
| Segurança | JWT em cookie `HttpOnly`, CSRF double-submit, bcrypt, Helmet, CSP própria |
| Infraestrutura | Docker / Docker Compose (dev e produção), Caddy (TLS automático) |
| Testes | Test runner nativo do Node.js (`node --test`), Vitest + Testing Library, Playwright (verificação de PWA/offline num Chrome real) |
| Integração contínua | GitHub Actions |

#### 3.3.3. Processo de desenvolvimento através de Vibe Coding

O fluxo seguido, funcionalidade a funcionalidade, foi consistentemente:

1. Definição do requisito em linguagem natural (o que a funcionalidade deve fazer e, muitas vezes, o que deve *recusar* fazer — p.ex. "o gabarito da lição nunca pode chegar ao browser").
2. Criação do pedido/instrução para o assistente de IA, incluindo restrições explícitas de segurança e de modelo de dados.
3. Geração do código (rotas, módulos de domínio, componentes de interface, migrations SQL).
4. Escrita e execução de testes (unitários de domínio, de integração contra API+PostgreSQL reais, e de interface) para validar o comportamento gerado.
5. Identificação de erros ou de decisões erradas — por vezes só visíveis a correr a aplicação a sério (ver exemplo do `NODE_ENV`/PWA descrito no `README.md`).
6. Correção, iteração e nova validação.
7. Registo da decisão relevante em documentação viva (`README.md`, secção "Decisões que vale a pena conhecer") em vez de apenas no código.

#### 3.3.4. Exemplos de prompts utilizados

O repositório guarda pelo menos um prompt completo, extenso e estruturado (`prompt.md`), usado para orientar a migração do MVP gerado pela plataforma de origem para uma stack própria de produção. Excerto ilustrativo:

> "Tenho um MVP exportado do Lovable (tipicamente React + Vite + Tailwind). Quero transformá-lo numa base sólida de produção, independente do Lovable: 1. Remover todas as referências e dependências do Lovable / AI builder. 2. Ter Docker + PostgreSQL locais com schema + seed. 3. Ter API Express própria [...] O que NÃO fazer: Não introduzir Prisma/Drizzle/Next/Nest/Redis a menos que eu peça. Não deixar CDNs do Lovable/Tailwind/AI Studio no HTML final. [...] Não inventar features fora do MVP."

`[A PREENCHER]`: acrescentar 2–4 exemplos adicionais de prompts para funcionalidades concretas (por exemplo, o pedido que deu origem ao livro-razão de XP idempotente, ou ao sistema de bloqueio bidirecional), idealmente copiados do histórico real de conversas com o assistente, com o resultado obtido e o que teve de ser corrigido.

#### 3.3.5. Gestão e organização do código gerado

O projeto manteve uma separação clara de responsabilidades independente de quem — humano ou IA — escreveu cada parte: lógica de negócio pura e sem I/O isolada em `server/domain/` (testável em milissegundos, sem base de dados), rotas HTTP finas em `server/routes/`, camada de repositório explícita em `src/data/` no frontend, e funcionalidades organizadas por domínio em `src/features/*` em vez de por tipo técnico. Esta estrutura funcionou como uma restrição imposta ao código gerado: cada novo pedido tinha de "encaixar" num destes sítios, o que evitou a dispersão típica de código gerado sem arquitetura prévia.

#### 3.3.6. Validação e revisão do código

- Três camadas de testes automáticos, mantidas a par do desenvolvimento (não escritas no fim): testes de domínio, de integração (API real + PostgreSQL real) e de interface.
- Um script de "hardening" (`npm run test:hardening`) que bloqueia CDNs proibidas na build final — resíduo direto da preocupação em não repetir o problema do MVP original.
- Verificação de responsividade automatizada (`npm run check:responsive`) em vez de confiada à revisão visual.
- Verificação de comportamento offline/PWA num Chrome real controlado por protocolo (`npm run check:offline`, `check:offline-lesson`), porque o comportamento de cache e service worker não é fiável de validar só por leitura de código.
- Integração contínua (GitHub Actions) a correr lint, verificação de tipos, todos os testes e build em cada alteração.

`[A PREENCHER]`: incluir números finais de testes (à data da entrega) e um exemplo concreto de um erro introduzido pela IA e apanhado pelos testes ou por revisão manual.

#### 3.3.7. Reflexão sobre a utilização de Vibe Coding

`[A PREENCHER — secção de reflexão pessoal, não derivável do código]`. Pontos de partida sugeridos, com base no que o código e o histórico revelam:

- **O que facilitou**: geração rápida de código repetitivo mas correto (rotas CRUD, schemas de validação Zod, migrations); exploração rápida de alternativas de interface.
- **O que dificultou**: a necessidade de especificar explicitamente regras de segurança e de integridade de dados que não são óbvias a pedir em linguagem natural (idempotência do XP, revogação de XP ao apagar conteúdo, bloqueio bidirecional consistente em todas as consultas) — sem essa especificação explícita, é plausível que a IA gerasse uma versão mais simples e incorreta.
- **Conhecimentos que tiveste de aplicar** (preencher com sinceridade): modelação de base de dados, segurança web (CSRF, cookies, CSP), arquitetura de aplicações React, comportamento de service workers/PWA, desenho de APIs REST.
- **Problemas que surgiram**: o bug do `NODE_ENV`/`import.meta.env.PROD` documentado no `README.md` é um bom exemplo concreto e citável — um comportamento correto em todos os testes automáticos mas incorreto em produção, só descoberto por teste manual dirigido.
- **Tarefas que exigiram intervenção manual/decisão humana explícita**: decisões de modelo de dados (livro-razão vs. contador), decisões de segurança (o que fica exposto ao cliente vs. só ao servidor), decisões de produto (o que fica deliberadamente fora do âmbito, como a suspensão de contas pela fila de moderação).

---

## Capítulo 4 — [Provavelmente redundante — ver nota]

> **Nota:** a nota de correção do orientador pedia para o "estudo do estado da arte" (incluindo a análise das aplicações concorrentes) vir **antes** de qualquer especificação da app, como Capítulo 2. Isso já foi feito — a análise de Tasty, Cookpad, Gronda, ReciMe e Duolingo, com tabela comparativa e discussão crítica, está agora na secção **2.1** deste documento, exatamente como no texto entregue. Manter este Capítulo 4 como "Análise de aplicações" a seguir seria repetir o mesmo conteúdo duas vezes.
>
> Duas opções, à tua escolha:
> 1. **Remover este capítulo** e renumerar os seguintes (5→4, 6→5, ..., 9→8) — a estrutura fica: Introdução, Estado da arte, Vibe Coding, Especificação, Design/Desenvolvimento, Testes, Reflexão, Conclusão.
> 2. **Manter o número mas mudar o conteúdo** — por exemplo, transformar o Capítulo 4 num aprofundamento técnico que a secção 2.1 não cobre (ex.: análise de arquitetura/stack de concorrentes, se for relevante), para não ficar vazio.
>
> Deixei o conteúdo antigo por baixo, comentado, só para referência — decide e apaga o resto.

<!--
### 4.1. Aplicações de receitas — conteúdo agora coberto em 2.1
### 4.2. Análise comparativa — tabela agora em 2.1 (Comparação das aplicações)
### 4.3. Oportunidade de desenvolvimento do ChefXP — argumento agora coberto no fecho de 2.1 e no "Resumo do capítulo" de 2.3
-->

---

## Capítulo 5 — Análise e especificação do ChefXP

### Conceito da Aplicação

> Texto conforme entregue ao orientador (`Projeto1_R1_Correção.docx`, secção "A Aplicação"), seguido das notas de reconciliação com o código.

A aplicação ChefXP tem o objetivo de transformar a experiência de cozinhar e aprender sobre alimentação num processo simples e motivador. A plataforma combina receitas, hábitos alimentares saudáveis e mecânicas de gamificação para criar um ambiente onde o utilizador não só encontra inspiração culinária, mas também desenvolve competências práticas de forma progressiva.

O ChefXP funciona como um assistente culinário interativo. O utilizador pode explorar receitas adaptadas às suas preferências, restrições alimentares ou nível de experiência, guardar refeições favoritas e acompanhar o seu progresso ao longo do tempo. Cada receita é apresentada de forma clara, permitindo que qualquer pessoa, mesmo quem tem pouca experiência na cozinha, consiga preparar pratos equilibrados.

A componente de gamificação é o elemento diferenciador da aplicação. O utilizador é desafiado a completar tarefas culinárias, testar novas receitas, cumprir metas semanais de alimentação saudável ou experimentar diferentes técnicas de cozinha. Ao realizar estas ações, ganha pontos, desbloqueia níveis e recebe badges temáticos que refletem o seu desenvolvimento. Além disso, o ChefXP integra elementos sociais, permitindo partilhar receitas, comparar progressos ou participar em desafios com amigos, promovendo um sentido de comunidade.

**Funcionalidades descritas:**

- **Progressão por níveis** — jogo por níveis, onde cada nível corresponde a uma receita apresentada de forma orientada e passo a passo, dos mais simples aos mais complexos.
- **Execução de receita e registo visual** — no final de cada nível, fotografia do prato como prova de conclusão e motivação visual; fica guardada no perfil com um símbolo identificativo.
- **Perfil do utilizador** — fotografias dos níveis concluídos, publicações de pratos próprios, evolução em níveis e conquistas, como portefólio.
- **Interação social** — seguir amigos, ver publicações, comentar e gostar.
- **Partilha de receitas próprias** — fotografias de pratos da autoria do utilizador, distintas das receitas de nível.
- **Pesquisa por filtros** — por orçamento (valor máximo por refeição), tempo de preparação, dificuldade e preferências alimentares (alergias, intolerâncias, gosto pessoal).

> **Reconciliação com o código — este é o ponto mais importante a resolver antes da entrega:**
>
> | O que o texto descreve | O que existe hoje no ChefXP | Ação sugerida |
> | --- | --- | --- |
> | "Cada nível corresponde a uma receita" apresentada passo a passo | O percurso de aprendizagem é feito de **lições** com preparação teórica + quiz (`shared/curriculum.json`, `server/routes/learning.js`); a aplicação prática de uma receita real acontece separadamente, nas **missões de cozinha** no fim de cada unidade (`server/domain/missions.js`) | Ajustar o texto para descrever os dois momentos (lição/quiz vs. missão prática), ou simplificar a implementação para um único fluxo — decisão de produto, não só de relatório |
> | Foto do prato como "prova de conclusão do nível", com símbolo distintivo no perfil | A missão já pede foto de checkpoint no fim; não há hoje um símbolo visual próprio para distinguir fotos de missão de fotos de receita publicada no perfil | Verificar se vale a pena implementar o símbolo, ou ajustar o texto |
> | Filtro de pesquisa **por orçamento** (valor máximo a gastar) | **Implementado (2026-09-22).** `estimated_cost_eur` em `recipes`, filtro `maxCost` na pesquisa, campo no formulário de publicar/editar | `server/routes/recipes.js`, `src/pages/SearchPage.tsx`, `src/pages/PublishPage.tsx` |
> | Filtro de pesquisa **por preferências alimentares** (alergias, intolerâncias, gosto) | **Implementado (2026-09-22).** `dietary_tags` (conjunto fechado: vegetariano, vegano, sem glúten, sem lactose, sem frutos secos, halal), filtro `dietaryTags` que exige todas as etiquetas escolhidas | mesmos ficheiros acima |
> | "Metas semanais de alimentação saudável" | A app tem meta **diária** de XP (`dailyXpGoal`), não uma meta nutricional semanal | Ajustar o texto — a meta existente é de atividade, não de composição da dieta |
>
> Duas linhas continuam por reconciliar (a framing de nível/receita e a foto como "prova de nível"), mas os dois filtros — provavelmente o motivo mais visível para o orientador voltar a pedir correções, porque não se viam numa demonstração da app — já estão implementados, com testes de domínio e de integração (`server/test/recipes.integration.test.js`) e verificados manualmente na aplicação a correr.

### 5.1. Descrição geral da aplicação

O ChefXP é uma Single Page Application React, servida como PWA instalável, com backend próprio em Express/PostgreSQL. Combina três eixos: aprendizagem estruturada (percurso de unidades e lições), prática guiada (missões de cozinha com passos cronometrados) e comunidade (feed social de receitas, desafios, ranking).

### 5.2. Público-alvo

Estudantes universitários com pouca ou nenhuma experiência de cozinha, tipicamente a viver fora de casa dos pais pela primeira vez, com acesso a smartphone e maior familiaridade com apps gamificadas (Duolingo, apps de fitness) do que com literatura culinária tradicional.

> Do texto entregue: "Apesar deste foco, esta aplicação é igualmente relevante para outros perfis de utilizadores que desejem aprender a cozinhar, partilhar criações culinárias ou melhorar os seus hábitos alimentares [...] embora a sua conceção esteja orientada para estudantes, o público-alvo estende-se a uma maior audiência."

### 5.3. Requisitos funcionais

| # | Requisito | Estado | Onde |
| --- | --- | --- | --- |
| 5.3.1 | Gestão de utilizadores (registo em duas fases, login, Google OAuth, edição de perfil, exportação e eliminação de conta) | Implementado | `server/routes/auth.js`, `server/routes/users.js` |
| 5.3.2 | Consulta de receitas (feed, detalhe, três vistas: recentes/a seguir/em alta) | Implementado | `server/routes/recipes.js`, `src/pages/FeedPage.tsx`, `src/pages/RecipePage.tsx` |
| 5.3.3 | Pesquisa e filtros (dificuldade, tempo, orçamento, preferências alimentares) | Implementado | `src/pages/SearchPage.tsx`, `server/routes/recipes.js`, `server/db/migrations/020_recipe_budget_and_diet.sql` |
| 5.3.4 | Sistema de XP e níveis | Implementado | `server/domain/xp.js`, `server/lib/xpLedger.js` |
| 5.3.5 | Sistema de badges | Implementado | `badgesFor()` em `server/domain/xp.js` |
| 5.3.6 | Progresso de aprendizagem (percurso, corações, streak, meta diária) | Implementado | `server/routes/learning.js`, `shared/curriculum.json` |
| 5.3.7 | Partilha de fotografias | Implementado, com validação de assinatura de ficheiro | `server/lib/imageStore.js` |
| 5.3.8 | Likes e comentários | Implementado | `server/routes/recipes.js` |
| 5.3.9 | Perfil do utilizador (próprio e público) | Implementado | `src/pages/ProfilePage.tsx`, `src/pages/ChefPage.tsx` |
| 5.3.10 | Área de administração/moderação | Implementado (três papéis: user, moderator, admin) | `server/routes/admin.js`, `server/routes/moderation.js`, `src/pages/AdminPage.tsx` |
| — | Desafios da comunidade | Implementado | `server/domain/challenges.js`, `server/routes/challenges.js` |
| — | Notificações | Implementado | `server/routes/notifications.js`, `server/lib/notifications.js` |
| — | Rankings semanal/global | Implementado | `server/routes/leaderboard.js` |
| — | Denúncia e bloqueio de conteúdo/contas | Implementado | `server/lib/blocks.js`, `server/domain/moderation.js` |
| — | Funcionamento offline (lições e fotos de missão em fila) | Implementado | `src/lib/offline/outbox.ts`, `src/lib/offline/sync.ts` |
| — | Recuperação de password e confirmação de email | Implementado, condicional a SMTP configurado | `server/lib/mailer.js`, `server/domain/authEmails.js` |

### 5.4. Requisitos não funcionais

- **Usabilidade**: mobile-first, verificado entre 320–414px sem scroll horizontal e alvos de toque ≥32px (`docs/RESPONSIVIDADE.md`).
- **Desempenho**: *code-splitting* por rota, bibliotecas em ficheiros próprios para cache entre deploys; landing reduzida de 820kB para 515kB, percurso completo até desafios de 820kB para 704kB (medido a 390px).
- **Segurança**: cookies `HttpOnly` + `__Host-` + `SameSite=strict` em produção, CSRF double-submit, bcrypt para passwords, CSP própria, rate limiting (`express-rate-limit`), validação de imagens pelos bytes, `helmet`.
- **Manutenibilidade**: domínio puro separado de I/O, testado isoladamente; decisões de arquitetura documentadas no `README.md`.
- **Compatibilidade**: PWA instalável em Android/iOS/desktop, sem dependência de app store.
- **Acessibilidade**: `[A PREENCHER — não há evidência no código de auditoria formal de acessibilidade (WCAG); assumir como limitação a discutir no Capítulo 9]`.
- **Responsividade**: verificada por script automático (`scripts/check-responsive.mjs`) e integrada no CI.
- **Disponibilidade offline**: leitura de rotas já visitadas, fila de sincronização (IndexedDB) para lições e fotos de missão, com garantia de não pagar XP duas vezes.

### 5.5. Casos de utilização

Principais casos de utilização, com o ator "Estudante/Utilizador" salvo indicação contrária:

- Criar conta e confirmar email
- Iniciar sessão (password ou Google)
- Consultar uma lição e responder ao quiz
- Ganhar XP e subir de nível
- Desbloquear um badge
- Completar uma missão de cozinha (com foto de checkpoint)
- Publicar uma receita com fotografia
- Gostar/comentar uma receita
- Seguir outro utilizador
- Participar num desafio com uma receita própria
- Consultar o ranking semanal/global
- Receber uma notificação (gosto, comentário, novo seguidor)
- Denunciar conteúdo ou uma conta
- Bloquear outro utilizador
- Exportar os próprios dados / apagar a própria conta
- (Ator: Moderador) Tratar a fila de denúncias, remover conteúdo denunciado
- (Ator: Administrador) Promover/despromover papéis, consultar métricas da plataforma

`[A PREENCHER]`: converter esta lista num diagrama UML de casos de uso para os anexos.

### 5.6. Arquitetura da aplicação

Arquitetura em camadas, cliente-servidor:

```
UI (React) → hooks → services → API Express → PostgreSQL
```

A autenticação e os utilizadores passam por um `Repository` explícito (`src/data/`), que permite trocar de *provider* de dados num único ficheiro. Os restantes domínios (receitas, desafios, aprendizagem, missões) falam com a API através de serviços próprios em `src/features/*/services/`.

Do lado do servidor, cada domínio tem uma camada de regras puras e testáveis sem I/O (`server/domain/*.js`) separada das rotas HTTP (`server/routes/*.js`), que se limitam a autenticar, validar (Zod) e invocar o domínio.

`[A PREENCHER]`: incluir aqui um diagrama de arquitetura (camadas) e um diagrama entidade-relação simplificado da base de dados para os anexos.

### 5.7. Tecnologias e ferramentas

Ver tabela na secção 3.3.2 — já definido e estável (não é um placeholder para stack "a decidir": o projeto já corre em produção com esta stack).

---

## Capítulo 6 — Design e desenvolvimento da aplicação

### 6.1. Planeamento da interface

- 6.1.1. Identidade visual do ChefXP — a mascote "Chef Sapo" é o elemento central de identidade: ícone da aplicação, avatar nas lições e cabeçalho, com variantes de expressão (aprovar, celebrar, erro, triste) geradas a partir de um único desenho fonte (`public/mascot/chef-frog.png`) por um script próprio (`npm run icons`), sem depender de várias imagens mantidas manualmente.
- 6.1.2. Wireframes e protótipos — `[A PREENCHER — se existirem wireframes/protótipos anteriores ao código, incluir; caso contrário, referir que o protótipo inicial foi já o MVP funcional gerado em Lovable]`
- 6.1.3. Design da interface — Tailwind CSS v4 + shadcn/ui (componentes Radix), navegação inferior fixa (Feed, Pesquisa, Publicar, Desafios, Perfil).
- 6.1.4. Navegação e experiência de utilização — `[A PREENCHER — descrever fluxos principais com capturas de ecrã]`

### 6.2. Desenvolvimento das funcionalidades

- 6.2.1. Estrutura base da aplicação — organização por `features` (não por tipo técnico), com rotas protegidas (`src/components/ProtectedRoute.tsx`).
- 6.2.2. Sistema de receitas — publicação, edição, remoção (só pelo autor), com revogação de XP associada.
- 6.2.3. Sistema de gamificação — XP, níveis, badges, corações, streak, meta diária (ver Capítulo 2.3.8).
- 6.2.4. Sistema de utilizadores — autenticação, papéis (user/moderator/admin), perfis.
- 6.2.5. Funcionalidades sociais — feed, gostos, comentários, seguir, notificações, desafios, ranking.
- 6.2.6. Filtros por orçamento e por preferências alimentares — implementados em 2026-09-22, junto com os filtros de tempo e dificuldade já existentes.
- 6.2.7. Outras funcionalidades desenvolvidas — moderação e denúncias, bloqueio bidirecional, área de administração, PWA/offline, recuperação de password.

### 6.3. Desenvolvimento através de Vibe Coding

Ver Capítulo 3.3 para o processo geral. Nesta secção, `[A PREENCHER]` com 2–3 estudos de caso concretos de funcionalidades específicas (prompt → código gerado → problema encontrado → correção → resultado final), por exemplo:

- O livro-razão de XP (`xp_events`) e a garantia de idempotência.
- O bloqueio bidirecional de utilizadores, centralizado num único fragmento SQL (`server/lib/blocks.js`) em vez de repetido em cada rota.
- A sincronização offline (fila em IndexedDB, ordem estrita, paragem no primeiro erro de rede).

### 6.4. Integração e implementação

Frontend e backend comunicam por REST/JSON, mesma origem em produção (o Express serve o `dist/` do build do Vite), atrás de um proxy Caddy que trata o TLS. Em desenvolvimento, `concurrently` corre Vite e Express em paralelo (`npm run dev:all`).

### 6.5. Dificuldades encontradas e soluções adotadas

Exemplo documentado e citável (do `README.md`): o `.env` do projeto define `NODE_ENV=development` para o Express, mas o Vite lê o mesmo `.env` e isso fazia com que `import.meta.env.PROD` ficasse `false` mesmo numa build de produção — eliminando código como o registo do service worker por *dead code elimination*, sem qualquer erro visível. A aplicação passava todos os testes e, mesmo assim, não funcionava offline. A correção separou a origem de `PROD`/`DEV` (passaram a vir do modo de build indicado na linha de comandos) da variável de ambiente do servidor, e foi acrescentada uma verificação automática (`check:pwa`) que procura o registo do service worker dentro do JavaScript gerado.

`[A PREENCHER]`: acrescentar mais 1–2 exemplos de dificuldades técnicas reais encontradas durante o desenvolvimento.

---

## Capítulo 7 — Testes e avaliação

### 7.1. Plano de testes

O projeto já tem um plano de testes técnico em produção (ver 7.2); falta o plano de avaliação com utilizadores (7.4). `[A PREENCHER]`

### 7.2. Testes funcionais

Três camadas de testes automáticos, todas correndo em CI (GitHub Actions):

- **Domínio** (`server/domain/*.test.js`): regras puras — curva de XP, streaks, validação do currículo, quem pode entrar num desafio, regras de moderação. Sem I/O, correm em milissegundos.
- **Integração** (`server/test/*.integration.test.js`): API completa numa porta efémera, contra PostgreSQL real — cobrem CSRF, cookies de sessão, códigos de estado, transações e idempotência do livro-razão de XP.
- **Interface** (`src/**/*.test.tsx`, Vitest + Testing Library): comportamento de cache, formulários e tratamento de erros da API no browser.

Segundo o `README.md`, a área de moderação e bloqueio sozinha está coberta por 24 testes de domínio, 37 de integração e 13 de interface. `[A PREENCHER]`: consolidar aqui a contagem total de testes de todo o projeto (correr `npm test`, `npm run test:ui` e contar) para citar um número exato no relatório final.

### 7.3. Testes de usabilidade

`[A PREENCHER — ainda não realizados]`. Nota: existe já verificação automática de responsividade (`npm run check:responsive`) e de funcionamento offline com percurso real num Chrome controlado (`npm run check:offline-lesson`), que cobrem usabilidade técnica mas não substituem observação de utilizadores reais.

### 7.4. Avaliação da experiência de utilização

- 7.4.1. Metodologia de avaliação — `[A PREENCHER — sugestão: testes de usabilidade moderados + questionário pós-uso, p.ex. System Usability Scale (SUS) e/ou um instrumento de motivação adaptado (p.ex. baseado na SDT)]`
- 7.4.2. Participantes — `[A PREENCHER — recrutar estudantes universitários, público-alvo definido em 5.2]`
- 7.4.3. Instrumentos de recolha de dados — `[A PREENCHER]`
- 7.4.4. Resultados — `[A PREENCHER]`
- 7.4.5. Análise dos resultados — `[A PREENCHER]`

### 7.5. Avaliação das funcionalidades de gamificação

`[A PREENCHER]` — avaliar perceção de utilizadores relativamente a XP, níveis, badges, missões/desafios, motivação percebida e progresso.

### 7.6. Limitações da avaliação

`[A PREENCHER]`

### 7.7. Melhorias futuras

Itens já identificados como "por fazer" no `docs/ROADMAP.md` do próprio projeto, reaproveitáveis diretamente aqui — `[A PREENCHER — copiar a secção "Por fazer" atualizada do ROADMAP.md à data da entrega]`.

---

## Capítulo 8 — Reflexão crítica e competências adquiridas

`[A PREENCHER — capítulo de reflexão pessoal]`

### 8.1. Conhecimentos técnicos mobilizados

Relacionáveis com UCs do curso, a confirmar contra o plano curricular real:

- Programação (JavaScript/TypeScript, React, Node.js)
- Bases de dados (modelação relacional em PostgreSQL, SQL, migrations, transações)
- Linguagens Web (HTML/CSS, Tailwind, acessibilidade)
- Programação para dispositivos móveis (PWA, service workers, design responsivo)
- Engenharia de Software (arquitetura em camadas, testes automáticos, CI/CD)
- Análise de Sistemas (levantamento de requisitos, casos de uso)
- Design de Sistemas Interativos (fluxos de navegação, feedback, gamificação)
- Multimédia (processamento de imagem no cliente via `<canvas>`, validação de ficheiros)
- Inteligência Artificial (uso crítico de ferramentas de IA generativa no desenvolvimento — Vibe Coding)

### 8.2. Competências adquiridas
- 8.2.1. Desenvolvimento de software — `[A PREENCHER]`
- 8.2.2. Design de interfaces — `[A PREENCHER]`
- 8.2.3. Planeamento de projetos — `[A PREENCHER]`
- 8.2.4. Utilização de ferramentas de IA — `[A PREENCHER]`
- 8.2.5. Resolução de problemas — `[A PREENCHER, usar o exemplo do NODE_ENV/PWA como caso concreto]`
- 8.2.6. Testes e validação — `[A PREENCHER]`

### 8.3. Reflexão sobre a utilização de Vibe Coding

`[A PREENCHER — ver pontos de partida já esboçados em 3.3.7]`

### 8.4. Reflexão sobre o resultado final

`[A PREENCHER]`

---

## Capítulo 9 — Conclusão

### 9.1. Síntese do trabalho desenvolvido

`[A PREENCHER]` — esboço: o ChefXP evoluiu de um protótipo gerado por IA sem lógica de negócio real para uma aplicação de produção completa, com autenticação segura, um percurso de aprendizagem gamificado com XP/níveis/badges/streak, missões práticas, uma componente social completa (feed, desafios, ranking, notificações), moderação, e suporte a PWA/offline — desenvolvida através de uma abordagem de Vibe Coding documentada ao longo de 64 commits e cerca de dois meses.

### 9.2. Cumprimento dos objetivos

`[A PREENCHER]` — a maioria dos objetivos específicos de 1.3.2 está cumprida (1–9); o objetivo 11 (avaliação com utilizadores) está pendente à data deste rascunho.

### 9.3. Principais contributos do projeto

`[A PREENCHER]`

### 9.4. Limitações

- O custo estimado de uma receita é dado por quem a publica, não calculado a partir dos ingredientes — a app não tem uma tabela de preços de mercado.
- Sem avaliação formal de acessibilidade (WCAG).
- Sem avaliação com utilizadores reais à data deste rascunho.
- Moderação não suporta suspensão/remoção de contas (decisão deliberada, documentada no `README.md`, mas ainda assim uma limitação face a um serviço de produção completo).
`[A PREENCHER — acrescentar mais, com honestidade]`

### 9.5. Trabalho futuro

Reaproveitável do `docs/ROADMAP.md`: `[A PREENCHER — copiar itens pendentes]`.

---

## Referências bibliográficas

`[A PREENCHER conforme norma do IPCB/orientador]`

## Anexos

Sugestões de anexos a preparar:

- Diagramas UML (casos de uso, classes/domínio, ER da base de dados)
- Wireframes/protótipos, se existirem
- Questionários de avaliação (Capítulo 7)
- Guiões de teste de usabilidade
- Exemplos de prompts utilizados (expandir a secção 3.3.4, incluindo o `prompt.md` completo)
- Capturas de ecrã da aplicação (ver `docs/FOTOS-LICOES.md` para a lista de ecrãs/lições já identificados para fotografar)
- Tabela de requisitos (5.3)
- Excerto de código relevante (p.ex. `server/domain/xp.js` como exemplo de domínio puro e testado)

---

## Esboço de Resumo / Abstract (para reaproveitar depois)

**Resumo (PT):** `[A PREENCHER]` — cerca de 250 palavras cobrindo problema, objetivo, abordagem (gamificação + Vibe Coding), o que foi construído, e (quando existir) resultado da avaliação.

**Abstract (EN):** `[A PREENCHER]` — tradução/adaptação do resumo.

**Palavras-chave:** gamificação, aprendizagem culinária, Vibe Coding, desenvolvimento assistido por IA, aplicação móvel, PWA, motivação, React, Express, PostgreSQL.
