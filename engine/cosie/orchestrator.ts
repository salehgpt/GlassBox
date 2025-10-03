import { GoogleGenAI, Type } from '@google/genai';
import { HybridDynamicGraphDAG } from '../dag/dag';
import { DAGNode, Strategy } from '../dag/node';
import { NDJSONLogger } from '../logger';
import { SearchTool } from '../tools/searchTool';
import { Tool } from '../tools';
import { UntoldRepairMechanism } from '../repair/urm';
import { ParameterGovernanceService } from '../governance/parameterService';

const EUREKA_THRESHOLD = 0.75; // Novelty score required to trigger validation
const MAX_LOOPS = 5; // Safety break for the discovery loop

// --- DISCOVERY ENGINE STRATEGIES ---

class HypothesisStrategy implements Strategy {
  constructor(private ai: GoogleGenAI) {}
  async execute(taskId: string, deps: string[], state: Map<string, any>, dag: any, runId: string, logger: NDJSONLogger) {
    const domain = state.get('domain');
    const gkg = state.get('gkg') || 'No knowledge yet.';
    const prompt = `
    You are a creative researcher in a Perpetual Discovery Engine.
    Your prime directive is to generate novel hypotheses.
    The discovery domain is: "${domain}".
    Current knowledge base: "${gkg}".
    
    Based on the gaps or contradictions in the current knowledge, generate a single, novel, and testable hypothesis. The hypothesis should be a concise statement that can be investigated. Avoid repeating previous hypotheses.
    `;
    const response = await this.ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return { hypothesis: response.text.trim() };
  }
}

class ExperimentDesignStrategy implements Strategy {
    constructor(private ai: GoogleGenAI) {}
    async execute(taskId: string, deps: string[], state: Map<string, any>, dag: any, runId: string, logger: NDJSONLogger) {
        const hypothesisNodeId = deps[0];
        const hypothesis = state.get(hypothesisNodeId).hypothesis;

        const prompt = `
        You are an experimental designer in a Perpetual Discovery Engine.
        Your task is to design a simple, executable experiment to test a hypothesis.
        The experiment will be a small DAG of 1-3 tasks.
        The available task roles are: 'DataCollection' (uses a search tool), 'Simulation' (uses pure reasoning to predict outcomes), 'CrossReference' (compares data from multiple sources).
        
        Hypothesis to test: "${hypothesis}"

        Generate a JSON object containing a "tasks" array. Each task needs a unique taskId (e.g., E1-T1, E1-T2), role, a brief description, and its dependencies within this experiment. The first task should not have dependencies.
        Example:
        {
          "tasks": [
            { "taskId": "E1-T1", "role": "DataCollection", "brief": "Search for existing data on topic X.", "dependsOn": [] },
            { "taskId": "E1-T2", "role": "Simulation", "brief": "Simulate the effect of Y based on data from E1-T1.", "dependsOn": ["E1-T1"] }
          ]
        }
        `;
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        tasks: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    taskId: { type: Type.STRING },
                                    role: { type: Type.STRING },
                                    brief: { type: Type.STRING },
                                    dependsOn: { type: Type.ARRAY, items: { type: Type.STRING } }
                                },
                                required: ['taskId', 'role', 'brief']
                            }
                        }
                    },
                    required: ['tasks']
                }
            }
        });
        const plan = JSON.parse(response.text);
        plan.tasks.forEach((task: any) => {
            if (!task.dependsOn) task.dependsOn = [];
        });
        return plan;
    }
}

