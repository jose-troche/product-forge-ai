import { z } from "zod";

export const agentIdSchema = z.enum([
  "market",
  "competitors",
  "product",
  "ux",
  "architecture",
  "database",
  "api",
  "security",
  "roadmap",
  "kpi",
  "risk",
]);

export type AgentId = z.infer<typeof agentIdSchema>;

export const productInputSchema = z.object({
  idea: z.string().trim().min(10, "Describe the product idea in at least 10 characters.").max(2_500),
  constraints: z.string().trim().max(1_500).default(""),
  industry: z.string().trim().max(120).default("Technology"),
  budget: z.enum(["Bootstrapped", "Under $50K", "$50K–$250K", "$250K+"]).default("Bootstrapped"),
  teamSize: z.enum(["Solo founder", "2–5 people", "6–12 people", "13+ people"]).default("2–5 people"),
  sessionId: z.string().uuid(),
});

export type ProductInput = z.infer<typeof productInputSchema>;

export const agentSectionSchema = z.object({
  heading: z.string().min(1).max(100),
  summary: z.string().min(1),
  bullets: z.array(z.string()).max(12).default([]),
  code: z.string().optional(),
  table: z
    .object({
      columns: z.array(z.string()).min(1).max(8),
      rows: z.array(z.array(z.string())).max(12),
    })
    .optional(),
});

export type AgentSection = z.infer<typeof agentSectionSchema>;

export const agentResultSchema = z.object({
  agentId: agentIdSchema,
  title: z.string().min(1).max(100),
  summary: z.string().min(1),
  sections: z.array(agentSectionSchema).min(1).max(8),
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()).max(8).default([]),
  latencyMs: z.number().int().nonnegative(),
  tokenUsage: z
    .object({
      input: z.number().int().nonnegative(),
      output: z.number().int().nonnegative(),
    })
    .default({ input: 0, output: 0 }),
  source: z.enum(["ai", "cache", "fallback"]),
});

export type AgentResult = z.infer<typeof agentResultSchema>;

export const artifactSchema = z.object({
  sql: z.string(),
  mermaid: z.string(),
  openapi: z.string(),
});

export const proposalSectionSchema = z.object({
  id: z.enum([
    "executive",
    "market",
    "prd",
    "ux",
    "architecture",
    "database",
    "apis",
    "roadmap",
    "risks",
  ]),
  title: z.string(),
  markdown: z.string(),
  agentIds: z.array(agentIdSchema),
});

export type ProposalSection = z.infer<typeof proposalSectionSchema>;

export const proposalSchema = z.object({
  title: z.string().min(1),
  oneLiner: z.string().min(1),
  executiveSummary: z.string().min(1),
  sections: z.array(proposalSectionSchema).length(9),
  artifacts: artifactSchema,
  generatedAt: z.string().datetime(),
  model: z.string(),
  totalLatencyMs: z.number().int().nonnegative(),
  totalTokenUsage: z.object({
    input: z.number().int().nonnegative(),
    output: z.number().int().nonnegative(),
  }),
});

export type Proposal = z.infer<typeof proposalSchema>;

export const projectSchema = z.object({
  id: z.string().uuid(),
  input: productInputSchema,
  status: z.enum(["running", "completed", "partial", "failed"]),
  proposal: proposalSchema.nullable(),
  agents: z.array(agentResultSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Project = z.infer<typeof projectSchema>;

export const projectSummarySchema = z.object({
  id: z.string().uuid(),
  idea: z.string(),
  industry: z.string(),
  status: z.enum(["running", "completed", "partial", "failed"]),
  createdAt: z.string().datetime(),
});

export type ProjectSummary = z.infer<typeof projectSummarySchema>;

const eventBaseSchema = z.object({
  projectId: z.string().uuid(),
  at: z.string().datetime(),
});

export const orchestrationEventSchema = z.discriminatedUnion("type", [
  eventBaseSchema.extend({
    type: z.literal("project.started"),
    refinedIdea: z.string(),
  }),
  eventBaseSchema.extend({
    type: z.literal("agent.started"),
    agentId: agentIdSchema,
  }),
  eventBaseSchema.extend({
    type: z.literal("agent.completed"),
    agent: agentResultSchema,
  }),
  eventBaseSchema.extend({
    type: z.literal("agent.failed"),
    agentId: agentIdSchema,
    message: z.string(),
  }),
  eventBaseSchema.extend({
    type: z.literal("synthesis.started"),
  }),
  eventBaseSchema.extend({
    type: z.literal("synthesis.completed"),
  }),
  eventBaseSchema.extend({
    type: z.literal("project.completed"),
    project: projectSchema,
  }),
  eventBaseSchema.extend({
    type: z.literal("project.failed"),
    message: z.string(),
  }),
]);

export type OrchestrationEvent = z.infer<typeof orchestrationEventSchema>;

export const projectListResponseSchema = z.object({
  projects: z.array(projectSummarySchema),
});
