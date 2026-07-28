import { describe, expect, it } from "vitest";
import { productInputSchema } from "./index";

describe("productInputSchema", () => {
  it("normalizes optional inputs", () => {
    const parsed = productInputSchema.parse({
      idea: "Build a calmer incident command center",
      sessionId: "eb8856d8-584d-45ee-8f20-65ba4bc825f9",
    });

    expect(parsed.industry).toBe("Technology");
    expect(parsed.budget).toBe("Bootstrapped");
  });

  it("rejects vague ideas", () => {
    expect(() =>
      productInputSchema.parse({
        idea: "an app",
        sessionId: "eb8856d8-584d-45ee-8f20-65ba4bc825f9",
      }),
    ).toThrow();
  });
});
