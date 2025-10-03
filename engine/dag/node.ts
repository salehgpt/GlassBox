
import { NodeStatus } from '../../types';
import { NDJSONLogger } from '../logger';

export interface Strategy {
  execute(taskId: string, deps: string[], state: Map<string, any>, dag: any, runId: string, logger: NDJSONLogger): Promise<any>;
}

export class DAGNode {
  status: NodeStatus = 'PENDING';

  constructor(
    public taskId: string,
    public role: string,
    public brief: string,
    public strategy: Strategy,
    public dependsOn: string[] = [],
  ) {}

  async execute(state: Map<string, any>, dag: any, runId: string, logger: NDJSONLogger): Promise<any> {
    this.status = 'RUNNING';
    try {
        const result = await this.strategy.execute(this.taskId, this.dependsOn, state, dag, runId, logger);
        const approved = result?.approved ?? true;
        const passed = result?.validation?.passed ?? true;
        this.status = approved && passed ? 'COMPLETED' : 'FAILED';
        return { ...result, taskId: this.taskId, role: this.role, status: this.status };
    } catch (error) {
        console.error(`Error executing node ${this.taskId}:`, error);
        this.status = 'FAILED';
        // Re-throw the error to be caught by the orchestrator for repair
        throw error;
    }
  }
}