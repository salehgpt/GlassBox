

export type SessionStatus = 'IDLE' | 'STARTING' | 'RUNNING' | 'PAUSED' | 'AWAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'STOPPED';

export type MessageRole = 'user' | 'agent' | 'system' | 'thought' | 'repair';

export interface Message {
  id: number;
  role: MessageRole;
  content: string;
  nodeId?: string;
  eventType?: string;
}

export interface Artifact {
  id: string;
  name: string;
  type: 'file' | 'link' | 'log';
  size: string;
  url: string;
}

export interface ApprovalRequest {
  action: string;
  details: string;
}


// Engine Types
export type NDJSONEvent = {
  ts: string;
  runId: string;
  nodeId?: string;
  type: string;
  data: any;
};

export type StrategyId = 'h1' | 'h2' | 'h3' | 'h4' | 'h5';

export interface Hypothesis {
  id: StrategyId;
  statement: string;
}

export interface GoTDecision {
  summary: string;
  chosen: Hypothesis;
  critiques: Record<StrategyId, number>;
  hypotheses: Hypothesis[];
}

export interface DAGTaskDef {
  taskId: string;
  role: string;
  brief: string;
  dependsOn?: string[];
}

export type NodeStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'REPAIRING';

// For DAG visualization
export interface UINode {
    id: string;
    role: string;
    brief: string;
    status: NodeStatus;
    dependsOn: string[];
    output?: any;
    activeTool?: string | null;
}