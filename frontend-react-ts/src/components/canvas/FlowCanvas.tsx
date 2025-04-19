import React, { useCallback, useRef, memo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  NodeTypes,
  EdgeTypes,
  OnSelectionChangeParams,
  SelectionMode,
  ReactFlowInstance,
  Panel,
  Node,
  // useNodesState, // 제거
  // useEdgesState, // 제거
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import 'tailwindcss/tailwind.css';

// Store hooks
import { useNodes, useEdges, useFlowActions, useSelectedNodeIds } from '../../store/useFlowStructureStore';
// import { useFlowSync } from '../../hooks/useFlowSync'; // 제거
import { useSettingsStore } from '../../store/useSettingsStore';
import { useViewModeStore } from '../../store/useViewModeStore';
import { useHistoryStore } from '../../store/useHistoryStore'; // For undo/redo

// Handlers & Utilities
import { useNodeHandlers } from '../../hooks/useNodeHandlers'; // 필요시 사용 가능
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useClipboard } from '../../hooks/useClipboard';
import { createIDBStorage } from '../../utils/storage/idbStorage'; // 필요시 유지
import { snapGrid, connectionLineStyle } from './canvasConfig';
import { NodeData } from '../../types/nodes'; // NodeData 타입 임포트

// Custom Nodes and Edges
import { nodeTypes } from '../nodes';
import { edgeTypes } from '../edges';

// --- Props Interface ---
interface FlowCanvasProps {
  onNodeSelect: (nodeId: string | null) => void;
  // Add other props if needed, e.g., for interacting with parent components
}

