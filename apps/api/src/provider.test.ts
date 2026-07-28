import { describe, expect, it } from "vitest";
import { WorkersAiProvider, parseResponse } from "./provider";

const validPayload = {
  summary: "A concise validated response.",
  sections: [
    {
      heading: "Core model",
      summary: "The data model supports the MVP.",
      bullets: ["Use stable identifiers", "Index common lookups"],
    },
  ],
  confidence: 0.84,
  assumptions: ["The MVP uses relational storage"],
};

describe("WorkersAiProvider", () => {
  it("accepts fenced structured JSON", () => {
    const parsed = parseResponse({ response: `\`\`\`json\n${JSON.stringify(validPayload)}\n\`\`\`` });
    expect(parsed.payload.summary).toBe(validPayload.summary);
  });

  it("retries truncated JSON with increasingly concise guidance", async () => {
    const requests: Array<{ messages?: Array<{ content?: string }>; max_tokens?: number }> = [];
    let calls = 0;
    const ai = {
      async run(_model: string, request: { messages?: Array<{ content?: string }>; max_tokens?: number }) {
        requests.push(request);
        calls += 1;
        if (calls < 3) return { response: '{"summary":"cut off' };
        return { response: validPayload };
      },
    };
    const cache = {
      async get() {
        return null;
      },
      async put() {},
    };

    const provider = new WorkersAiProvider(
      ai as unknown as Ai,
      cache as unknown as KVNamespace,
      "@cf/meta/llama-3.1-8b-instruct-fast",
    );
    const result = await provider.generate("database", "Return the data architecture.");

    expect(result.source).toBe("ai");
    expect(calls).toBe(3);
    expect(requests.every((request) => request.max_tokens === 1_400)).toBe(true);
    expect(requests[1]?.messages?.[0]?.content).toContain("exactly 3 concise sections");
    expect(requests[2]?.messages?.[0]?.content).toContain("Final retry");
  });
});
