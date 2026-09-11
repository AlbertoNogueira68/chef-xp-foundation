#!/usr/bin/env node
import "dotenv/config";
import { mailFrom, sendMail, smtpConfigError, smtpConfigured, verifyTransport } from "../server/lib/mailer.js";

/**
 * Diagnóstico do SMTP.
 *
 *   npm run mail:check                  → só verifica a ligação
 *   npm run mail:check -- tu@exemplo.pt → verifica e envia um email de teste
 *
 * Separa os três problemas que costumam ser confundidos: falta configuração,
 * as credenciais não servem, ou o email sai mas não chega.
 */

const destino = process.argv[2] ?? null;
const mask = (value) => (value ? `${"•".repeat(8)} (${value.length} caracteres)` : "(por definir)");

console.log("\nConfiguração\n" + "─".repeat(52));
console.log(`  SMTP_HOST      ${process.env.SMTP_HOST || "(por definir)"}`);
console.log(`  SMTP_PORT      ${process.env.SMTP_PORT || "587 (por omissão)"}`);
console.log(`  SMTP_USER      ${process.env.SMTP_USER || "(por definir)"}`);
console.log(`  SMTP_PASSWORD  ${mask(process.env.SMTP_PASSWORD)}`);
console.log(`  SMTP_FROM      ${mailFrom()}`);

const erro = smtpConfigError();
if (erro) {
  console.error(`\n✖ ${erro}\n`);
  process.exit(1);
}

if (!smtpConfigured()) {
  console.log(
    "\n○ Sem SMTP configurado.\n" +
      "  Em desenvolvimento os códigos aparecem na consola do servidor e a app\n" +
      "  funciona. Em produção o arranque falha de propósito.\n",
  );
  process.exit(0);
}

const porta = Number(process.env.SMTP_PORT || 587);
console.log(
  `\n  Modo TLS: ${porta === 465 ? "implícito (porta 465)" : "STARTTLS (porta " + porta + ")"}`,
);

try {
  await verifyTransport();
  console.log("\n✔ Ligação e autenticação OK.");
} catch (error) {
  console.error(`\n✖ Não foi possível autenticar: ${error.message}`);
  console.error(
    "\n  Causas mais comuns:\n" +
      "   · No Gmail é preciso uma palavra-passe de app (16 caracteres), não a\n" +
      "     password normal da conta — e exige verificação em duas etapas ligada.\n" +
      "   · Porta trocada: 587 usa STARTTLS, 465 usa TLS desde o início.\n" +
      "   · O fornecedor bloqueia SMTP básico e só aceita OAuth ou uma chave de API.\n",
  );
  process.exit(1);
}

if (!destino) {
  console.log("  Para enviar um email de teste:  npm run mail:check -- tu@exemplo.pt\n");
  process.exit(0);
}

try {
  await sendMail({
    to: destino,
    subject: "Teste de SMTP do ChefXP",
    text:
      "Se estás a ler isto, o envio de email do ChefXP está a funcionar.\n\n" +
      "É por aqui que vão sair os códigos de confirmação de conta e de " +
      "recuperação de password.",
  });
  console.log(`✔ Email enviado para ${destino}.`);
  console.log("  Confirma a caixa de entrada — e o spam, que é onde costuma cair.\n");
} catch (error) {
  console.error(`✖ A autenticação passou mas o envio falhou: ${error.message}\n`);
  process.exit(1);
}
