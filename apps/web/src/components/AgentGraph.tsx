import type { AgentId, AgentResult, OrchestrationEvent } from "@product-forge/contracts";
import { agentDefinitions } from "@product-forge/orchestrator/agents";
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Bot, Check, CircleAlert, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { cn, formatDuration } from "../lib/utils";

export type AgentStatus = "idle" | "running" | "completed" | "degraded" | "failed";

type GraphNodeId = AgentId | "orchestrator" | "synthesis";

interface AgentNodeData extends Record<string, unknown> {
  label: string;
  subtitle: string;
  accent: string;
  status: AgentStatus;
  latencyMs?: number;
  error?: string;
  onRetry?: () => void;
  kind: "agent" | "orchestrator" | "synthesis";
}

type AgentFlowNode = Node<AgentNodeData, "agent">;

function StatusIcon({ status }: { status: AgentStatus }) {
  if (status === "running") return <LoaderCircle className="size-3.5 animate-spin text-[var(--lime)]" />;
  if (status === "completed") return <Check className="size-3.5 text-emerald-300" />;
  if (status === "degraded" || status === "failed")
    return <CircleAlert className={cn("size-3.5", status === "failed" ? "text-red-300" : "text-amber-300")} />;
  return <Bot className="size-3.5 text-white/30" />;
}

