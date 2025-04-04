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
  ReactFlowProvider,
  ConnectionLineType,
} from 'reactflow';
import { useDispatch, useSelector } from 'react-redux';
import 'reactflow/dist/style.css';
import { isEqual } from 'lodash';
import { cloneDeep } from 'lodash';

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
  registerReactFlowApi?: (api: { addNodes: (nodes: Node<NodeData>[]) => void }) => void;
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

export const FlowCanvas = React.memo(({ onNodeSelect, registerReactFlowApi }: FlowCanvasProps) => {
  const dispatch = useDispatch();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Removed Redux selectors for nodes/edges here
  const { project, getNodes: _getNodes, getEdges: _getEdges, addNodes, setNodes: rfSetNodes, setEdges: rfSetEdges, getViewport: rfGetViewport } = useReactFlow(); // Keep useReactFlow for project, addNodes etc.

  // State for clipboard and history
  const clipboard = useRef<CopiedData | null>(null);
  const history = useRef<HistoryItem[]>([]);
  const historyIndex = useRef<number>(-1);
  // ignoreHistoryUpdate ref is no longer needed with direct state setting
  const isRestoringHistory = useRef<boolean>(false);

  // Register the addNodes function with the parent component
  useEffect(() => {
      if (registerReactFlowApi) {
        registerReactFlowApi({ addNodes });
      }
  }, [registerReactFlowApi, addNodes]);

  // Initialize local state from Redux and keep it synced
  const initialNodes = useSelector((state: RootState) => state.flow.nodes);
  const initialEdges = useSelector((state: RootState) => state.flow.edges);

  // Use React Flow's state hooks
  const [localNodes, setLocalNodes, onLocalNodesChange] = useNodesState(initialNodes);
  const [localEdges, setLocalEdges, onLocalEdgesChange] = useEdgesState(initialEdges);

  // Sync Redux state -> local state (e.g., for initial load or external changes)
  useEffect(() => {
      // Avoid feedback loop if the change originated from this component updating Redux
      // A more robust solution might involve tracking the source of the Redux update
      // For now, this basic sync handles initial load and undo/redo correctly
      if (!isEqual(localNodes, initialNodes)) {
          console.log("[Sync Effect] Updating local nodes from Redux");
          setLocalNodes(initialNodes);
      }
  }, [initialNodes, setLocalNodes, localNodes]); // Dependency on initialNodes (from Redux)

  useEffect(() => {
      if (!isEqual(localEdges, initialEdges)) {
          console.log("[Sync Effect] Updating local edges from Redux");
          setLocalEdges(initialEdges);
      }
  }, [initialEdges, setLocalEdges, localEdges]); // Dependency on initialEdges (from Redux)


  // Initialize history on mount using local state
  useEffect(() => {
      // Initialize only if history is empty and localNodes/localEdges are populated
      if (history.current.length === 0 && localNodes.length > 0) {
        history.current.push({ nodes: cloneDeep(localNodes), edges: cloneDeep(localEdges) });
        historyIndex.current = 0;
        console.log('History initialized with local state.');
      }
  }, [localNodes, localEdges]); // Depend on local state for initialization

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
      // No need for isRestoringHistory check here as undo/redo directly set state
      console.log("[History] Pushing state:", { nodes: nodesToSave.length, edges: edgesToSave.length });
      historyIndex.current += 1;
      // Remove any future states if we branch off
      history.current.splice(historyIndex.current); // Correct splice index
      // Push deep copies to prevent mutation issues
      history.current.push({ nodes: cloneDeep(nodesToSave), edges: cloneDeep(edgesToSave) });
      // Limit history size
      if (history.current.length > 50) {
        history.current.shift(); // Remove the oldest state
        historyIndex.current -= 1; // Adjust index
      }
      console.log("[History] New index:", historyIndex.current, "Stack size:", history.current.length);
  }, []);

  const undo = useCallback(() => {
      if (historyIndex.current <= 0) {
          console.log("[History] Cannot undo: at beginning of history.");
          return;
      }

      // Logic to potentially save current state before undoing (optional, depends on desired UX)
      // if (historyIndex.current === history.current.length - 1) {
      //    pushToHistory(localNodes, localEdges); // Save current state if at the latest point
      //    historyIndex.current = historyIndex.current - 1; // Adjust index back
      // }

      historyIndex.current -= 1;
      const prevState = history.current[historyIndex.current];
      console.log('Undoing to index:', historyIndex.current, "State:", prevState);

      isRestoringHistory.current = true; // Flag to potentially prevent effects if needed
      // Set local state DIRECTLY
      setLocalNodes(prevState.nodes);
      setLocalEdges(prevState.edges);
      // Also update Redux state
      dispatch(setNodes(prevState.nodes));
      dispatch(setEdges(prevState.edges));
      // Use setTimeout to reset the flag after the state updates have likely processed
      setTimeout(() => { isRestoringHistory.current = false; }, 0);


  }, [dispatch, setLocalNodes, setLocalEdges]); // Removed localNodes, localEdges, pushToHistory deps for simplicity

  const redo = useCallback(() => {
      if (historyIndex.current >= history.current.length - 1) {
          console.log("[History] Cannot redo: at end of history.");
          return;
      }

      historyIndex.current += 1;
      const nextState = history.current[historyIndex.current];
      console.log('Redoing to index:', historyIndex.current, "State:", nextState);

      isRestoringHistory.current = true; // Flag
      // Set local state DIRECTLY
      setLocalNodes(nextState.nodes);
      setLocalEdges(nextState.edges);
      // Also update Redux state
      dispatch(setNodes(nextState.nodes));
      dispatch(setEdges(nextState.edges));
      // Use setTimeout to reset the flag after the state updates have likely processed
      setTimeout(() => { isRestoringHistory.current = false; }, 0);


  }, [dispatch, setLocalNodes, setLocalEdges]);

  // --- Paste Handler Definition (Uses pushToHistory, cloneNodeWithNewId) ---
  const handlePaste = useCallback(() => {
      if (!clipboard.current) return;

      // Push history BEFORE the change using current local state
      pushToHistory(localNodes, localEdges);

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

      const updatedNodes = [...localNodes, ...newNodes];
      const updatedEdges = [...localEdges, ...newEdges];

      // Update local state FIRST
      setLocalNodes(updatedNodes);
      setLocalEdges(updatedEdges);
      // Update Redux state SECOND
      dispatch(setNodes(updatedNodes));
      dispatch(setEdges(updatedEdges));

  }, [clipboard, dispatch, localNodes, localEdges, setLocalNodes, setLocalEdges, pushToHistory]); // Use local state vars

  // --- Basic React Flow Handlers (modified for history & local state) ---
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
      console.log('[handleNodesChange] Received changes:', changes);

      // Check for significant changes BEFORE applying them
      const isAddOrRemove = changes.some(c => c.type === 'add' || c.type === 'remove');
      const isPositionStop = changes.some(c => c.type === 'position' && !c.dragging);
      const isDimensionChange = changes.some(c => c.type === 'dimensions');
      const isSelectionChange = changes.some(c => c.type === 'select'); // Explicitly check for selection
      const isRemove = changes.some(c => c.type === 'remove'); // Check if remove is present

      // Determine if it's just selection without removal
      const isPureSelectionChange = isSelectionChange && !isRemove && !isAddOrRemove && !isPositionStop && !isDimensionChange;

      // Determine if it's a significant change that warrants history push
      // Exclude pure selection changes from triggering history
      const significantChangeForHistory = (isAddOrRemove || isPositionStop || isDimensionChange) && !isPureSelectionChange;


      // Push history BEFORE applying the changes if significant
      if (significantChangeForHistory) {
          console.log("[History] Pushing significant node changes:", changes.map(c => c.type));
          // Push the *current* local state to history
          pushToHistory(localNodes, localEdges);
      } else if (!significantChangeForHistory && !isPureSelectionChange) {
          // console.log("[History] Skipping non-significant node changes:", changes.map(c => c.type)); // Commented out this log
      } else if (isPureSelectionChange) {
          console.log("[History] Skipping pure selection changes:", changes.map(c => c.type));
      }

      // Apply changes to local state using the handler from useNodesState
      // This updates localNodes internally
      onLocalNodesChange(changes);

      // Update Redux state AFTER local state is updated
      // We need the state *after* changes are applied by onLocalNodesChange
      // applyNodeChanges simulates the change to get the next state for Redux
      const nextNodes = applyNodeChanges(changes, localNodes);
      dispatch(setNodes(nextNodes));

  }, [dispatch, localNodes, localEdges, onLocalNodesChange, pushToHistory, setLocalNodes]); // Include local state vars and setters

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
      console.log('[handleEdgesChange] Received changes:', changes);

      const significantChange = changes.some(change => change.type === 'add' || change.type === 'remove');

      if (significantChange) {
          console.log("[History] Pushing significant edge changes:", changes.map(c => c.type));
          // Push the *current* local state BEFORE the change
          pushToHistory(localNodes, localEdges);
      } else {
          console.log("[History] Skipping non-significant edge changes:", changes.map(c => c.type));
      }

      // Apply changes to local state using the handler from useEdgesState
      // This updates localEdges internally
      onLocalEdgesChange(changes);

      // Update Redux state AFTER local state is updated
      // applyEdgeChanges simulates the change to get the next state for Redux
      const nextEdges = applyEdgeChanges(changes, localEdges);
      dispatch(setEdges(nextEdges));

  }, [dispatch, localNodes, localEdges, onLocalEdgesChange, pushToHistory, setLocalEdges]); // Include local state vars and setters

  const onConnect = useCallback((connection: Connection) => {
      console.log('[onConnect] Triggered');

      // Push history BEFORE adding edge using current local state
      pushToHistory(localNodes, localEdges);

      const newEdge = { ...connection, type: 'smoothstep', animated: true };

      // Update local state using setLocalEdges (addEdge helper is useful here)
      setLocalEdges((eds) => addEdge(newEdge, eds));

      // Update Redux state AFTER local state update
      // Calculate next state based on current local state *before* the setLocalEdges update finishes
      const nextEdges = addEdge(newEdge, localEdges);
      dispatch(setEdges(nextEdges));

  }, [dispatch, localNodes, localEdges, setLocalEdges, pushToHistory]); // Use local state vars

  // --- Node Drag Handlers (Modified for reduced logging and local state) ---
  const onNodeDragStart: NodeDragHandler = useCallback((event, node, nodes) => {
      console.log(`[onNodeDragStart] Node ${node.id} (${node.type}) drag started.`);
  }, []);

  const onNodeDrag: NodeDragHandler = useCallback((event, node, nodes) => {
      // No logging during intermediate drag
  }, []);

  // Helper function to check if NodeA is fully outside NodeB
  const areBoundsOutside = (nodeA: Node, nodeB: Node): boolean => {
    if (!nodeA.positionAbsolute || !nodeA.width || !nodeA.height || 
        !nodeB.positionAbsolute || !nodeB.width || !nodeB.height) {
      console.warn("areBoundsOutside: Missing position or dimensions:", 
        { nodeA: nodeA.id, nodeB: nodeB.id, 
          nodeAPos: nodeA.positionAbsolute, nodeBPos: nodeB.positionAbsolute,
          nodeADim: { w: nodeA.width, h: nodeA.height }, 
          nodeBDim: { w: nodeB.width, h: nodeB.height } });
      return false; // If we can't determine, assume it's not outside to prevent accidental detachment
    }
    
    // Define bounds with a small overlap tolerance (5px) to prevent flickering
    const boundsA = { 
      x1: nodeA.positionAbsolute.x, 
      y1: nodeA.positionAbsolute.y, 
      x2: nodeA.positionAbsolute.x + nodeA.width, 
      y2: nodeA.positionAbsolute.y + nodeA.height 
    };
    const boundsB = { 
      x1: nodeB.positionAbsolute.x, 
      y1: nodeB.positionAbsolute.y, 
      x2: nodeB.positionAbsolute.x + nodeB.width, 
      y2: nodeB.positionAbsolute.y + nodeB.height 
    };

    // Node is outside if there's no overlap in either x or y axis
    const isOutside = (
      boundsA.x2 < boundsB.x1 || // A is completely to the left of B
      boundsA.x1 > boundsB.x2 || // A is completely to the right of B
      boundsA.y2 < boundsB.y1 || // A is completely above B
      boundsA.y1 > boundsB.y2    // A is completely below B
    );
    
    console.log(`Node ${nodeA.id} outside ${nodeB.id}? ${isOutside}`, 
      { nodeA: boundsA, nodeB: boundsB });
    
    return isOutside;
  };

  const onNodeDragStop: NodeDragHandler = useCallback((event, stoppedNode, dragNodes) => {
    console.log(`[onNodeDragStop] Node ${stoppedNode.id} (${stoppedNode.type}) drag stopped.`);
    
    // Skip if node is a group
    if (stoppedNode.type === 'group') return;
    
    // Force ensure we have positionAbsolute from the dragged node
    const absolutePosition = stoppedNode.positionAbsolute ?? stoppedNode.position;
    if (!absolutePosition) {
      console.warn(`Missing absolutePosition for node ${stoppedNode.id}`);
      return;
    }
    
    // Get the current parent ID if any
    const currentParentId = stoppedNode.parentNode;
    
    // Check for detachment first (if node has a parent)
    if (currentParentId) {
      const parentNode = localNodes.find(n => n.id === currentParentId);
      
      // If parent exists, check if node is now outside
      if (parentNode) {
        console.log(`Checking if ${stoppedNode.id} is outside parent ${parentNode.id}`);
        const isOutside = areBoundsOutside(stoppedNode, parentNode);
        
        if (isOutside) {
          console.log(`🔑 DETACHING: Node ${stoppedNode.id} detected outside group ${parentNode.id}`);
          
          // Update nodes with detached node
          const updatedNodes = localNodes.map(n => {
            if (n.id === stoppedNode.id) {
              // Create a completely new node object instead of modifying existing one
              // This forces React Flow to fully re-render and recalculate the node's position
              return {
                id: n.id,
                type: n.type,
                data: n.data,
                position: absolutePosition,
                positionAbsolute: absolutePosition,
                width: n.width,
                height: n.height,
                selected: n.selected,
                dragging: false,
                draggable: true,
                selectable: true,
                connectable: true,
                // Explicitly set all group-related properties to undefined
                parentNode: undefined,
                extent: undefined,
                expandParent: false,
                // Include any other essential properties but omit all calculated or internal ones
                style: n.style,
                className: n.className
              };
            }
            return n;
          });
          
          // Push to history, update local state, and Redux
          pushToHistory(localNodes, localEdges);
          setLocalNodes(updatedNodes);
          dispatch(setNodes(updatedNodes));
          
          // Exit early - we've handled the detachment
          return;
        }
      }
    }
    
    // If not detaching, check if node is entering a group
    // Find potential target group based on node center
    const nodeCenter = {
      x: absolutePosition.x + (stoppedNode.width || 0) / 2,
      y: absolutePosition.y + (stoppedNode.height || 0) / 2
    };
    
    // Find a group that contains this node's center
    const targetGroup = localNodes.find(n => {
      if (n.type !== 'group' || n.id === currentParentId) return false;
      if (!n.positionAbsolute || !n.width || !n.height) return false;
      
      const groupBounds = {
        x1: n.positionAbsolute.x,
        y1: n.positionAbsolute.y,
        x2: n.positionAbsolute.x + n.width,
        y2: n.positionAbsolute.y + n.height
      };
      
      return (
        nodeCenter.x >= groupBounds.x1 &&
        nodeCenter.x <= groupBounds.x2 &&
        nodeCenter.y >= groupBounds.y1 &&
        nodeCenter.y <= groupBounds.y2
      );
    });
    
    // If entering a new group
    if (targetGroup && (!currentParentId || currentParentId !== targetGroup.id)) {
      console.log(`Node ${stoppedNode.id} entered group ${targetGroup.id}`);
      
      // Calculate relative position
      const relativePos = {
        x: absolutePosition.x - (targetGroup.positionAbsolute?.x || 0),
        y: absolutePosition.y - (targetGroup.positionAbsolute?.y || 0)
      };
      
      // Update nodes
      const updatedNodes = localNodes.map(n => {
        if (n.id === stoppedNode.id) {
          // Create a completely new node object for group entry too
          return {
            id: n.id,
            type: n.type,
            data: n.data,
            // Set position relative to parent
            position: relativePos,
            width: n.width,
            height: n.height,
            selected: n.selected,
            dragging: false,
            draggable: true,
            selectable: true,
            connectable: true,
            // Explicitly set group membership
            parentNode: targetGroup.id,
            extent: 'parent' as const,
            expandParent: true,
            // Include other essential properties
            style: n.style,
            className: n.className
          };
        }
        return n;
      });
      
      // Push to history, update local state, and Redux
      pushToHistory(localNodes, localEdges);
      setLocalNodes(updatedNodes);
      dispatch(setNodes(updatedNodes));
    }
    
  }, [dispatch, localNodes, localEdges, setLocalNodes, pushToHistory]);


  // --- Node Selection Handler ---
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
      onNodeSelect(node);
  }, [onNodeSelect]);

  const onPaneClick = useCallback(() => {
      onNodeSelect(null);
  }, [onNodeSelect]);

  // --- Keyboard Shortcuts (Copy, Paste, Delete, Undo, Redo) ---
  const handleCopy = useCallback(() => {
      const selectedNodes = localNodes.filter(node => node.selected); // Use localNodes
      if (selectedNodes.length === 0) return;

      const selectedNodeIds = new Set(selectedNodes.map(node => node.id));
      const relevantEdges = localEdges.filter(edge => // Use localEdges
          selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target)
      );

      clipboard.current = { nodes: selectedNodes, edges: relevantEdges };
      console.log('Copied nodes:', selectedNodes);
      console.log('Copied edges:', relevantEdges);
  }, [localNodes, localEdges]); // Use local state

  const handleDelete = useCallback(() => {
      const selectedNodes = localNodes.filter(node => node.selected); // Use localNodes
      const selectedEdges = localEdges.filter(edge => edge.selected); // Use localEdges

      if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

      // Push history BEFORE deleting using current local state
      pushToHistory(localNodes, localEdges);

      const nodesToRemove = new Set(selectedNodes.map(node => node.id));
      const edgesToRemove = new Set(selectedEdges.map(edge => edge.id));

      // --- START: Group Deletion Logic ---
      selectedNodes.forEach(node => {
          if (node.type === 'group') {
              const childNodes = localNodes.filter(n => n.parentNode === node.id); // Use localNodes
              childNodes.forEach(child => nodesToRemove.add(child.id));
          }
      });

      // Add all edges connected to ANY node being removed
      localEdges.forEach(edge => { // Use localEdges
          if (nodesToRemove.has(edge.source) || nodesToRemove.has(edge.target)) {
              edgesToRemove.add(edge.id);
          }
      });
      // --- END: Group Deletion Logic ---

      const remainingNodes = localNodes.filter(node => !nodesToRemove.has(node.id)); // Use localNodes
      const remainingEdges = localEdges.filter(edge => !edgesToRemove.has(edge.id)); // Use localEdges

      // Update local state FIRST
      setLocalNodes(remainingNodes);
      setLocalEdges(remainingEdges);

      // Update Redux state SECOND
      dispatch(setNodes(remainingNodes));
      dispatch(setEdges(remainingEdges));

  }, [dispatch, localNodes, localEdges, setLocalNodes, setLocalEdges, pushToHistory]); // Use local state vars

  // Setup keydown listener (no changes needed here as it calls the updated handlers)
  useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        const targetElement = event.target as HTMLElement;
        if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
          return;
        }
        const isMetaKey = event.metaKey || event.ctrlKey;
        if (isMetaKey && event.key === 'c') handleCopy();
        else if (isMetaKey && event.key === 'v') handlePaste();
        else if (event.key === 'Delete' || event.key === 'Backspace') handleDelete();
        else if (isMetaKey && event.key === 'z') event.shiftKey ? redo() : undo();
        else if (isMetaKey && (event.key === 'y' || (event.shiftKey && event.key === 'Z'))) redo();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handlePaste, handleDelete, undo, redo]);

  // Helper function to check if a point (node center) is within another node (group bounds)
  // This function needs the absolute positions which are updated by React Flow internally
  const isPointInNode = (draggedNode: Node, targetNode: Node): boolean => {
      if (!draggedNode.positionAbsolute || !targetNode.positionAbsolute || !draggedNode.width || !draggedNode.height || !targetNode.width || !targetNode.height) {
          console.warn("isPointInNode: Missing position or dimensions for check.");
          return false;
      }
      const draggedNodeCenter = {
          x: draggedNode.positionAbsolute.x + draggedNode.width / 2,
          y: draggedNode.positionAbsolute.y + draggedNode.height / 2,
      };
      const targetBounds = {
          x1: targetNode.positionAbsolute.x,
          y1: targetNode.positionAbsolute.y,
          x2: targetNode.positionAbsolute.x + targetNode.width,
          y2: targetNode.positionAbsolute.y + targetNode.height,
      };
      return (
          draggedNodeCenter.x >= targetBounds.x1 &&
          draggedNodeCenter.x <= targetBounds.x2 &&
          draggedNodeCenter.y >= targetBounds.y1 &&
          draggedNodeCenter.y <= targetBounds.y2
      );
  };


  const resetView = useCallback(() => {
      // project should still work as expected
      project({ x: 0, y: 0 } as Viewport);
  }, [project]);

  const miniMapNodeColor = useCallback((node: Node) => {
      switch (node.type as NodeType) {
          case 'llm': return '#3b82f6';
          case 'api': return '#22c55e';
          case 'output': return '#8b5cf6';
          default: return '#94a3b8';
      }
  }, []);

  // Sort nodes to render groups behind other nodes
  const sortedNodes = useMemo(() => {
    return [...localNodes].sort((a, b) => {
      if (a.type === 'group' && b.type !== 'group') return -1; // a (group) comes before b
      if (a.type !== 'group' && b.type === 'group') return 1;  // b (group) comes before a
      return 0; // Maintain original order for non-group nodes relative to each other
    });
  }, [localNodes]);

  return (
      <div ref={reactFlowWrapper} className="w-full h-full" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
          {/* <ReactFlowProvider> REMOVED - Provider should be higher up */}
          <ReactFlow
              nodes={sortedNodes} // Use sorted nodes
              edges={localEdges} // Use local state
              onNodesChange={handleNodesChange} // Use adapted handler
              onEdgesChange={handleEdgesChange} // Use adapted handler
              onConnect={onConnect} // Use adapted handler
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onNodeDragStart={onNodeDragStart}
              onNodeDrag={onNodeDrag}
              onNodeDragStop={onNodeDragStop} // Use adapted handler
              nodeTypes={nodeTypes}
              defaultViewport={defaultViewport}
              fitView
              style={{ background: '#f8fafc', width: '100%', height: '100%' }}
              proOptions={{ hideAttribution: true }}
              deleteKeyCode={null} // We handle delete manually
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
          {/* </ReactFlowProvider> REMOVED */}
      </div>
  );
});

export default FlowCanvas;