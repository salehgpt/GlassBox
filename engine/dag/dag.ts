
import { DAGNode } from './node';

export class HybridDynamicGraphDAG {
  nodes = new Map<string, DAGNode>();

  add(node: DAGNode) {
    this.nodes.set(node.taskId, node);
  }

  get(taskId: string) {
    return this.nodes.get(taskId);
  }

  runnable(): DAGNode[] {
    return Array.from(this.nodes.values()).filter(n => 
        n.status === 'PENDING' && 
        (n.dependsOn ?? []).every(depId => this.nodes.get(depId)?.status === 'COMPLETED')
    );
  }
}