function AgentNode({ data }: NodeProps<AgentFlowNode>) {
  return (
    <div
      className={cn(
        "agent-node",
        data.status === "running" && "is-running",
        data.status === "completed" && "is-complete",
        data.status === "degraded" && "is-degraded",
        data.status === "failed" && "is-failed",
        data.kind !== "agent" && "is-special",
      )}
      style={{ "--node-accent": data.accent } as CSSProperties}
      title={data.error}
    >
      <Handle type="target" position={Position.Top} className="!border-0 !bg-white/20" />
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/[.06]">
          {data.kind === "orchestrator" ? (
            <Sparkles className="size-3.5 text-[var(--lime)]" />
          ) : (
            <StatusIcon status={data.status} />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-white/90">{data.label}</p>
          <p className="truncate font-mono text-[8px] uppercase tracking-[.13em] text-white/35">
            {data.status === "running" ? "thinking…" : data.error ? `Failed · ${data.error}` : data.subtitle}
          </p>
        </div>
        {data.error && data.onRetry && data.status !== "running" ? (
          <button
            className="nodrag ml-auto grid size-7 shrink-0 place-items-center rounded-lg border border-amber-300/20 bg-amber-300/[.08] text-amber-200 transition hover:border-amber-300/40 hover:bg-amber-300/[.14]"
            type="button"
            aria-label={`Retry ${data.label}. Failure: ${data.error}`}
            title={`Retry ${data.label}`}
            onClick={(event) => {
              event.stopPropagation();
              data.onRetry?.();
            }}
          >
            <RotateCcw className="size-3.5" />
          </button>
        ) : typeof data.latencyMs === "number" ? (
          <span className="ml-auto font-mono text-[8px] text-white/30">{formatDuration(data.latencyMs)}</span>
        ) : null}
      </div>
      <Handle type="source" position={Position.Bottom} className="!border-0 !bg-white/20" />
    </div>
  );
}

const nodeTypes: NodeTypes = { agent: AgentNode };

interface AgentGraphProps {
  statuses: Partial<Record<GraphNodeId, AgentStatus>>;
  latencies: Partial<Record<AgentId, number>>;
  errors: Partial<Record<AgentId, string>>;
  retryingAgentId: AgentId | null;
  onRetry: (agentId: AgentId) => void;
}

export function AgentGraph({
  statuses,
  latencies,
  errors,
  retryingAgentId,
  onRetry,
}: AgentGraphProps) {
  const nodes = useMemo<AgentFlowNode[]>(() => {
    const width = 172;
    const gap = 18;
    const columns = 4;
    const agents = agentDefinitions.map((agent, index) => ({
      id: agent.id,
      type: "agent" as const,
      position: {
        x: (index % columns) * (width + gap),
        y: 112 + Math.floor(index / columns) * 92,
      },
      data: {
        label: agent.name,
        subtitle: agent.role.split(",")[0] ?? "specialist",
        accent: agent.accent,
        status: retryingAgentId === agent.id ? "running" : (statuses[agent.id] ?? "idle"),
        ...(typeof latencies[agent.id] === "number" ? { latencyMs: latencies[agent.id] } : {}),
        ...(errors[agent.id] ? { error: errors[agent.id], onRetry: () => onRetry(agent.id) } : {}),
        kind: "agent" as const,
      },
    }));

    return [
      {
        id: "orchestrator",
        type: "agent",
        position: { x: 294, y: 4 },
        data: {
          label: "Product Orchestrator",
          subtitle: "refine · delegate · validate",
          accent: "#d8ff5f",
          status: statuses.orchestrator ?? "idle",
          kind: "orchestrator",
        },
      },
      ...agents,
      {
        id: "synthesis",
        type: "agent",
        position: { x: 294, y: 418 },
        data: {
          label: "Synthesis Agent",
          subtitle: "cohesive proposal",
          accent: "#4ee1ad",
          status: statuses.synthesis ?? "idle",
          kind: "synthesis",
        },
      },
    ];
  }, [errors, latencies, onRetry, retryingAgentId, statuses]);

  const edges = useMemo<Edge[]>(
    () => [
      ...agentDefinitions.map((agent) => ({
        id: `orchestrator-${agent.id}`,
        source: "orchestrator",
        target: agent.id,
        animated: statuses[agent.id] === "running",
        style: {
          stroke: statuses[agent.id] === "completed" ? "#4ee1ad" : "rgba(255,255,255,.1)",
          strokeWidth: 1,
        },
      })),
      ...agentDefinitions.map((agent) => ({
        id: `${agent.id}-synthesis`,
        source: agent.id,
        target: "synthesis",
        animated: statuses.synthesis === "running",
        style: {
          stroke: statuses[agent.id] === "completed" ? "rgba(78,225,173,.36)" : "rgba(255,255,255,.075)",
          strokeWidth: 1,
        },
      })),
    ],
    [statuses],
  );

  return (
    <div className="h-full min-h-[440px]" aria-label="Live multi-agent execution graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.55}
        maxZoom={1.25}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll={false}
        zoomOnScroll={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="rgba(255,255,255,.055)" />
      </ReactFlow>
    </div>
  );
}

export function deriveStatuses(events: OrchestrationEvent[], savedAgents: AgentResult[] = []) {
  const statuses: Partial<Record<GraphNodeId, AgentStatus>> = {};
  const latencies: Partial<Record<AgentId, number>> = {};
  const errors: Partial<Record<AgentId, string>> = {};

  if (savedAgents.length) {
    statuses.orchestrator = "completed";
    statuses.synthesis = "completed";
    for (const agent of savedAgents) {
      statuses[agent.agentId] = agent.source === "fallback" ? "degraded" : "completed";
      latencies[agent.agentId] = agent.latencyMs;
      if (agent.source === "fallback") {
        errors[agent.agentId] =
          agent.failureReason ??
          "The agent did not return valid structured output after three attempts.";
      }
    }
  }

  for (const event of events) {
    if (event.type === "project.started") statuses.orchestrator = "completed";
    if (event.type === "agent.started") statuses[event.agentId] = "running";
    if (event.type === "agent.failed") {
      statuses[event.agentId] = "failed";
      errors[event.agentId] = event.message;
    }
    if (event.type === "agent.completed") {
      statuses[event.agent.agentId] = event.agent.source === "fallback" ? "degraded" : "completed";
      latencies[event.agent.agentId] = event.agent.latencyMs;
      if (event.agent.failureReason) {
        errors[event.agent.agentId] = event.agent.failureReason;
      } else {
        delete errors[event.agent.agentId];
      }
    }
    if (event.type === "synthesis.started") statuses.synthesis = "running";
    if (event.type === "synthesis.completed") statuses.synthesis = "completed";
  }

  return { statuses, latencies, errors };
}
