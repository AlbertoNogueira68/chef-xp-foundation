import test from "node:test";
import assert from "node:assert/strict";
import { containsPattern } from "./sql.js";

test("escapa os curingas do LIKE", () => {
  assert.equal(containsPattern("100%"), "%100\\%%");
  assert.equal(containsPattern("a_b"), "%a\\_b%");
  assert.equal(containsPattern("a\\b"), "%a\\\\b%");
});

test("texto simples só leva os curingas das pontas", () => {
  assert.equal(containsPattern("massa"), "%massa%");
});
