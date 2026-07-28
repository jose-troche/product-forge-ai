import type { Project, Proposal, ProposalSection } from "@product-forge/contracts";
import {
  Braces,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Database,
  Download,
  FileJson,
  FileText,
  GitBranch,
  Network,
  Printer,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn, formatDuration } from "../lib/utils";
import { MermaidDiagram } from "./MermaidDiagram";
import { Button } from "./ui/button";

const tabs: Array<{ id: ProposalSection["id"]; short: string }> = [
  { id: "executive", short: "Summary" },
  { id: "market", short: "Market" },
  { id: "prd", short: "PRD" },
  { id: "ux", short: "UX" },
  { id: "architecture", short: "Architecture" },
  { id: "database", short: "Database" },
  { id: "apis", short: "APIs" },
  { id: "roadmap", short: "Roadmap" },
  { id: "risks", short: "Risks" },
];

function fullMarkdown(proposal: Proposal): string {
  return [
    `# ${proposal.title}`,
    `> ${proposal.oneLiner}`,
    ...proposal.sections.map((section) => `## ${section.title}\n\n${section.markdown}`),
    `## SQL schema\n\n\`\`\`sql\n${proposal.artifacts.sql}\n\`\`\``,
    `## Architecture diagram\n\n\`\`\`mermaid\n${proposal.artifacts.mermaid}\n\`\`\``,
    `## OpenAPI specification\n\n\`\`\`yaml\n${proposal.artifacts.openapi}\n\`\`\``,
  ].join("\n\n");
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ExportMenu({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const proposal = project.proposal;
  if (!proposal) return null;
  const slug = proposal.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const options = [
    {
      label: "Complete Markdown",
      icon: FileText,
      action: () => download(`${slug}-product-plan.md`, fullMarkdown(proposal), "text/markdown"),
    },
    {
      label: "Complete JSON",
      icon: FileJson,
      action: () => download(`${slug}-product-plan.json`, JSON.stringify(project, null, 2), "application/json"),
    },
    {
      label: "SQL schema",
      icon: Database,
      action: () => download(`${slug}-schema.sql`, proposal.artifacts.sql, "text/sql"),
    },
    {
      label: "OpenAPI",
      icon: Network,
      action: () => download(`${slug}-openapi.yaml`, proposal.artifacts.openapi, "text/yaml"),
    },
    {
      label: "Mermaid",
      icon: GitBranch,
      action: () => download(`${slug}-architecture.mmd`, proposal.artifacts.mermaid, "text/plain"),
    },
    {
      label: "Complete PDF / print",
      icon: Printer,
      action: () => window.print(),
    },
  ];

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Download className="size-3.5" />
        Export
        <ChevronDown className="size-3" />
      </Button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-48 rounded-xl border border-white/10 bg-[#101a17] p-1.5 shadow-2xl">
          {options.map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-white/65 hover:bg-white/[.06] hover:text-white"
              onClick={() => {
                action();
                setOpen(false);
              }}
            >
              <Icon className="size-3.5 text-[var(--mint)]" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CodePreview({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-shell">
      <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-2">
        <span className="font-mono text-[9px] uppercase tracking-[.16em] text-white/35">{language}</span>
        <button
          className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/70"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1_500);
          }}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-[420px] overflow-auto p-4 text-[11px] leading-relaxed text-emerald-100/75">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ProposalContent({ proposal, section }: { proposal: Proposal; section: ProposalSection }) {
  return (
    <div className="space-y-5">
      {section.id === "architecture" && <MermaidDiagram code={proposal.artifacts.mermaid} />}
      <article className="proposal-copy">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.markdown}</ReactMarkdown>
      </article>
      {section.id === "database" && <CodePreview code={proposal.artifacts.sql} language="SQL schema" />}
      {section.id === "apis" && <CodePreview code={proposal.artifacts.openapi} language="OpenAPI 3.1" />}
    </div>
  );
}

function CompletePrintView({ proposal }: { proposal: Proposal }) {
  return (
    <div className="print-complete">
      <header className="mb-8 border-b border-black/15 pb-5">
        <p className="text-xs uppercase tracking-[.16em] text-black/50">Product Forge AI · Complete product plan</p>
        <h1 className="mt-2 font-serif text-4xl text-black">{proposal.title}</h1>
        <p className="mt-2 text-sm text-black/60">{proposal.oneLiner}</p>
      </header>
      {proposal.sections.map((proposalSection) => (
        <section key={proposalSection.id} className="mb-8 break-inside-avoid-page">
          <h2 className="mb-3 font-serif text-3xl text-black">{proposalSection.title}</h2>
          <article className="proposal-copy print-copy">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{proposalSection.markdown}</ReactMarkdown>
          </article>
        </section>
      ))}
      <section className="mb-8 break-before-page">
        <h2 className="mb-3 font-serif text-3xl text-black">Database schema</h2>
        <pre className="whitespace-pre-wrap rounded-lg border border-black/15 bg-black/[.03] p-4 text-[9px] leading-relaxed text-black">
          <code>{proposal.artifacts.sql}</code>
        </pre>
      </section>
      <section className="mb-8 break-before-page">
        <h2 className="mb-3 font-serif text-3xl text-black">API specification</h2>
        <pre className="whitespace-pre-wrap rounded-lg border border-black/15 bg-black/[.03] p-4 text-[9px] leading-relaxed text-black">
          <code>{proposal.artifacts.openapi}</code>
        </pre>
      </section>
      <section className="mb-8">
        <h2 className="mb-3 font-serif text-3xl text-black">Architecture diagram source</h2>
        <pre className="whitespace-pre-wrap rounded-lg border border-black/15 bg-black/[.03] p-4 text-[9px] leading-relaxed text-black">
          <code>{proposal.artifacts.mermaid}</code>
        </pre>
      </section>
    </div>
  );
}

export function ProposalPanel({
  project,
  loading,
  error,
}: {
  project: Project | null;
  loading: boolean;
  error: string | null;
}) {
  const [activeTab, setActiveTab] = useState<ProposalSection["id"]>("executive");
  const [raw, setRaw] = useState(false);
  const proposal = project?.proposal ?? null;
  const section = useMemo(
    () => proposal?.sections.find((candidate) => candidate.id === activeTab) ?? proposal?.sections[0],
    [activeTab, proposal],
  );

  if (!proposal || !project || !section) {
    return (
      <div className="grid h-full min-h-[520px] place-items-center px-8 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl border border-[var(--lime)]/20 bg-[var(--lime)]/[.06] shadow-[0_0_80px_rgba(216,255,95,.08)]">
            {loading ? (
              <Sparkles className="size-6 animate-pulse text-[var(--lime)]" />
            ) : (
              <Braces className="size-6 text-[var(--lime)]" />
            )}
          </div>
          <p className="eyebrow">{loading ? "Your team is working" : "Proposal studio"}</p>
          <h2 className="mt-3 font-serif text-3xl leading-tight text-[var(--paper)]">
            {loading ? "Specialists are shaping your product." : "A complete product plan will appear here."}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
            {error ??
              (loading
                ? "You can watch the execution graph while research, product, design, and engineering agents work in parallel."
                : "Set the product brief, then forge it into a market thesis, PRD, system design, roadmap, risk register, and implementation artifacts.")}
          </p>
          {!loading && !error && (
            <div className="mt-6 flex justify-center gap-3 font-mono text-[9px] uppercase tracking-[.12em] text-white/30">
              <span>9 proposal tabs</span>
              <span>·</span>
              <span>6 export formats</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="screen-proposal-content border-b border-white/[.07] px-5 pb-4 pt-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-[.15em]",
                  project.status === "partial"
                    ? "bg-amber-300/10 text-amber-200"
                    : "bg-emerald-300/10 text-emerald-200",
                )}
              >
                {project.status === "partial" ? "Completed with fallback" : "Proposal ready"}
              </span>
              <span className="font-mono text-[9px] text-white/30">
                {formatDuration(proposal.totalLatencyMs)}
              </span>
            </div>
            <h2 className="truncate font-serif text-2xl text-[var(--paper)]">{proposal.title}</h2>
            <p className="mt-1 truncate text-xs text-[var(--muted)]">{proposal.oneLiner}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="icon" onClick={() => setRaw((value) => !value)} title="Toggle raw JSON">
              {raw ? <FileText className="size-4" /> : <Code2 className="size-4" />}
            </Button>
            <ExportMenu project={project} />
          </div>
        </div>
      </div>

      <div className="screen-proposal-content scrollbar-none flex shrink-0 gap-1 overflow-x-auto border-b border-white/[.07] px-4 py-2" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-medium transition",
              activeTab === tab.id && !raw
                ? "bg-white/[.08] text-white"
                : "text-white/40 hover:bg-white/[.04] hover:text-white/65",
            )}
            onClick={() => {
              setActiveTab(tab.id);
              setRaw(false);
            }}
          >
            {tab.short}
          </button>
        ))}
      </div>

      <div className="screen-proposal-content min-h-0 flex-1 overflow-y-auto px-5 py-6">
        {raw ? <CodePreview code={JSON.stringify(project, null, 2)} language="Structured agent output · JSON" /> : <ProposalContent proposal={proposal} section={section} />}
      </div>
      <CompletePrintView proposal={proposal} />
    </div>
  );
}
