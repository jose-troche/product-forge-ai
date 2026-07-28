import type { ProductInput } from "@product-forge/contracts";
import { ArrowUpRight, RotateCcw, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "./ui/button";

type Brief = Omit<ProductInput, "sessionId">;

interface ForgeFormProps {
  disabled: boolean;
  onSubmit: (brief: Brief) => void;
  onBriefReplace: () => void;
}

const defaultBrief: Brief = {
  idea: "Build Airbnb for boats.",
  constraints: "Launch in one coastal market. Prioritize trust and owner verification.",
  industry: "Travel & marketplaces",
  budget: "Under $50K",
  teamSize: "2–5 people",
};

const blankBrief: Brief = {
  idea: "",
  constraints: "",
  industry: "Technology",
  budget: "Bootstrapped",
  teamSize: "2–5 people",
};

const examples: Array<{ label: string; brief: Brief }> = [
  {
    label: "Airbnb for boats",
    brief: defaultBrief,
  },
  {
    label: "Incident command for clinics",
    brief: {
      idea: "Build an incident command center for independent clinics.",
      constraints: "HIPAA-aware, mobile first, and deployable without dedicated IT staff.",
      industry: "Healthcare operations",
      budget: "$50K–$250K",
      teamSize: "6–12 people",
    },
  },
  {
    label: "A calm CRM for freelancers",
    brief: {
      idea: "Build a calm CRM for independent freelancers.",
      constraints: "Privacy-first, email-friendly, and useful without complex setup or sales jargon.",
      industry: "Freelance business tools",
      budget: "Bootstrapped",
      teamSize: "Solo founder",
    },
  },
];

export function ForgeForm({ disabled, onSubmit, onBriefReplace }: ForgeFormProps) {
  const [brief, setBrief] = useState<Brief>(defaultBrief);

  const update = <Key extends keyof Brief>(key: Key, value: Brief[Key]) => {
    setBrief((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(brief);
  };

  const replaceBrief = (nextBrief: Brief) => {
    onBriefReplace();
    setBrief(nextBrief);
  };

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <label className="field-label" htmlFor="idea">
              Product idea
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-white/30">{brief.idea.length}/2500</span>
              <button
                type="button"
                className="flex items-center gap-1 rounded-md px-1.5 py-1 font-mono text-[9px] uppercase tracking-wider text-white/35 transition hover:bg-white/[.05] hover:text-white/65"
                onClick={() => replaceBrief(blankBrief)}
              >
                <RotateCcw className="size-2.5" />
                Reset
              </button>
            </div>
          </div>
          <textarea
            id="idea"
            className="field min-h-32 resize-none text-[15px] leading-relaxed"
            value={brief.idea}
            maxLength={2500}
            onChange={(event) => update("idea", event.target.value)}
            placeholder="What should the product do, and for whom?"
            required
          />
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Example ideas">
            {examples.map((example) => (
              <button
                key={example.label}
                type="button"
                className="rounded-full border border-white/[.07] bg-white/[.025] px-2.5 py-1 text-[10px] text-white/45 transition hover:border-white/15 hover:text-white/70"
                onClick={() => replaceBrief(example.brief)}
              >
                {example.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="field-label mb-2 block" htmlFor="constraints">
            Constraints
          </label>
          <textarea
            id="constraints"
            className="field min-h-24 resize-none text-sm leading-relaxed"
            value={brief.constraints}
            maxLength={1500}
            onChange={(event) => update("constraints", event.target.value)}
            placeholder="Timeline, compliance, platform, audience…"
          />
        </section>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2">
            <span className="field-label mb-2 block">Industry</span>
            <input
              className="field"
              value={brief.industry}
              maxLength={120}
              onChange={(event) => update("industry", event.target.value)}
              placeholder="e.g. Healthcare"
            />
          </label>

          <label>
            <span className="field-label mb-2 block">Budget</span>
            <select
              className="field appearance-none"
              value={brief.budget}
              onChange={(event) => update("budget", event.target.value as Brief["budget"])}
            >
              <option>Bootstrapped</option>
              <option>Under $50K</option>
              <option>$50K–$250K</option>
              <option>$250K+</option>
            </select>
          </label>

          <label>
            <span className="field-label mb-2 block">Team size</span>
            <select
              className="field appearance-none"
              value={brief.teamSize}
              onChange={(event) => update("teamSize", event.target.value as Brief["teamSize"])}
            >
              <option>Solo founder</option>
              <option>2–5 people</option>
              <option>6–12 people</option>
              <option>13+ people</option>
            </select>
          </label>
        </div>
      </div>

      <div className="border-t border-white/[.07] p-4">
        <Button className="group w-full" type="submit" disabled={disabled || brief.idea.trim().length < 10}>
          {disabled ? (
            <>
              <Sparkles className="size-4 animate-pulse" />
              Forging product plan…
            </>
          ) : (
            <>
              Forge product
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
        <p className="mt-2.5 text-center text-[10px] leading-relaxed text-white/35">
          11 specialists · parallel execution · usually under 60 sec
        </p>
      </div>
    </form>
  );
}
