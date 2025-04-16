import { create } from 'zustand';

interface NodeState {
  status: 'idle' | 'running' | 'success' | 'error';
  result?: any;
  error?: string;
}

interface NodeStateStore {
  states: Record<string, NodeState>;
  getNodeState: (nodeId: string) => NodeState;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
}

export const useNodeStateStore = create<NodeStateStore>((set, get) => ({
  states: {},
  
  getNodeState: (nodeId) => {
    return get().states[nodeId] || { status: 'idle' };
  },
  
  setNodeState: (nodeId, state) => {
    set((store) => ({
      states: {
        ...store.states,
        [nodeId]: {
          ...get().getNodeState(nodeId),
          ...state
        }
      }
    }));
  }
}));

export const useNodeState = (nodeId: string) => {
  return useNodeStateStore((state) => state.getNodeState(nodeId));
}; 