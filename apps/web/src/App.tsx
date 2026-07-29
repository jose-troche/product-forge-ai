import type { AgentId, OrchestrationEvent, ProductInput, Project } from "@product-forge/contracts";
import { agentDefinitions } from "@product-forge/orchestrator/agents";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Check,
  CircleDot,
  Clock3,
  CodeXml,
  FolderClock,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { AgentGraph, deriveStatuses } from "./components/AgentGraph";
import { ExecutionTimeline } from "./components/ExecutionTimeline";
import { ForgeForm } from "./components/ForgeForm";
import { ProposalPanel } from "./components/ProposalPanel";
import { RecentProjects } from "./components/RecentProjects";
import { Button } from "./components/ui/button";
import { fetchProject, fetchProjects, forgeProject, retryProjectAgent } from "./lib/api";
import { formatDuration } from "./lib/utils";

function getSessionId(): string {
  const key = "product-forge-session";
  const current = window.localStorage.getItem(key);
  if (current) return current;
  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

type Brief = Omit<ProductInput, "sessionId">;
type RetryNotice = {
  agentId: AgentId;
  kind: "running" | "success" | "error";
  message: string;
};

const agentNames = new Map(agentDefinitions.map((agent) => [agent.id, agent.name]));

export default function App() {
  const sessionId = useMemo(getSessionId, []);
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<OrchestrationEvent[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [retryingAgentId, setRetryingAgentId] = useState<AgentId | null>(null);
  const [retryNotice, setRetryNotice] = useState<RetryNotice | null>(null);
  const requestVersionRef = useRef(0);
  const activeRequestRef = useRef<AbortController | null>(null);
  const { statuses, latencies, errors } = useMemo(
    () => deriveStatuses(events, project?.agents),
    [events, project?.agents],
  );

  const history = useQuery({
    queryKey: ["projects", sessionId],
    queryFn: () => fetchProjects(sessionId),
    staleTime: 10_000,
  });

  const resetWorkspace = useCallback(() => {
    requestVersionRef.current += 1;
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    setEvents([]);
    setProject(null);
    setRunning(false);
    setStartedAt(null);
    setError(null);
    setRetryingAgentId(null);
    setRetryNotice(null);
  }, []);

  const runForge = async (brief: Brief) => {
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    activeRequestRef.current = controller;
    setRunning(true);
    setStartedAt(Date.now());
    setEvents([]);
    setProject(null);
    setError(null);
    setRetryNotice(null);

    try {
      const completed = await forgeProject(
        { ...brief, sessionId },
        (event) => {
          if (requestVersionRef.current !== requestVersion) return;
          setEvents((current) => [...current, event]);
          if (event.type === "project.completed") setProject(event.project);
        },
        controller.signal,
      );
      if (requestVersionRef.current !== requestVersion) return;
      setProject(completed);
      await queryClient.invalidateQueries({ queryKey: ["projects", sessionId] });
    } catch (cause) {
      if (controller.signal.aborted || requestVersionRef.current !== requestVersion) return;
      setError(cause instanceof Error ? cause.message : "The forge run failed.");
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setRunning(false);
        activeRequestRef.current = null;
      }
    }
  };

  const openProject = async (id: string) => {
    setLoadingProjectId(id);
    setError(null);
    try {
      const saved = await fetchProject(id, sessionId);
      setProject(saved);
      setEvents([]);
      setStartedAt(null);
      setRetryNotice(null);
      setRecentOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the saved project.");
    } finally {
      setLoadingProjectId(null);
    }
  };

  const retryAgent = useCallback(
    async (agentId: AgentId) => {
      if (!project || running || retryingAgentId) return;
      activeRequestRef.current?.abort();
      const controller = new AbortController();
      const requestVersion = requestVersionRef.current + 1;
      requestVersionRef.current = requestVersion;
      activeRequestRef.current = controller;
      const at = new Date().toISOString();
      const agentName = agentNames.get(agentId) ?? agentId;
      setRetryingAgentId(agentId);
      setError(null);
      setRetryNotice({
        agentId,
        kind: "running",
        message: `Retrying ${agentName}. Validating a fresh structured response (up to three attempts)…`,
      });
      setEvents((current) => [
        ...current,
        { type: "agent.started", projectId: project.id, agentId, at },
      ]);

      try {
        const updated = await retryProjectAgent(project.id, agentId, sessionId, controller.signal);
        if (requestVersionRef.current !== requestVersion) return;
        const retried = updated.agents.find((agent) => agent.agentId === agentId);
        if (!retried) throw new Error("The retried agent output was not returned.");
        setProject(updated);
        setRetryNotice({
          agentId,
          kind: "success",
          message: `${agentName} completed successfully. The proposal has been refreshed.`,
        });
        setEvents((current) => [
          ...current,
          {
            type: "agent.completed",
            projectId: updated.id,
            agent: retried,
            at: new Date().toISOString(),
          },
          {
            type: "synthesis.completed",
            projectId: updated.id,
            at: new Date().toISOString(),
          },
        ]);
        await queryClient.invalidateQueries({ queryKey: ["projects", sessionId] });
      } catch (cause) {
        if (controller.signal.aborted || requestVersionRef.current !== requestVersion) return;
        const message = cause instanceof Error ? cause.message : "The agent retry failed.";
        setRetryNotice({
          agentId,
          kind: "error",
          message: `${agentName} retry failed: ${message}`,
        });
        setEvents((current) => [
          ...current,
          {
            type: "agent.failed",
            projectId: project.id,
            agentId,
            message,
            at: new Date().toISOString(),
          },
        ]);
      } finally {
        if (requestVersionRef.current === requestVersion) {
          setRetryingAgentId(null);
          activeRequestRef.current = null;
        }
      }
    },
    [project, queryClient, retryingAgentId, running, sessionId],
  );

  const completedAgents = Object.values(statuses).filter(
    (status) => status === "completed" || status === "degraded",
  ).length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="flex min-w-0 items-center gap-3">
          <span className="brand-mark" aria-hidden="true">
            <Boxes className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-bold tracking-[-.02em] text-[var(--paper)]">Product Forge AI</h1>
              <span className="hidden rounded-full border border-[var(--lime)]/20 bg-[var(--lime)]/[.06] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[.14em] text-[var(--lime)] sm:block">
                beta
              </span>
            </div>
            <p className="hidden text-[9px] tracking-wide text-white/35 sm:block">Your AI product team, working in parallel</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-4 rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-2 lg:flex">
            <span className="flex items-center gap-1.5 font-mono text-[9px] text-white/40">
              <CircleDot className="size-3 text-emerald-300" />
              Edge ready
            </span>
            <span className="h-3 w-px bg-white/10" />
            <span className="font-mono text-[9px] text-white/40">Llama 3.1 · open weight</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setRecentOpen(true)}>
            <FolderClock className="size-3.5" />
            <span className="hidden sm:inline">Recent</span>
            {history.data?.length ? (
              <span className="rounded-full bg-white/[.08] px-1.5 py-0.5 font-mono text-[8px]">{history.data.length}</span>
            ) : null}
          </Button>
          <a
            className="grid size-9 place-items-center rounded-lg text-white/35 transition hover:bg-white/[.05] hover:text-white/70"
            href="https://github.com/jose-troche/product-forge-ai"
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
          >
            <CodeXml className="size-4" />
          </a>
        </div>
      </header>

      <main className="workspace">
        <section className="panel brief-panel" aria-label="Product brief">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">01 / Brief</p>
              <h2 className="mt-1 font-serif text-xl text-[var(--paper)]">Shape the idea</h2>
            </div>
            <Sparkles className="size-4 text-[var(--lime)]/60" />
          </div>
          <ForgeForm
            disabled={running}
            onSubmit={(brief) => void runForge(brief)}
            onBriefReplace={resetWorkspace}
          />
        </section>

        <section className="panel graph-panel" aria-label="Agent orchestration">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">02 / Orchestrate</p>
              <h2 className="mt-1 font-serif text-xl text-[var(--paper)]">Parallel product team</h2>
            </div>
            <div className="flex items-center gap-2">
              {startedAt && (
                <span className="hidden items-center gap-1.5 rounded-full border border-white/[.07] bg-white/[.03] px-2.5 py-1 font-mono text-[9px] text-white/40 sm:flex">
                  <Clock3 className="size-3" />
                  {running ? "working" : formatDuration(Date.now() - startedAt)}
                </span>
              )}
              <span className="flex items-center gap-1.5 rounded-full border border-white/[.07] bg-white/[.03] px-2.5 py-1 font-mono text-[9px] text-white/40">
                <Zap className="size-3 text-[var(--lime)]" />
                {completedAgents}/13
              </span>
            </div>
          </div>
          <div className="graph-stage">
            <AgentGraph
              statuses={statuses}
              latencies={latencies}
              errors={errors}
              retryingAgentId={retryingAgentId}
              onRetry={(agentId) => void retryAgent(agentId)}
            />
          </div>
          <ExecutionTimeline events={events} startedAt={startedAt} running={running} />
          {retryNotice && (
            <div
              className={`retry-notice is-${retryNotice.kind}`}
              role="status"
              aria-live="polite"
            >
              {retryNotice.kind === "running" ? (
                <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
              ) : retryNotice.kind === "success" ? (
                <Check className="size-3.5 shrink-0" />
              ) : (
                <RotateCcw className="size-3.5 shrink-0" />
              )}
              <span className="min-w-0 flex-1">{retryNotice.message}</span>
              {retryNotice.kind !== "running" && (
                <button
                  type="button"
                  className="shrink-0 text-[10px] uppercase tracking-wider opacity-60 hover:opacity-100"
                  onClick={() => setRetryNotice(null)}
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-3 border-t border-red-300/15 bg-red-300/[.05] px-5 py-3 text-xs text-red-100">
              <span className="min-w-0 flex-1">{error}</span>
              <Button variant="danger" size="sm" onClick={() => setError(null)}>
                Dismiss
              </Button>
            </div>
          )}
        </section>

        <section className="panel proposal-panel print-panel" aria-label="Generated proposal">
          <div className="panel-heading lg:hidden">
            <div>
              <p className="eyebrow">03 / Proposal</p>
              <h2 className="mt-1 font-serif text-xl text-[var(--paper)]">Product plan</h2>
            </div>
          </div>
          <ProposalPanel project={project} loading={running} error={error} />
        </section>
      </main>

      <footer className="statusbar">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />
          Cloudflare edge
        </span>
        <span className="hidden sm:inline">Typed contracts · graceful degradation · session-private history</span>
        <span className="ml-auto">Free-tier architecture</span>
      </footer>

      <RecentProjects
        open={recentOpen}
        projects={history.data ?? []}
        loadingId={loadingProjectId}
        onClose={() => setRecentOpen(false)}
        onSelect={(id) => void openProject(id)}
      />
    </div>
  );
}
