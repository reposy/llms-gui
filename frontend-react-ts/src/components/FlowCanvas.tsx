import React, { useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  Node,
  Edge,
  useReactFlow,
  Panel,
  ReactFlowProvider,
  ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Import custom hooks
import { useHistory } from '../hooks/useHistory';
import { useClipboard } from '../hooks/useClipboard';
import { useFlowSync } from '../hooks/useFlowSync';
import { useNodeHandlers } from '../hooks/useNodeHandlers';
import { createNewNode } from '../utils/flowUtils';
// Removed nodeContentStore imports related to hydration
// import { loadFromReduxNodes, cleanupDeletedNodes } from '../store/nodeContentStore'; 

// Node type imports
import LLMNode from './nodes/LLMNode';
import APINode from './nodes/APINode';
import OutputNode from './nodes/OutputNode';
import JSONExtractorNode from './nodes/JSONExtractorNode';
import InputNode from './nodes/InputNode';
import GroupNode from './nodes/GroupNode';
import ConditionalNode from './nodes/ConditionalNode';
import MergerNode from './nodes/MergerNode';
import { NodeData, NodeType } from '../types/nodes';

// Custom wrapper to remove default React Flow node styling
const NodeWrapper = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: 'relative' }} className="react-flow__node pointer-events-auto">
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
  group: (props: any) => (
    <GroupNode {...props} />
  ),
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

export interface FlowCanvasApi {
  addNodes: (nodes: Node<NodeData>[]) => void;
  forceSync: () => void; // Assuming this comes from useFlowSync as forceSyncFromRedux
  commitStructure: () => void; // Renamed from commitChanges
}

interface FlowCanvasProps {
  onNodeSelect: (node: Node<NodeData> | null) => void;
  registerReactFlowApi?: (api: FlowCanvasApi) => void;
}

// ... defaultViewport ...
const defaultViewport = { x: 0, y: 0, zoom: 0.7 };

