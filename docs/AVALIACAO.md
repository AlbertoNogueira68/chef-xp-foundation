# Avaliação com utilizadores

O que falta ao projeto não é código: é evidência de que a aplicação funciona
para outras pessoas além de quem a escreveu. Os Capítulos 4, 7 e 8 do
`RELATORIO.md` dependem disto e só disto.

Este documento é o instrumento completo — protocolo, guião, questionário e
folhas de registo. **Não substitui as sessões**: essas são com pessoas, e são
tuas. O que está aqui serve para não teres de inventar nada no dia.

Tempo total a investir: cerca de **seis horas**, espalhadas por uma semana.
É o melhor retorno por hora que existe no que falta fazer.

---

## 1. O que se está a medir

Três perguntas, e nada mais — uma avaliação que tenta medir tudo não mede nada.

| #   | Pergunta                                                     | Como se responde                            |
| --- | ------------------------------------------------------------ | ------------------------------------------- |
| 1   | Uma pessoa sem ajuda consegue aprender uma lição e publicar? | Taxa de sucesso por tarefa, sem intervenção |
| 2   | A aplicação é fácil de usar?                                 | SUS (System Usability Scale)                |
| 3   | A gamificação motiva a voltar?                               | Três perguntas abertas + dados de retorno   |

A 1 e a 2 são sobre usabilidade e resolvem-se numa sessão. A 3 é sobre
motivação e não se resolve numa sessão nenhuma — precisa de uma semana de uso,
e é por isso que há uma segunda parte.

---

## 2. Quem

**8 a 12 participantes.** Não são precisos mais: a investigação de usabilidade
mostra que cinco pessoas encontram a maioria dos problemas de interface, e oito
dá margem para o SUS ter um desvio-padrão que se possa reportar.

O perfil é o do público-alvo declarado no Capítulo 1: **estudantes
universitários que cozinham pouco**. Uma pessoa que já cozinha bem não consegue
avaliar se isto ensina a cozinhar.

Recruta, de propósito:

- pelo menos 2 que nunca usaram uma aplicação de aprendizagem gamificada
  (sem Duolingo, portanto — senão estás a medir o reconhecimento do padrão);
- pelo menos 1 que use Android e 1 que use iPhone (o comportamento da PWA e da
  câmara diferem);
- ninguém que já tenha visto a aplicação antes, e ninguém que te queira agradar.
  Um colega de curso que sabe que isto é o teu projeto final vai dizer que está
  óptimo. Isso não é um dado.

---

## 3. Antes da sessão

- [ ] Base de dados com o seed aplicado (`npm run db:seed`) e a aplicação a correr
- [ ] **Uma conta nova por participante** — o percurso é sobre a primeira vez
- [ ] Telemóvel do participante, e não o teu: é o ecrã real que interessa
- [ ] Gravação do ecrã ligada, com consentimento dado por escrito (ver §7)
- [ ] `npm run metrics -- --json > antes.json` para ter o ponto de partida

Diz isto, em voz alta, antes de começar:

> «Não é a ti que estou a avaliar, é à aplicação. Se te perderes, a culpa é
> dela, não tua — e é exactamente isso que eu preciso de saber. Pensa em voz
> alta enquanto usas: diz o que estás à procura, o que esperavas que
> acontecesse. Não te vou ajudar, e não é por mal.»

A última frase é a mais importante e a mais difícil de cumprir.

---

## 4. As tarefas

Cinco tarefas, por ordem. Regista, para cada uma: **conseguiu sozinho / com
uma pista / não conseguiu**, o tempo, e o que disse enquanto tentava.

