/**
 * O português do que o servidor escreve.
 *
 * A chave é a mensagem em inglês, tal como está no código. A tradução é
 * aplicada num sítio só — no tratador de erros — e não espalhada pelas
 * rotas: uma mensagem nasce onde a regra é decidida, e a língua só importa
 * quando ela sai pela porta.
 *
 * O que fica de fora, de propósito: o `validateEnv` e o validador do
 * currículo. Falam para quem põe a app de pé, não para quem a usa.
 */

const PT = {
  "Hi {name},": "Olá {name},",
  "24 hours": "24 horas",
  "{days} days": "{days} dias",
  "1 hour": "1 hora",
  "{hours} hours": "{hours} horas",
  "{minutes} minutes": "{minutes} minutos",
  "The link lasts {validity} and works once.":
    "O link vale {validity} e só pode ser usado uma vez.",
  "The link lasts {validity}.": "O link vale {validity}.",
  "The link lasts {validity} and works once. If this wasn't you, ignore this email — your password stays as it is.":
    "O link vale {validity} e só pode ser usado uma vez. Se não foste tu, ignora este email — a tua password fica como está.",
  "The link lasts {validity}. If you didn't create a ChefXP account, ignore this email.":
    "O link vale {validity}. Se não criaste conta no ChefXP, ignora este email.",
  "The link lasts {validity} and works once. If you didn't ask for this, ignore this email — no account is created.":
    "O link vale {validity} e só pode ser usado uma vez. Se não foste tu a pedir, ignora este email — não fica conta nenhuma criada.",
  "Hi <strong>{name}</strong>, you asked to reset your account's password.":
    "Olá <strong>{name}</strong>, pediste para redefinir a password da tua conta.",
  "Hi <strong>{name}</strong>, confirm this address is yours — it's how you recover the account if you lose your password.":
    "Olá <strong>{name}</strong>, confirma que este endereço é teu — é por aqui que recuperas a conta se perderes a password.",
  "Hi <strong>{name}</strong>, someone asked to create an account with this address — but it already has one. If it was you and you don't remember the password, you can reset it.":
    "Olá <strong>{name}</strong>, alguém pediu para criar uma conta com este endereço — mas ele já tem uma. Se foste tu e não te lembras da password, podes redefini-la.",
  "If the button doesn't work, copy this address into your browser:":
    "Se o botão não funcionar, copia este endereço para o browser:",
  "1 hour": "1 hora",
  "24 hours": "24 horas",
  "A week of lessons": "Semana de lições",
  "Accounts aren't deleted from the queue — handle their content, one piece at a time":
    "Uma conta não se apaga pela fila — trata o conteúdo dela, uma peça de cada vez",
  "Active month": "Mês ativo",
  "An account with these details already exists": "Já existe uma conta com estes dados",
  "An admin is only created from the command line":
    "Um administrador só se cria na linha de comandos",
  "An admin isn't deleted from here": "Um administrador não se apaga por aqui",
  "An admin isn't demoted from here": "Um administrador não se despromove por aqui",
  "At least 3 characters": "Mínimo 3 caracteres",
  "At most 30 characters": "Máximo 30 caracteres",
  "At most 500 characters": "Máximo 500 caracteres",
  "Authorisation cancelled": "Autorização cancelada",
  "Challenge not found": "Desafio não encontrado",
  "Choose a new password": "Escolher password nova",
  "Choose username and password": "Escolher nome e password",
  "Comment not found": "Comentário não encontrado",
  "Confirm email": "Confirmar o email",
  "Confirm this address is yours so we can help you recover the account if you lose your password:":
    "Confirma que este endereço é teu para podermos ajudar-te a recuperar a conta se perderes a password:",
  "Confirm your email": "Confirma o teu email",
  "Confirm your email — ChefXP": "Confirma o teu email — ChefXP",
  "Couldn't reach Google": "Não foi possível falar com a Google",
  "Couldn't send the email. Try again later.": "Não foi possível enviar o email. Tenta mais tarde.",
  "Create your account": "Criar a tua conta",
  "Create your account — ChefXP": "Criar a tua conta — ChefXP",
  "Email or username already taken": "Email ou nome de utilizador já em uso",
  "Email sign-up isn't configured": "Criar conta por email não está configurado",
  "Email verification isn't configured": "Verificação de email não está configurada",
  "Endpoint not found": "Endpoint não encontrado",
  "Finish the earlier lessons first": "Termina as lições anteriores primeiro",
  "Finish the unit's lessons first": "Termina as lições da unidade primeiro",
  "First lesson": "Primeira lição",
  "Google isn't configured": "Google não configurado",
  "Google returned no code": "A Google não devolveu código",
  "Google returned no id_token": "A Google não devolveu id_token",
  "Google sign-in isn't configured": "Início de sessão com Google não está configurado",
  "If it was you and you don't remember the password, reset it here:":
    "Se foste tu e não te lembras da password, redefine-a aqui:",
  "If it wasn't you, ignore this email: nothing changed in your account.":
    "Se não foste tu, ignora este email: não mudou nada na tua conta.",
  "If it wasn't you, you can ignore this email: nothing changed in your account.":
    "Se não foste tu, podes ignorar este email: não mudou nada na tua conta.",
  "If the button doesn't work, copy this address into your browser:":
    "Se o botão não funcionar, copia este endereço para o browser:",
  "If this wasn't you, ignore this email — your password stays as it is.":
    "Se não foste tu, ignora este email — a tua password fica como está.",
  "If you didn't ask for this, ignore this email — no account is created.":
    "Se não foste tu a pedir, ignora este email — não fica conta nenhuma criada.",
  "If you didn't create a ChefXP account, ignore this email.":
    "Se não criaste conta no ChefXP, ignora este email.",
  "Images are only downloaded over https": "Só se descarregam imagens por https",
  "Internal server error": "Erro interno do servidor",
  "Invalid content type": "Tipo de conteúdo inválido",
  "Invalid credentials": "Credenciais inválidas",
  "Invalid data": "Dados inválidos",
  "Invalid email": "Email inválido",
  "Invalid identifier": "Identificador inválido",
  "Invalid image": "Imagem inválida",
  "Invalid image address": "Endereço de imagem inválido",
  "Invalid or expired link. Ask for another.": "Link inválido ou expirado. Pede outro.",
  "Invalid or expired request": "Pedido inválido ou expirado",
  "Invalid question": "Pergunta inválida",
  "Invalid request": "Pedido inválido",
  "Invalid token": "Token inválido",
  "Lesson not found": "Lição não encontrada",
  "List at least a few ingredients": "Lista pelo menos alguns ingredientes",
  "Lowercase letters, numbers, dot and underscore only":
    "Só letras minúsculas, números, ponto e underscore",
  "Mission not found": "Missão não encontrada",
  "No answer for this step": "Sem resposta para este passo",
  "No mission running": "Sem missão a decorrer",
  "No skipping steps": "Não se saltam passos",
  "Nothing to update": "Nada para atualizar",
  "Notification not found": "Notificação não encontrada",
  "Only base64 PNG, JPEG or WebP images are accepted":
    "Só são aceites imagens PNG, JPEG ou WebP em base64",
  "Open this address to choose your username and password:":
    "Abre este endereço para escolheres o teu nome de utilizador e a tua password:",
  "Origin not allowed by CORS": "Origem não permitida por CORS",
  "Password recovery isn't configured": "Recuperação de password não está configurada",
  "Password required": "Password obrigatória",
  "Recipe not found": "Receita não encontrada",
  "Report not found": "Denúncia não encontrada",
  "Reset the password": "Redefinir a password",
  "Reset your password — ChefXP": "Redefinir a tua password — ChefXP",
  "Sign-up goes through a confirmed email. Ask for the link at /signup.":
    "Criar conta é por email confirmado. Pede o link em /signup.",
  "Someone (maybe you) asked to create an account with this address — but it already has one.":
    "Alguém (talvez tu) pediu para criar uma conta com este endereço — mas ele já tem uma.",
  "Step outside the mission": "Passo fora da missão",
  "Tell us a bit more about the recipe": "Conta um pouco mais sobre a receita",
  "That no longer exists": "Isso já não existe",
  "That recipe is already in another challenge": "Essa receita já está noutro desafio",
  "That username is already taken": "Esse nome de utilizador já está em uso",
  "The content isn't a PNG, JPEG or WebP image": "O conteúdo não é uma imagem PNG, JPEG ou WebP",
  "The Google account didn't share the email": "A conta Google não partilhou o email",
  "The Google account's email isn't verified": "Email da conta Google não verificado",
  "The name doesn't match the account's": "O nome não coincide com o da conta",
  "The password can't be longer than 200 characters":
    "A password não pode ter mais de 200 caracteres",
  "The password needs a number": "A password tem de ter um número",
  "The password needs a special character": "A password tem de ter um caractere especial",
  "The password needs an uppercase letter": "A password tem de ter uma letra maiúscula",
  "The proof photo is missing": "Falta a foto do passo de verificação",
  "The username doesn't match": "O nome de utilizador não coincide",
  "The username must be at least 3 characters":
    "O nome de utilizador tem de ter pelo menos 3 caracteres",
  "There's already an account for this email, still unconfirmed. Sign in with the password.":
    "Já existe uma conta com este email, ainda por confirmar. Entra com a password.",
  "This account signs in with Google. Use the «Continue with Google» button.":
    "Esta conta entra com o Google. Usa o botão «Continuar com Google».",
  "This challenge is over": "Este desafio já terminou",
  "This comment isn't yours": "Este comentário não é teu",
  "This email is already confirmed": "Este email já está confirmado",
  "This is for admins": "Isto é da administração",
  "This is for moderators": "Isto é da moderação",
  "This mission is already finished": "Esta missão já terminou",
  "This recipe isn't yours": "Esta receita não é tua",
  "This report has already been handled": "Esta denúncia já foi tratada",
  "This step doesn't ask for a photo": "Este passo não pede foto",
  "To remove your own, delete it — reporting is for other people's":
    "Para tirar o que é teu, apaga — denunciar é para o que é dos outros",
  "Token issued for another application": "Token emitido para outra aplicação",
  "Token without a user identifier": "Token sem identificador de utilizador",
  "Too many email requests. Try again in an hour.":
    "Demasiados pedidos de email. Tenta daqui a uma hora.",
  "Too many sign-in attempts. Try again in a few minutes.":
    "Demasiadas tentativas de login. Tenta daqui a uns minutos.",
  "Type the account's name": "Escreve o nome da conta",
  "Type your username": "Escreve o teu nome de utilizador",
  "Unknown action": "Ação desconhecida",
  "unreadable id_token": "id_token ilegível",
  "User not found": "Utilizador não encontrado",
  "We've confirmed this address is yours. Now choose your username and password.":
    "Confirmámos que este endereço é teu. Falta escolheres o nome de utilizador e a password.",
  "Welcome to ChefXP!": "Bem-vindo ao ChefXP!",
  "Wrong password": "Password incorreta",
  "You already have a ChefXP account": "Já tens conta no ChefXP",
  "You asked to reset the password for your ChefXP account. Open this address:":
    "Pediste para redefinir a password da tua conta ChefXP. Abre este endereço:",
  "You can only submit a recipe of your own": "Só podes submeter uma receita tua",
  "You can't block yourself": "Não te podes bloquear a ti próprio",
  "You can't change your own role here": "O teu próprio papel não se muda por aqui",
  "You can't follow this person": "Não dá para seguir esta pessoa",
  "You can't follow yourself": "Não te podes seguir a ti próprio",
  "You can't report yourself": "Não te podes denunciar a ti próprio",
  "You're not entered in this challenge": "Não estás a participar neste desafio",
  "You've already entered this challenge": "Já participaste neste desafio",
  "Your own account is deleted from your profile": "A tua própria conta apaga-se no perfil",
};

/** Traduz uma mensagem. Sem tradução, devolve-a como está (em inglês). */
export function translate(mensagem, lang) {
  if (lang !== "pt" || typeof mensagem !== "string") return mensagem;
  return PT[mensagem] ?? mensagem;
}
