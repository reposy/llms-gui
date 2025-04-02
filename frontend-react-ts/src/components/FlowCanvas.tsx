import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  Connection,
  addEdge,
  Node,
  NodeChange,
  EdgeChange,
  Edge,
  useReactFlow,
  Panel,
  Viewport,
  applyEdgeChanges,
  applyNodeChanges,
  getConnectedEdges,
  getNodesBounds,
  GetViewport,
  useNodesState,
  useEdgesState,
  XYPosition,
  NodeDragHandler,
  ReactFlowInstance,
  isNode,
} from 'reactflow';
import { useDispatch, useSelector } from 'react-redux';
import 'reactflow/dist/style.css';
import { isEqual } from 'lodash';

import LLMNode from './nodes/LLMNode';
import APINode from './nodes/APINode';
import OutputNode from './nodes/OutputNode';
import JSONExtractorNode from './nodes/JSONExtractorNode';
import InputNode from './nodes/InputNode';
import GroupNode from './nodes/GroupNode';
import ConditionalNode from './nodes/ConditionalNode';
import MergerNode from './nodes/MergerNode';
import { NodeData, NodeType, InputNodeData, GroupNodeData } from '../types/nodes';
import { RootState } from '../store/store';
import { setNodes, setEdges, addNode, updateNodeData } from '../store/flowSlice';

// Custom wrapper to remove default React Flow node styling
const NodeWrapper = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: 'relative' }} className="react-flow__node">
    {children}
  </div>
);

// Override default node styles completely
const nodeTypes = {
  llm: (props: any) => (
    <NodeWrapper>
      <LLMNode {...props} />
    </NodeWrapper>
  ),
  api: (props: any) => (
    <NodeWrapper>
      <APINode {...props} />
    </NodeWrapper>
  ),
  output: (props: any) => (
    <NodeWrapper>
      <OutputNode {...props} />
    </NodeWrapper>
  ),
  'json-extractor': (props: any) => (
    <NodeWrapper>
      <JSONExtractorNode {...props} />
    </NodeWrapper>
  ),
  input: (props: any) => (
    <NodeWrapper>
      <InputNode {...props} />
    </NodeWrapper>
  ),
  group: GroupNode,
  conditional: (props: any) => (
    <NodeWrapper>
      <ConditionalNode {...props} />
    </NodeWrapper>
  ),
  merger: (props: any) => (
    <NodeWrapper>
      <MergerNode {...props} />
    </NodeWrapper>
  ),
};

interface FlowCanvasProps {
  onNodeSelect: (node: Node | null) => void;
}

const defaultViewport = { x: 0, y: 0, zoom: 1 };

// Type for clipboard
interface CopiedData {
  nodes: Node<NodeData>[];
  edges: Edge[];
}

// Type for history stack item
interface HistoryItem {
  nodes: Node<NodeData>[];
  edges: Edge[];
}

