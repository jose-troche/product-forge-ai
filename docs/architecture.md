# Product Forge AI architecture

## Runtime flow

1. The React client submits a typed product brief and reads an NDJSON event stream.
2. The Worker creates a `running` D1 project and applies a small session rate limit in KV.
3. LangGraph refines the idea and fans out eleven independent agent nodes.
4. Each node checks KV, calls an open-weight Workers AI model when needed, validates the response with Zod, and retries transient failures.
5. Failed nodes emit a visible degradation event and return a specialist fallback.
6. The graph fans in to deterministic synthesis and completeness validation.
7. Agent results and the final proposal are written to D1 as one batch.
8. The stream closes with the completed, typed project.

## Boundaries

- `packages/contracts` is the only wire-format authority.
- `packages/orchestrator` has no Cloudflare dependency; it receives an `AgentProvider`.
- `apps/api` owns Cloudflare bindings, transport, rate limiting, and persistence.
- `apps/web` owns progressive rendering, project history, visualization, and exports.

This separation makes the model provider and hosting surface replaceable without leaking infrastructure concerns into product logic.

## Failure model

Agent inference has three attempts with bounded exponential backoff. An exhausted AI quota, invalid JSON response, or model error affects only that specialist; the graph continues with a deterministic fallback and marks the project `partial`. Persistence failures fail the run because a proposal must not be reported as saved when it is not. The UI preserves all execution events so degraded output is visible rather than silently presented as AI-generated.

## Free-tier posture

Static assets bypass Worker execution. API payloads are bounded. Project list queries use a session/time index. Agent results are batched into D1. Prompt cache entries expire after 24 hours, and rate entries expire after two minutes. The selected model and maximum output length are intentionally constrained. No paid-only queue, workflow, R2, or Durable Object is required.
