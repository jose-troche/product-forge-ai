import type {
  AgentId,
  AgentResult,
  ProductInput,
  Proposal,
  ProposalSection,
} from "@product-forge/contracts";

function titleFromIdea(idea: string): string {
  const cleaned = idea
    .replace(/^(build|create|make|design)\s+/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  const words = cleaned.split(/\s+/).slice(0, 8).join(" ");
  return words ? words.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "New Product";
}

function sectionMarkdown(result: AgentResult): string {
  const sections = result.sections
    .map((section) => {
      const bullets = section.bullets.length ? `\n${section.bullets.map((bullet) => `- ${bullet}`).join("\n")}` : "";
      const table = section.table
        ? `\n\n| ${section.table.columns.join(" | ")} |\n| ${section.table.columns.map(() => "---").join(" | ")} |\n${section.table.rows
            .map((row) => `| ${row.join(" | ")} |`)
            .join("\n")}`
        : "";
      const code = section.code ? `\n\n\`\`\`\n${section.code}\n\`\`\`` : "";
      return `### ${section.heading}\n\n${section.summary}${bullets}${table}${code}`;
    })
    .join("\n\n");

  const assumptions = result.assumptions.length
    ? `\n\n> **Assumptions to validate:** ${result.assumptions.join(" · ")}`
    : "";
  return `${sections}${assumptions}`;
}

function combine(results: Map<AgentId, AgentResult>, ids: AgentId[]): string {
  return ids
    .map((id) => results.get(id))
    .filter((result): result is AgentResult => Boolean(result))
    .map(sectionMarkdown)
    .join("\n\n---\n\n");
}

function createSql(): string {
  return `-- Portable PostgreSQL-flavored MVP schema
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  input JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE artifacts (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  kind TEXT NOT NULL,
  content JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, kind, version)
);

CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX projects_org_updated_idx ON projects (organization_id, updated_at DESC);
CREATE INDEX artifacts_project_kind_idx ON artifacts (project_id, kind, version DESC);
CREATE INDEX jobs_project_status_idx ON jobs (project_id, status);`;
}

function createMermaid(title: string): string {
  return `flowchart LR
    U[User] --> W[Responsive Web App]
    W --> A[Edge API]
    A --> I[Identity & Authorization]
    A --> O[Workflow Orchestrator]
    O --> Q[Async Job Queue]
    O --> M[Model Provider Adapter]
    A --> D[(Relational Database)]
    Q --> M
    Q --> D
    A --> S[(Object Storage)]
    O --> T[Telemetry]
    subgraph Product["${title.replace(/"/g, "'")}"]
      W
      A
      O
    end`;
}

function createOpenApi(title: string): string {
  return `openapi: 3.1.0
info:
  title: ${title} API
  version: 1.0.0
servers:
  - url: https://api.example.com/v1
paths:
  /projects:
    get:
      summary: List projects
      parameters:
        - in: query
          name: cursor
          schema: { type: string }
      responses:
        "200":
          description: Cursor-paginated projects
    post:
      summary: Create a project
      parameters:
        - in: header
          name: Idempotency-Key
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [title, input]
              properties:
                title: { type: string, minLength: 1 }
                input: { type: object, additionalProperties: true }
      responses:
        "201": { description: Project created }
        "422": { description: Validation failed }
  /projects/{projectId}:
    get:
      summary: Get a project
      parameters:
        - in: path
          name: projectId
          required: true
          schema: { type: string, format: uuid }
      responses:
        "200": { description: Project detail }
        "404": { description: Project not found }
  /projects/{projectId}/runs:
    post:
      summary: Start a product generation run
      responses:
        "202": { description: Run accepted }
  /jobs/{jobId}:
    get:
      summary: Get job status
      responses:
        "200": { description: Job status and progress }
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer }
security:
  - bearerAuth: []`;
}

export function synthesizeProposal(
  input: ProductInput,
  agents: AgentResult[],
  totalLatencyMs: number,
  model: string,
): Proposal {
  const results = new Map(agents.map((agent) => [agent.agentId, agent]));
  const title = titleFromIdea(input.idea);
  const executiveSummary = `${title} turns a specific ${input.industry.toLowerCase()} workflow into a faster, more trustworthy outcome. The recommended launch strategy is a narrow, reviewable MVP for the users with the most frequent pain, delivered by ${input.teamSize.toLowerCase()} under a ${input.budget.toLowerCase()} budget. Validate urgency and willingness to pay before expanding scope; make traceability, user control, and measurable time-to-value the product’s defining qualities.`;

  const sectionData: Array<{
    id: ProposalSection["id"];
    title: string;
    ids: AgentId[];
    prefix?: string;
  }> = [
    {
      id: "executive",
      title: "Executive Summary",
      ids: ["kpi"],
      prefix: `## Product thesis\n\n${executiveSummary}\n\n### Value proposition\n\nFor teams that need a dependable way to complete the core workflow, ${title} provides a guided, collaborative path from input to accepted outcome—without the fragmented handoffs and opaque automation of existing workarounds.\n\n### Recommended launch stance\n\n- Start with one high-frequency job and one accountable buyer.\n- Recruit three paid design partners before broad implementation.\n- Ship review, edit, provenance, and recovery controls with the core workflow.\n- Use the North Star and activation criteria below as release gates.`,
    },
    { id: "market", title: "Market", ids: ["market", "competitors"] },
    { id: "prd", title: "PRD", ids: ["product"] },
    { id: "ux", title: "UX", ids: ["ux"] },
    { id: "architecture", title: "Architecture", ids: ["architecture", "security"] },
    { id: "database", title: "Database", ids: ["database"] },
    { id: "apis", title: "APIs", ids: ["api"] },
    { id: "roadmap", title: "Roadmap", ids: ["roadmap", "kpi"] },
    { id: "risks", title: "Risks", ids: ["risk", "security"] },
  ];

  const sections = sectionData.map(({ id, title: sectionTitle, ids, prefix }) => ({
    id,
    title: sectionTitle,
    markdown: [prefix, combine(results, ids)].filter(Boolean).join("\n\n---\n\n"),
    agentIds: ids,
  }));

  return {
    title,
    oneLiner: `A focused ${input.industry.toLowerCase()} product plan designed to move from validated problem to measurable outcome.`,
    executiveSummary,
    sections,
    artifacts: {
      sql: createSql(),
      mermaid: createMermaid(title),
      openapi: createOpenApi(title),
    },
    generatedAt: new Date().toISOString(),
    model,
    totalLatencyMs,
    totalTokenUsage: agents.reduce(
      (total, agent) => ({
        input: total.input + agent.tokenUsage.input,
        output: total.output + agent.tokenUsage.output,
      }),
      { input: 0, output: 0 },
    ),
  };
}
