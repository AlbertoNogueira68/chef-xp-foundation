import rateLimit from "express-rate-limit";

/**
 * Quantas imagens uma conta pode gravar por hora.
 *
 * O limite global da API conta pedidos e trata todos por igual; estes pedidos
 * não são iguais aos outros — cada um escreve até 3 MB no disco do servidor, e
 * o disco não se recupera sozinho quando enche. Com o limite geral (1000 por
 * 15 minutos) e nada mais, uma conta autenticada podia escrever da ordem de
 * gigabytes por hora.
 *
 * Desde que apagar conteúdo passou a apagar o ficheiro, o ciclo
 * publicar/apagar já não acumula nada. Falta o caso simples: publicar e não
 * apagar, muitas vezes. Sessenta imagens por hora é muito acima de qualquer
 * uso real — quem publica uma receita por minuto durante uma hora não está a
 * cozinhar — e põe um tecto de 180 MB por hora e por conta.
 *
 * A chave é o utilizador e não o IP, de propósito: o IP é partilhado por uma
 * casa inteira e, nas redes móveis, por muita gente atrás do mesmo CGNAT. Quem
 * escreve no disco é uma conta, e é a conta que responde por isso.
 *
 * Aplica-se **depois** do `requireAuth`, senão não há `req.user` para contar.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  // Função e não valor: os limitadores nascem quando o módulo é importado, e
  // nessa altura o ambiente do processo de teste ainda não está montado.
  max: () => Number(process.env.RATE_LIMIT_UPLOAD_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip,
  message: { error: "Too many photos in a short time. Try again later." },
});
