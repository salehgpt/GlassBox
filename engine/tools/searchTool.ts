import type { Tool, ToolInput, ToolContext, ToolResult } from './index';

export class SearchTool implements Tool {
  name = 'search';
  description = 'Performs a web search using Google Search grounding to find up-to-date information.';

  async call(input: ToolInput, ctx: ToolContext): Promise<ToolResult> {
    try {
      const response = await ctx.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: input.query,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const sources = groundingMetadata?.groundingChunks
        ?.map((chunk: any) => chunk.web)
        .filter(Boolean) || [];

      return {
        ok: true,
        data: response.text,
        sources: sources,
      };
    } catch (error) {
      console.error('Error using SearchTool:', error);
      return { ok: false, data: 'Failed to perform search.' };
    }
  }
}
