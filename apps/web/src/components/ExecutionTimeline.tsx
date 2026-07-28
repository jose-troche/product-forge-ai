import type { OrchestrationEvent } from "@product-forge/contracts";
import { agentDefinitions } from "@product-forge/orchestrator/agents";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn, formatDuration } from "../lib/utils";

const agentNames = new Map(agentDefinitions.map((agent) => [agent.id, agent.name]));

function labelForEvent(event: OrchestrationEvent): string | null {
  if (event.type === "project.started") return "Brief refined and execution plan created";
  if (event.type === "agent.started") return `${agentNames.get(event.agentId)} started`;
  if (event.type === "agent.completed") return `${event.agent.title} completed`;
  if (event.type === "agent.failed") return `${agentNames.get(event.agentId)} failed: ${event.message}`;
  if (event.type === "synthesis.started") return "Synthesis and quality validation started";
  if (event.type === "synthesis.completed") return "Proposal passed completeness validation";
  if (event.type === "project.completed") return "Product plan ready";
  if (event.type === "project.failed") return event.message;
  return null;
}

export function ExecutionTimeline({
  events,
  startedAt,
  running,
}: {
  events: OrchestrationEvent[];
  startedAt: number | null;
  running: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleEvents = events.filter((event) => event.type !== "agent.started").slice(-8);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [events.length]);

  return (
    <div className="border-t border-white/[.07] bg-black/10">
      <div className="flex items-center justify-between px-5 py-3">
        <div>
          <p className="text-[11px] font-semibold text-white/75">Execution timeline</p>
          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[.15em] text-white/30">
            deterministic fan-out / fan-in
          </p>
        </div>
        {startedAt && (
          <span className="rounded-full border border-white/[.08] bg-white/[.03] px-2.5 py-1 font-mono text-[9px] text-white/45">
            {running ? "live · " : ""}
            {formatDuration(Date.now() - startedAt)}
          </span>
        )}
      </div>
      <div ref={scrollRef} className="h-[124px] overflow-y-auto px-5 pb-4">
        {visibleEvents.length === 0 ? (
          <div className="flex h-full items-center text-xs text-white/30">
            Agent activity will appear here when you forge a plan.
          </div>
        ) : (
          <ol className="space-y-2">
            {visibleEvents.map((event, index) => {
              const failed = event.type === "agent.failed" || event.type === "project.failed";
              const active = index === visibleEvents.length - 1 && running;
              const label = labelForEvent(event);
              if (!label) return null;
              return (
                <li key={`${event.at}-${event.type}-${index}`} className="flex items-center gap-2.5 text-[10px]">
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-full border",
                      failed
                        ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                        : "border-emerald-400/20 bg-emerald-400/[.08] text-emerald-200",
                    )}
                  >
                    {failed ? (
                      <CircleAlert className="size-2.5" />
                    ) : active ? (
                      <LoaderCircle className="size-2.5 animate-spin" />
                    ) : (
                      <Check className="size-2.5" />
                    )}
                  </span>
                  <span className={cn("truncate", active ? "text-white/75" : "text-white/45")}>{label}</span>
                  <time className="ml-auto shrink-0 font-mono text-[8px] text-white/20">
                    {new Date(event.at).toLocaleTimeString([], {
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
