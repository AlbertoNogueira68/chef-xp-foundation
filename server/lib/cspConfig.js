/**
 * CSP para SPA + API no mesmo domínio.
 *
 * `imgSrc` inclui o Unsplash porque as receitas de demonstração apontam para lá.
 * As imagens carregadas pelos utilizadores ficam em /uploads, ou seja 'self'.
 * Assim que o seed deixar de usar imagens externas, esta entrada sai.
 */
export const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  /**
   * `'unsafe-inline'` nos estilos, e a razão por escrito.
   *
   * O CSP3 separa folhas de estilo injetadas (`style-src-elem`) de atributos
   * `style=` (`style-src-attr`), e as duas não têm o mesmo risco: a primeira
   * serve para exfiltrar o conteúdo de um formulário com seletores de
   * atributo, a segunda é como o Radix posiciona um popover. A ideia de
   * apertar a primeira e deixar só a segunda é boa — e não passa: o
   * `react-remove-scroll`, que vem com os diálogos do Radix, injeta mesmo um
   * `<style>` quando um diálogo abre, e com `style-src-elem 'self'` a app
   * abre com o scroll partido e os menus por cima do sítio errado.
   *
   * Isto não é uma suposição: está medido. O `scripts/check-csp.mjs` abre a
   * app num Chrome a sério com esta política e conta as violações — com
   * `style-src-elem 'self'` dá dezenas, todas em `inline`. Fica aqui
   * escrito para a próxima pessoa não gastar a tarde a redescobri-lo.
   *
   * O que isto **não** abre: `script-src` continua `'self'` sem
   * `unsafe-inline` nem `unsafe-eval`, e `script-src-attr` é `'none'`. Um
   * estilo injetado não executa código.
   */
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com"],
  connectSrc: ["'self'"],
  // O service worker e o manifesto herdariam o `defaultSrc`, mas dizê-lo por
  // extenso poupa a próxima pessoa de ir confirmar a tabela de heranças do CSP
  // quando a app instalada não arrancar.
  workerSrc: ["'self'"],
  manifestSrc: ["'self'"],
  fontSrc: ["'self'", "data:"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  upgradeInsecureRequests: [],
};
