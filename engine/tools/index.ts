import { GoogleGenAI } from '@google/genai';

export interface ToolContext {
  runId: string;
  ai: GoogleGenAI;
}
export interface ToolInput {
  query: string;
}
export interface ToolResult {
  ok: boolean;
  data: any;
  sources?: { uri: string; title: string }[];
}

export interface Tool {
  name: string;
  description: string;
  call(input: ToolInput, ctx: ToolContext): Promise<ToolResult>;
}