class DataCollectionStrategy implements Strategy {
    constructor(private ai: GoogleGenAI, private tool: Tool) {}
    async execute(taskId: string, deps: string[], state: Map<string, any>, dag: any, runId: string, logger: NDJSONLogger) {
        const goal = state.get('domain');
        const brief = dag.get(taskId)?.brief;
        
        const hypothesisNodeId = deps.find(id => id.startsWith('H'));
        const hypothesisState = hypothesisNodeId ? state.get(hypothesisNodeId) : null;
        if (!hypothesisState || !hypothesisState.hypothesis) {
            throw new Error(`Could not find parent hypothesis state for node ${taskId}`);
        }
        const hypothesisText = hypothesisState.hypothesis;
        
        const deliberationPrompt = `For the overall goal "${goal}", under the hypothesis "${hypothesisText}", and for the specific task "${brief}", what is the best search query to execute?`;
        
        const queryResponse = await this.ai.models.generateContent({ model: 'gemini-2.5-flash', contents: deliberationPrompt });
        const searchQuery = queryResponse.text.trim();
        
        logger.emit({ nodeId: taskId, type: 'dag.node.tool.start', data: { name: this.tool.name, input: searchQuery } }, runId);
        const toolResult = await this.tool.call({ query: searchQuery }, { runId, ai: this.ai });
        logger.emit({ nodeId: taskId, type: 'dag.node.tool.result', data: { name: this.tool.name, output: toolResult } }, runId);
        
        if (!toolResult.ok) throw new Error(`Tool ${this.tool.name} failed: ${toolResult.data}`);
        
        return { data: toolResult.data, sources: toolResult.sources || [] };
    }
}

class SimulationStrategy implements Strategy {
    constructor(private ai: GoogleGenAI) {}
    async execute(taskId: string, deps: string[], state: Map<string, any>, dag: any, runId: string, logger: NDJSONLogger) {
        const hypothesisNodeId = deps.find(id => id.startsWith('H'));
        const hypothesisState = hypothesisNodeId ? state.get(hypothesisNodeId) : null;
        if (!hypothesisState || !hypothesisState.hypothesis) {
            throw new Error(`Could not find parent hypothesis state for node ${taskId}`);
        }
        const hypothesis = hypothesisState.hypothesis;
        const brief = dag.get(taskId)?.brief;
        const collectedData = deps.map(depId => JSON.stringify(state.get(depId))).join('\n');
        
        const prompt = `
        Run a pure-thinking simulation.
        Hypothesis: "${hypothesis}"
        Task: "${brief}"
        Available Data: ${collectedData}
        
        Based on the data, what is the logical conclusion or predicted outcome of this simulation?
        `;
        const response = await this.ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return { simulation_result: response.text.trim() };
    }
}

class AnalysisStrategy implements Strategy {
    constructor(private ai: GoogleGenAI) {}
    async execute(taskId: string, deps: string[], state: Map<string, any>, dag: any, runId: string, logger: NDJSONLogger) {
        const hypothesisNodeId = deps.find(id => id.startsWith('H'));
        const hypothesisState = hypothesisNodeId ? state.get(hypothesisNodeId) : null;
        if (!hypothesisState || !hypothesisState.hypothesis) {
            throw new Error(`Could not find parent hypothesis state for node ${taskId}`);
        }
        const hypothesis = hypothesisState.hypothesis;
        const experimentResults = deps.filter(id => id.startsWith('E')).map(depId => `Result from ${depId}: ${JSON.stringify(state.get(depId))}`).join('\n');
        
        const prompt = `
        Analyze the results of an experiment.
        Hypothesis: "${hypothesis}"
        Experiment Results:
        ${experimentResults}

        1.  Did the results confirm, refute, or are they inconclusive regarding the hypothesis?
        2.  Most importantly, calculate a 'novelty score' from 0.0 to 1.0, where 1.0 means the result was completely unexpected and surprising given general knowledge.
        
        Return a JSON object with keys "conclusion" (string) and "novelty_score" (number).
        `;
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        conclusion: { type: Type.STRING },
                        novelty_score: { type: Type.NUMBER },
                    },
                    required: ['conclusion', 'novelty_score'],
                }
            }
        });
        return JSON.parse(response.text);
    }
}

