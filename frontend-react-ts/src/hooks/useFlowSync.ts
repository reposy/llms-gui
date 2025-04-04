import { useEffect } from 'react';
import { Node, Edge, useNodesState, useEdgesState } from 'reactflow';
import { NodeData } from '../types/nodes';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { isEqual } from 'lodash';

interface UseFlowSyncOptions {
  isRestoringHistory: React.MutableRefObject<boolean>;
}

interface UseFlowSyncReturn {
  localNodes: Node<NodeData>[];
  localEdges: Edge[];
  setLocalNodes: React.Dispatch<React.SetStateAction<Node<NodeData>[]>>;
  setLocalEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onLocalNodesChange: (changes: any) => void;
  onLocalEdgesChange: (changes: any) => void;
}

export const useFlowSync = ({ 
  isRestoringHistory 
}: UseFlowSyncOptions): UseFlowSyncReturn => {
  const dispatch = useDispatch();
  
  // Get initial data from Redux
  const initialNodes = useSelector((state: RootState) => state.flow.nodes);
  const initialEdges = useSelector((state: RootState) => state.flow.edges);
  
  // Set up local state with React Flow hooks
  const [localNodes, setLocalNodes, onLocalNodesChange] = useNodesState(initialNodes);
  const [localEdges, setLocalEdges, onLocalEdgesChange] = useEdgesState(initialEdges);
  
  // Sync Redux state -> local state (for initial load or external changes)
  useEffect(() => {
    // Skip if we're currently restoring history to avoid feedback loops
    if (isRestoringHistory.current) return;
    
    if (!isEqual(localNodes, initialNodes)) {
      console.log("[Sync Effect] Updating local nodes from Redux");
      setLocalNodes(initialNodes);
    }
  }, [initialNodes, setLocalNodes, localNodes, isRestoringHistory]);

  useEffect(() => {
    // Skip if we're currently restoring history to avoid feedback loops
    if (isRestoringHistory.current) return;
    
    if (!isEqual(localEdges, initialEdges)) {
      console.log("[Sync Effect] Updating local edges from Redux");
      setLocalEdges(initialEdges);
    }
  }, [initialEdges, setLocalEdges, localEdges, isRestoringHistory]);
  
  return {
    localNodes,
    localEdges,
    setLocalNodes,
    setLocalEdges,
    onLocalNodesChange,
    onLocalEdgesChange
  };
}; 