import type { LearningUnit } from "@/types/learning";

const IMG = {
  bolognese:
    "https://images.unsplash.com/photo-1622973536968-3ead9e780960?w=800&h=600&fit=crop",
  omelete:
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&h=600&fit=crop",
  sopa: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&h=600&fit=crop",
  arroz: "https://images.unsplash.com/photo-1603133872877-684f208fb84b?w=800&h=600&fit=crop",
  salada:
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop",
  panquecas:
    "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=600&fit=crop",
  jantar:
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop",
  bonus:
    "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&h=600&fit=crop",
};

export const LEARNING_CURRICULUM: LearningUnit[] = [
  {
    id: "week-1",
    title: "Semana 1",
    subtitle: "7 dias · 7 pratos para o dia a dia",
    color: "emerald",
    lessons: [
      {
        id: "day-1",
        dayNumber: 1,
        title: "Dia 1",
        dishName: "Massa à bolonhesa",
        description: "O clássico italiano perfeito para a primeira aula — molho rico e massa al dente.",
        type: "lesson",
        xpReward: 25,
        icon: "pasta",
        imageUrl: IMG.bolognese,
        cookTimeMin: 45,
        difficulty: "medio",
        ingredients: [
          "300 g massa (spaghetti ou tagliatelle)",
          "400 g carne de vaca picada",
          "1 cebola média",
          "2 dentes de alho",
          "400 g polpa de tomate",
          "Azeite, sal, pimenta, orégãos",
          "Queijo parmesão (opcional)",
        ],
        preparationSteps: [
          {
            title: "Mise en place",
            description:
              "Pica a cebola e o alho em cubos pequenos. Tem todos os ingredientes à mão antes de ligar o fogão.",
          },
          {
            title: "Refogar a base",
            description:
              "Aquece azeite em lume médio. Junta cebola e alho e deixa amolecer 3–4 min até ficarem translúcidos.",
          },
          {
            title: "Cozinhar a carne",
            description:
              "Aumenta o lume, junta a carne e vai desfazendo com uma colher de pau até dourar e não ficar rosa.",
          },
          {
            title: "O molho",
            description:
              "Adiciona a polpa, tempera com sal, pimenta e orégãos. Reduz o lume e deixa cozinhar 20–25 min, mexendo de vez em quando.",
          },
          {
            title: "A massa",
            description:
              "Cozinha a massa em água bem salgada conforme a embalagem. Escorre e reserva um copo da água da massa.",
          },
          {
            title: "Empratar",
            description:
              "Mistura a massa com o molho (usa um pouco da água reservada se precisares de cremosidade). Sirve com parmesão.",
          },
        ],
        questions: [
          {
            id: "d1-q1",
            type: "multiple_choice",
            prompt: "Quando deves salgar a água da massa?",
            options: ["Antes de ferver", "Quando ferve", "Depois de escorrer", "Nunca"],
            correctAnswer: "Quando ferve",
            explanation: "Água a ferver com sal tempera a massa por dentro — essencial na bolonhesa.",
          },
          {
            id: "d1-q2",
            type: "true_false",
            prompt: "Deves deixar o molho cozinhar em lume brando pelo menos 20 minutos.",
            correctAnswer: "true",
            explanation: "Tempo lento desenvolve sabor e espessa o molho naturalmente.",
          },
          {
            id: "d1-q3",
            type: "multiple_choice",
            prompt: "Para que serve a água da massa reservada?",
            options: [
              "Ligar o molho à massa",
              "Beber durante o jantar",
              "Lavar a louça",
              "Arrefecer o molho",
            ],
            correctAnswer: "Ligar o molho à massa",
            explanation: "O amido da água da massa torna o prato cremoso e uniforme.",
          },
        ],
      },
      {
        id: "day-2",
        dayNumber: 2,
        title: "Dia 2",
        dishName: "Omelete de queijo",
        description: "Refeição rápida e versátil — domina a técnica da omelete perfeita.",
        type: "lesson",
        xpReward: 20,
        icon: "egg",
        imageUrl: IMG.omelete,
        cookTimeMin: 15,
        difficulty: "facil",
        ingredients: [
          "3 ovos",
          "30 g queijo ralado (flamengo ou cheddar)",
          "Sal e pimenta",
          "1 colher de sopa de manteiga",
          "Azeite (opcional)",
        ],
        preparationSteps: [
          {
            title: "Bater os ovos",
            description:
              "Numa tigela, bate os ovos com sal e pimenta até ficarem homogéneos — não precisas de espuma, só misturar bem.",
          },
          {
            title: "Aquecer a frigideira",
            description:
              "Frigideira antiaderente em lume médio-baixo com manteiga (e um fio de azeite se quiseres). A manteiga deve derreter sem dourar.",
          },
          {
            title: "Verter e cozinhar",
            description:
              "Deita os ovos e deixa assentar 20 segundos. Empurra as bordas para o centro com uma espátula, inclinando a frigideira para o ovo cru preencher.",
          },
          {
            title: "Adicionar queijo",
            description:
              "Quando o topo ainda estiver ligeiramente húmido, espalha o queijo numa metade da omelete.",
          },
          {
            title: "Dobrar e servir",
            description:
              "Dobra ao meio, deixa 30 segundos para o queijo derreter e desenforma para o prato. Sirve logo.",
          },
        ],
        questions: [
          {
            id: "d2-q1",
            type: "multiple_choice",
            prompt: "Lume ideal para uma omelete?",
            options: ["Médio-baixo", "Máximo", "Desligado", "Só grill"],
            correctAnswer: "Médio-baixo",
            explanation: "Fogo alto queima o exterior antes do interior cozinhar.",
          },
          {
            id: "d2-q2",
            type: "true_false",
            prompt: "Deves dobrar a omelete quando o topo ainda está um pouco cremoso.",
            correctAnswer: "true",
            explanation: "Assim a omelete fica suculenta — cozinha um pouco mais ao dobrar.",
          },
        ],
      },
      {
        id: "day-3",
        dayNumber: 3,
        title: "Dia 3",
        dishName: "Sopa de legumes",
        description: "Confort food saudável — aprende a construir sabor num caldo caseiro.",
        type: "lesson",
        xpReward: 20,
        icon: "soup",
        imageUrl: IMG.sopa,
        cookTimeMin: 40,
        difficulty: "facil",
        ingredients: [
          "2 cenouras",
          "2 batatas médias",
          "1 cebola",
          "2 dentes de alho",
          "1,2 L caldo de legumes ou água",
          "Azeite, sal, pimenta",
          "Salsa fresca",
        ],
        preparationSteps: [
          {
            title: "Preparar legumes",
            description: "Descasca e corta cenoura, batata e cebola em cubos médios (tamanho uniforme).",
          },
          {
            title: "Refogado inicial",
            description:
              "Em panela, refoga cebola e alho em azeite 3 min. Junta cenoura e batata, mexe 2 min.",
          },
          {
            title: "Cozedura",
            description:
              "Cobre com caldo ou água. Leva a ferver, baixa o lume e cozinha 25–30 min até os legumes estarem tenros.",
          },
          {
            title: "Triturar (opcional)",
            description:
              "Podes servir com pedaços ou triturar parte/tudo com varinha mágica para textura cremosa.",
          },
          {
            title: "Finalizar",
            description: "Ajusta sal e pimenta. Sirve com salsa picada e um fio de azeite por cima.",
          },
        ],
        questions: [
          {
            id: "d3-q1",
            type: "multiple_choice",
            prompt: "Porque cortar os legumes em cubos do mesmo tamanho?",
            options: [
              "Cozinham ao mesmo ritmo",
              "Ficam mais bonitos na foto",
              "Não é necessário",
              "Para congelar depois",
            ],
            correctAnswer: "Cozinham ao mesmo ritmo",
            explanation: "Tamanho uniforme = cozedura uniforme, sem pedaços crus ou em papas.",
          },
          {
            id: "d3-q2",
            type: "true_false",
            prompt: "Refogar a cebola no início dá mais profundidade ao sabor da sopa.",
            correctAnswer: "true",
            explanation: "O refogado carameliza ligeiramente e constrói a base de sabor.",
          },
        ],
      },
      {
        id: "day-bonus",
        dayNumber: 3,
        title: "Baú",
        dishName: "Dica do chef",
        description: "Segredo extra: como temperar em camadas.",
        type: "chest",
        xpReward: 15,
        icon: "gift",
        imageUrl: IMG.bonus,
        cookTimeMin: 5,
        difficulty: "facil",
        ingredients: ["Sal", "Pimenta", "Ervas frescas"],
        preparationSteps: [
          {
            title: "Temperar em camadas",
            description:
              "Tempéra ligeiramente em cada etapa: no refogado, no molho, no final. Prova sempre antes de servir.",
          },
        ],
        questions: [
          {
            id: "bonus-q1",
            type: "true_false",
            prompt: "É mais fácil corrigir prato pouco salgado do que demasiado salgado.",
            correctAnswer: "true",
            explanation: "Por isso vais sempre adicionando sal aos poucos.",
          },
        ],
      },
      {
        id: "day-4",
        dayNumber: 4,
        title: "Dia 4",
        dishName: "Arroz de frango",
        description: "Prato único português — arroz cremoso com frango suculento.",
        type: "lesson",
        xpReward: 25,
        icon: "rice",
        imageUrl: IMG.arroz,
        cookTimeMin: 50,
        difficulty: "medio",
        ingredients: [
          "400 g peito de frango em cubos",
          "300 g arroz carolino",
          "1 cebola",
          "2 dentes de alho",
          "1,2 L caldo de galinha quente",
          "Azeite, sal, pimenta, colorau (opcional)",
          "Salsa e limão",
        ],
        preparationSteps: [
          {
            title: "Temperar o frango",
            description: "Tempera os cubos de frango com sal, pimenta e um pouco de colorau se tiveres.",
          },
          {
            title: "Dourar o frango",
            description:
              "Em panela larga, doura o frango em azeite quente. Retira e reserva — não precisa de cozinhar por completo.",
          },
          {
            title: "Refogado e arroz",
            description:
              "Na mesma panela, refoga cebola e alho. Junta o arroz e envolve 1–2 min até ficar translúcido.",
          },
          {
            title: "Cozedura",
            description:
              "Devolve o frango, deita o caldo quente (o dobro do volume do arroz). Mexe, leva a ferver e cozinha em lume brando tapado 18–20 min.",
          },
          {
            title: "Repouso",
            description:
              "Desliga o lume, deixa repousar tapado 5 min. Abre, solta com garfo, decora com salsa e limão.",
          },
        ],
        questions: [
          {
            id: "d4-q1",
            type: "multiple_choice",
            prompt: "O caldo deve estar…",
            options: ["Quente", "Frio", "Gelado", "Não importa"],
            correctAnswer: "Quente",
            explanation: "Caldo quente mantém a cozedura — caldo frio interrompe o processo.",
          },
          {
            id: "d4-q2",
            type: "true_false",
            prompt: "Deves deixar o arroz repousar tapado antes de servir.",
            correctAnswer: "true",
            explanation: "O repouso distribui a humidade e o arroz fica solto e cremoso.",
          },
        ],
      },
      {
        id: "day-5",
        dayNumber: 5,
        title: "Dia 5",
        dishName: "Salada mediterrânica",
        description: "Fresca, colorida e nutritiva — montagem e molho vinaigrette.",
        type: "lesson",
        xpReward: 20,
        icon: "salad",
        imageUrl: IMG.salada,
        cookTimeMin: 20,
        difficulty: "facil",
        ingredients: [
          "Alface ou rúcula",
          "Tomate cherry",
          "Pepino",
          "1 lata de grão-de-bico",
          "Queijo feta",
          "Azeitonas",
          "Azeite, limão, sal, orégãos",
        ],
        preparationSteps: [
          {
            title: "Lavar e secar",
            description: "Lava bem as folhas e seca-as (salada molhada não segura o molho).",
          },
          {
            title: "Cortar ingredientes",
            description: "Corta tomate ao meio, pepino em rodelas, esmaga levemente o feta em pedaços.",
          },
          {
            title: "Montar a base",
            description: "Numa saladeira, dispõe folhas, tomate, pepino, grão escorrido e azeitonas.",
          },
          {
            title: "Molho vinaigrette",
            description:
              "Numa tigela pequena, mistura 3 partes azeite, 1 parte limão, sal e orégãos. Bate com garfo.",
          },
          {
            title: "Servir",
            description: "Junta o feta, rega com molho só na hora de comer para manter a crocância.",
          },
        ],
        questions: [
          {
            id: "d5-q1",
            type: "multiple_choice",
            prompt: "Quando deves adicionar o molho à salada?",
            options: [
              "Na hora de servir",
              "1 hora antes",
              "Na véspera",
              "Durante o corte",
            ],
            correctAnswer: "Na hora de servir",
            explanation: "Molho antecipado deixa as folhas murchas e perdem textura.",
          },
          {
            id: "d5-q2",
            type: "true_false",
            prompt: "Secar as folhas depois de lavar é importante.",
            correctAnswer: "true",
            explanation: "Folhas secas absorvem melhor o molho e ficam crocantes.",
          },
        ],
      },
      {
        id: "day-6",
        dayNumber: 6,
        title: "Dia 6",
        dishName: "Panquecas americanas",
        description: "Pequeno-almoço ou sobremesa — massa fofa e douradita.",
        type: "lesson",
        xpReward: 20,
        icon: "pancake",
        imageUrl: IMG.panquecas,
        cookTimeMin: 25,
        difficulty: "facil",
        ingredients: [
          "200 g farinha",
          "2 ovos",
          "250 ml leite",
          "2 colheres de sopa de açúcar",
          "1 colher de chá de fermento",
          "Sal, manteiga para a frigideira",
          "Mel ou fruta para servir",
        ],
        preparationSteps: [
          {
            title: "Massa",
            description:
              "Numa tigela, mistura farinha, açúcar, fermento e sal. Faz um buraco no centro, junta ovos e leite, bate até ficar liso.",
          },
          {
            title: "Descansar",
            description: "Deixa a massa repousar 5–10 min — o fermento começa a atuar.",
          },
          {
            title: "Aquecer frigideira",
            description: "Frigideira em lume médio com um pouco de manteiga. Deve estar quente mas não fumegante.",
          },
          {
            title: "Cozinhar",
            description:
              "Deita porções de massa. Quando aparecerem bolhas na superfície e as bordas firmarem, vira e doura o outro lado (1–2 min cada lado).",
          },
          {
            title: "Servir",
            description: "Empilha e serve com mel, fruta fresca ou maple syrup.",
          },
        ],
        questions: [
          {
            id: "d6-q1",
            type: "multiple_choice",
            prompt: "Sinal de que está na hora de virar a panqueca?",
            options: [
              "Bolhas na superfície",
              "Ficar preta",
              "Levantar sozinha",
              "Depois de 10 min",
            ],
            correctAnswer: "Bolhas na superfície",
            explanation: "As bolhas indicam que o interior está a cozinhar e a base está dourada.",
          },
          {
            id: "d6-q2",
            type: "true_false",
            prompt: "O fermento ajuda as panquecas a ficarem fofas.",
            correctAnswer: "true",
            explanation: "O fermento liberta gás que cria a textura aerada.",
          },
        ],
      },
      {
        id: "day-7",
        dayNumber: 7,
        title: "Dia 7",
        dishName: "Jantar completo",
        description: "Revisão da semana — combina sopa, salada e um prato principal.",
        type: "boss",
        xpReward: 50,
        icon: "crown",
        imageUrl: IMG.jantar,
        cookTimeMin: 60,
        difficulty: "medio",
        ingredients: [
          "Sopa de legumes (receita dia 3)",
          "Salada mediterrânica (receita dia 5)",
          "Massa à bolonhesa ou arroz de frango",
          "Mise en place organizada",
        ],
        preparationSteps: [
          {
            title: "Planear o menu",
            description:
              "Escolhe sopa + prato principal + salada. Lista ingredientes e tempos — começa pelo que demora mais.",
          },
          {
            title: "Mise en place",
            description:
              "Prepara tudo antes: legumes cortados, molho feito, salada lavada. Cozinhar fica mais calmo.",
          },
          {
            title: "Ordem de execução",
            description:
              "1) Sopa (pode ficar em lume brando). 2) Prato principal. 3) Salada e molho na última hora.",
          },
          {
            title: "Empratar",
            description:
              "Sopa em bowl, prato principal no centro, salada à parte. Tempera cada elemento antes de servir.",
          },
        ],
        questions: [
          {
            id: "d7-q1",
            type: "multiple_choice",
            prompt: "O que é mise en place?",
            options: [
              "Ter tudo preparado antes de cozinhar",
              "Um tipo de faca",
              "Temperar só no fim",
              "Servir em camadas",
            ],
            correctAnswer: "Ter tudo preparado antes de cozinhar",
            explanation: "Organização prévia é o segredo de um jantar sem stress.",
          },
          {
            id: "d7-q2",
            type: "multiple_choice",
            prompt: "Que prato da semana 1 cozes massa em água salgada?",
            options: ["Massa à bolonhesa", "Arroz de frango", "Sopa", "Salada"],
            correctAnswer: "Massa à bolonhesa",
            explanation: "Dia 1 — lembraste da água com sabor a mar?",
          },
          {
            id: "d7-q3",
            type: "true_false",
            prompt: "Na omelete (dia 2), o lume deve ser médio-baixo.",
            correctAnswer: "true",
            explanation: "Revisão da técnica que aprendeste no dia 2.",
          },
        ],
      },
    ],
  },
];
