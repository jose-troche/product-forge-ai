import {
  agentResultSchema,
  productInputSchema,
  projectSchema,
  proposalSchema,
  type AgentResult,
  type ProductInput,
  type Project,
  type ProjectSummary,
  type Proposal,
} from "@product-forge/contracts";

interface ProjectRow {
  id: string;
  session_id: string;
  idea: string;
  industry: string;
  status: Project["status"];
  input_json: string;
  proposal_json: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentRow {
  output_json: string;
}

interface ProjectSummaryRow {
  id: string;
  idea: string;
  industry: string;
  status: Project["status"];
  created_at: string;
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

export async function createProject(db: D1Database, id: string, input: ProductInput): Promise<string> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO projects
        (id, session_id, idea, industry, status, input_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'running', ?, ?, ?)`,
    )
    .bind(id, input.sessionId, input.idea, input.industry, JSON.stringify(input), now, now)
    .run();
  return now;
}

export async function completeProject(
  db: D1Database,
  projectId: string,
  proposal: Proposal,
  agents: AgentResult[],
): Promise<void> {
  const now = new Date().toISOString();
  const status = agents.some((agent) => agent.source === "fallback") ? "partial" : "completed";
  const statements = [
    db
      .prepare("UPDATE projects SET status = ?, proposal_json = ?, updated_at = ? WHERE id = ?")
      .bind(status, JSON.stringify(proposal), now, projectId),
    ...agents.map((agent) =>
      db
        .prepare(
          `INSERT INTO agent_outputs (project_id, agent_id, output_json, created_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(project_id, agent_id)
           DO UPDATE SET output_json = excluded.output_json, created_at = excluded.created_at`,
        )
        .bind(projectId, agent.agentId, JSON.stringify(agent), now),
    ),
  ];
  await db.batch(statements);
}

export async function failProject(db: D1Database, projectId: string): Promise<void> {
  await db
    .prepare("UPDATE projects SET status = 'failed', updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), projectId)
    .run();
}

export async function getProject(
  db: D1Database,
  projectId: string,
  sessionId: string,
): Promise<Project | null> {
  const row = await db
    .prepare("SELECT * FROM projects WHERE id = ? AND session_id = ?")
    .bind(projectId, sessionId)
    .first<ProjectRow>();
  if (!row) return null;

  const agentRows = await db
    .prepare("SELECT output_json FROM agent_outputs WHERE project_id = ? ORDER BY agent_id")
    .bind(projectId)
    .all<AgentRow>();
  const agents = agentRows.results.map((agent) => agentResultSchema.parse(parseJson(agent.output_json)));

  return projectSchema.parse({
    id: row.id,
    input: productInputSchema.parse(parseJson(row.input_json)),
    status: row.status,
    proposal: row.proposal_json ? proposalSchema.parse(parseJson(row.proposal_json)) : null,
    agents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function listProjects(
  db: D1Database,
  sessionId: string,
  limit = 12,
): Promise<ProjectSummary[]> {
  const rows = await db
    .prepare(
      `SELECT id, idea, industry, status, created_at
       FROM projects
       WHERE session_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(sessionId, limit)
    .all<ProjectSummaryRow>();

  return rows.results.map((row) => ({
    id: row.id,
    idea: row.idea,
    industry: row.industry,
    status: row.status,
    createdAt: row.created_at,
  }));
}