| #   | Tarefa                                                         | Sucesso é                                   | Limite |
| --- | -------------------------------------------------------------- | ------------------------------------------- | ------ |
| 1   | «Cria uma conta e entra.»                                      | Chega ao percurso sem ajuda                 | 3 min  |
| 2   | «Aprende a primeira lição.»                                    | Acaba o quiz sem perder todas as vidas      | 8 min  |
| 3   | «Descobre quanto XP tens e quanto falta para o próximo nível.» | Encontra-o no perfil sem lhe dizeres onde é | 2 min  |
| 4   | «Publica uma receita que já saibas fazer.»                     | Receita no feed, com fotografia             | 5 min  |
| 5   | «Encontra uma receita de outra pessoa e diz que gostaste.»     | Gosto dado a uma receita que não é dele     | 3 min  |

Não digas os nomes dos ecrãs. Dizer «vai ao separador Aprender» é resolver-lhe
a tarefa e apagar o dado.

**Se pedir ajuda**: conta até dez em silêncio. Depois dá uma pista, e regista
que houve pista. Uma pista já é uma falha parcial da interface.

---

## 5. O questionário SUS

Aplica-se **logo a seguir à última tarefa**, antes de conversarem. Dez
afirmações, resposta de 1 (discordo totalmente) a 5 (concordo totalmente).

Esta é a tradução portuguesa do instrumento original de Brooke (1996), com o
vocabulário adaptado à aplicação:

| #   | Afirmação                                                                         |
| --- | --------------------------------------------------------------------------------- |
| 1   | Gostaria de usar esta aplicação com frequência.                                   |
| 2   | A aplicação é desnecessariamente complicada.                                      |
| 3   | A aplicação foi fácil de usar.                                                    |
| 4   | Precisaria de ajuda de alguém com experiência para conseguir usar esta aplicação. |
| 5   | As várias funcionalidades da aplicação estão bem integradas.                      |
| 6   | A aplicação tem demasiadas incoerências.                                          |
| 7   | A maioria das pessoas aprenderia a usar esta aplicação muito depressa.            |
| 8   | A aplicação é muito complicada de usar.                                           |
| 9   | Senti-me confiante a usar a aplicação.                                            |
| 10  | Precisei de aprender muitas coisas antes de conseguir usar a aplicação.           |

**Como se calcula** (é preciso fazer isto certo, e é onde a maioria erra):

1. Ímpares (1, 3, 5, 7, 9): contribuição = resposta − 1
2. Pares (2, 4, 6, 8, 10): contribuição = 5 − resposta
3. Soma as dez contribuições (0 a 40) e **multiplica por 2,5** → 0 a 100

O resultado **não é uma percentagem**. É um valor numa escala própria, e a
referência de leitura é esta:

| SUS     | Leitura                         |
| ------- | ------------------------------- |
| > 80,3  | Excelente                       |
| 68 – 80 | Bom (68 é a média da indústria) |
| 51 – 67 | Aceitável, com problemas        |
| < 51    | Mau                             |

Reporta a **média e o desvio-padrão**, sempre com o `n` ao lado. Com oito
pessoas, «SUS de 78» sem desvio-padrão não é um resultado — é um número.

---

## 6. As três perguntas abertas

Depois do SUS, a conversa. Grava, ou escreve as respostas à letra — citações
diretas valem mais num relatório do que um resumo teu.

1. **«Em que momento é que te sentiste perdido?»**
   (Não «sentiste-te perdido?». A pergunta fechada dá sempre «não».)
2. **«O que te faria abrir isto outra vez amanhã?»**
   É a pergunta de retenção, e a resposta vai ser desconfortável se a
   gamificação não estiver a funcionar. Escreve o que ouvires, não o que
   esperavas ouvir.
3. **«Se pudesses apagar uma coisa desta aplicação, qual era?»**
   A pergunta que dá as respostas mais úteis, porque dá licença para criticar.

---

## 7. Consentimento

Uma folha por participante, assinada antes de começar. Sem isto, os dados não
se podem usar no relatório.

