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
import { useSelectionManager } from '../hooks/useSelectionManager';
import { createNewNode } from '../utils/flowUtils';
// Import Zustand store
import { setNodes, setEdges } from '../store/useFlowStructureStore';

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
  forceSync: () => void; // Now fetches from Zustand
  commitStructure: () => void; // Now commits to Zustand
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
  
  // Get selection manager functions
  const { setSelectedNodeId } = useSelectionManager();

  // Use the refactored flow sync hook (now using Zustand)
  const { 
    localNodes, 
    localEdges, 
    setLocalNodes, 
    setLocalEdges,
    onLocalNodesChange,
    onLocalEdgesChange,
    forceSyncFromStore,
    commitStructureToStore
  } = useFlowSync({ isRestoringHistory });
  
  // History hook now uses Zustand setters
  const { 
    pushToHistory, 
    undo, 
    redo 
  } = useHistory(
    { initialNodes: localNodes, initialEdges: localEdges }, // Pass local state
    setNodes, // Now uses Zustand setter
    setEdges // Now uses Zustand setter
  );
  
  // Clipboard hook now interacts with Zustand
  const { 
    handleCopy, 
    handlePaste,
    pasteVersion
  } = useClipboard();
  
  // Node handlers now operate on Zustand state
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
    { 
      onNodeSelect: (node) => {
        onNodeSelect(node);
        setSelectedNodeId(node?.id || null); // Update selection using the manager
      }, 
      pushToHistory, 
      isRestoringHistory 
    }
  );
  
  // Register the API functions with the parent component
  useEffect(() => {
    if (registerReactFlowApi) {
      // Create a stable API object reference that won't change unless needed
      const stableFlowApi = {
        addNodes,
        forceSync: forceSyncFromStore,
        commitStructure: commitStructureToStore
      };
      
      console.log("[FlowCanvas] Registering React Flow API");
      registerReactFlowApi(stableFlowApi);
    }
    
    // Only re-register if one of these functions changes their identity
    // This is much less likely than the previous dependency array
  }, [registerReactFlowApi]);

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

  // Detect if we're in a paste operation using global flags
  const isJustAfterPaste = window._devFlags?.hasJustPasted;

  // Debug paste activity in ReactFlow state
  useEffect(() => {
    if (isJustAfterPaste) {
      console.log(`[FlowCanvas] Detected paste operation, using pasteVersion=${pasteVersion}`);
    }
  }, [isJustAfterPaste, pasteVersion]);

  return (
    <div 
      ref={reactFlowWrapper} 
      className="w-full h-full relative"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        // Only use pasteVersion as part of the key when paste operation had issues
        // This prevents unnecessary remounts
        key={isJustAfterPaste && pasteVersion > 0 ? `flow-${pasteVersion}` : 'flow'}
        nodes={localNodes}
        edges={localEdges}
        onNodesChange={onLocalNodesChange}
        onEdgesChange={onLocalEdgesChange}
        onConnect={handleConnect}
        onSelectionChange={handleSelectionChange}
        onNodeDragStop={handleNodeDragStop}
        onSelectionDragStop={handleSelectionDragStop}
        nodeTypes={nodeTypes}
        fitView
        defaultViewport={defaultViewport}
        attributionPosition="bottom-right"
        connectionLineType={ConnectionLineType.Bezier}
        connectionRadius={30}
        snapToGrid
        snapGrid={[15, 15]}
        className="w-full h-full bg-dot-pattern"
      >
        <Controls position="bottom-right" />
        <MiniMap position="bottom-left" zoomable pannable />
        <Background gap={15} color="#d9e1ec" />
        <Panel position="top-right" className="bg-white rounded-lg shadow-lg p-3 space-y-2 flex flex-col">
          <button
            onClick={undo}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors tooltip"
            data-tooltip="Undo (Ctrl+Z)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <button
            onClick={redo}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors tooltip"
            data-tooltip="Redo (Ctrl+Shift+Z)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          <button
            onClick={() => setNodes([])}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors tooltip"
            data-tooltip="Clear All"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </Panel>
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