# Responsividade: a regra

O ChefXP é uma aplicação de telemóvel que também abre num computador — não o
contrário. Alguém cozinha com o telemóvel encostado à bancada, com uma mão
suja e o ecrã a 30 cm. É esse o caso de uso a proteger.

Esta regra não é um conselho: é verificada por `npm run check:responsive`, que
abre a aplicação a sério num browser e falha se algum ponto for violado.

## A regra

**Tudo o que está feito tem de funcionar entre 320 px e 414 px de largura.**
Em concreto, em qualquer ecrã, rota ou diálogo:

1. **Nunca há scroll horizontal.** A página não pode ser mais larga do que o
   ecrã. Se algo tem de ser mais largo — uma tabela, uma fila de filtros —
   esse algo vive dentro do seu próprio contentor com `overflow-x-auto`, e é
   ele que rola, não a página.

2. **Nada é cortado na margem.** Nenhum elemento visível pode passar do bordo
   direito nem ficar antes do esquerdo. Títulos longos levam `truncate` ou
   `line-clamp`; números levam `tabular-nums` para não saltarem; nomes de
   utilizador levam `min-w-0` no contentor flex, senão não encolhem.

3. **O que se carrega tem altura de dedo: 32 px no mínimo**, e 24 px de
   largura. As diretrizes de acessibilidade falam em 44 px; 32 é o mínimo que
   esta aplicação aceita, por ser o que os cartões densos permitem sem se
   desfazerem. Um ícone de 16 px não é um alvo — o alvo é o botão à volta dele.

   Duas isenções, e só estas: um link dentro de uma frase tem a altura da
   linha de texto e não pode ter outra (as WCAG 2.5.8 isentam-nos
   explicitamente); e um input nativo escondido por baixo de um controlo
   próprio não se carrega, quem se carrega é o controlo.

## Como escrever código que cumpre a regra

- **Larguras em px são quase sempre um erro.** `w-full`, `max-w-*`, `flex-1` e
  `grid-cols-*` adaptam-se; `w-[420px]` não.
- **Grelhas acima de quatro colunas não cabem em 320 px.** A grelha de
  estatísticas do perfil tem quatro e já é o limite.
- **Em `flex`, o filho que tem texto leva `min-w-0`.** Sem isso o texto recusa
  encolher e empurra o resto para fora do ecrã. É a causa mais comum de scroll
  horizontal nesta aplicação.
- **Filas horizontais** (filtros, chefs a seguir) usam `ScrollArea` ou
  `overflow-x-auto` com `shrink-0` nos filhos.
- **Diálogos** levam `max-h-[85vh] overflow-y-auto`: num telemóvel deitado, um
  diálogo alto não cabe e fica sem forma de chegar ao botão de confirmar.
- **A área de toque pode ser maior do que o desenho.** Para um texto pequeno
  que é clicável, `-my-2 py-2` dá altura sem afastar nada.

## Correr a verificação

Precisa da aplicação a correr e de uma base de dados com o seed (o utilizador
`demo@chef-xp.local`):

```bash
npm run dev:all           # noutro terminal
npm run check:responsive
```

Contra uma build de produção servida pelo Express:

```bash
npm run build && npm start
BASE_URL=http://localhost:3010 npm run check:responsive
```

O que a verificação cobre: as nove rotas da aplicação e os quatro diálogos
(definições, seguidores, desafio, ranking), em quatro larguras. São 44
medições por execução.

## Quando a regra falhar

A saída diz o tipo, o ecrã, o elemento e as larguras em que falha:

```
alvo-pequeno · /feed · button 96×24px — "Recentes"  [320, 360, 390, 414px]
```

Resolve-se no componente, não no ecrã: se um separador é pequeno no feed, é
pequeno em todo o lado — o sítio para corrigir é `components/ui/tabs.tsx`. Foi
assim que os 112 problemas da primeira medição se resolveram em cinco
alterações.
