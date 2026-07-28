import type { ProjectSummary } from "@product-forge/contracts";
import { Clock3, FolderOpen, LoaderCircle, X } from "lucide-react";
import { formatRelativeTime } from "../lib/utils";
import { Button } from "./ui/button";

export function RecentProjects({
  open,
  projects,
  loadingId,
  onClose,
  onSelect,
}: {
  open: boolean;
  projects: ProjectSummary[];
  loadingId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  if (!open) return null;

  return (
    <>
      <button className="fixed inset-0 z-40 cursor-default bg-black/55 backdrop-blur-sm" onClick={onClose} aria-label="Close recent projects" />
      <aside className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-white/10 bg-[#0c1512] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-5">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2 className="mt-1 font-serif text-2xl text-[var(--paper)]">Recent projects</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {projects.length === 0 ? (
            <div className="grid h-64 place-items-center px-8 text-center">
              <div>
                <FolderOpen className="mx-auto size-7 text-white/25" />
                <p className="mt-4 text-sm font-medium text-white/60">No saved projects yet</p>
                <p className="mt-1 text-xs leading-relaxed text-white/35">Every completed forge is saved to this browser session.</p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {projects.map((project) => (
                <li key={project.id}>
                  <button
                    className="group w-full rounded-xl border border-white/[.07] bg-white/[.025] p-4 text-left transition hover:border-white/15 hover:bg-white/[.05]"
                    disabled={loadingId !== null}
                    onClick={() => onSelect(project.id)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--mint)]/[.08] text-[var(--mint)]">
                        {loadingId === project.id ? <LoaderCircle className="size-4 animate-spin" /> : <FolderOpen className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-white/75 group-hover:text-white">{project.idea}</p>
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-white/35">
                          <span>{project.industry}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock3 className="size-2.5" />
                            {formatRelativeTime(project.createdAt)}
                          </span>
                        </div>
                      </div>
                      <span className="rounded-full bg-white/[.05] px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white/35">
                        {project.status}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
