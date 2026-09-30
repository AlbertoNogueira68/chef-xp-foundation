import test from "node:test";
import assert from "node:assert/strict";
import { purgeExpiredTokens } from "./housekeeping.js";

test("apaga só o que expirou, nas duas tabelas", async () => {
  const chamadas = [];
  const pool = {
    query: async (text, params) => {
      chamadas.push({ text, params });
      return { rowCount: chamadas.length === 1 ? 3 : 2 };
    },
  };
  const now = new Date("2026-01-01T00:00:00Z");

  const resultado = await purgeExpiredTokens(pool, { now });

  assert.deepEqual(resultado, { pendingSignups: 3, authTokens: 2 });
  assert.match(chamadas[0].text, /pending_signups WHERE expires_at < \$1/);
  assert.match(chamadas[1].text, /auth_tokens WHERE expires_at < \$1/);
  assert.deepEqual(chamadas[0].params, [now]);
});
