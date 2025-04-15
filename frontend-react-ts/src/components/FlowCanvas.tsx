import React, { useCallback, useRef, useEffect, useMemo } from 'react';
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
  useNodesState,
  useEdgesState,
  OnConnectStart,
  OnConnectEnd,
  Connection,
  NodeTypes
} from 'reactflow';
import 'reactflow/dist/style.css';

// Import custom hooks
import { useHistory } from '../hooks/useHistory';
import { useClipboard } from '../hooks/useClipboard';
import { useFlowSync } from '../hooks/useFlowSync';
import { useNodeHandlers } from '../hooks/useNodeHandlers';
import { useConsoleErrorOverride } from '../hooks/useConsoleErrorOverride';
import { createNewNode } from '../utils/flowUtils';
// Import Zustand store
import { setNodes, setEdges, setSelectedNodeId, useFlowStructureStore, applyNodeSelection } from '../store/useFlowStructureStore';
import { isEqual } from 'lodash';

// Node type imports
import LLMNode from './nodes/LLMNode';
import APINode from './nodes/APINode';
import OutputNode from './nodes/OutputNode';
import JSONExtractorNode from './nodes/JSONExtractorNode';
import InputNode from './nodes/InputNode';
import GroupNode from './nodes/GroupNode';
import ConditionalNode from './nodes/ConditionalNode';
import MergerNode from './nodes/MergerNode';
import WebCrawlerNode from './nodes/WebCrawlerNode';
import { NodeData, NodeType } from '../types/nodes';
import { SelectionModifierKey } from '../store/useFlowStructureStore';

// Custom wrapper to remove default React Flow node styling
export const NodeWrapper = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: 'relative' }} className="react-flow__node pointer-events-auto">
    {children}
  </div>
);

// Map of node types to components
const nodeTypes: Record<string, React.ComponentType<any>> = {
  llm: LLMNode,
  api: APINode,
  output: OutputNode,
  'json-extractor': JSONExtractorNode,
  input: InputNode,
  group: GroupNode,
  conditional: ConditionalNode,
  merger: MergerNode,
  webCrawler: WebCrawlerNode
};

// Default viewport
const defaultViewport = { x: 0, y: 0, zoom: 1 };

// API exported to parent components
export interface FlowCanvasApi {
  addNodes: (nodes: Node<NodeData>[]) => void;
  forceSync: () => void;
  commitStructure: () => void;
}

interface FlowCanvasProps {
  onNodeSelect: (node: Node<NodeData> | null) => void;
  registerReactFlowApi?: (api: FlowCanvasApi) => void;
}

// Define the expected shape of the selectionHandlers
interface SelectionHandlers {
  handleSelectionChange: (selectedNodeIds: string[], modifierKey?: SelectionModifierKey) => void;
  isShiftPressed: React.MutableRefObject<boolean>;
  isCtrlPressed: React.MutableRefObject<boolean>;
  getActiveModifierKey: () => SelectionModifierKey;
  normalizeSelectionState: () => void;
  forceDeselection: () => void;
}

