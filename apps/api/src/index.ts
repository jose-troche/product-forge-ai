import {
  agentIdSchema,
  productInputSchema,
  type OrchestrationEvent,
  type Project,
} from "@product-forge/contracts";
import { retryProductAgent, runProductForge, synthesizeProposal } from "@product-forge/orchestrator";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import { WorkersAiProvider } from "./provider";
import { completeProject, createProject, failProject, getProject, listProjects } from "./repository";

type AppBindings = {
  Bindings: Env;
};

const app = new Hono<AppBindings>();

app.use("*", secureHeaders());
app.use("*", async (c, next) => {
  const startedAt = Date.now();
  await next();
  console.log(
    JSON.stringify({
      message: "request.completed",
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      durationMs: Date.now() - startedAt,
    }),
  );
});

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "product-forge-ai",
    runtime: "cloudflare-workers",
    at: new Date().toISOString(),
  }),
);

const sessionQuerySchema = z.object({ sessionId: z.string().uuid() });

app.get("/api/projects", async (c) => {
  const query = sessionQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: "A valid sessionId is required." }, 400);
  }
  const projects = await listProjects(c.env.DB, query.data.sessionId);
  return c.json({ projects });
});

app.get("/api/projects/:id", async (c) => {
  const query = sessionQuerySchema.safeParse(c.req.query());
  const id = z.string().uuid().safeParse(c.req.param("id"));
  if (!query.success || !id.success) {
    return c.json({ error: "A valid project and session are required." }, 400);
  }
  const project = await getProject(c.env.DB, id.data, query.data.sessionId);
  return project ? c.json(project) : c.json({ error: "Project not found." }, 404);
});

async function applyRateLimit(cache: KVNamespace, sessionId: string): Promise<boolean> {
  const minute = Math.floor(Date.now() / 60_000);
  const key = `rate:forge:${sessionId}:${minute}`;
  const count = (await cache.get<number>(key, "json")) ?? 0;
  if (count >= 4) return false;
  await cache.put(key, JSON.stringify(count + 1), { expirationTtl: 120 });
  return true;
}

app.post("/api/projects", async (c) => {
  const contentLength = Number(c.req.header("content-length") ?? "0");
  if (contentLength > 8_192) {
    return c.json({ error: "Request body is too large." }, 413);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON." }, 400);
  }

  const input = productInputSchema.safeParse(body);
  if (!input.success) {
    return c.json(
      {
        error: "Please check the product brief.",
        issues: input.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      422,
    );
  }

  if (!(await applyRateLimit(c.env.CACHE, input.data.sessionId))) {
    return c.json({ error: "Generation limit reached. Try again in a minute." }, 429);
  }

  const projectId = crypto.randomUUID();
  const createdAt = await createProject(c.env.DB, projectId, input.data);
  const provider = new WorkersAiProvider(c.env.AI, c.env.CACHE, c.env.AI_MODEL);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: OrchestrationEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        const result = await runProductForge({
          projectId,
          input: input.data,
          provider,
          emit,
        });
        await completeProject(c.env.DB, projectId, result.proposal, result.agents);
        const project: Project = {
          id: projectId,
          input: input.data,
          status: result.agents.some((agent) => agent.source === "fallback") ? "partial" : "completed",
          proposal: result.proposal,
          agents: result.agents,
          createdAt,
          updatedAt: new Date().toISOString(),
        };
        emit({
          type: "project.completed",
          projectId,
          project,
          at: new Date().toISOString(),
        });
      } catch (error) {
        await failProject(c.env.DB, projectId);
        const message = error instanceof Error ? error.message : "Product generation failed.";
        console.error(JSON.stringify({ message: "orchestration.failed", projectId, error: message }));
        emit({
          type: "project.failed",
          projectId,
          message,
          at: new Date().toISOString(),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

app.post("/api/projects/:id/agents/:agentId/retry", async (c) => {
  const contentLength = Number(c.req.header("content-length") ?? "0");
  if (contentLength > 1_024) {
    return c.json({ error: "Request body is too large." }, 413);
  }

  const projectId = z.string().uuid().safeParse(c.req.param("id"));
  const agentId = agentIdSchema.safeParse(c.req.param("agentId"));
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON." }, 400);
  }
  const session = z.object({ sessionId: z.string().uuid() }).safeParse(body);

  if (!projectId.success || !agentId.success || !session.success) {
    return c.json({ error: "A valid project, agent, and session are required." }, 400);
  }
  if (!(await applyRateLimit(c.env.CACHE, session.data.sessionId))) {
    return c.json({ error: "Generation limit reached. Try again in a minute." }, 429);
  }

  const existing = await getProject(c.env.DB, projectId.data, session.data.sessionId);
  if (!existing || !existing.proposal) {
    return c.json({ error: "Completed project not found." }, 404);
  }

  const provider = new WorkersAiProvider(c.env.AI, c.env.CACHE, c.env.AI_MODEL);
  try {
    const retriedAgent = await retryProductAgent(existing.input, agentId.data, provider);
    const agents = existing.agents.map((agent) =>
      agent.agentId === agentId.data ? retriedAgent : agent,
    );
    const proposal = synthesizeProposal(
      existing.input,
      agents,
      existing.proposal.totalLatencyMs + retriedAgent.latencyMs,
      provider.model,
    );
    await completeProject(c.env.DB, existing.id, proposal, agents);
    const updated = await getProject(c.env.DB, existing.id, session.data.sessionId);
    if (!updated) throw new Error("Retried project could not be reloaded.");
    return c.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent retry failed.";
    console.error(
      JSON.stringify({
        message: "agent.retry.failed",
        projectId: projectId.data,
        agentId: agentId.data,
        error: message,
      }),
    );
    return c.json({ error: `Retry failed after three attempts: ${message}` }, 502);
  }
});

app.notFound((c) => c.json({ error: "API route not found." }, 404));

app.onError((error, c) => {
  console.error(
    JSON.stringify({
      message: "request.failed",
      path: new URL(c.req.url).pathname,
      error: error.message,
    }),
  );
  return c.json({ error: "An unexpected error occurred." }, 500);
});

export default app;
