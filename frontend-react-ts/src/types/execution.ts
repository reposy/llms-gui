export interface ExecutionContext {
  isSubExecution?: boolean;
  triggerNodeId: string;
  executionId: string;
  iterationItem?: any;
}

// Represents the state of a single node during execution
export interface NodeState {
  status: 'idle' | 'running' | 'success' | 'error' | 'skipped';
  result: any; // This will hold GroupExecutionItemResult[] for groups
  error?: string;
  _lastUpdate?: number;
  executionId?: string;
  lastTriggerNodeId?: string;
  activeOutputHandle?: 'trueHandle' | 'falseHandle';
  conditionResult?: boolean;
}

// Represents the results for a single item processed by a group
export interface GroupExecutionItemResult {
  item: any; // The input item
  nodeResults: Record<string, any>; // Results of each node within the group for this item { nodeId: result }
  finalOutput: any; // Final output(s) of the group for this item (e.g., from leaf node)
  conditionalBranch?: 'true' | 'false'; // Branch taken if a conditional node was present
  status: 'success' | 'error';
  error?: string;
}

// Default state for a node before any execution
export const defaultNodeState: NodeState = {
  status: 'idle',
  result: null,
  error: undefined,
  _lastUpdate: 0,
  executionId: undefined,
  lastTriggerNodeId: undefined,
  activeOutputHandle: undefined,
  conditionResult: undefined,
}; 