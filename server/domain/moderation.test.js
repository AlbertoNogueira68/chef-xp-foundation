import test from "node:test";
import assert from "node:assert/strict";
import {
  REPORT_REASONS,
  REPORT_SUBJECTS,
  canAdminister,
  canModerate,
  commentDeleterRole,
  reportRefusal,
  resolutionOf,
  roleChangeRefusal,
  accountDeletionRefusal,
} from "./moderation.js";

const eu = "user-1";
const outro = "user-2";

/* ---------------------------------------------------------------- *
 * Apagar um comentário
 * ---------------------------------------------------------------- */

test("o autor apaga o que escreveu", () => {
  assert.equal(
    commentDeleterRole({ userId: eu, role: "user", commentAuthorId: eu, recipeAuthorId: outro }),
    "author",
  );
});

test("o dono da receita apaga um comentário de outra pessoa na sua receita", () => {
  assert.equal(
    commentDeleterRole({ userId: eu, role: "user", commentAuthorId: outro, recipeAuthorId: eu }),
    "recipe_owner",
  );
});

test("um terceiro não apaga nada", () => {
  assert.equal(
    commentDeleterRole({
      userId: "user-3",
      role: "user",
      commentAuthorId: outro,
      recipeAuthorId: eu,
    }),
    null,
  );
});

test("o admin apaga o que o moderador apaga — a escada vale para baixo", () => {
  assert.equal(
    commentDeleterRole({
      userId: "user-3",
      role: "admin",
      commentAuthorId: outro,
      recipeAuthorId: eu,
    }),
    "moderator",
  );
});

test("o moderador apaga o que não é dele nem da sua receita", () => {
  assert.equal(
    commentDeleterRole({
      userId: "user-3",
      role: "moderator",
      commentAuthorId: outro,
      recipeAuthorId: eu,
    }),
    "moderator",
  );
});

test("ser autor ganha a ser moderador — o papel registado é o mais próximo", () => {
  assert.equal(
    commentDeleterRole({
      userId: eu,
      role: "moderator",
      commentAuthorId: eu,
      recipeAuthorId: eu,
    }),
    "author",
  );
});

test("sem sessão não se apaga", () => {
  assert.equal(
    commentDeleterRole({ userId: null, role: "user", commentAuthorId: null, recipeAuthorId: null }),
    null,
  );
});

/* ---------------------------------------------------------------- *
 * Denunciar
 * ---------------------------------------------------------------- */

test("denunciar conteúdo de outra pessoa passa", () => {
  assert.equal(
    reportRefusal({ reporterId: eu, subjectType: "recipe", subjectOwnerId: outro }),
    null,
  );
});

test("denunciar o que é meu é recusado com o caminho certo à frente", () => {
  const recusa = reportRefusal({ reporterId: eu, subjectType: "comment", subjectOwnerId: eu });
  assert.match(recusa, /delete/);
});

test("denunciar-me a mim próprio é recusado", () => {
  assert.equal(
    reportRefusal({ reporterId: eu, subjectType: "user", subjectOwnerId: eu }),
    "You can't report yourself",
  );
});

test("um tipo de alvo desconhecido é recusado antes de qualquer consulta", () => {
  assert.equal(
    reportRefusal({ reporterId: eu, subjectType: "mensagem", subjectOwnerId: outro }),
    "Invalid content type",
  );
});

test("dono desconhecido não inventa recusa — quem valida a existência é a rota", () => {
  assert.equal(reportRefusal({ reporterId: eu, subjectType: "recipe", subjectOwnerId: null }), null);
});

/* ---------------------------------------------------------------- *
 * Fechar uma denúncia
 * ---------------------------------------------------------------- */

test("remover e arquivar deixam estados diferentes", () => {
  assert.deepEqual(resolutionOf("remover"), { status: "resolved", resolution: "removido" });
  assert.deepEqual(resolutionOf("arquivar"), { status: "dismissed", resolution: "arquivado" });
});

test("uma ação que não existe não fecha nada", () => {
  assert.equal(resolutionOf("apagar-tudo"), null);
});

test("as listas fechadas são as mesmas que a base aceita", () => {
  assert.deepEqual([...REPORT_REASONS], ["spam", "ofensivo", "perigoso", "copia", "outro"]);
  assert.deepEqual([...REPORT_SUBJECTS], ["recipe", "comment", "user"]);
});


/* ---------------------------------------------------------------- *
 * Papéis
 * ---------------------------------------------------------------- */

test("a escada dos papéis: o admin pode o que o moderador pode, e mais", () => {
  assert.equal(canModerate("user"), false);
  assert.equal(canModerate("moderator"), true);
  assert.equal(canModerate("admin"), true);

  assert.equal(canAdminister("moderator"), false);
  assert.equal(canAdminister("admin"), true);
});

const mudanca = {
  actorId: "admin-1",
  actorRole: "admin",
  targetId: "user-9",
  targetRole: "user",
  newRole: "moderator",
};

test("um admin promove alguém a moderador", () => {
  assert.equal(roleChangeRefusal(mudanca), null);
});

test("despromover um moderador é a mesma operação ao contrário", () => {
  assert.equal(
    roleChangeRefusal({ ...mudanca, targetRole: "moderator", newRole: "user" }),
    null,
  );
});

test("quem não é admin não muda papéis", () => {
  assert.match(roleChangeRefusal({ ...mudanca, actorRole: "moderator" }), /admins/);
  assert.match(roleChangeRefusal({ ...mudanca, actorRole: "user" }), /admins/);
});

test("o meu próprio papel não se muda por aqui", () => {
  assert.match(
    roleChangeRefusal({ ...mudanca, targetId: "admin-1", newRole: "user" }),
    /own role/,
  );
});

test("nenhum admin nasce dentro da aplicação", () => {
  assert.match(roleChangeRefusal({ ...mudanca, newRole: "admin" }), /command line/);
});

test("um admin não é despromovido por outro admin a um clique", () => {
  assert.match(
    roleChangeRefusal({ ...mudanca, targetRole: "admin", newRole: "user" }),
    /isn't demoted/,
  );
});

test("um papel que não existe é recusado antes de qualquer escrita", () => {
  assert.equal(roleChangeRefusal({ ...mudanca, newRole: "chefe" }), "Papel desconhecido");
});

test("promover quem já tem o papel não é erro — é não fazer nada", () => {
  assert.equal(roleChangeRefusal({ ...mudanca, targetRole: "moderator" }), null);
});

const apagar = { actorId: "admin-1", actorRole: "admin", targetId: "user-9", targetRole: "user" };

test("um admin apaga a conta de um utilizador ou de um moderador", () => {
  assert.equal(accountDeletionRefusal(apagar), null);
  assert.equal(accountDeletionRefusal({ ...apagar, targetRole: "moderator" }), null);
});

test("só um admin apaga contas", () => {
  assert.match(accountDeletionRefusal({ ...apagar, actorRole: "moderator" }), /admins/);
  assert.match(accountDeletionRefusal({ ...apagar, actorRole: "user" }), /admins/);
});

test("um admin não apaga outro admin nem a si próprio pelo painel", () => {
  assert.match(accountDeletionRefusal({ ...apagar, targetRole: "admin" }), /admin/);
  assert.match(accountDeletionRefusal({ ...apagar, targetId: "admin-1", targetRole: "admin" }), /profile/);
});
