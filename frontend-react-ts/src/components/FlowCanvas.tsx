import React, { useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  ReactFlow,
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
  NodeTypes,
  ReactFlowInstance,
  OnInit
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import isEqual from 'lodash/isEqual';

// Import custom hooks
import { useClipboard } from '../hooks/useClipboard';
import { useNodeHandlers } from '../hooks/useNodeHandlers';
import { useConsoleErrorOverride } from '../hooks/useConsoleErrorOverride';
import { createNewNode } from '../utils/flow/flowUtils';
// Import Zustand store & actions
import { 
  useFlowStructureStore,
  useNodes,
  useEdges,
  onNodesChange as onZustandNodesChange,
  onEdgesChange as onZustandEdgesChange,
  setSelectedNodeIds
} from '../store/useFlowStructureStore';
import { undo, redo } from '../store/useHistoryStore';

// Node type imports
import LLMNode from './nodes/LLMNode';
import APINode from './nodes/APINode';
import OutputNode from './nodes/OutputNode';
import JSONExtractorNode from './nodes/JSONExtractorNode';
import InputNode from './nodes/InputNode';
import GroupNode from './nodes/GroupNode';
import { ConditionalNode } from './nodes/ConditionalNode';
import MergerNode from './nodes/MergerNode';
import WebCrawlerNode from './nodes/WebCrawlerNode';
import { NodeData, NodeType } from '../types/nodes';

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
  'web-crawler': WebCrawlerNode
};

// Default viewport
const defaultViewport = { x: 0, y: 0, zoom: 1 };

// API exported to parent components
export interface FlowCanvasApi {
  clearNodes: () => void;
  reactFlowInstance?: ReactFlowInstance<Node<NodeData>, Edge>;
}

interface FlowCanvasProps {
  onNodeSelect: (nodeIds: string[] | null) => void;
  registerReactFlowApi?: (api: FlowCanvasApi) => void;
  children?: React.ReactNode;
}

