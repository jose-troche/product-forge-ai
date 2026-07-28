import type { AgentId, AgentResult, AgentSection, ProductInput } from "@product-forge/contracts";
import { agentDefinitionById } from "./agents";

function productName(input: ProductInput): string {
  const sentence = input.idea.replace(/^build\s+/i, "").split(/[.!?]/)[0]?.trim() || "the product";
  return sentence.length > 72 ? `${sentence.slice(0, 69)}…` : sentence;
}

function common(input: ProductInput) {
  return {
    product: productName(input),
    industry: input.industry,
    budget: input.budget,
    team: input.teamSize,
    constraints: input.constraints || "No additional constraints supplied",
  };
}

const builders: Record<AgentId, (input: ProductInput) => AgentSection[]> = {
  market: (input) => {
    const c = common(input);
    return [
      {
        heading: "Market thesis",
        summary: `${c.product} addresses a recurring coordination or decision problem in ${c.industry}. The initial market should be defined behaviorally—not by a broad demographic—around people already using a workaround and feeling measurable friction.`,
        bullets: [
          "Beachhead: users with frequent, high-consequence workflows and an existing patchwork solution.",
          "Demand signal: repeated manual work, spreadsheet handoffs, or costly context switching.",
          "Willingness-to-pay proxy: current spend in labor hours, errors, or adjacent software.",
        ],
      },
      {
        heading: "Sizing approach",
        summary: "Use a bottom-up model until primary research supports defensible market figures.",
        bullets: [
          "TAM assumption: all reachable organizations or users with the core workflow.",
          "SAM assumption: segments reachable through the first geography, language, and integrations.",
          "SOM assumption: qualified accounts × realistic conversion × first-year annual value.",
          "Validate each variable with 12–15 interviews and three paid design partners.",
        ],
      },
      {
        heading: "SWOT",
        summary: "The strongest early advantage is focused workflow depth; the primary risk is solving an interesting but non-urgent problem.",
        table: {
          columns: ["Strengths", "Weaknesses", "Opportunities", "Threats"],
          rows: [
            ["Focused workflow", "No proprietary data at launch", "Underserved niche", "Incumbent bundling"],
            ["Fast learning loop", "Small delivery team", "AI-assisted automation", "Low switching appetite"],
          ],
        },
        bullets: [],
      },
    ];
  },
  competitors: (input) => {
    const c = common(input);
    return [
      {
        heading: "Competitive set",
        summary: `${c.product} competes with direct software, horizontal suites, services, and the status quo. The status quo is usually the most important competitor.`,
        table: {
          columns: ["Category", "Typical strength", "Typical gap"],
          rows: [
            ["Direct products", "Purpose-built workflow", "May optimize for larger teams"],
            ["Horizontal suites", "Distribution and integrations", "Shallow domain workflow"],
            ["Services", "High-touch expertise", "Expensive and hard to scale"],
            ["Manual workaround", "Familiar and flexible", "Slow, fragmented, unauditable"],
          ],
        },
        bullets: [],
      },
      {
        heading: "Positioning wedge",
        summary: `Position around a concrete outcome: the fastest trustworthy path from input to decision for ${c.industry} teams.`,
        bullets: [
          "Lead with time-to-value, not feature count.",
          "Make provenance, review, and reversibility visible wherever automation is used.",
          "Win one end-to-end job before expanding into a suite.",
        ],
      },
    ];
  },
  product: (input) => {
    const c = common(input);
    return [
      {
        heading: "Vision and outcomes",
        summary: `Enable the target user to complete the core ${c.industry} workflow with less coordination, clearer decisions, and a reliable record of what happened.`,
        bullets: [
          "Outcome 1: first useful result in under five minutes.",
          "Outcome 2: reduce manual handoffs in the core journey by at least half.",
          "Outcome 3: every automated output is reviewable and editable.",
        ],
      },
      {
        heading: "Prioritized MVP",
        summary: `The MVP must fit a ${c.team.toLowerCase()} team and ${c.budget.toLowerCase()} budget.`,
        bullets: [
          "P0 — Guided onboarding and a clearly defined first job.",
          "P0 — Core create, review, revise, and share workflow.",
          "P0 — Project history with status and audit context.",
          "P1 — Lightweight collaboration and notifications.",
          "P1 — One high-value integration selected through research.",
          "Later — Advanced analytics, marketplace, and deep customization.",
        ],
      },
      {
        heading: "Representative user stories",
        summary: "Stories are framed around decisions and outcomes.",
        bullets: [
          "As a first-time user, I can start from an example so I understand the expected input.",
          "As an owner, I can review and edit generated work before sharing it.",
          "As a collaborator, I can see what changed and why.",
          "As an admin, I can remove data and control who has access.",
        ],
      },
      {
        heading: "Non-functional requirements",
        summary: "Trust and speed are part of the product, not implementation details.",
        bullets: [
          "WCAG 2.2 AA interaction and contrast.",
          "P95 interactive response under two seconds outside long-running generation.",
          "Encryption in transit and at rest; tenant-scoped authorization on every resource.",
          "Idempotent writes, observable failures, and recoverable background work.",
        ],
      },
    ];
  },
  ux: (input) => {
    const c = common(input);
    return [
      {
        heading: "Primary personas",
        summary: `Begin with two roles in ${c.industry}: the hands-on operator and the accountable decision-maker.`,
        bullets: [
          "Operator: values speed, clear next actions, keyboard efficiency, and low rework.",
          "Decision-maker: values confidence, summaries, exceptions, and a defensible audit trail.",
          "Administrator: secondary persona focused on access, retention, and integration health.",
        ],
      },
      {
        heading: "Golden path",
        summary: "Orient → provide context → generate or act → review exceptions → publish/share → revisit history.",
        bullets: [
          "Use progressive disclosure; ask only for inputs that materially change the result.",
          "Keep system status and automation boundaries visible.",
          "Preserve user edits during regeneration.",
          "Provide empty, loading, partial, error, and recovery states for every async surface.",
        ],
      },
      {
        heading: "Information architecture",
        summary: "A compact workspace model keeps attention on the current job.",
        bullets: ["Home / recent work", "Project workspace", "Review and compare", "Shared outputs", "Settings and data controls"],
      },
      {
        heading: "Accessibility",
        summary: "The experience must remain fully operable without color, animation, pointer precision, or a large viewport.",
        bullets: [
          "Semantic landmarks, logical focus order, and visible focus indicators.",
          "Text equivalents for diagrams and status animation.",
          "Reduced-motion support and no status conveyed by color alone.",
          "Touch targets of at least 44×44 px on mobile.",
        ],
      },
    ];
  },
  architecture: (input) => {
    const c = common(input);
    return [
      {
        heading: "System shape",
        summary: `Start with a modular monolith that a ${c.team.toLowerCase()} team can operate, with clear boundaries for identity, core workflow, automation, and notifications.`,
        bullets: [
          "Web client: responsive application with local optimistic state.",
          "API: stateless request validation, authorization, and orchestration.",
          "Relational store: source of truth for users, projects, and audit records.",
          "Async worker: retriable generation, imports, and notifications.",
          "Object storage: user uploads and generated exports when needed.",
        ],
      },
      {
        heading: "Reliability and scale",
        summary: "Scale the bottleneck only after measuring it; protect correctness first.",
        bullets: [
          "Use idempotency keys on mutation and job endpoints.",
          "Bound concurrency and apply exponential backoff with jitter.",
          "Emit structured logs with request, user, project, and job correlation IDs.",
          "Define SLOs for core actions and alert on user-visible error budget burn.",
        ],
      },
      {
        heading: "Tradeoffs",
        summary: "A modular monolith minimizes operational overhead while preserving an extraction path.",
        bullets: [
          "Prefer managed primitives over bespoke infrastructure.",
          "Keep provider adapters at the boundary so AI and notification vendors remain replaceable.",
          "Do not introduce event sourcing or microservices until audit or scaling evidence requires them.",
        ],
      },
    ];
  },
  database: (input) => {
    const c = common(input);
    return [
      {
        heading: "Core entities",
        summary: `A tenant-aware relational model supports the first version of ${c.product}.`,
        bullets: [
          "users and organizations define identity and tenancy.",
          "memberships define role and lifecycle.",
          "projects own the core user workflow.",
          "artifacts retain generated and edited outputs.",
          "jobs track asynchronous work and retries.",
          "audit_events capture security-relevant changes.",
        ],
      },
      {
        heading: "Data rules",
        summary: "Use server-generated IDs, explicit lifecycle timestamps, and tenant-scoped indexes.",
        bullets: [
          "Foreign keys prevent orphaned project data.",
          "Soft deletion is reserved for recovery or regulated retention needs.",
          "Store structured generation payloads as JSON only where query needs are limited.",
          "Version artifacts instead of overwriting user-reviewed content.",
        ],
      },
    ];
  },
  api: () => [
    {
      heading: "Resource design",
      summary: "A versioned JSON API centers on projects, artifacts, jobs, and exports.",
      bullets: [
        "POST /v1/projects — create a project with an idempotency key.",
        "GET /v1/projects — cursor-paginated project history.",
        "GET /v1/projects/{id} — project, latest artifact, and status.",
        "POST /v1/projects/{id}/runs — start or refine a generation run.",
        "GET /v1/jobs/{id} — poll progress; optionally expose an event stream.",
        "POST /v1/projects/{id}/exports — create a shareable export.",
      ],
    },
    {
      heading: "Contract conventions",
      summary: "Errors are stable, actionable, and safe to expose.",
      bullets: [
        "Validate all inputs at the boundary and return field-level problems.",
        "Use opaque cursors and RFC 3339 timestamps.",
        "Return 202 for asynchronous work and a status URL.",
        "Rate-limit by authenticated principal and protect expensive endpoints separately.",
      ],
    },
  ],
  security: (input) => {
    const c = common(input);
    return [
      {
        heading: "Threat priorities",
        summary: `The initial threat model for ${c.product} prioritizes broken tenant isolation, sensitive input leakage, prompt injection, account takeover, and resource abuse.`,
        bullets: [
          "Authorize every object by organization membership; never trust client-supplied tenant IDs.",
          "Treat model output and uploaded content as untrusted data.",
          "Separate instructions from user content and constrain tool permissions.",
          "Rate-limit generation, uploads, invitations, and authentication attempts.",
        ],
      },
      {
        heading: "Controls",
        summary: "Build the minimum credible trust baseline before inviting design partners.",
        bullets: [
          "Managed identity with MFA support and short-lived sessions.",
          "Encryption in transit/at rest plus secret rotation.",
          "Content Security Policy, secure cookies, CSRF protection, and output encoding.",
          "Audit access and destructive actions without logging sensitive content.",
          "Retention controls, deletion workflow, and subprocessor inventory.",
        ],
      },
    ];
  },
  roadmap: (input) => {
    const c = common(input);
    return [
      {
        heading: "Phase 0 · Validate (2 weeks)",
        summary: "Prove urgency and narrow the workflow before building.",
        bullets: ["12–15 problem interviews", "Clickable prototype tests", "Three design-partner commitments", "Baseline the current workflow"],
      },
      {
        heading: "Phase 1 · MVP (6–8 weeks)",
        summary: `A ${c.team.toLowerCase()} team delivers the P0 journey, trust controls, instrumentation, and one integration.`,
        bullets: ["Weekly partner demos", "Feature flags for incomplete paths", "Production telemetry from day one", "Launch gate: five users complete the core job unaided"],
      },
      {
        heading: "Phase 2 · Pilot (4 weeks)",
        summary: "Improve reliability and activation using observed behavior.",
        bullets: ["Onboarding experiments", "Exception and recovery UX", "Support playbook", "Security review and data lifecycle test"],
      },
      {
        heading: "Phase 3 · Scale (ongoing)",
        summary: "Expand only after retention and repeat usage are visible.",
        bullets: ["Second integration", "Team collaboration", "Usage-based packaging", "Operational automation"],
      },
    ];
  },
  kpi: () => [
    {
      heading: "North Star",
      summary: "Weekly successful core outcomes completed and accepted by a user.",
      bullets: [
        "Count an outcome only when the user reaches the end state and does not immediately discard it.",
        "Segment by first-time vs returning user and by acquisition cohort.",
      ],
    },
    {
      heading: "Product metrics",
      summary: "Measure activation, repeat value, quality, and friction together.",
      bullets: [
        "Activation: percentage completing the first core outcome within one day.",
        "Time to first value and median active effort.",
        "Week-4 retained teams and outcomes per retained team.",
        "Output acceptance rate and average revision depth.",
      ],
    },
    {
      heading: "Business and technical health",
      summary: "Pair growth metrics with unit and reliability constraints.",
      bullets: [
        "Qualified pipeline, paid conversion, expansion, and gross retention.",
        "Cost per successful outcome and support minutes per active team.",
        "P95 latency, job success rate, retry rate, and availability.",
      ],
    },
  ],
  risk: () => [
    {
      heading: "Risk register",
      summary: "The first release should retire product risk before optimizing scale.",
      table: {
        columns: ["Risk", "Signal", "Mitigation"],
        rows: [
          ["Problem lacks urgency", "Praise without repeat use", "Paid design partners and workflow baselines"],
          ["Automation is not trusted", "High discard/edit rate", "Provenance, review, and bounded automation"],
          ["Scope exceeds team", "Missed weekly milestones", "One golden path; strict P0 gate"],
          ["Sensitive data exposure", "Unsafe logs or permissions", "Data classification and tenant tests"],
          ["Provider dependency", "Cost/latency volatility", "Adapter boundary, budgets, and fallback"],
        ],
      },
      bullets: [],
    },
    {
      heading: "Validation plan",
      summary: "Each major assumption gets a cheap falsification test.",
      bullets: [
        "Desirability: users schedule a second session without prompting.",
        "Usability: 5/6 target users finish the golden path unaided.",
        "Feasibility: representative workloads meet latency and cost budgets.",
        "Viability: at least three partners accept the proposed paid pilot terms.",
      ],
    },
  ],
};

export function buildFallbackResult(
  agentId: AgentId,
  input: ProductInput,
  latencyMs = 0,
  failureReason?: string,
): AgentResult {
  const definition = agentDefinitionById.get(agentId);
  if (!definition) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  const builder = builders[agentId];
  if (!builder) {
    throw new Error(`Missing fallback builder for ${agentId}`);
  }
  const sections = builder(input);
  return {
    agentId,
    title: definition.name,
    summary: sections[0]?.summary ?? definition.outputFocus,
    sections,
    confidence: 0.72,
    assumptions: [
      "Recommendations are hypotheses until validated with target users.",
      `Scope is constrained to ${input.teamSize.toLowerCase()} and a ${input.budget.toLowerCase()} budget.`,
    ],
    latencyMs,
    tokenUsage: { input: 0, output: 0 },
    source: "fallback",
    ...(failureReason ? { failureReason } : {}),
  };
}
