import type { AgentId, ProductInput } from "@product-forge/contracts";

export interface AgentDefinition {
  id: AgentId;
  name: string;
  role: string;
  outputFocus: string;
  accent: string;
}

export const agentDefinitions = [
  {
    id: "market",
    name: "Market Intelligence",
    role: "Analyze market shape, trends, TAM/SAM/SOM, opportunities, and SWOT.",
    outputFocus: "Market thesis with clearly labeled assumptions rather than invented facts.",
    accent: "#bfdbfe",
  },
  {
    id: "competitors",
    name: "Competitive Strategy",
    role: "Map direct and adjacent competitors, positioning, pricing patterns, and gaps.",
    outputFocus: "Competitive landscape and a defendable wedge.",
    accent: "#c4b5fd",
  },
  {
    id: "product",
    name: "Product Management",
    role: "Define vision, outcomes, requirements, MVP priorities, and user stories.",
    outputFocus: "A focused PRD with testable acceptance criteria.",
    accent: "#fde68a",
  },
  {
    id: "ux",
    name: "Experience Design",
    role: "Create personas, journeys, navigation, wireframe direction, and accessibility guidance.",
    outputFocus: "A usable, inclusive end-to-end experience.",
    accent: "#fbcfe8",
  },
  {
    id: "architecture",
    name: "Systems Architecture",
    role: "Design components, boundaries, scaling, reliability, and technology choices.",
    outputFocus: "Pragmatic architecture with explicit tradeoffs.",
    accent: "#a7f3d0",
  },
  {
    id: "database",
    name: "Data Architecture",
    role: "Model entities, relationships, SQL schema, lifecycle, and indexes.",
    outputFocus: "A durable data model that supports the MVP.",
    accent: "#99f6e4",
  },
  {
    id: "api",
    name: "API Design",
    role: "Define REST resources, request models, auth, versioning, and rate limits.",
    outputFocus: "A coherent API contract ready for implementation.",
    accent: "#fed7aa",
  },
  {
    id: "security",
    name: "Security & Trust",
    role: "Threat-model authentication, authorization, privacy, abuse, and compliance.",
    outputFocus: "Prioritized controls tied to credible threats.",
    accent: "#fecaca",
  },
  {
    id: "roadmap",
    name: "Delivery Strategy",
    role: "Sequence phases, team, timing, dependencies, and release gates.",
    outputFocus: "A realistic roadmap matched to constraints.",
    accent: "#d9f99d",
  },
  {
    id: "kpi",
    name: "Metrics & Growth",
    role: "Define a North Star plus product, business, and technical KPIs.",
    outputFocus: "Measurable leading and lagging indicators.",
    accent: "#bae6fd",
  },
  {
    id: "risk",
    name: "Risk & Validation",
    role: "Surface market, technical, legal, and operational risks with mitigations.",
    outputFocus: "A risk register and validation plan.",
    accent: "#ddd6fe",
  },
] as const satisfies readonly AgentDefinition[];

export const agentDefinitionById = new Map<AgentId, AgentDefinition>(
  agentDefinitions.map((agent) => [agent.id, agent]),
);

export function buildAgentPrompt(definition: AgentDefinition, input: ProductInput, refinedIdea: string): string {
  return [
    `You are the ${definition.name} agent on a senior product team.`,
    definition.role,
    `Product concept: ${refinedIdea}`,
    `Industry: ${input.industry}`,
    `Budget: ${input.budget}`,
    `Team: ${input.teamSize}`,
    `Constraints: ${input.constraints || "No additional constraints supplied."}`,
    `Deliverable: ${definition.outputFocus}`,
    "Separate assumptions from claims. Do not invent research, customers, revenue, or exact market facts.",
    "Return concise structured JSON matching the supplied schema. Use 3–5 sections and actionable bullets.",
  ].join("\n");
}

export function refineIdea(input: ProductInput): string {
  const cleanIdea = input.idea.replace(/\s+/g, " ").trim();
  const constraint = input.constraints ? ` while respecting ${input.constraints.trim()}` : "";
  return `${cleanIdea} for the ${input.industry} market, designed for a ${input.teamSize.toLowerCase()} team on a ${input.budget.toLowerCase()} budget${constraint}.`;
}