// Component implementation
export const FlowCanvas = React.memo(({ onNodeSelect, registerReactFlowApi }: FlowCanvasProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  // Access React Flow instance
  const { project } = useReactFlow();
  
  // Flag to track if we're restoring history (to avoid feedback loops)
  const isRestoringHistory = useRef(false);
  
  // Flag to track if we normalized selection state
  const didNormalizeRef = useRef(false);
  
  // Get the current paste version for key regeneration
  const pasteVersion = window._devFlags?.pasteVersion || 0;
  
  // Initialize flow sync hook for the local ReactFlow state
  // This handles syncing to/from Zustand store, and tracks selection state
  const { 
    localNodes, 
    localEdges, 
    setLocalNodes, 
    setLocalEdges, 
    onLocalNodesChange, 
    onLocalEdgesChange,
    forceSyncFromStore,
    commitStructureToStore,
    selectionHandlers
  } = useFlowSync({ isRestoringHistory });

  useConsoleErrorOverride();
  
  // Add nodes utility function
  const addNodes = useCallback((nodes: Node<NodeData>[]) => {
    console.log('Adding nodes:', nodes);
    setLocalNodes(nds => [...nds, ...nodes]);
  }, [setLocalNodes]);
  
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
    handlePaste
  } = useClipboard();
  
  // Node handlers now operate on Zustand state
  const { 
    handleConnect,
    handleSelectionChange: nodeHandlersSelectionChange, // Renamed to avoid collision
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
        setSelectedNodeId(node?.id || null); // Update Zustand selectedNodeId
      }, 
      pushToHistory, 
      isRestoringHistory 
    }
  );

  // Create a combined selection handler that uses both the node handlers and selection sync handlers
  const handleSelectionChangeIntegrated = useCallback((params: any) => {
    // Extract selected nodes from params
    const selectedNodeIds = params.nodes.map((node: Node) => node.id);
    
    // Check if this is a deselection event (empty selection)
    const isDeselection = selectedNodeIds.length === 0;
    
    // For a deselection event (clicking on canvas), use our special handler
    // that forces proper synchronization of selection states
    if (isDeselection) {
      console.log('[FlowCanvas] Canvas deselection detected, forcing complete deselection');
      
      // First, let nodeHandlers update the sidebar
      nodeHandlersSelectionChange(params);
      
      // Then force a complete deselection sync
      selectionHandlers.forceDeselection();
    } else {
      // For normal selection, use the regular flow
      
      // First, let nodeHandlers update the sidebar
      nodeHandlersSelectionChange(params);
      
      // Then, let selectionSync handle the sync between ReactFlow and Zustand
      selectionHandlers.handleSelectionChange(selectedNodeIds);
    }
  }, [nodeHandlersSelectionChange, selectionHandlers]);
  
  // Register the API functions with the parent component
  useEffect(() => {
    if (registerReactFlowApi) {
      registerReactFlowApi({ 
        addNodes,
        forceSync: forceSyncFromStore, // Now references Zustand
        commitStructure: () => commitStructureToStore() // Now commits to Zustand
      });
    }
  }, [registerReactFlowApi, addNodes, forceSyncFromStore]);

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
  
  // Selection consistency check - run only once after initial mount
  // This ensures multi-selection drag works even after a refresh
  useEffect(() => {
    // Skip if we're restoring history
    if (isRestoringHistory.current) return;
    
    // We only need to normalize selection state once after initial mount
    if (!didNormalizeRef.current) {
      console.log("[FlowCanvas] Running one-time selection normalization");
      selectionHandlers.normalizeSelectionState();
      didNormalizeRef.current = true;
    }
    
  }, [selectionHandlers, isRestoringHistory]);

  // Define connection callbacks at component level instead of inline
  const handleConnectStart: OnConnectStart = useCallback((event, params) => {
    console.log("[FlowCanvas] Connection start:", params);
  }, []);
  
  const handleConnectEnd: OnConnectEnd = useCallback((event) => {
    // Connection failures can be detected here
    const target = event.target as HTMLElement;
    const isHandle = target.classList.contains('react-flow__handle');
    
    if (!isHandle) {
      console.log("[FlowCanvas] Connection ended on non-handle element");
    }
  }, []);

  return (
    <div 
      ref={reactFlowWrapper} 
      className="w-full h-full relative"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        // Use pasteVersion as part of the key to force remount after paste
        key={`flow-${pasteVersion}`}
        nodes={localNodes}
        edges={localEdges}
        onNodesChange={onLocalNodesChange}
        onEdgesChange={onLocalEdgesChange}
        onConnect={handleConnect}
        onSelectionChange={handleSelectionChangeIntegrated}
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
        // Additional connection validation and configuration
        connectOnClick={false}
        disableKeyboardA11y={false}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Control"
        selectionKeyCode="Shift"
        zoomActivationKeyCode="Alt"
        // Make sure that edge connections only happen when handle IDs are valid
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
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