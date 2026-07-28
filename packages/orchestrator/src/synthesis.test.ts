import { describe, expect, it } from "vitest";
import type { AgentId, ProductInput } from "@product-forge/contracts";
import { agentDefinitions } from "./agents";
import { buildFallbackResult } from "./fallback";
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
});