class ValidationStrategy implements Strategy {
    constructor(private ai: GoogleGenAI) {}
    async execute(taskId: string, deps: string[], state: Map<string, any>, dag: any, runId: string, logger: NDJSONLogger) {
        const hypothesisNodeId = deps.find(id => id.startsWith('H'));
        const hypothesisState = hypothesisNodeId ? state.get(hypothesisNodeId) : null;
        if (!hypothesisState || !hypothesisState.hypothesis) {
            throw new Error(`Could not find parent hypothesis state for node ${taskId}`);
        }
        const hypothesis = hypothesisState.hypothesis;
        
        const analysisNodeId = deps.find(id => id.startsWith('A'));
        if (!analysisNodeId) {
            throw new Error(`Could not find parent analysis node for validation node ${taskId}`);
        }
        const analysis = state.get(analysisNodeId);
        if (!analysis) {
            throw new Error(`Could not find state for analysis node ${analysisNodeId}`);
        }
        
        const prompt = `
        A potential discovery has been made with a high novelty score. As the final arbiter, you must validate it.
        Hypothesis: "${hypothesis}"
        Analysis Conclusion: "${analysis.conclusion}"
        Novelty Score: ${analysis.novelty_score}

        Does this constitute a "Eureka" moment? Is it truly novel and significant enough to be considered a discovery and halt the engine?
        Return a JSON object with keys "is_discovery" (boolean) and "justification" (string).
        `;
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        is_discovery: { type: Type.BOOLEAN },
                        justification: { type: Type.STRING },
                    },
                    required: ['is_discovery', 'justification'],
                }
            }
        });
        return JSON.parse(response.text);
    }
}

// --- ORCHESTRATOR ---

export class COSIEOrchestrator {
  private isStopped = false;
  private governance = new ParameterGovernanceService();
  private urm: UntoldRepairMechanism;
  private repairAttempts = new Map<string, number>();

  constructor(private logger: NDJSONLogger, private ai: GoogleGenAI) {
    this.urm = new UntoldRepairMechanism(this.ai, this.governance);
  }

  stop() {
    this.isStopped = true;
  }

  private getRelevantState(depIds: string[], fullState: Map<string, any>): any {
    const relevantState: { [key: string]: any } = {};
    depIds.forEach(id => {
        if (fullState.has(id)) {
            relevantState[id] = fullState.get(id);
        }
    });
    return relevantState;
  }
  
