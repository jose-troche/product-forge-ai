import { agentSectionSchema, type AgentId } from "@product-forge/contracts";
import type { AgentProvider, GeneratedAgentPayload } from "@product-forge/orchestrator";
import { z } from "zod";

const generatedPayloadSchema = z.object({
  summary: z.string().min(1),
  sections: z.array(agentSectionSchema).min(1).max(6),
  confidence: z.number().min(0).max(1).default(0.75),
  assumptions: z.array(z.string()).max(8).default([]),
});

const envelopeSchema = z
  .object({
    response: z.union([z.string(), z.record(z.string(), z.unknown())]),
    usage: z
      .object({
        prompt_tokens: z.number().int().nonnegative().optional(),
        completion_tokens: z.number().int().nonnegative().optional(),
      })
      .optional(),
  })
  .passthrough();

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseResponse(raw: unknown): {
  payload: z.infer<typeof generatedPayloadSchema>;
  usage: { input: number; output: number };
} {
  const envelope = envelopeSchema.safeParse(raw);
  const usage = envelope.success
    ? {
        input: envelope.data.usage?.prompt_tokens ?? 0,
        output: envelope.data.usage?.completion_tokens ?? 0,
      }
    : { input: 0, output: 0 };

  const candidate = envelope.success ? envelope.data.response : raw;
  const parsedCandidate =
    typeof candidate === "string" ? (JSON.parse(candidate) as unknown) : candidate;

  return {
    payload: generatedPayloadSchema.parse(parsedCandidate),
    usage,
  };
}

function jsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "sections", "confidence", "assumptions"],
    properties: {
      summary: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      assumptions: { type: "array", items: { type: "string" }, maxItems: 8 },
      sections: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["heading", "summary", "bullets"],
          properties: {
            heading: { type: "string" },
            summary: { type: "string" },
            bullets: { type: "array", items: { type: "string" }, maxItems: 12 },
            code: { type: "string" },
            table: {
              type: "object",
              additionalProperties: false,
              required: ["columns", "rows"],
              properties: {
                columns: { type: "array", items: { type: "string" }, maxItems: 8 },
                rows: {
                  type: "array",
                  items: { type: "array", items: { type: "string" }, maxItems: 8 },
                  maxItems: 12,
                },
              },
            },
          },
        },
      },
    },
  };
}

export class WorkersAiProvider implements AgentProvider {
  readonly model: string;

  constructor(
    private readonly ai: Ai,
    private readonly cache: KVNamespace,
    model: string,
  ) {
    this.model = model;
  }

  async generate(agentId: AgentId, prompt: string): Promise<GeneratedAgentPayload> {
    const key = `agent:v2:${agentId}:${await sha256(`${this.model}:${prompt}`)}`;
    const cached = await this.cache.get(key, "json");
    const cachedPayload = generatedPayloadSchema.safeParse(cached);

    if (cachedPayload.success) {
      return {
        ...cachedPayload.data,
        tokenUsage: { input: 0, output: 0 },
        source: "cache",
      };
    }

    let finalError: Error | null = null;
    const delays = [0, 250, 750];
    for (const delay of delays) {
      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        const raw: unknown = await this.ai.run("@cf/meta/llama-3.1-8b-instruct-fast", {
          messages: [
            {
              role: "system",
              content:
                "You are a disciplined product specialist. Return only valid JSON. Be concrete, concise, and honest about uncertainty.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 700,
          temperature: 0.35,
          response_format: {
            type: "json_schema",
            json_schema: jsonSchema(),
          },
        });
        const parsed = parseResponse(raw);
        await this.cache.put(key, JSON.stringify(parsed.payload), { expirationTtl: 86_400 });
        return {
          ...parsed.payload,
          tokenUsage: parsed.usage,
          source: "ai",
        };
      } catch (error) {
        finalError = error instanceof Error ? error : new Error("Workers AI request failed.");
      }
    }

    throw finalError ?? new Error("Workers AI request failed.");
  }
}