> **Consentimento informado — ChefXP**
>
> Este estudo faz parte de um projeto final de licenciatura. Vou pedir-te para
> usares uma aplicação de aprendizagem culinária e responderes a um
> questionário. Demora cerca de 30 minutos.
>
> - A sessão é gravada apenas no ecrã (sem imagem da tua cara).
> - Os dados são anonimizados: no relatório és «Participante 3», e mais nada.
> - Podes parar a qualquer momento, sem dar explicação.
> - A gravação é apagada depois de o relatório estar entregue.
> - Não estou a avaliar-te: estou a avaliar a aplicação.
>
> Nome: **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_** Data: **\_\_\_\_\_\_\_\_\_\_**
> Assinatura: **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**

---

## 8. A semana de uso

Uma sessão de 30 minutos mede usabilidade. **Não mede retenção**, que é a
pergunta 3 — e é a pergunta que uma aplicação gamificada tem de responder.

Por isso: a seguir à sessão, pede aos participantes que fiquem com a conta e a
usem como quiserem durante **sete dias**. Sem lembretes teus — um lembrete teu
é a tua motivação a substituir a da aplicação, e nesse caso não estás a medir
nada.

Ao oitavo dia, corre:

```bash
npm run metrics
```

As contas que interessam aqui:

- **retorno ao dia 2 e na primeira semana** — a pergunta de retenção, medida
  em vez de perguntada;
- **funil das lições** — onde é que as pessoas desistem a meio, e em que lição;
- **missões concluídas** — quantas saíram do ecrã e foram mesmo cozinhar;
- **origem do XP** — ficaram pelo percurso de aprendizagem ou pela parte social?

E manda uma única pergunta por mensagem, ao oitavo dia:

> «Abriste outra vez? Se não abriste, o que é que fez com que não abrisses?»

A resposta de quem **não** voltou é o dado mais valioso do estudo inteiro, e é
o que quase ninguém recolhe.

---

## 9. Folha de registo

Uma por participante. Copia isto para cada sessão.

```
PARTICIPANTE ___     DATA ___/___/______     TELEMÓVEL: Android / iPhone
Cozinha por semana: nunca · 1-2x · 3-5x · todos os dias
Já usou app de aprendizagem gamificada: sim / não

TAREFAS                                    sozinho  pista  falhou   tempo
1. Criar conta e entrar                       [ ]    [ ]    [ ]     ___
2. Aprender a primeira lição                  [ ]    [ ]    [ ]     ___
3. Encontrar XP e nível                       [ ]    [ ]    [ ]     ___
4. Publicar uma receita                       [ ]    [ ]    [ ]     ___
5. Gostar da receita de outra pessoa          [ ]    [ ]    [ ]     ___

SUS (1 a 5)
 1 ___   2 ___   3 ___   4 ___   5 ___
 6 ___   7 ___   8 ___   9 ___  10 ___
                                         → pontuação SUS: ______

O QUE DISSE ENQUANTO USAVA (à letra, não resumido)
_________________________________________________________________
_________________________________________________________________

1. Onde se sentiu perdido:
_________________________________________________________________

2. O que o faria voltar amanhã:
_________________________________________________________________

3. O que apagaria:
_________________________________________________________________

OBSERVADO POR MIM (o que ele não disse mas eu vi)
_________________________________________________________________
```

---

## 10. O que fazer com isto no relatório

| Capítulo | O que lá vai                                                                                  |
| -------- | --------------------------------------------------------------------------------------------- |
| **4**    | Método: perfil dos participantes, tarefas, instrumento, como se analisou                      |
| **7**    | Resultados: taxa de sucesso por tarefa, SUS (média e desvio), as métricas da semana, citações |
| **8**    | Discussão: o que correu mal e porquê, o que mudarias, limitações                              |

Duas regras de honestidade, que valem nota:

1. **Reporta o que correu mal.** Uma tarefa com 50 % de sucesso é um resultado
   tão válido como uma com 100 %, e um relatório em que tudo correu bem é um
   relatório em que ninguém acredita. O Capítulo 8 existe para isto.
2. **Não generalizes de oito pessoas.** A frase certa é «no grupo estudado
   (n=8)», nunca «os utilizadores preferem». O `npm run metrics` avisa-te
   disto sozinho quando o `n` é pequeno — é de propósito.