export const FlowCanvas = React.memo(({ onNodeSelect }: FlowCanvasProps) => {
  const dispatch = useDispatch();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const nodes = useSelector((state: RootState) => state.flow.nodes);
  const edges = useSelector((state: RootState) => state.flow.edges);
  const { project, getNodes, getEdges, setNodes: rfSetNodes, setEdges: rfSetEdges, getViewport: rfGetViewport } = useReactFlow();

  // State for clipboard and history
  const clipboard = useRef<CopiedData | null>(null);
  const history = useRef<HistoryItem[]>([]);
  const historyIndex = useRef<number>(-1);
  const ignoreHistoryUpdate = useRef<boolean>(false);

  // Initialize history on mount
  useEffect(() => {
    if (history.current.length === 0) {
      history.current.push({ nodes: getNodes(), edges: getEdges() });
      historyIndex.current = 0;
      console.log('History initialized.');
    }
  }, [getNodes, getEdges]); // Should only run once

  // --- MOVE Helper Function and Paste Handler HERE --- 
  // Helper function to clone a node with a new unique id and offset position
  const cloneNodeWithNewId = (node: Node<NodeData>): Node<NodeData> => ({
    ...node,
    id: crypto.randomUUID(), // Use built-in crypto API
    position: { x: node.position.x + 50, y: node.position.y + 50 }, // Adjust offset as needed
    data: { ...node.data } // Shallow copy is usually fine for data
  });

  // --- History Management (Declare before usage in other callbacks) ---
  const pushToHistory = useCallback((nodesToSave: Node[], edgesToSave: Edge[]) => {
    // Clear redo stack
    if (historyIndex.current < history.current.length - 1) {
      history.current.splice(historyIndex.current + 1);
    }
    // Push new state
    history.current.push({ nodes: nodesToSave, edges: edgesToSave });
    // Limit history size (e.g., 50 steps)
    if (history.current.length > 50) {
      history.current.shift();
    }
    historyIndex.current = history.current.length - 1;
    console.log('History pushed. Index:', historyIndex.current, 'Size:', history.current.length);
  }, []); // Empty dependency array as it doesn't depend on external state/props

  const undo = useCallback(() => {
    if (historyIndex.current <= 0) return;

    if (historyIndex.current === history.current.length - 1) {
       pushToHistory(getNodes(), getEdges());
       historyIndex.current = historyIndex.current - 1; 
    }
    
    historyIndex.current -= 1;
    const prevState = history.current[historyIndex.current];
    console.log('Undoing to index:', historyIndex.current);
    ignoreHistoryUpdate.current = true;
    dispatch(setNodes(prevState.nodes));
    ignoreHistoryUpdate.current = true;
    dispatch(setEdges(prevState.edges));
  }, [dispatch, getNodes, getEdges, pushToHistory]);

  const redo = useCallback(() => {
    if (historyIndex.current >= history.current.length - 1) return;

    historyIndex.current += 1;
    const nextState = history.current[historyIndex.current];
    console.log('Redoing to index:', historyIndex.current);
    ignoreHistoryUpdate.current = true;
    dispatch(setNodes(nextState.nodes));
    ignoreHistoryUpdate.current = true;
    dispatch(setEdges(nextState.edges));
  }, [dispatch]);

  // --- Paste Handler Definition (Uses pushToHistory, cloneNodeWithNewId) ---
  const handlePaste = useCallback(() => {
    if (!clipboard.current) return;
    const idMap = new Map<string, string>();
    const newNodes = clipboard.current.nodes.map(node => {
      const newNode = cloneNodeWithNewId(node);
      idMap.set(node.id, newNode.id);
      return newNode;
    });
    const newEdges = clipboard.current.edges.map(edge => ({
      ...edge,
      id: `edge-${crypto.randomUUID()}`,
      source: idMap.get(edge.source) || edge.source,
      target: idMap.get(edge.target) || edge.target,
    }));
    const currentNodes = getNodes(); 
    const currentEdges = getEdges(); 
    const updatedNodes = [...currentNodes, ...newNodes];
    const updatedEdges = [...currentEdges, ...newEdges];
    dispatch(setNodes(updatedNodes));
    dispatch(setEdges(updatedEdges));
    pushToHistory(updatedNodes, updatedEdges);
  }, [clipboard, dispatch, getNodes, getEdges, pushToHistory]);

  // --- Basic React Flow Handlers (modified for history) ---
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (ignoreHistoryUpdate.current) {
      ignoreHistoryUpdate.current = false;
      return;
    }
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    const nextNodes = applyNodeChanges(changes, currentNodes);

    // Check if the changes are significant enough to warrant a history push
    const significantChange = changes.some(change => 
        change.type === 'add' || 
        change.type === 'remove' || 
        (change.type === 'position' && !change.dragging) || // Only push on drag stop
        change.type === 'dimensions' || // Push on resize stop
        (change.type === 'select' && change.selected === false && changes.some(c => c.type === 'remove')) // Allow history push if deselecting happens alongside a removal (e.g., deleting selected node)
    );

    // Filter out pure selection changes unless they accompany a removal.
    const isPureSelectionChange = changes.every(c => c.type === 'select') && !changes.some(c => c.type === 'remove');

    if (significantChange && !isPureSelectionChange) {
        // Check if the change actually modified the node structure or position meaningfully
        const nodesChanged = !isEqual(currentNodes, nextNodes); // Use lodash isEqual for deep comparison

        if (nodesChanged) {
          console.log("[History] Pushing significant node changes:", changes.map(c => c.type));
          // Push history BEFORE applying the change for accurate undo state
          pushToHistory(currentNodes, currentEdges); 
        } else {
           console.log("[History] Skipping push: No meaningful node change detected despite significant event type.");
        }

    } else if (!significantChange) {
        console.log("[History] Skipping non-significant node changes:", changes.map(c => c.type));
    } else if (isPureSelectionChange) {
        console.log("[History] Skipping pure selection changes:", changes.map(c => c.type));
    }

    dispatch(setNodes(nextNodes));
  }, [dispatch, getNodes, getEdges, pushToHistory]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (ignoreHistoryUpdate.current) {
      ignoreHistoryUpdate.current = false;
      return;
    }
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    const nextEdges = applyEdgeChanges(changes, currentEdges);

    // Check for significant changes (add/remove)
    const significantChange = changes.some(change => change.type === 'add' || change.type === 'remove');

    if (significantChange) {
      const edgesChanged = !isEqual(currentEdges, nextEdges);
      if (edgesChanged) {
        console.log("[History] Pushing significant edge changes:", changes.map(c => c.type));
        // Push history BEFORE applying the change
        pushToHistory(currentNodes, currentEdges); 
      } else {
        console.log("[History] Skipping push: No meaningful edge change detected despite significant event type.");
      }
    } else {
       console.log("[History] Skipping non-significant edge changes:", changes.map(c => c.type));
    }

    dispatch(setEdges(nextEdges));
  }, [dispatch, getNodes, getEdges, pushToHistory]);

  const onConnect = useCallback((connection: Connection) => {
    console.log('[onConnect] Triggered');
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    const newEdge = { ...connection, type: 'smoothstep', animated: true };
    const nextEdges = addEdge(newEdge, currentEdges);
    pushToHistory(currentNodes, currentEdges); // Push history before adding edge
    dispatch(setEdges(nextEdges));
  }, [dispatch, getNodes, getEdges, pushToHistory]);

  // --- Node Drag Handlers (Modified for reduced logging) ---
  const onNodeDragStart: NodeDragHandler = useCallback((event, node, nodes) => {
    // Minimal log on drag start
    console.log(`[onNodeDragStart] Node ${node.id} (${node.type}) drag started.`);
    // Original group node moving logic (if any) can remain if needed, but logging reduced.
  }, []); // Empty dependencies unless specific state/props are needed

  const onNodeDrag: NodeDragHandler = useCallback((event, node, nodes) => {
    // No logging during intermediate drag for groups or other nodes
    // React Flow handles position updates via onNodesChange
  }, []);

  const onNodeDragStop: NodeDragHandler = useCallback((event, node, nodes) => {
    // Minimal log on drag stop
    console.log(`[onNodeDragStop] Node ${node.id} (${node.type}) drag stopped.`);
    // History push is handled by onNodesChange (position change with dragging=false)
    // No need for explicit history push or "Skipping" logs here.

    // Logic for adding node to group can remain if needed
    if (node.type !== 'group') { // Don't check if the dragged node itself is a group
        const targetGroup = getNodes().find(
          (n) =>
            n.type === 'group' &&
            !node.parentNode && // Ensure node doesn't already have a parent
            isPointInNode(node, n)
        );

        if (targetGroup) {
          console.log(`Node ${node.id} dropped into group ${targetGroup.id}`);
          const currentNodes = getNodes();
          const currentEdges = getEdges();
          const nextNodes = currentNodes.map(n => {
            if (n.id === node.id) {
              return { 
                ...n, 
                parentNode: targetGroup.id,
                extent: 'parent' as const, // Important: Constrain node to parent bounds
                position: {
                    // Calculate position relative to the parent group
                    x: node.positionAbsolute?.x ? node.positionAbsolute.x - (targetGroup.positionAbsolute?.x ?? 0) : n.position.x,
                    y: node.positionAbsolute?.y ? node.positionAbsolute.y - (targetGroup.positionAbsolute?.y ?? 0) : n.position.y
                }
              };
            }
            return n;
          });
          pushToHistory(currentNodes, currentEdges); // Push history before updating parent
          dispatch(setNodes(nextNodes));
        }
    }
  }, [dispatch, getNodes, getEdges, pushToHistory]);

  // --- Node Selection Handler ---
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    onNodeSelect(node);
  }, [onNodeSelect]);

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  // --- Keyboard Shortcuts (Copy, Paste, Delete, Undo, Redo) ---
  const handleCopy = useCallback(() => {
    const selectedNodes = getNodes().filter(node => node.selected);
    if (selectedNodes.length === 0) return;

    const selectedNodeIds = new Set(selectedNodes.map(node => node.id));
    // Include edges connected to selected nodes, even if the other end isn't selected
    const relevantEdges = getEdges().filter(edge => 
        selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target)
    );

    clipboard.current = { nodes: selectedNodes, edges: relevantEdges };
    console.log('Copied nodes:', selectedNodes);
    console.log('Copied edges:', relevantEdges);
  }, [getNodes, getEdges]);

  const handleDelete = useCallback(() => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    const selectedNodes = currentNodes.filter(node => node.selected);
    const selectedEdges = currentEdges.filter(edge => edge.selected);

    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    pushToHistory(currentNodes, currentEdges); // Push history BEFORE deleting

    const selectedNodeIds = new Set(selectedNodes.map(node => node.id));
    const remainingNodes = currentNodes.filter(node => !node.selected);
    // Remove edges connected to deleted nodes or edges that were selected
    const remainingEdges = currentEdges.filter(edge => 
        !edge.selected &&
        !selectedNodeIds.has(edge.source) && 
        !selectedNodeIds.has(edge.target)
    );

    dispatch(setNodes(remainingNodes));
    dispatch(setEdges(remainingEdges));
  }, [dispatch, getNodes, getEdges, pushToHistory]);

  // Setup keydown listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      const targetElement = event.target as HTMLElement;
      if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
        return;
      }

      // Meta key (Cmd on Mac, Ctrl on Windows/Linux)
      const isMetaKey = event.metaKey || event.ctrlKey;

      if (isMetaKey && event.key === 'c') {
        handleCopy();
      }
      if (isMetaKey && event.key === 'v') {
        handlePaste();
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        handleDelete();
      }
      if (isMetaKey && event.key === 'z') {
        if (event.shiftKey) {
            redo();
        } else {
            undo();
        }
      }
      if (isMetaKey && event.key === 'y') {
          redo(); // Standard redo key
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleCopy, handlePaste, handleDelete, undo, redo]); // Add undo/redo dependencies

  // Helper function to check if a point is inside a node's bounds
  const isPointInNode = (draggedNode: Node, targetNode: Node) => {
    // Ensure both nodes have absolute positions and dimensions
    if (!draggedNode.positionAbsolute || !targetNode.positionAbsolute || !targetNode.width || !targetNode.height) {
      return false;
    }

    const nodeCenterX = draggedNode.positionAbsolute.x + (draggedNode.width ? draggedNode.width / 2 : 0);
    const nodeCenterY = draggedNode.positionAbsolute.y + (draggedNode.height ? draggedNode.height / 2 : 0);

    return (
      nodeCenterX > targetNode.positionAbsolute.x &&
      nodeCenterX < targetNode.positionAbsolute.x + targetNode.width &&
      nodeCenterY > targetNode.positionAbsolute.y &&
      nodeCenterY < targetNode.positionAbsolute.y + targetNode.height
    );
  };

  const resetView = useCallback(() => {
    project({ x: 0, y: 0 } as Viewport);
  }, [project]);

  const miniMapNodeColor = useCallback((node: Node) => {
    switch (node.type as NodeType) {
      case 'llm':
        return '#3b82f6';
      case 'api':
        return '#22c55e';
      case 'output':
        return '#8b5cf6';
      default:
        return '#94a3b8';
    }
  }, []);

  return (
    <div ref={reactFlowWrapper} className="w-full h-full" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        defaultViewport={defaultViewport}
        fitView
        style={{ background: '#f8fafc', width: '100%', height: '100%' }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={'Shift'}
        selectNodesOnDrag={true}
        snapToGrid={true}
        snapGrid={[16, 16]}
      >
        <Background gap={16} color="#94a3b8" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={miniMapNodeColor}
          maskColor="rgba(248, 250, 252, 0.8)"
        />
        <Panel position="top-right">
          <button
            onClick={resetView}
            className="bg-white p-2 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
});