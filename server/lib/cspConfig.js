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
