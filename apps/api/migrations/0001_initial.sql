PRAGMA foreign_keys = ON;

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  idea TEXT NOT NULL,
  industry TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'partial', 'failed')),
  input_json TEXT NOT NULL,
  proposal_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE agent_outputs (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  output_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, agent_id)
);

CREATE INDEX projects_session_created_idx
  ON projects (session_id, created_at DESC);

CREATE INDEX agent_outputs_project_idx
  ON agent_outputs (project_id);