export const FlowCanvas = React.memo(({ onNodeSelect, registerReactFlowApi }: FlowCanvasProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project, addNodes } = useReactFlow();
  
  const isRestoringHistory = useRef<boolean>(false);

  // Use the refactored flow sync hook (now focuses on structure)
  const { 
    localNodes, 
    localEdges, 
    setLocalNodes, 
    setLocalEdges,
    onLocalNodesChange,
    onLocalEdgesChange,
    forceSyncFromRedux, // Renamed function
    commitStructureToRedux // Renamed function
  } = useFlowSync({ isRestoringHistory });
  
  // History hook likely needs local state now
  const { 
    pushToHistory, 
    undo, 
    redo 
  } = useHistory(
    { initialNodes: localNodes, initialEdges: localEdges }, // Pass local state
    setLocalNodes, // Setter for local state
    setLocalEdges // Setter for local state
  );
  
  // Clipboard hook likely interacts with history/local state
  const { 
    handleCopy, 
    handlePaste 
  } = useClipboard();
  
  // Node handlers hook operates on local state
  const { 
    handleConnect,
    handleSelectionChange,
    handleNodeDragStop,
    handleSelectionDragStop,
    handleEdgesDelete,
    handleNodesDelete
  } = useNodeHandlers(
    localNodes,
    setLocalNodes,
    localEdges,
    setLocalEdges,
    { onNodeSelect, pushToHistory, isRestoringHistory }
  );
  
  // Keep a ref to the commit function for the API
  const commitStructureRef = useRef(commitStructureToRedux);
  useEffect(() => {
    commitStructureRef.current = commitStructureToRedux;
  }, [commitStructureToRedux]);
  
  // Register the API functions with the parent component
  useEffect(() => {
    if (registerReactFlowApi) {
      registerReactFlowApi({ 
        addNodes,
        forceSync: forceSyncFromRedux, // Pass the renamed function
        commitStructure: () => commitStructureRef.current() // Pass the renamed function
      });
    }
  }, [registerReactFlowApi, addNodes, forceSyncFromRedux]); // Update dependency

  // REMOVED useEffect that called loadFromReduxNodes and cleanupDeletedNodes
  /*
  useEffect(() => {
    // Load node content from Redux nodes - convert Node<NodeData> to NodeData
    const nodeDataArray = localNodes.map(node => node.data);
    loadFromReduxNodes(nodeDataArray);
    
    // Clean up deleted nodes from content store
    const existingNodeIds = localNodes.map(node => node.id);
    cleanupDeletedNodes(existingNodeIds);
    
    console.log('[FlowCanvas] Node content store initialized/updated from flow nodes');
  }, [localNodes.length]);
  */

  // Set up keyboard shortcuts (Undo/Redo/Copy/Paste/Delete)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle events when an input/textarea is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement instanceof HTMLInputElement || 
                             activeElement instanceof HTMLTextAreaElement ||
                             activeElement instanceof HTMLSelectElement ||
                             activeElement?.getAttribute('contenteditable') === 'true';
      
      if (isInputFocused) {
        return;
      }
      
      // Handle ctrl/cmd + z for undo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      
      // Handle ctrl/cmd + shift + z or ctrl/cmd + y for redo
      if (((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) ||
          ((event.ctrlKey || event.metaKey) && event.key === 'y')) {
        event.preventDefault();
        redo();
      }
      
      // Handle ctrl/cmd + c for copy
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        event.preventDefault();
        handleCopy();
      }
      
      // Handle ctrl/cmd + v for paste
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        event.preventDefault();
        handlePaste();
      }
      
      // Handle delete key
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedNodes = localNodes.filter(node => node.selected);
        const selectedEdges = localEdges.filter(edge => edge.selected);
        
        if (selectedEdges.length > 0) {
          handleEdgesDelete(selectedEdges);
        }
        
        if (selectedNodes.length > 0) {
          handleNodesDelete(selectedNodes);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    localNodes,
    localEdges,
    undo, 
    redo, 
    handleCopy, 
    handlePaste, 
    handleEdgesDelete, 
    handleNodesDelete
  ]);

  // ... onDragOver, onDrop handlers ...
  // These likely remain the same, operating on local state via setLocalNodes
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const nodeType = event.dataTransfer.getData('application/reactflow') as NodeType;

      if (!nodeType || !reactFlowBounds) {
        return;
      }

      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      
      const newNode = createNewNode(nodeType, position);
      
      // Add node to local state
      setLocalNodes((nds) => nds.concat(newNode));
      // Mark structure as changed
      // Note: useFlowSync's onLocalNodesChange wrapper should handle this
      // If not using the wrapper, manually set: hasPendingStructuralChanges.current = true;
    },
    [project, setLocalNodes] // Ensure dependencies are correct
  );

  return (
    <div className="w-full h-full" ref={reactFlowWrapper} style={{ background: '#f8f9fa' }}>
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        onNodesChange={onLocalNodesChange} // Use handler from useFlowSync
        onEdgesChange={onLocalEdgesChange} // Use handler from useFlowSync
        onConnect={handleConnect} // Keep using handler from useNodeHandlers
        onSelectionChange={handleSelectionChange} // Keep using handler from useNodeHandlers
        onNodeDragStop={handleNodeDragStop} // Keep using handler from useNodeHandlers
        onSelectionDragStop={handleSelectionDragStop} // Keep using handler from useNodeHandlers
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        defaultViewport={defaultViewport}
        multiSelectionKeyCode="Shift" // Enable built-in multi-selection support
        fitView
        fitViewOptions={{ padding: 0.2 }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        attributionPosition="bottom-left"
        deleteKeyCode={null} // Disable default delete behaviour, handled by useEffect
      >
        <Controls />
        <MiniMap />
        <Background gap={16} color="#e9ecef" />
        {/* <Panel position="top-right">
          <button onClick={forceSyncFromRedux}>Force Sync</button>
        </Panel> */}
      </ReactFlow>
    </div>
  );
});

// Define props for FlowCanvasWrapper if needed, otherwise remove if FlowCanvas is used directly
interface FlowCanvasWrapperProps {
   onNodeSelect: (node: Node | null) => void;
   registerReactFlowApi?: (api: FlowCanvasApi) => void;
}

// This wrapper might be unnecessary if FlowEditor directly renders FlowCanvas within ReactFlowProvider
export const FlowCanvasWrapper: React.FC<FlowCanvasWrapperProps> = (props) => (
    <ReactFlowProvider>
        <FlowCanvas {...props} />
    </ReactFlowProvider>
);