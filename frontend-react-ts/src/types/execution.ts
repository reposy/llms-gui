export type NodeStatus = 'idle' | 'running' | 'success' | 'error';

export interface ExecutionContext {
  isSubExecution?: boolean;
  triggerNodeId: string;
  executionId: string;
  iterationItem?: any;
  // For foreach iteration tracking
  iterationTracking?: {
    inputNodeId: string;  // ID of the input node doing the iteration
    originalExecutionId: string; // Original execution ID before iteration
    currentIndex: number; // Current iteration index
    totalItems: number;   // Total number of items to iterate over
  };
  
  // Iteration support for foreach/batch control
  executionMode: 'single' | 'foreach' | 'batch'; // Identifies how this node is being executed
  iterationIndex?: number; // Index of current iteration (only set in foreach)
  originalInputLength?: number; // Total number of items in the original input
  inputRows?: any[]; // Full array of inputs in batch mode (used for template resolution or merging)
  
  // Methods
  log: (message: string) => void;
  markNodeRunning: (nodeId: string) => void;
  markNodeSuccess: (nodeId: string, result: any) => void;
  markNodeError: (nodeId: string, error: string) => void;
  storeOutput: (nodeId: string, output: any) => void;
  getOutput: (nodeId: string) => any;
}

// Represents the state of a single node during execution
export interface NodeState {
  status: NodeStatus;
  result: any; // This will hold GroupExecutionItemResult[] for groups
  error?: string;
  executionId?: string;
  lastTriggerNodeId?: string;
  activeOutputHandle?: string;
  conditionResult?: boolean;
  _lastUpdate?: number;
  
  // Iteration metadata
  iterationIndex?: number;
  iterationTotal?: number;
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

// Result type for conditional node execution
export interface ConditionalExecutionResult {
  outputHandle: 'trueHandle' | 'falseHandle';
  value: any; // The value to pass through to downstream nodes
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