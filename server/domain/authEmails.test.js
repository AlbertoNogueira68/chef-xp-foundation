import test from "node:test";
import assert from "node:assert/strict";

import { emailVerificationEmail, passwordResetEmail } from "./authEmails.js";

const LINK = "http://localhost:5173/reset-password?token=abc123";

test("o email de recuperação leva o link no texto e no HTML", () => {
  const mail = passwordResetEmail({ username: "ana", link: LINK });
  assert.match(mail.subject, /password/i);
  assert.ok(mail.text.includes(LINK));
  assert.ok(mail.html.includes(LINK));
});

test("diz quanto tempo o link vale e que só serve uma vez", () => {
  const mail = passwordResetEmail({ username: "ana", link: LINK });
  assert.match(mail.text, /1 hora/);
  assert.match(mail.text, /uma vez/);
});

test("diz a quem não pediu que não tem de fazer nada", () => {
  const mail = passwordResetEmail({ username: "ana", link: LINK });
  assert.match(mail.text, /Se não foste tu/);
});

test("o email de verificação vale 24 horas", () => {
  const mail = emailVerificationEmail({ username: "ana", link: LINK });
  assert.match(mail.subject, /email/i);
  assert.match(mail.text, /24 horas/);
  assert.ok(mail.html.includes(LINK));
});

test("um nome com HTML não passa a ser HTML no email", () => {
  const mail = passwordResetEmail({
    username: '<img src=x onerror="alert(1)">',
    link: LINK,
  });
  assert.ok(!mail.html.includes("<img"));
  assert.ok(mail.html.includes("&lt;img"));
});

test("os dois formatos existem sempre — há clientes que não mostram HTML", () => {
  for (const mail of [
    passwordResetEmail({ username: "ana", link: LINK }),
    emailVerificationEmail({ username: "ana", link: LINK }),
  ]) {
    assert.ok(mail.text.length > 50);
    assert.ok(mail.html.startsWith("<!doctype html>"));
  }
});
