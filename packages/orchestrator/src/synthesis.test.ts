import { describe, expect, it } from "vitest";
import type { AgentId, ProductInput } from "@product-forge/contracts";
import { agentDefinitions } from "./agents";
import { buildFallbackResult } from "./fallback";
import { retryProductAgent, type AgentProvider } from "./index";
import { synthesizeProposal } from "./synthesis";

const input: ProductInput = {
  idea: "Build an incident command center for independent clinics",
  constraints: "HIPAA-aware and mobile first",
  industry: "Healthcare operations",
  budget: "Under $50K",
  teamSize: "2–5 people",
  sessionId: "eb8856d8-584d-45ee-8f20-65ba4bc825f9",
};

describe("synthesizeProposal", () => {
  it("creates every requested proposal surface and export", () => {
    const agents = agentDefinitions.map((agent) => buildFallbackResult(agent.id as AgentId, input));
    const proposal = synthesizeProposal(input, agents, 200, "test-model");

    expect(proposal.sections).toHaveLength(9);
    expect(proposal.artifacts.sql).toContain("CREATE TABLE projects");
    expect(proposal.artifacts.mermaid).toContain("flowchart");
    expect(proposal.artifacts.openapi).toContain("openapi: 3.1.0");
  });

  it("retains fallback failures and can replace one agent independently", async () => {
    const fallback = buildFallbackResult("market", input, 120, "Invalid JSON after three attempts");
    expect(fallback.failureReason).toContain("Invalid JSON");

    const provider: AgentProvider = {
      model: "test-model",
      async generate(agentId) {
        return {
          summary: "Validated retry output",
          sections: [
            {
              heading: "Retry succeeded",
              summary: "The isolated agent returned a valid structured response.",
              bullets: ["Only this agent was rerun."],
            },
          ],
          confidence: 0.9,
          assumptions: [],
          tokenUsage: { input: 10, output: 20 },
          source: "ai",
        };
      },
    };

    const retried = await retryProductAgent(input, "market", provider);
    expect(retried.source).toBe("ai");
    expect(retried.failureReason).toBeUndefined();
  });
});
