import {
  orchestrationEventSchema,
  projectListResponseSchema,
  projectSchema,
  type OrchestrationEvent,
  type ProductInput,
  type Project,
  type ProjectSummary,
} from "@product-forge/contracts";

interface ErrorBody {
  error?: string;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody;
    return body.error || `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

export async function forgeProject(
  input: ProductInput,
  onEvent: (event: OrchestrationEvent) => void,
): Promise<Project> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) throw new Error(await errorMessage(response));
  if (!response.body) throw new Error("The orchestration stream could not be opened.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let project: Project | null = null;

  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = orchestrationEventSchema.parse(JSON.parse(line) as unknown);
    onEvent(event);
    if (event.type === "project.completed") project = event.project;
    if (event.type === "project.failed") throw new Error(event.message);
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) consume(line);
    if (done) break;
  }

  if (buffer.trim()) consume(buffer);
  if (!project) throw new Error("The run ended before a proposal was created.");
  return project;
}

export async function fetchProjects(sessionId: string): Promise<ProjectSummary[]> {
  const response = await fetch(`/api/projects?sessionId=${encodeURIComponent(sessionId)}`);
  if (!response.ok) throw new Error(await errorMessage(response));
  return projectListResponseSchema.parse(await response.json()).projects;
}

export async function fetchProject(projectId: string, sessionId: string): Promise<Project> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}?sessionId=${encodeURIComponent(sessionId)}`,
  );
  if (!response.ok) throw new Error(await errorMessage(response));
  return projectSchema.parse(await response.json());
}
