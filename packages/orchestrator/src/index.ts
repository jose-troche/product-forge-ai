import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  agentResultSchema,
  type AgentId,
  type AgentResult,
  type OrchestrationEvent,
  type ProductInput,
  type Proposal,
} from "@product-forge/contracts";
import { agentDefinitionById, agentDefinitions, buildAgentPrompt, refineIdea } from "./agents";
import { buildFallbackResult } from "./fallback";
import { synthesizeProposal } from "./synthesis";

export interface GeneratedAgentPayload {
  summary: string;
  sections: AgentResult["sections"];
  confidence: number;
  assumptions: string[];
  tokenUsage: {
    input: number;
    output: number;
  };
  source?: "ai" | "cache";
}

export interface AgentProvider {
  readonly model: string;
  generate(agentId: AgentId, prompt: string): Promise<GeneratedAgentPayload>;
}

export interface RunOptions {
  projectId: string;
  input: ProductInput;
  provider: AgentProvider;
  emit: (event: OrchestrationEvent) => void;
}

const WorkflowState = Annotation.Root({
  input: Annotation<ProductInput>(),
  projectId: Annotation<string>(),
  refinedIdea: Annotation<string>(),
  provider: Annotation<AgentProvider>(),
  emit: Annotation<(event: OrchestrationEvent) => void>(),
  agents: Annotation<AgentResult[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  proposal: Annotation<Proposal | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
  startedAt: Annotation<number>(),
});

type WorkflowStateType = typeof WorkflowState.State;

function eventBase(state: WorkflowStateType) {
  return {
    projectId: state.projectId,
    at: new Date().toISOString(),
  };
}

async function generateAgentResult(
  agentId: AgentId,
  input: ProductInput,
  refinedIdea: string,
  provider: AgentProvider,
): Promise<AgentResult> {
  const definition = agentDefinitionById.get(agentId);
  if (!definition) {
    throw new Error(`Missing agent definition for ${agentId}`);
  }

  const startedAt = Date.now();
  const generated = await provider.generate(agentId, buildAgentPrompt(definition, input, refinedIdea));
  return agentResultSchema.parse({
    agentId,
    title: definition.name,
    ...generated,
    latencyMs: Date.now() - startedAt,
    source: generated.source ?? "ai",
  });
}

function createAgentNode(agentId: AgentId) {
  return async (state: WorkflowStateType): Promise<Partial<WorkflowStateType>> => {
    state.emit({ ...eventBase(state), type: "agent.started", agentId });
    const startedAt = Date.now();
    let result: AgentResult;

    try {
      result = await generateAgentResult(agentId, state.input, state.refinedIdea, state.provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent generation failed";
      state.emit({
        ...eventBase(state),
        type: "agent.failed",
        agentId,
        message,
      });
      result = buildFallbackResult(agentId, state.input, Date.now() - startedAt, message);
    }

    state.emit({ ...eventBase(state), type: "agent.completed", agent: result });
    return { agents: [result] };
  };
}

export async function retryProductAgent(
  input: ProductInput,
  agentId: AgentId,
  provider: AgentProvider,
): Promise<AgentResult> {
  return generateAgentResult(agentId, input, refineIdea(input), provider);
}

const refineNode = async (state: WorkflowStateType): Promise<Partial<WorkflowStateType>> => {
  const refinedIdea = refineIdea(state.input);
  state.emit({ ...eventBase(state), type: "project.started", refinedIdea });
  return { refinedIdea };
};

const synthesisNode = async (state: WorkflowStateType): Promise<Partial<WorkflowStateType>> => {
  state.emit({ ...eventBase(state), type: "synthesis.started" });
  const proposal = synthesizeProposal(
    state.input,
    state.agents,
    Date.now() - state.startedAt,
    state.agents.some((agent) => agent.source === "ai") ? state.provider.model : "Resilient local synthesis",
  );
  state.emit({ ...eventBase(state), type: "synthesis.completed" });
  return { proposal };
};

const qualityNode = async (state: WorkflowStateType): Promise<Partial<WorkflowStateType>> => {
  if (!state.proposal || state.proposal.sections.length !== 9) {
    throw new Error("Proposal did not pass completeness validation.");
  }
  return {};
};

function buildWorkflow() {
  const graph = new StateGraph(WorkflowState)
    .addNode("refine", refineNode)
    .addNode("market", createAgentNode("market"))
    .addNode("competitors", createAgentNode("competitors"))
    .addNode("product", createAgentNode("product"))
    .addNode("ux", createAgentNode("ux"))
    .addNode("architecture", createAgentNode("architecture"))
    .addNode("database", createAgentNode("database"))
    .addNode("api", createAgentNode("api"))
    .addNode("security", createAgentNode("security"))
    .addNode("roadmap", createAgentNode("roadmap"))
    .addNode("kpi", createAgentNode("kpi"))
    .addNode("risk", createAgentNode("risk"))
    .addNode("synthesis", synthesisNode)
    .addNode("quality", qualityNode)
    .addEdge(START, "refine")
    .addEdge("refine", "market")
    .addEdge("refine", "competitors")
    .addEdge("refine", "product")
    .addEdge("refine", "ux")
    .addEdge("refine", "architecture")
    .addEdge("refine", "database")
    .addEdge("refine", "api")
    .addEdge("refine", "security")
    .addEdge("refine", "roadmap")
    .addEdge("refine", "kpi")
    .addEdge("refine", "risk")
    .addEdge(
      ["market", "competitors", "product", "ux", "architecture", "database", "api", "security", "roadmap", "kpi", "risk"],
      "synthesis",
    )
    .addEdge("synthesis", "quality")
    .addEdge("quality", END);

  return graph.compile();
}

export async function runProductForge(options: RunOptions): Promise<{
  proposal: Proposal;
  agents: AgentResult[];
}> {
  const workflow = buildWorkflow();
  const result = await workflow.invoke({
    input: options.input,
    projectId: options.projectId,
    refinedIdea: "",
    provider: options.provider,
    emit: options.emit,
    agents: [],
    proposal: null,
    startedAt: Date.now(),
  });

  if (!result.proposal) {
    throw new Error("The synthesis agent did not return a proposal.");
  }

  return { proposal: result.proposal, agents: result.agents };
}

export { agentDefinitions, buildFallbackResult, refineIdea, synthesizeProposal };
