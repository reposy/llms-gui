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

import LLMNode from './nodes/LLMNode';
import APINode from './nodes/APINode';
import OutputNode from './nodes/OutputNode';
import JSONExtractorNode from './nodes/JSONExtractorNode';
import InputNode from './nodes/InputNode';
import GroupNode from './nodes/GroupNode';
import ConditionalNode from './nodes/ConditionalNode';
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
  group: GroupNode, // Render GroupNode directly without wrapper
  conditional: (props: any) => (
    <NodeWrapper>
      <ConditionalNode {...props} />
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
  const { project, getNodes, getEdges, setNodes: rfSetNodes, setEdges: rfSetEdges, getViewport: rfGetViewport, getNodes: rfGetNodes } = useReactFlow();

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

  // --- Basic React Flow Handlers (modified for history) ---
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (ignoreHistoryUpdate.current) {
      ignoreHistoryUpdate.current = false;
      return;
    }
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    const nextNodes = applyNodeChanges(changes, currentNodes);
    pushToHistory(currentNodes, currentEdges);
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
    pushToHistory(currentNodes, currentEdges);
    dispatch(setEdges(nextEdges));
  }, [dispatch, getNodes, getEdges, pushToHistory]);

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const sourceNode = currentNodes.find((node) => node.id === params.source);
      const targetNode = currentNodes.find((node) => node.id === params.target);

      if (!sourceNode || !targetNode) return;

      // Define allowed connections
      const allowedConnections: Record<NodeType, NodeType[]> = {
        input: ['llm', 'api', 'json-extractor', 'group'], 
        llm: ['llm', 'output', 'json-extractor', 'conditional'], // Allow output to conditional 
        api: ['output', 'json-extractor', 'conditional'], // Allow output to conditional     
        output: [],                             
        'json-extractor': ['llm', 'api', 'output', 'conditional'], // Allow output to conditional
        group: ['output', 'json-extractor', 'conditional'],
        conditional: ['llm', 'api', 'output', 'json-extractor', 'group', 'conditional'], // Conditional can output to almost anything
      };

      // --- Connection Logic Update --- 
      // Existing validation logic needs to be smarter to check handle IDs if present
      let isAllowed = false;
      const sourceHandleId = params.sourceHandle; // Can be null, 'output', 'group-results', etc.
      
      // Basic check based on node types (existing logic)
      const basicAllowed = allowedConnections[sourceNode.type as NodeType]?.includes(targetNode.type as NodeType);

      if (sourceNode.type === 'group' && sourceHandleId === 'group-results') {
        // Specific rule for group results output
        isAllowed = ['output'].includes(targetNode.type as NodeType); // Only allow connection to Output for now
      } else if (sourceNode.type === 'conditional' && (sourceHandleId === 'true' || sourceHandleId === 'false')) {
         // Conditional node output can go anywhere its type allows in the map
         isAllowed = basicAllowed;
      } else {
        // Default case: Use the basic node type mapping
        isAllowed = basicAllowed;
      }

      if (isAllowed) {
        // Specific logic for Input -> Group connection
        if (sourceNode.type === 'input' && targetNode.type === 'group') {
          // Update the Group node's iteration source
          const groupData = targetNode.data as GroupNodeData;
          dispatch(updateNodeData({
            nodeId: targetNode.id,
            data: {
              ...groupData,
              iterationConfig: {
                ...groupData.iterationConfig,
                sourceNodeId: sourceNode.id
              }
            }
          }));
          console.log(`Set iteration source for Group ${targetNode.id} to Input ${sourceNode.id}`);
        }
        
        // Add the edge graphically
        const newEdge = { ...params, id: `edge-${Date.now()}`, type: 'default' }; // Ensure edge type is set
        const nextEdges = addEdge(newEdge, currentEdges);
        dispatch(setEdges(nextEdges));
        pushToHistory(currentNodes, nextEdges); 

      } else {
        console.warn('Connection not allowed:', sourceNode.type, '->', targetNode.type);
      }
    },
    [dispatch, getNodes, getEdges, pushToHistory] // Removed setEdges, use dispatch
  );

  // --- Copy/Paste/Delete ---
  const copySelected = useCallback(() => {
    const selectedNodes = getNodes().filter(n => n.selected);
    if (selectedNodes.length === 0) return;

    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    // Only copy edges that connect *between* selected nodes
    const internalEdges = getEdges().filter(e => 
      selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
    );

    clipboard.current = {
      nodes: selectedNodes.map(n => ({ ...n, selected: false })), // Deselect nodes in clipboard
      edges: internalEdges
    };
    console.log('Copied to clipboard:', clipboard.current);
  }, [getNodes, getEdges]);

  const pasteNodes = useCallback(() => {
    if (!clipboard.current || !reactFlowWrapper.current) return;

    const { nodes: copiedNodes, edges: copiedEdges } = clipboard.current;
    if (copiedNodes.length === 0) return;

    // Get viewport center projected onto the flow plane
    const viewport = rfGetViewport();
    const flowWrapperBounds = reactFlowWrapper.current.getBoundingClientRect();
    const center = project({
      x: flowWrapperBounds.width / 2,
      y: flowWrapperBounds.height / 2,
    });

    // Calculate the bounds of the nodes being pasted to find their collective top-left corner
    const bounds = getNodesBounds(copiedNodes);
    // Use the absolute position if available (might be more accurate after dragging)
    const topLeftX = bounds.x;
    const topLeftY = bounds.y;

    const idMapping: Record<string, string> = {};
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const currentNodes = getNodes();
    const currentEdges = getEdges();
    pushToHistory(currentNodes, currentEdges); // Save state before paste

    // Create new nodes, positioning their top-left corner relative to the viewport center
    copiedNodes.forEach(node => {
      const newNodeId = `${node.type}-${Date.now()}-${Math.random().toString(16).substring(2, 6)}`;
      idMapping[node.id] = newNodeId;
      
      // Calculate offset from the original group's top-left
      const offsetX = (node.positionAbsolute?.x ?? node.position.x) - topLeftX;
      const offsetY = (node.positionAbsolute?.y ?? node.position.y) - topLeftY;
      
      newNodes.push({
        ...node,
        id: newNodeId,
        position: {
          // Place node relative to the calculated center, maintaining its offset within the group
          x: center.x + offsetX,
          y: center.y + offsetY,
        },
        selected: true, // Select pasted nodes
        data: { ...node.data } // Ensure data is copied deeply if needed
      });
    });

    // Create new edges referencing the new node IDs
    copiedEdges.forEach(edge => {
      const newSourceId = idMapping[edge.source];
      const newTargetId = idMapping[edge.target];
      if (newSourceId && newTargetId) {
        newEdges.push({
          ...edge,
          id: `edge-${Date.now()}-${Math.random().toString(16).substring(2, 6)}`,
          source: newSourceId,
          target: newTargetId,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
        });
      }
    });

    // Deselect currently selected nodes before pasting new ones
    const nodesToUpdate = currentNodes.map(n => ({ ...n, selected: false }));

    dispatch(setNodes([...nodesToUpdate, ...newNodes]));
    dispatch(setEdges([...currentEdges, ...newEdges]));

    console.log('Pasted nodes at viewport center:', newNodes);

  }, [dispatch, getNodes, getEdges, project, rfGetViewport, getNodesBounds, pushToHistory]);

  const deleteSelected = useCallback(() => {
    const selectedNodes = getNodes().filter(n => n.selected);
    const selectedEdges = getEdges().filter(e => e.selected);
    
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    const currentNodes = getNodes();
    const currentEdges = getEdges();
    pushToHistory(currentNodes, currentEdges); // Save state before delete

    const nodesToRemoveIds = new Set(selectedNodes.map(n => n.id));
    const edgesToRemove = getConnectedEdges(selectedNodes, currentEdges);
    const edgesToRemoveIds = new Set([...edgesToRemove.map(e => e.id), ...selectedEdges.map(e => e.id)]);

    const nextNodes = currentNodes.filter(n => !nodesToRemoveIds.has(n.id));
    const nextEdges = currentEdges.filter(e => !edgesToRemoveIds.has(e.id));

    dispatch(setNodes(nextNodes));
    dispatch(setEdges(nextEdges));
    console.log('Deleted nodes:', nodesToRemoveIds, 'Deleted edges:', edgesToRemoveIds);

  }, [dispatch, getNodes, getEdges, pushToHistory]);

  // --- Effect for Keyboard Shortcuts (Updated) ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts if focus is inside an input/textarea
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        // Allow backspace/delete in inputs
        if (event.key === 'Backspace' || event.key === 'Delete') return;
        // Allow copy/paste in inputs
        if ((event.metaKey || event.ctrlKey) && (event.key === 'c' || event.key === 'v' || event.key === 'x')) return;
        // Allow undo/redo in inputs
        if ((event.metaKey || event.ctrlKey) && event.key === 'z') return;
        // Block other shortcuts if focus is on input/textarea
        if (event.metaKey || event.ctrlKey) return;
      }
      
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? event.metaKey : event.ctrlKey;

      if (modKey && event.key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (modKey && event.key === 'c') {
        event.preventDefault();
        copySelected();
      } else if (modKey && event.key === 'v') {
        event.preventDefault();
        pasteNodes();
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        deleteSelected();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
    // Add copy/paste/delete handlers to dependency array
  }, [undo, redo, copySelected, pasteNodes, deleteSelected]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    onNodeSelect(node);
  }, [onNodeSelect]);

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

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

  // Update isPointInNode function
  const isPointInNode = (draggedNode: Node, targetNode: Node) => {
    // Use positionAbsolute for more accurate positioning
    const draggedPos = draggedNode.positionAbsolute || draggedNode.position;
    const targetPos = targetNode.positionAbsolute || targetNode.position;

    // Check if the dragged node's center is inside the target node
    const draggedCenterX = draggedPos.x + (draggedNode.width || 0) / 2;
    const draggedCenterY = draggedPos.y + (draggedNode.height || 0) / 2;

    return (
      draggedCenterX > targetPos.x &&
      draggedCenterX < targetPos.x + (targetNode.width || 0) &&
      draggedCenterY > targetPos.y &&
      draggedCenterY < targetPos.y + (targetNode.height || 0)
    );
  };

  // Update onNodeDragStop handler to use getNodes()
  const onNodeDragStop: NodeDragHandler = useCallback((event, draggedNode) => { // Remove allNodes from args
    console.log('[onNodeDragStop] Triggered for node:', draggedNode.id, 'Type:', draggedNode.type);
    const currentNodes = rfGetNodes(); // Get current nodes using the hook

    if (!draggedNode.positionAbsolute) {
      console.log('[onNodeDragStop] Skipping: No absolute position.');
      return;
    }

    if (draggedNode.type === 'group') {
      console.log('[onNodeDragStop] Skipping: Dragged node is a group.');
      return;
    }

    const groupNodes = currentNodes.filter( // Use currentNodes from getNodes()
      (n) => n.type === 'group' && n.id !== draggedNode.id
    );
    console.log('[onNodeDragStop] Potential parent groups:', groupNodes.map(g => g.id));

    const parentGroup = groupNodes.find((group) => isPointInNode(draggedNode, group));
    console.log('[onNodeDragStop] Found parent group?: ', parentGroup ? parentGroup.id : 'None');

    const originalParentId = draggedNode.parentNode;
    let parentChanged = false;

    const updatedNodes = currentNodes.map((n): Node<NodeData> | null => { // Use currentNodes
      if (n.id === draggedNode.id) {
        const nodeAbsPos = n.positionAbsolute!;
        console.log(`[onNodeDragStop] Checking node ${n.id}: Original parent: ${originalParentId}`);

        if (parentGroup) {
          console.log(`[onNodeDragStop] Node ${n.id} is over group ${parentGroup.id}`);
          if (n.parentNode !== parentGroup.id) {
            const parentAbsPos = parentGroup.positionAbsolute || parentGroup.position;
            const relativePos = {
              x: nodeAbsPos.x - parentAbsPos.x,
              y: nodeAbsPos.y - parentAbsPos.y,
            };
            console.log(`[onNodeDragStop] ADDING node ${n.id} to group ${parentGroup.id}. Relative pos:`, relativePos);
            parentChanged = true;
            return {
              ...n,
              position: relativePos,
              parentNode: parentGroup.id,
              extent: 'parent' as const,
            };
          } else {
            console.log(`[onNodeDragStop] Node ${n.id} already in group ${parentGroup.id}. No parent change.`);
            return n; 
          }
        } else if (n.parentNode) {
          console.log(`[onNodeDragStop] Node ${n.id} is NOT over any group, but had parent ${n.parentNode}`);
          const oldParent = currentNodes.find((p) => p.id === n.parentNode); // Use currentNodes
          if (oldParent) {
            console.log(`[onNodeDragStop] REMOVING node ${n.id} from group ${oldParent.id}. New absolute pos:`, nodeAbsPos);
            parentChanged = true;
            const { parentNode, extent, ...rest } = n;
            return {
              ...rest,
              position: nodeAbsPos, 
            };
          } else {
            console.warn(`[onNodeDragStop] Node ${n.id} had parentId ${n.parentNode}, but parent node not found!`);
            return n;
          }
        } else {
           console.log(`[onNodeDragStop] Node ${n.id} is not over a group and had no parent. No change.`);
           return n;
        }
      }
      return n; 
    });

    if (parentChanged) {
      const finalNodes = updatedNodes.filter((n): n is Node<NodeData> => n !== null);
      console.log('[onNodeDragStop] Parent changed, dispatching setNodes with updated nodes:', finalNodes);
      dispatch(setNodes(finalNodes));
    } else {
      console.log('[onNodeDragStop] No parent change detected, not dispatching.');
    }
  }, [dispatch, rfGetNodes]); // Add rfGetNodes to dependency array

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
        nodeTypes={nodeTypes}
        defaultViewport={defaultViewport}
        fitView
        style={{ background: '#f8fafc', width: '100%', height: '100%' }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={'Shift'}
        selectNodesOnDrag={true}
        onNodeDragStop={onNodeDragStop}
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