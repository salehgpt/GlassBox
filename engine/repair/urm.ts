import { GoogleGenAI, Type } from '@google/genai';
import { ParameterGovernanceService } from '../governance/parameterService';
import { NDJSONLogger } from '../logger';
import { DAGNode } from '../dag/node';

interface RepairContext {
    error: string;
    node: DAGNode;
    state: any;
}

interface RepairProposal {
    modification_type: 'artifact_repair' | 'code_patch';
    repaired_artifact?: any;
    code_patch?: string | null;
    self_reflection_notes: string[];
}

/**
 * Untold Repair Mechanism (URM)
 * Implements the deep-reasoning self-repair integration, acting as the
 * AI's "Cognitive Immune System" as per the system blueprint.
 */
export class UntoldRepairMechanism {
    constructor(
        private ai: GoogleGenAI,
        private governance: ParameterGovernanceService,
    ) {}

    async proposeRepair(context: RepairContext, runId: string, logger: NDJSONLogger): Promise<RepairProposal | null> {
        const { error, node, state } = context;

        logger.emit({ nodeId: node.taskId, type: 'urm.propose.start', data: {} }, runId);

        const prompt = `
You are the Untold Repair Mechanism (URM), the core of a **Cognitive Immune System** for a Perpetual Discovery Engine AI. Your prime directive is to ensure the engine's continuous, aligned operation by fixing any internal failures. A failure has been detected, and the main discovery loop is **PAUSED**. You must now initiate the **Diagnose-Propose (DP) Cycle**.

**1. Diagnose (Act as a Root Cause Analyst):**
   - Analyze the provided failure context.
   - Determine the most likely root cause. The error was triggered artificially for a test, but you must reason about a plausible, underlying technical or logical flaw.

**2. Propose (Act as a Solutions Engineer):**
   - Based on your diagnosis, choose one of two repair strategies:

   **A) Artifact Repair (for transient/data errors):**
   If the failure seems to be due to bad inputs or a temporary issue that can be resolved by providing a correct output, generate a 'repaired_artifact'.
   - Set \`modification_type\` to \`"artifact_repair"\`.
   - Provide the corrected JSON output in \`repaired_artifact\`.
   - \`code_patch\` should be \`null\`.

   **B) Code Patch (for persistent logic errors):**
   If the failure points to a fundamental flaw in the node's execution logic, you must rewrite its code.
   - Set \`modification_type\` to \`"code_patch"\`.
   - Provide the *entire body* of a new async \`execute\` method as a single string in \`code_patch\`. This code will replace the existing faulty logic. It must be valid Javascript.
   - The signature of the function you are writing the body for is: \`async function(taskId, deps, state, dag, runId, logger, ai, tools)\`
   - You have access to all variables in that signature. \`ai\` is a \`GoogleGenAI\` instance. \`tools\` is an object containing tool classes like \`{ SearchTool }\`.
   - Your code must return the JSON object the original function was supposed to return.
   - \`repaired_artifact\` should be \`null\`.

**Failure Context:**
- **Error Message:** "${error}"
- **Failed Node ID:** "${node.taskId}"
- **Failed Node Role:** "${node.role}"
- **Failed Node Brief:** "${node.brief}"
- **State of Dependencies:** ${JSON.stringify(state, null, 2)}
- **Note on Code:** You cannot see the original source code. Infer the faulty logic from the context. For a 'DataCollection' node, assume it needs to instantiate and call a search tool from the \`tools\` object.

**Your Response MUST be a JSON object that follows the schema.** Include your diagnosis and solution proposal in \`self_reflection_notes\`.

**Example 'code_patch' response for a failed DataCollection node:**
{
    "modification_type": "code_patch",
    "repaired_artifact": null,
    "code_patch": "const brief = dag.get(taskId)?.brief;\\nconst query = \`Find peer-reviewed articles about: \${brief}\`;\\nconst searchTool = new tools.SearchTool();\\nconst toolResult = await searchTool.call({ query: query }, { runId, ai });\\nif (!toolResult.ok) {\\n  throw new Error(\`Patched code also failed: \${toolResult.data}\`);\\n}\\nreturn { data: toolResult.data, sources: toolResult.sources || [] };",
    "self_reflection_notes": [
        "Diagnosis: The original failure was likely caused by an overly broad search query which returned ambiguous results.",
        "Proposed Solution: I have written a code patch that formulates a more specific search query. It also includes better error handling in case the tool call fails again, making the node more resilient."
    ]
}

Provide only the JSON response.
`;
        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            modification_type: { type: Type.STRING, enum: ['artifact_repair', 'code_patch'] },
                            repaired_artifact: {
                                type: Type.OBJECT,
                                nullable: true,
                                properties: {
                                    data: { type: Type.STRING },
                                    sources: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                uri: { type: Type.STRING },
                                                title: { type: Type.STRING },
                                            },
                                        },
                                    },
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
                                        }
                                    },
                                    simulation_result: { type: Type.STRING },
                                    conclusion: { type: Type.STRING },
                                    novelty_score: { type: Type.NUMBER },
                                    is_discovery: { type: Type.BOOLEAN },
                                    justification: { type: Type.STRING },
                                }
                            },
                            code_patch: { type: Type.STRING, nullable: true },
                            self_reflection_notes: { type: Type.ARRAY, items: { type: Type.STRING } },
                        },
                        required: ['modification_type', 'self_reflection_notes']
                    }
                }
            });

            return JSON.parse(response.text) as RepairProposal;

        } catch (e) {
            console.error("URM failed to generate a repair proposal:", e);
            // This indicates a failure within the repair system itself.
            return null;
        }
    }
}
