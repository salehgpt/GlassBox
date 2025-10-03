import { GoogleGenAI, Type } from '@google/genai';
import { Hypothesis, GoTDecision, StrategyId } from '../../types';

export class GoTReasoner {
  constructor(private ai: GoogleGenAI) {}

  private async generateHypotheses(ctx: string): Promise<Hypothesis[]> {
    const prompt = `Given the goal "${ctx}", generate exactly 5 distinct, strategic hypotheses to achieve it. Each hypothesis should be a concise, actionable statement.`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hypotheses: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: 'A unique identifier, e.g., "h1", "h2".' },
                    statement: { type: Type.STRING, description: 'The strategic statement.' },
                  },
                  required: ['id', 'statement'],
                },
              },
            },
            required: ['hypotheses'],
          },
        },
      });

      const result = JSON.parse(response.text);
      // Ensure we have exactly 5, and they have the correct IDs
      return result.hypotheses.slice(0, 5).map((h: any, i: number) => ({
          ...h,
          id: `h${i+1}` as StrategyId
      }));
    } catch (error) {
      console.error("Error generating hypotheses, falling back to stub.", error);
      // Fallback to stubbed data on API error
      return [
        { id: 'h1', statement: 'Aggressive Shutdown: maximize safety, halt ops early.' },
        { id: 'h2', statement: 'Flexible Response: staged remote-work and shutdown.' },
        { id: 'h3', statement: 'Minimal Disruption: maintain ops until official orders.' },
        { id: 'h4', statement: 'Regional Split: at-risk sites switch remote; others continue.' },
        { id: 'h5', statement: 'Data-First: prioritize infra backups; stagger people operations.' },
      ];
    }
  }

  private async critique(hypotheses: Hypothesis[]): Promise<Record<StrategyId, number>> {
    const prompt = `Critique the following 5 strategic hypotheses and assign a score from 0.0 to 1.0 for each, where 1.0 is the best. Consider feasibility, safety, and efficiency.
    
    Hypotheses:
    ${hypotheses.map(h => `${h.id}: ${h.statement}`).join('\n')}
    
    Return a JSON object with keys "h1" through "h5" and their corresponding numeric scores.`;

    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        h1: { type: Type.NUMBER },
                        h2: { type: Type.NUMBER },
                        h3: { type: Type.NUMBER },
                        h4: { type: Type.NUMBER },
                        h5: { type: Type.NUMBER },
                    },
                    required: ['h1', 'h2', 'h3', 'h4', 'h5'],
                }
            }
        });

        const result = JSON.parse(response.text);
        return result;
    } catch (error) {
        console.error("Error critiquing hypotheses, falling back to stub.", error);
        return { h1: 0.7, h2: 0.95, h3: 0.3, h4: 0.85, h5: 0.88 };
    }
  }

  async decide(ctx: string): Promise<GoTDecision> {
    const hypotheses = await this.generateHypotheses(ctx);
    if (hypotheses.length === 0) {
        throw new Error("Failed to generate any hypotheses.");
    }
    const critiques = await this.critique(hypotheses);
    
    const bestId = (Object.keys(critiques) as StrategyId[]).reduce(
        (a, b) => (critiques[a] >= critiques[b] ? a : b)
    );
    
    const chosen = hypotheses.find(h => h.id === bestId)!;
    
    return {
      summary: `Based on the context, the chosen strategy is: '${chosen.statement}'`,
      chosen,
      critiques,
      hypotheses,
    };
  }
}