// Component implementation
export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  onNodeSelect,
  registerReactFlowApi,
  children
}) => {
  const reactFlowRef = useRef<HTMLDivElement>(null);
  const reactFlowInstanceRef = useRef<ReactFlowInstance<Node<NodeData>, Edge> | null>(null);
  const didNormalizeRef = useRef<boolean>(false);
  const isRestoringHistoryRef = useRef<boolean>(false);
  
  // ReactFlow hooks
  const { screenToFlowPosition } = useReactFlow();
  
  // Use Zustand for flow structure instead of local state
  const nodes = useNodes();
  const edges = useEdges();
  const { setNodes, setEdges } = useFlowStructureStore.getState();
  
  useConsoleErrorOverride();
  
  // Node handlers now operate on Zustand state
  const { 
    handleConnect,
    handleNodeDragStop,
    handleSelectionDragStop,
    handleEdgesDelete,
    handleNodesDelete
  } = useNodeHandlers({
    onNodeSelect: (node) => {
      // Selection logic is now handled by onSelectionChange callback
      if (node) {
        console.log(`[FlowCanvas] Node selected: ${node.id}`);
        onNodeSelect([node.id]); // Call with node.id instead of node object
      } else {
        console.log(`[FlowCanvas] Node selection cleared`);
        onNodeSelect(null);
      }
    }
  });
  
  // 클립보드 초기화 및 기능 설정
  const { handleCopy, handlePaste, canPaste } = useClipboard();
  
  // 선택된 노드를 삭제하는 핸들러
  const handleDeleteSelectedNodes = useCallback(() => {
    const selectedNodes = nodes.filter(node => node.selected);
    if (selectedNodes.length > 0) {
      console.log(`[FlowCanvas] 선택된 ${selectedNodes.length}개 노드 삭제`);
      handleNodesDelete(selectedNodes as Node<NodeData>[]);
    }
  }, [nodes, handleNodesDelete]);
  
  // 직접 키보드 이벤트 처리 로직 추가
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    console.log(`[FlowCanvas] 키보드 이벤트 감지: key=${event.key}, ctrl=${event.ctrlKey}, meta=${event.metaKey}`);
    
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;
    
    const targetElement = event.target as HTMLElement;
    const isInputFocused = 
      targetElement.tagName === 'INPUT' || 
      targetElement.tagName === 'TEXTAREA' || 
      targetElement.isContentEditable;
      
    if (isInputFocused) {
      console.log('[FlowCanvas] 입력 필드에 포커스 중, 단축키 무시');
      return;
    }
    
    if (isCtrlOrCmd && event.key.toLowerCase() === 'c') {
      console.log('[FlowCanvas] Ctrl/Cmd+C 감지, 복사 시작...');
      event.preventDefault();
      handleCopy();
    } else if (isCtrlOrCmd && event.key.toLowerCase() === 'v') {
      console.log('[FlowCanvas] Ctrl/Cmd+V 감지, 붙여넣기 시작...');
      event.preventDefault();
      const centerPosition = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
      handlePaste(centerPosition);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      // Delete 키 또는 Backspace 키로 선택된 노드 삭제
      console.log(`[FlowCanvas] ${event.key} 키 감지, 선택된 노드 삭제 시작...`);
      event.preventDefault();
      handleDeleteSelectedNodes();
    }
  }, [handleCopy, handlePaste, screenToFlowPosition, handleDeleteSelectedNodes]);

  // 키보드 이벤트 리스너 등록
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
  
  // 패널 버튼 핸들러를 메모이제이션
  const handleUndo = useCallback(() => {
    undo();
  }, []);
  
  const handleRedo = useCallback(() => {
    redo();
  }, []);
  
  const handleClearAll = useCallback(() => {
    console.log('[FlowCanvas] Clear All button clicked');
    setNodes([]);
    setEdges([]);
    setSelectedNodeIds([]);
  }, [setNodes, setEdges]);
  
  // 선택 변경을 처리하는 핸들러 최적화
  const handleSelectionChange = useCallback(({ nodes: selectedFlowNodes = [] }: { nodes: Node[] }) => {
    console.log('[FlowCanvas] handleSelectionChange called with nodes:', selectedFlowNodes.map(n => n.id));
    if (isRestoringHistoryRef.current) {
      console.log('[FlowCanvas] Skipping selection change during history restore.');
      return;
    }
    const selectedIds = selectedFlowNodes.map(node => node.id);
    setSelectedNodeIds(selectedIds);
    
    // Pass all selected node IDs to the parent component
    console.log(`[FlowCanvas] Directly calling onNodeSelect with ${selectedIds.length} nodes: ${selectedIds.join(', ')}`);
    onNodeSelect(selectedIds.length > 0 ? selectedIds : null);
  }, [isRestoringHistoryRef, onNodeSelect]);
  
  // onDragOver, onDrop handlers
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowRef.current?.getBoundingClientRect();
      const nodeType = event.dataTransfer.getData('application/reactflow') as NodeType;

      if (!nodeType || !reactFlowBounds) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      // 1. 먼저 새 노드 생성
      const newNode = createNewNode(nodeType, position);
      
      // 2. 드롭 위치에 그룹 노드가 있는지 확인
      const { reactFlowInstance } = useReactFlow();
      const groupNodes = nodes.filter(node => node.type === 'group');
      
      let parentGroupId = null;
      
      // 그룹 노드들을 순회하며 새 노드가 그룹 내에 위치하는지 확인
      for (const groupNode of groupNodes) {
        // 그룹 노드의 영역을 계산 (position, width, height 사용)
        if (
          position.x >= groupNode.position.x && 
          position.x <= groupNode.position.x + (groupNode.width || 1200) &&
          position.y >= groupNode.position.y && 
          position.y <= groupNode.position.y + (groupNode.height || 700)
        ) {
          // 이 그룹 노드 내부에 드롭됨
          parentGroupId = groupNode.id;
          break;
        }
      }
      
      // 3. 부모 그룹이 발견되면 parentNode만 설정 (위치 변환이나 extent 설정 안 함)
      if (parentGroupId) {
        newNode.parentNode = parentGroupId;
        
        // 절대 위치 그대로 유지 (상대 위치로 변환하지 않음)
        // extent 속성도 설정하지 않음
      }
      
      // 4. 노드 추가
      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes, nodes]
  );
  
  // Selection consistency check - run only once after initial mount
  // This ensures multi-selection drag works even after a refresh
  useEffect(() => {
    // Skip if we're restoring history
    if (isRestoringHistoryRef.current) return;
    
    // We only need to normalize selection state once after initial mount
    if (!didNormalizeRef.current) {
      didNormalizeRef.current = true;
    }
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 의존성 배열을 비워 마운트 시 한 번만 실행

  // Register React Flow API for external components to use
  const registerApi: OnInit<Node<NodeData>, Edge> = useCallback((reactFlowInstance: ReactFlowInstance<Node<NodeData>, Edge>) => {
    console.log('[FlowCanvas] Registering React Flow API:', reactFlowInstance);
    if (!reactFlowInstance) {
      console.error('[FlowCanvas] Attempted to register null API');
      return;
    }
    
    // Store the instance for external access
    reactFlowInstanceRef.current = reactFlowInstance;
    
    // 필요한 최소 API만 구성
    const minimalApi: FlowCanvasApi = {
      clearNodes: handleClearAll,
      reactFlowInstance: reactFlowInstance
    };
    
    // Set the API reference for external components
    if (registerReactFlowApi) {
      registerReactFlowApi(minimalApi);
    }
  }, [registerReactFlowApi, handleClearAll]);
  
  return (
    <div 
      ref={reactFlowRef} 
      className="w-full h-full relative"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onZustandNodesChange}
        onEdgesChange={onZustandEdgesChange}
        onSelectionChange={handleSelectionChange}
        onConnect={handleConnect}
        multiSelectionKeyCode={['Shift', 'Control', 'Meta']}
        selectionKeyCode={'Shift'}
        zoomActivationKeyCode={'Alt'}
        deleteKeyCode={['Delete', 'Backspace']}
        nodeTypes={nodeTypes}
        fitView
        defaultViewport={defaultViewport}
        attributionPosition="bottom-right"
        connectionLineType={ConnectionLineType.Bezier}
        connectionRadius={30}
        snapToGrid
        snapGrid={[15, 15]}
        className="w-full h-full bg-dot-pattern"
        connectOnClick={false}
        disableKeyboardA11y={false}
        onInit={registerApi}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onNodeDragStop={handleNodeDragStop}
        onSelectionDragStop={handleSelectionDragStop}
      >
        <Controls position="bottom-right" />
        <MiniMap position="bottom-left" zoomable pannable />
        <Background gap={15} color="#d9e1ec" />
        <Panel position="top-right" className="bg-white rounded-lg shadow-lg p-3 space-y-2 flex flex-col">
          <button
            onClick={handleUndo}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors tooltip"
            data-tooltip="Undo (Ctrl+Z)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <button
            onClick={handleRedo}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors tooltip"
            data-tooltip="Redo (Ctrl+Shift+Z)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          <button
            onClick={handleClearAll}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors tooltip"
            data-tooltip="Clear All"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </Panel>
        {children}
      </ReactFlow>
    </div>
  );
};

// Define props for FlowCanvasWrapper if needed, otherwise remove if FlowCanvas is used directly
interface FlowCanvasWrapperProps {
  onNodeSelect: (nodeIds: string[] | null) => void;
  registerReactFlowApi?: (api: FlowCanvasApi) => void;
  children?: React.ReactNode;
}

// This wrapper might be unnecessary if FlowEditor directly renders FlowCanvas within ReactFlowProvider
export const FlowCanvasWrapper: React.FC<FlowCanvasWrapperProps> = (props) => (
    <ReactFlowProvider>
        <FlowCanvas {...props} />
    </ReactFlowProvider>
);