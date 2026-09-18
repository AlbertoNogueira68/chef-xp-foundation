import "dotenv/config";
import { closePool, query } from "../server/db/index.js";
import { ROLES } from "../server/domain/moderation.js";

/**
 * Dar ou tirar papéis, pela linha de comandos.
 *
 *   node scripts/set-role.mjs alguem@exemplo.com admin
 *   node scripts/set-role.mjs alguem@exemplo.com moderator
 *   node scripts/set-role.mjs alguem@exemplo.com user
 *
 * O primeiro administrador nasce obrigatoriamente aqui, e é essa a razão de
 * este guião existir: dentro da aplicação um admin promove moderadores mas
 * não cria outros admins — se pudesse, uma sessão roubada bastava para abrir
 * uma porta permanente. Aqui é preciso ter acesso ao servidor, que é uma
 * barreira de outra natureza.
 *
 * A mudança fica registada em `role_changes` com `actor_id` a nulo: não há
 * sessão nenhuma a apontar para uma pessoa quando isto corre.
 */
const email = process.argv[2]?.trim().toLowerCase();
const role = process.argv[3]?.trim();

if (!email || !ROLES.includes(role)) {
  console.error(
    `Uso: node scripts/set-role.mjs <email> <${ROLES.join("|")}>\n` +
      `  admin     — papéis, números da plataforma, e tudo o que o moderador faz\n` +
      `  moderator — fila de denúncias e apagar conteúdo denunciado\n` +
      `  user      — sem poderes`,
  );
  process.exit(1);
}

const { rows } = await query(`SELECT id, username, role FROM users WHERE email = $1`, [email]);
const user = rows[0];

if (!user) {
  console.error(`Não há nenhuma conta com o email ${email}.`);
  await closePool();
  process.exit(1);
}

if (user.role === role) {
  console.log(`${user.username} já é "${role}". Nada a fazer.`);
  await closePool();
  process.exit(0);
}

await query(`UPDATE users SET role = $2 WHERE id = $1`, [user.id, role]);
await query(
  `INSERT INTO role_changes (target_id, actor_id, from_role, to_role) VALUES ($1, NULL, $2, $3)`,
  [user.id, user.role, role],
);

console.log(`${user.username}: ${user.role} → ${role}`);
await closePool();
