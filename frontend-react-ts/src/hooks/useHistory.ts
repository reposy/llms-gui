import { useCallback, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import { cloneDeep } from 'lodash';
import { NodeData } from '../types/nodes';
import { setNodes as setZustandNodes, setEdges as setZustandEdges } from '../store/useFlowStructureStore';

// Type for history stack item
interface HistoryItem {
  nodes: Node<NodeData>[];
  edges: Edge[];
}

interface UseHistoryOptions {
  initialNodes: Node<NodeData>[];
  initialEdges: Edge[];
  maxHistorySize?: number;
}

interface UseHistoryReturn {
  pushToHistory: (nodes: Node<NodeData>[], edges: Edge[]) => void;
  undo: () => void;
  redo: () => void;
  isRestoringHistory: React.MutableRefObject<boolean>;
  historyIndex: React.MutableRefObject<number>;
  history: React.MutableRefObject<HistoryItem[]>;
}

export const useHistory = (
  { initialNodes, initialEdges, maxHistorySize = 50 }: UseHistoryOptions,
  setLocalNodes: (nodes: Node<NodeData>[]) => void,
  setLocalEdges: (edges: Edge[]) => void
): UseHistoryReturn => {
  // Initialize history stack with initial state
  const history = useRef<HistoryItem[]>([{ 
    nodes: cloneDeep(initialNodes), 
    edges: cloneDeep(initialEdges) 
  }]);
  const historyIndex = useRef<number>(0);
  const isRestoringHistory = useRef<boolean>(false);

  // Push current state to history
  const pushToHistory = useCallback((nodesToSave: Node<NodeData>[], edgesToSave: Edge[]) => {
    console.log("[History] Pushing state:", { nodes: nodesToSave.length, edges: edgesToSave.length });
    historyIndex.current += 1;
    // Remove any future states if we branch off
    history.current.splice(historyIndex.current);
    // Push deep copies to prevent mutation issues
    history.current.push({ nodes: cloneDeep(nodesToSave), edges: cloneDeep(edgesToSave) });
    // Limit history size
    if (history.current.length > maxHistorySize) {
      history.current.shift();
      historyIndex.current -= 1;
    }
    console.log("[History] New index:", historyIndex.current, "Stack size:", history.current.length);
  }, [maxHistorySize]);

  // Undo to previous state
  const undo = useCallback(() => {
    if (historyIndex.current <= 0) {
      console.log("[History] Cannot undo: at beginning of history.");
      return;
    }

    historyIndex.current -= 1;
    const prevState = history.current[historyIndex.current];
    console.log('Undoing to index:', historyIndex.current, "State:", prevState);

    isRestoringHistory.current = true;
    // Set local state
    setLocalNodes(prevState.nodes);
    setLocalEdges(prevState.edges);
    // Also update Zustand state
    setZustandNodes(prevState.nodes);
    setZustandEdges(prevState.edges);
    // Reset the flag after the state updates have likely processed
    setTimeout(() => { isRestoringHistory.current = false; }, 0);
  }, [setLocalNodes, setLocalEdges]);

  // Redo to next state
  const redo = useCallback(() => {
    if (historyIndex.current >= history.current.length - 1) {
      console.log("[History] Cannot redo: at end of history.");
      return;
    }

    historyIndex.current += 1;
    const nextState = history.current[historyIndex.current];
    console.log('Redoing to index:', historyIndex.current, "State:", nextState);

    isRestoringHistory.current = true;
    // Set local state
    setLocalNodes(nextState.nodes);
    setLocalEdges(nextState.edges);
    // Also update Zustand state
    setZustandNodes(nextState.nodes);
    setZustandEdges(nextState.edges);
    // Reset the flag after the state updates have likely processed
    setTimeout(() => { isRestoringHistory.current = false; }, 0);
  }, [setLocalNodes, setLocalEdges]);

  return { 
    pushToHistory, 
    undo, 
    redo, 
    isRestoringHistory,
    historyIndex,
    history
  };
}; 