  private async executeNode(node: DAGNode, state: Map<string, any>, dag: HybridDynamicGraphDAG, runId: string) {
      if (this.isStopped) return;
      
      this.logger.emit({ nodeId: node.taskId, type: 'dag.node.start', data: { role: node.role, brief: node.brief } }, runId);
      
      const executeAndHandleResult = async () => {
        // Artificial failure trigger for demonstration
        if (node.brief.toUpperCase().includes('FAIL')) {
            throw new Error(`Artificial failure triggered for node ${node.taskId}.`);
        }
        const res = await node.execute(state, dag, runId, this.logger);
        state.set(node.taskId, res);
        this.logger.emit({ nodeId: node.taskId, type: 'dag.node.result', data: res }, runId);
        if (node.status === 'FAILED') {
            throw new Error(`Node ${node.taskId} (${node.role}) failed during execution.`);
        }
      };

      try {
        await executeAndHandleResult();
      } catch (error) {
        console.warn(`Node ${node.taskId} failed. Initiating Cognitive Immune System. Error:`, error);
        
        // --- PAUSE & REPORT ---
        const attempts = this.repairAttempts.get(node.taskId) || 0;
        if (attempts >= this.governance.MAX_REPAIR_ATTEMPTS) {
            this.logger.emit({ nodeId: node.taskId, type: 'urm.failed.permanent', data: { reason: 'Max repair attempts reached' } }, runId);
            node.status = 'FAILED';
            this.logger.emit({ nodeId: node.taskId, type: 'dag.node.status.update', data: { status: 'FAILED' } }, runId);
            throw error;
        }
        this.repairAttempts.set(node.taskId, attempts + 1);

        this.logger.emit({ nodeId: node.taskId, type: 'dag.node.status.update', data: { status: 'REPAIRING' } }, runId);
        this.logger.emit({ nodeId: node.taskId, type: 'urm.start', data: { message: 'Cognitive Immune System activated.' } }, runId);

        const repairContext = {
            error: error instanceof Error ? error.message : String(error),
            node,
            state: this.getRelevantState(node.dependsOn, state),
        };
        
        // --- DPVA Cycle (Diagnose, Propose) ---
        const repairProposal = await this.urm.proposeRepair(repairContext, runId, this.logger);

        if (!repairProposal) {
             this.logger.emit({ nodeId: node.taskId, type: 'urm.failed', data: { justification: ["The URM itself failed to generate a proposal."] } }, runId);
             node.status = 'FAILED';
             this.logger.emit({ nodeId: node.taskId, type: 'dag.node.status.update', data: { status: 'FAILED' } }, runId);
             throw new Error(`Self-repair for node ${node.taskId} failed at proposal stage.`);
        }

        // --- DPVA Cycle (Vet) ---
        this.logger.emit({ nodeId: node.taskId, type: 'urm.vet.start', data: { message: 'Submitting repair to Governance Layer for approval.' } }, runId);
        const vettingResult = this.governance.vetRepairProposal(repairProposal);

        if (!vettingResult.approved) {
            this.logger.emit({ nodeId: node.taskId, type: 'urm.failed', data: { justification: [`VETOED: ${vettingResult.comment}`] } }, runId);
            node.status = 'FAILED';
            this.logger.emit({ nodeId: node.taskId, type: 'dag.node.status.update', data: { status: 'FAILED' } }, runId);
            throw new Error(`Self-repair for node ${node.taskId} was vetoed by governance.`);
        }
        this.logger.emit({ nodeId: node.taskId, type: 'urm.vet.success', data: { message: 'Repair proposal approved by Governance.' } }, runId);

        // --- DPVA Cycle (Apply & Resume) ---
        if (repairProposal.modification_type === 'code_patch' && repairProposal.code_patch) {
            this.logger.emit({ nodeId: node.taskId, type: 'urm.apply.code_patch', data: { code_patch: repairProposal.code_patch, justification: repairProposal.self_reflection_notes } }, runId);
            try {
                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                const toolClasses = { SearchTool }; // Provide tool classes to the dynamic function's scope
                
                const patchedExecute = new AsyncFunction('taskId', 'deps', 'state', 'dag', 'runId', 'logger', 'ai', 'tools', repairProposal.code_patch);
                
                // Re-bind the strategy's execute method to our new dynamic function, injecting the required scope.
                node.strategy.execute = (taskId, deps, state, dag, runId, logger) => 
                    patchedExecute(taskId, deps, state, dag, runId, logger, this.ai, toolClasses);

                // Resume by retrying the node's execution with the new code
                this.logger.emit({ nodeId: node.taskId, type: 'urm.success', data: { message: 'Code patched. Retrying node execution.' } }, runId);
                node.status = 'PENDING'; // Reset status before retry
                await executeAndHandleResult(); // This re-run will be caught by the outer loop's try/catch if it fails again
            } catch (patchError) {
                this.logger.emit({ nodeId: node.taskId, type: 'urm.failed', data: { justification: ["The agent's self-written code patch failed on execution."] } }, runId);
                node.status = 'FAILED';
                this.logger.emit({ nodeId: node.taskId, type: 'dag.node.status.update', data: { status: 'FAILED' } }, runId);
                throw new Error(`Failed to execute self-generated patch for node ${node.taskId}.`);
            }
        } else { // Artifact Repair
            this.logger.emit({ nodeId: node.taskId, type: 'urm.success', data: {} }, runId);
            const finalResult = { 
                ...(repairProposal.repaired_artifact || {}),
                taskId: node.taskId, 
                role: node.role, 
                status: 'COMPLETED',
                repaired: true,
            };

            state.set(node.taskId, finalResult);
            node.status = 'COMPLETED';
            this.logger.emit({ nodeId: node.taskId, type: 'dag.node.result', data: finalResult }, runId);
        }
      }
  }

