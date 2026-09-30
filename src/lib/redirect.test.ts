import { describe, expect, test } from "vitest";
import { destinoAposEntrar } from "./redirect";

describe("destino depois de entrar", () => {
  test("volta ao caminho interno onde estava", () => {
    expect(destinoAposEntrar("/recipe/abc")).toBe("/recipe/abc");
  });

  test.each(["//evil.com", "https://evil.com", "/auth", "/auth/x", "", undefined, null, 42])(
    "recusa %s e cai no feed",
    (from) => {
      expect(destinoAposEntrar(from)).toBe("/feed");
    },
  );
});
