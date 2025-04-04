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

// Import node components
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
  forceSync: () => void;
}

interface FlowCanvasProps {
  onNodeSelect: (node: Node | null) => void;
  registerReactFlowApi?: (api: FlowCanvasApi) => void;
}

const defaultViewport = { x: 0, y: 0, zoom: 1 };

export const FlowCanvas = React.memo(({ onNodeSelect, registerReactFlowApi }: FlowCanvasProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project, addNodes } = useReactFlow();
  
  // Initialize isRestoringHistory ref first as it's needed by other hooks
  const isRestoringHistory = useRef<boolean>(false);

  // Use the flow sync hook to manage local state and sync with Redux
  const { 
    localNodes, 
    localEdges, 
    setLocalNodes, 
    setLocalEdges,
    forceSync
  } = useFlowSync({ isRestoringHistory });
  
  // Use the history hook for undo/redo functionality
  const { 
    pushToHistory, 
    undo, 
    redo 
  } = useHistory(
    { initialNodes: localNodes, initialEdges: localEdges },
    setLocalNodes,
    setLocalEdges
  );
  
  // Use the clipboard hook for copy/paste functionality
  const { 
    handleCopy, 
    handlePaste 
  } = useClipboard(pushToHistory);
  
  // Use the node handlers hook for node and edge changes
  const { 
    handleNodesChange,
    handleEdgesChange,
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
  
  // Register the addNodes function with the parent component
  useEffect(() => {
    if (registerReactFlowApi) {
      registerReactFlowApi({ 
        addNodes,
        forceSync
      });
    }
  }, [registerReactFlowApi, addNodes, forceSync]);

  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
        handleCopy();
      }
      
      // Handle ctrl/cmd + v for paste
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
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

  // Handle node dropping
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

      // Check if we're dropping onto a group node - improved detection
      const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
      const groupElement = elementsAtPoint.find(el => 
        el.classList.contains('react-flow__node') && 
        el.getAttribute('data-type') === 'group'
      );
      
      // Get the first group node if any
      const parentGroup = groupElement
        ? localNodes.find(n => n.type === 'group' && n.id === groupElement.getAttribute('data-id'))
        : null;

      // Use the createNewNode helper function
      const newNode = createNewNode(nodeType, position);
      
      // If dropping inside a group, set the parentNode property
      if (parentGroup) {
        newNode.parentNode = parentGroup.id;
        // Adjust position to be relative to the parent
        newNode.position = {
          x: position.x - parentGroup.position.x,
          y: position.y - parentGroup.position.y
        };
        
        console.log(`[Drop] Adding node ${newNode.id} as child of group ${parentGroup.id}`);
      } else {
        console.log(`[Drop] Adding standalone node ${newNode.id}`);
      }

      setLocalNodes((nds) => [...nds, newNode]);
      pushToHistory([...localNodes, newNode], localEdges);
    },
    [project, setLocalNodes, localNodes, localEdges, pushToHistory]
  );

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeDragStop={handleNodeDragStop}
        onSelectionDragStop={handleSelectionDragStop}
        onSelectionChange={handleSelectionChange}
        connectionLineType={ConnectionLineType.Bezier}
        defaultViewport={defaultViewport}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        deleteKeyCode={null}
        selectNodesOnDrag={false}
      >
        <Controls />
        <MiniMap />
        <Background gap={12} size={1} />
        
        <Panel position="top-right">
          <div className="flex space-x-2">
            <button 
              onClick={undo} 
              className="px-3 py-1 bg-blue-500 text-white rounded"
            >
              Undo
            </button>
            <button 
              onClick={redo} 
              className="px-3 py-1 bg-blue-500 text-white rounded"
            >
              Redo
            </button>
            <button 
              onClick={handleCopy} 
              className="px-3 py-1 bg-green-500 text-white rounded"
            >
              Copy
            </button>
            <button 
              onClick={handlePaste} 
              className="px-3 py-1 bg-green-500 text-white rounded"
            >
              Paste
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
});

// Export a provider-wrapped version to handle react-flow context
export const FlowCanvasWithProvider = (props: FlowCanvasProps) => (
  <ReactFlowProvider>
    <FlowCanvas {...props} />
  </ReactFlowProvider>
);

export default FlowCanvasWithProvider;