  async run(domain: string, runId: string) {
    this.isStopped = false;
    const dag = new HybridDynamicGraphDAG();
    const state = new Map<string, any>();
    state.set('domain', domain);
    state.set('gkg', '');
    this.repairAttempts.clear();

    this.logger.emit({ type: 'cosie.start', data: { goal: `${domain}` } }, runId);

    let eurekaFound = false;
    let discoveryReport: any = null;

    for (let i = 0; i < MAX_LOOPS; i++) {
        if (this.isStopped) {
            this.logger.emit({ type: 'cosie.stopped', data: { comment: 'Discovery loop stopped by user.' } }, runId);
            return;
        }

        const loopId = i + 1;

        // 1. Hypothesize
        const hypoNode = new DAGNode(`H${loopId}`, 'Hypothesize', `Generate hypothesis for domain`, new HypothesisStrategy(this.ai));
        dag.add(hypoNode);
        await this.executeNode(hypoNode, state, dag, runId);
        
        // 2. Experiment Design
        const designNode = new DAGNode(`D${loopId}`, 'ExperimentDesign', `Design experiment for H${loopId}`, new ExperimentDesignStrategy(this.ai), [`H${loopId}`]);
        dag.add(designNode);
        await this.executeNode(designNode, state, dag, runId);
        
        const experimentPlan = state.get(designNode.taskId);
        if (!experimentPlan.tasks || experimentPlan.tasks.length === 0) continue;

        const experimentNodes: DAGNode[] = [];
        for (const task of experimentPlan.tasks) {
            let strat: Strategy;
            // The dependencies need to be relative to the current experiment
            const absoluteDeps = task.dependsOn.map((dep: string) => dep).concat(designNode.taskId, hypoNode.taskId);
            
            // Allow the user prompt to inject the failure condition
            const briefWithFailure = domain.toUpperCase().includes("FAIL DURING THE DATA COLLECTION") && task.role === 'DataCollection'
                ? `${task.brief} FAIL`
                : task.brief;

            switch(task.role) {
                case 'DataCollection': strat = new DataCollectionStrategy(this.ai, new SearchTool()); break;
                case 'Simulation': strat = new SimulationStrategy(this.ai); break;
                case 'CrossReference': strat = new SimulationStrategy(this.ai); break; // Using Simulation as a stand-in
                default: strat = new SimulationStrategy(this.ai);
            }
            const expNode = new DAGNode(task.taskId, task.role, briefWithFailure, strat, absoluteDeps);
            dag.add(expNode);
            experimentNodes.push(expNode);
        }

        // 3. Execute Experiment
        let runnable = dag.runnable();
        while(runnable.length > 0) {
            if (this.isStopped) {
              this.logger.emit({ type: 'cosie.stopped', data: { comment: 'Discovery loop stopped by user.' } }, runId);
              return;
            }
            await Promise.all(runnable.map(node => this.executeNode(node, state, dag, runId)));
            runnable = dag.runnable();
        }
        
        // 4. Analyze
        const analysisDeps = experimentNodes.map(n => n.taskId).concat(hypoNode.taskId);
        const analysisNode = new DAGNode(`A${loopId}`, 'Analyze', `Analyze results for H${loopId}`, new AnalysisStrategy(this.ai), analysisDeps);
        dag.add(analysisNode);
        await this.executeNode(analysisNode, state, dag, runId);
        
        const analysisResult = state.get(analysisNode.taskId);
        const newKnowledge = `Hypothesis: ${state.get(hypoNode.taskId).hypothesis}. Conclusion: ${analysisResult.conclusion}.`;
        state.set('gkg', state.get('gkg') + `\n- ${newKnowledge}`);

        // 5. Validate if novelty is high
        if (analysisResult.novelty_score > EUREKA_THRESHOLD) {
            const validationNode = new DAGNode(`V${loopId}`, 'Validate', `Validate potential discovery from H${loopId}`, new ValidationStrategy(this.ai), [analysisNode.taskId, hypoNode.taskId]);
            dag.add(validationNode);
            await this.executeNode(validationNode, state, dag, runId);

            const validationResult = state.get(validationNode.taskId);
            if (validationResult.is_discovery) {
                eurekaFound = true;
                discoveryReport = {
                    hypothesis: state.get(hypoNode.taskId).hypothesis,
                    ...analysisResult,
                    ...validationResult
                };
                break; // Exit the discovery loop
            }
        }
    }

    const finalMessage = eurekaFound
      ? `!!! EUREKA !!! A discovery has been made in the domain of "${domain}".\n\n**Hypothesis:** ${discoveryReport.hypothesis}\n**Conclusion:** ${discoveryReport.conclusion}\n**Justification:** ${discoveryReport.justification}`
      : `The discovery engine completed ${MAX_LOOPS} cycles without a breakthrough. The final knowledge base has been updated.`;

    this.logger.emit({ type: 'cosie.done', data: { approved: eurekaFound, comment: eurekaFound ? "Discovery Validated" : "No discovery found", finalMessage } }, runId);
  }
}