// --- Internal Canvas Component ---
const InternalFlowCanvas: React.FC<FlowCanvasProps> = memo(({ onNodeSelect }) => {
  // Zustand State and Actions
  const nodes = useNodes();
  const edges = useEdges();
  const { onNodesChange, onEdgesChange, setSelectedNodeIds, clearAll } = useFlowActions(); // Zustand 액션 사용
  const selectedNodeIds = useSelectedNodeIds(); // 선택된 ID 직접 사용
  const { undo, redo } = useHistoryStore((state) => state.actions); // Undo/Redo actions

  // Settings and View Mode
  const { snapToGrid, showMinimap, showControls } = useSettingsStore();
  const { isReadOnly } = useViewModeStore();

  // React Flow Instance
  const { setViewport, getViewport, screenToFlowPosition, flowToScreenPosition, getNodes } = useReactFlow(); // getNodes 추가
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // --- Remove useFlowSync ---
  // const { isLoading } = useFlowSync(setViewport); // 제거

  // --- Node Handlers --- 
  // useNodeHandlers는 여전히 drag stop, connect, delete 로직을 포함하므로,
  // 필요에 따라 ReactFlow props나 단축키에 연결할 수 있습니다.
  // 여기서는 명시적으로 <ReactFlow> prop에 연결하지 않고 단축키 위주로 연결합니다.
  const nodeHandlers = useNodeHandlers({ onNodeSelect }); // Keep for potential use in shortcuts etc.

  // --- Clipboard ---
  console.log('[FlowCanvas DEBUG] Setting up clipboard hooks'); // 디버그 메시지 추가
  const { handleCopy, handlePaste, canPaste } = useClipboard();
  console.log('[FlowCanvas DEBUG] Clipboard handlers ready:', { 
    handleCopyExists: !!handleCopy, 
    handlePasteExists: !!handlePaste 
  }); // 핸들러가 실제로 존재하는지 확인

  // --- Keyboard Shortcuts ---
  // 삭제 로직은 nodeHandlers 또는 직접 Zustand 액션 사용
  const handleDeleteSelection = useCallback(() => {
    console.log('[FlowCanvas DEBUG] handleDeleteSelection called'); // 디버그 메시지 추가
    const selectedNodes = getNodes().filter(n => selectedNodeIds.includes(n.id));
    // TODO: selectedEdges도 가져와서 처리해야 함
    if (selectedNodes.length > 0) {
      nodeHandlers.handleNodesDelete(selectedNodes as Node<NodeData>[]);
    }
    // TODO: Handle edge deletion if only edges are selected
  }, [getNodes, selectedNodeIds, nodeHandlers]);

  // 직접 키보드 이벤트 처리 로직 추가
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    console.log(`[FlowCanvas DEBUG] Direct keyDown: key=${event.key}, ctrl=${event.ctrlKey}, meta=${event.metaKey}`);
    
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;
    
    const targetElement = event.target as HTMLElement;
    const isInputFocused = 
      targetElement.tagName === 'INPUT' || 
      targetElement.tagName === 'TEXTAREA' || 
      targetElement.isContentEditable;
      
    if (isInputFocused) {
      console.log('[FlowCanvas DEBUG] Input focused, ignoring shortcut');
      return;
    }
    
    if (isCtrlOrCmd && event.key.toLowerCase() === 'c') {
      console.log('[FlowCanvas DEBUG] Directly calling handleCopy');
      handleCopy();
      event.preventDefault();
    } else if (isCtrlOrCmd && event.key.toLowerCase() === 'v') {
      console.log('[FlowCanvas DEBUG] Directly calling handlePaste');
      const centerPosition = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
      handlePaste(centerPosition);
      event.preventDefault();
    }
  }, [handleCopy, handlePaste, screenToFlowPosition]);

  // 직접 키보드 이벤트 리스너 등록
  useEffect(() => {
    console.log('[FlowCanvas DEBUG] Adding direct keyboard listener');
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      console.log('[FlowCanvas DEBUG] Removing direct keyboard listener');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // useKeyboardShortcuts 유지 (문제 진단용)
  console.log('[FlowCanvas DEBUG] Setting up keyboard shortcuts');
  useKeyboardShortcuts({
    onCopy: handleCopy,
    onPaste: handlePaste,
    onCut: null, // Remove onCut as it's not provided by useClipboard anymore
    onDuplicate: null, // Remove onDuplicate as it's not provided by useClipboard anymore
    onDelete: handleDeleteSelection, // Use custom handler
    onUndo: undo,
    onRedo: redo,
  });
  console.log('[FlowCanvas DEBUG] Keyboard shortcuts setup complete');

  // --- Selection Handling ---
  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      const newSelectedIds = params.nodes.map((n) => n.id);
      
      // Update Zustand (internally prevents duplicate updates)
      setSelectedNodeIds(newSelectedIds); 
      
      // Update sidebar (for single selection)
      onNodeSelect(newSelectedIds.length === 1 ? newSelectedIds[0] : null);
    },
    [setSelectedNodeIds, onNodeSelect]
  );

  // --- Initialization ---
  // Loading state removed
  // if (isLoading) {
  //   return <div className="flex items-center justify-center h-full">Loading Canvas...</div>;
  // }

  return (
    <ReactFlow
      nodes={nodes} // Direct from Zustand
      edges={edges} // Direct from Zustand
      onNodesChange={onNodesChange} // Direct from Zustand action
      onEdgesChange={onEdgesChange} // Direct from Zustand action
      onSelectionChange={handleSelectionChange} // Handles selection sync to Zustand
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      // These handlers are either covered by onNodesChange/onEdgesChange or specific handlers in useNodeHandlers
      onConnect={nodeHandlers.handleConnect} // Keep handleConnect from nodeHandlers
      // onNodesDelete={nodeHandlers.handleNodesDelete} // Handled by useKeyboardShortcuts
      // onEdgesDelete={nodeHandlers.handleEdgesDelete} // Handled by useKeyboardShortcuts or edge selection
      onNodeDragStop={nodeHandlers.handleNodeDragStop} // Keep drag stop handler
      onSelectionDragStop={nodeHandlers.handleSelectionDragStop} // Keep selection drag stop handler
      snapToGrid={snapToGrid}
      snapGrid={snapGrid}
      connectionLineStyle={connectionLineStyle}
      defaultViewport={{ x: 0, y: 0, zoom: 1 }} // Initial viewport
      minZoom={0.1}
      maxZoom={4}
      fitView // Fit view on initial load
      attributionPosition="bottom-left"
      deleteKeyCode={null} // Use custom delete handler via useKeyboardShortcuts
      multiSelectionKeyCode="Shift" // Allow multi-selection with Shift key
      selectionMode={SelectionMode.Partial} // Allow partial selection box
      nodesDraggable={!isReadOnly}
      nodesConnectable={!isReadOnly}
      elementsSelectable={!isReadOnly}
      selectNodesOnDrag={true}
      panOnDrag={[1, 2]} // Allow panning with middle mouse or right mouse
      onInit={setReactFlowInstance} // Store instance for clipboard etc.
    >
      {showMinimap && <MiniMap nodeStrokeWidth={3} zoomable pannable />}
      {showControls && <Controls />}
      <Background />
      
      {/* Example Panel - Can be customized */}
      <Panel position="top-right">
        <button onClick={clearAll} className="p-2 bg-red-500 text-white rounded shadow mr-2">Clear All</button>
        <button onClick={undo} className="p-2 bg-gray-500 text-white rounded shadow mr-2">Undo</button>
        <button onClick={redo} className="p-2 bg-gray-500 text-white rounded shadow">Redo</button>
      </Panel>
    </ReactFlow>
  );
});

// --- Main Component Wrapper with Provider ---
const FlowCanvas: React.FC<FlowCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <InternalFlowCanvas {...props} />
    </ReactFlowProvider>
  );
};

export default FlowCanvas; 