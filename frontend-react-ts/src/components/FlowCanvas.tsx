import React, { useCallback, useRef, useEffect } from 'react';
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
  ReactFlowInstance,
  OnInit,
  OnSelectionChangeParams
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Import custom hooks
import { useClipboard } from '../hooks/useClipboard';
import { useNodeHandlers } from '../hooks/useNodeHandlers';
import { useConsoleErrorOverride } from '../hooks/useConsoleErrorOverride';
import { createNewNode } from '../utils/flow/flowUtils';
import { updateNodeParentRelationships, prepareNodesForReactFlow, relativeToAbsolutePosition, getIntersectingGroupId, addNodeToGroup, isNodeInGroup, sortNodesForRendering } from '../utils/flow/nodeUtils';
// Import Zustand store & actions
import { 
  useFlowStructureStore,
  useNodes,
  useEdges,
  onNodesChange,
  onEdgesChange,
  setSelectedNodeIds,
  setNodes as setZustandNodes,
  setEdges as setZustandEdges
} from '../store/useFlowStructureStore';
import { useCanUndo, useCanRedo, undo, redo } from '../store/useHistoryStore';

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
  forceClearLocalState?: () => void;
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
  const { screenToFlowPosition, getNodes: getReactFlowNodes, setNodes: setReactFlowNodes } = useReactFlow();
  
  // Use Zustand for flow structure instead of local state
  const nodes = useNodes();
  const edges = useEdges();
  
  // 실행 취소/다시 실행 상태
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  
  useConsoleErrorOverride();
  
  // Node handlers now operate on Zustand state
  const { 
    handleConnect,
    handleNodeDragStop,
    handleSelectionDragStop,
    handleEdgesDelete,
    handleNodesDelete
  } = useNodeHandlers({
    onNodeSelect: (nodeIds) => {
      // Selection logic is now handled by onSelectionChange callback
      if (nodeIds) {
        console.log(`[FlowCanvas] Nodes selected: ${nodeIds.join(', ')}`);
        onNodeSelect(nodeIds); // 이미 노드 ID 배열을 받고 있음
      } else {
        console.log(`[FlowCanvas] Node selection cleared`);
        onNodeSelect(null);
      }
    }
  });
  
  // 클립보드 초기화 및 기능 설정
  const { handleCopy, handlePaste } = useClipboard();
  
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
    if (canUndo) {
      console.log("[FlowCanvas] Undo triggered via UI button");
      // 실행 취소 수행
      undo();
      
      // 상태 변경 감지를 위한 미세한 지연
      setTimeout(() => {
        // 현재 Zustand 스토어 상태 가져오기
        const currentState = useFlowStructureStore.getState();
        // 노드와 엣지를 다시 설정하여 React Flow에 반영
        // TypeScript 에러 해결: 함수가 아닌 배열을 전달
        setZustandNodes([...currentState.nodes]);
        setZustandEdges([...currentState.edges]);
      }, 10); // 지연 시간을 약간 늘려 확실히 적용되도록 함
    }
  }, [canUndo]);
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      console.log("[FlowCanvas] Redo triggered via UI button");
      // 다시 실행 수행
      redo();
      
      // 상태 변경 감지를 위한 미세한 지연
      setTimeout(() => {
        // 현재 Zustand 스토어 상태 가져오기
        const currentState = useFlowStructureStore.getState();
        // 노드와 엣지를 다시 설정하여 React Flow에 반영
        // TypeScript 에러 해결: 함수가 아닌 배열을 전달
        setZustandNodes([...currentState.nodes]);
        setZustandEdges([...currentState.edges]);
      }, 10); // 지연 시간을 약간 늘려 확실히 적용되도록 함
    }
  }, [canRedo]);
  
  const handleClearAll = useCallback(() => {
    console.log('[FlowCanvas] Clear All button clicked');
    // 모든 노드와 엣지 지우기
    setZustandNodes([]);
    setZustandEdges([]);
    setSelectedNodeIds([]);
    
    // 미세한 지연으로 React Flow 업데이트 보장
    setTimeout(() => {
      const currentState = useFlowStructureStore.getState();
      // 빈 배열로 다시 설정하여 React Flow에 반영
      setZustandNodes(currentState.nodes); // 이미 빈 배열일 것이므로 그대로 사용
      setZustandEdges(currentState.edges);
      
      // 뷰 재설정을 통해 캔버스 갱신
      reactFlowInstanceRef.current?.fitView();
    }, 10);
  }, [setZustandNodes, setZustandEdges]);
  
  // 선택 변경을 처리하는 핸들러 최적화
  const handleSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    console.log('[FlowCanvas] handleSelectionChange called with params:', params);
    
    // Use the correct structure based on OnSelectionChangeParams
    const selectedFlowNodes: Node[] = params.nodes; 
    const selectedFlowEdges: Edge[] = params.edges; // Also capture selected edges
    
    if (isRestoringHistoryRef.current) {
      console.log('[FlowCanvas] Skipping selection change during history restore.');
      return;
    }

    // Handle node selection
    const selectedNodeIds = selectedFlowNodes.map((node: Node) => node.id); // Explicitly type node
    setSelectedNodeIds(selectedNodeIds); 
    
    // Handle edge selection (store or pass if needed, currently just logging)
    const selectedEdgeIds = selectedFlowEdges.map((edge: Edge) => edge.id);
    if (selectedEdgeIds.length > 0) {
      console.log('[FlowCanvas] Selected edges:', selectedEdgeIds);
      // TODO: Store or handle selected edge IDs if necessary
      // For now, we prioritize node selection for the side panel
    }
    
    // Pass only selected node IDs to the parent component as before
    console.log(`[FlowCanvas] Directly calling onNodeSelect with ${selectedNodeIds.length} nodes: ${selectedNodeIds.join(', ')}`);
    onNodeSelect(selectedNodeIds.length > 0 ? selectedNodeIds : null);
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

      // Use project directly if available
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      console.log(`[onDrop] Node type ${nodeType} dropped at absolute position=(${position.x}, ${position.y})`);

      // 1. Create the new node with absolute position
      const newNode = createNewNode(nodeType, position);

      // 2. Get current nodes from Zustand
      const currentNodes = nodes;

      // 3. Check if the drop position intersects with any group
      // Temporarily add the new node to check intersection
      const tempNodeForCheck = { ...newNode, width: 150, height: 50 }; // Use default/estimated dimensions
      const intersectingGroupId = getIntersectingGroupId(tempNodeForCheck, currentNodes);

      let updatedNodes;

      if (intersectingGroupId) {
        console.log(`[onDrop] Dropped inside group ${intersectingGroupId}. Adding node to group.`);
        const groupNode = currentNodes.find(n => n.id === intersectingGroupId);
        if (groupNode) {
          // Use addNodeToGroup utility which handles relative positioning and sorting
          updatedNodes = addNodeToGroup(newNode, groupNode, currentNodes);
        } else {
          console.warn(`[onDrop] Intersecting group ${intersectingGroupId} not found! Adding node to root.`);
          // Fallback: Add node without parent, but ensure sorting
          updatedNodes = sortNodesForRendering([...currentNodes, newNode]);
        }
      } else {
        console.log(`[onDrop] Dropped outside any group. Adding node to root.`);
        // Add node without parent, ensure sorting
        updatedNodes = sortNodesForRendering([...currentNodes, newNode]);
      }

      // 4. Update Zustand state directly
      setZustandNodes(updatedNodes);
      console.log('[onDrop] Updated Zustand state with new node.');

    },
    [screenToFlowPosition, nodes, setZustandNodes, getIntersectingGroupId, addNodeToGroup, sortNodesForRendering] // Include dependencies
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

  // 컴포넌트가 마운트될 때 한 번 처리하는 효과
  useEffect(() => {
    // 마운트 시 한 번 React Flow에 맞게 노드를 처리
    if (nodes.length > 0) {
      const processedNodes = prepareNodesForReactFlow(nodes);
      setReactFlowNodes(processedNodes);
    }
  }, []);

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
      reactFlowInstance: reactFlowInstance,
      forceClearLocalState: () => {
        console.log('[FlowCanvas] Force clear local state via API');
        // 노드와 엣지를 비우고 캔버스 초기화
        setZustandNodes([]);
        setZustandEdges([]);
        setSelectedNodeIds([]);
        // 뷰 재설정
        reactFlowInstance.fitView();
      }
    };
    
    // Set the API reference for external components
    if (registerReactFlowApi) {
      registerReactFlowApi(minimalApi);
    }
    
    // React Flow가 초기화된 후 부모-자식 관계 한 번 더 확인
    setTimeout(() => {
      const currentNodes = getReactFlowNodes() as Node<NodeData>[];
      console.log('[FlowCanvas] React Flow 초기화 후 부모-자식 관계 확인');
      
      // 모든 노드에 대해 부모-자식 관계 확인 및 업데이트
      const updatedNodes = updateNodeParentRelationships(currentNodes);
      
      // 변경된 노드가 있는 경우만 업데이트
      const hasChanges = updatedNodes.some((updatedNode, index) => {
        const currentNode = currentNodes[index];
        // parentId 뿐만 아니라 parentNode 속성도 확인
        return updatedNode.parentId !== currentNode.parentId || 
               (currentNode as any).parentNode !== (updatedNode.parentId || null);
      });
      
      if (hasChanges) {
        console.log('[FlowCanvas] 초기화 후 부모-자식 관계 변경 감지, 강제 업데이트');
        
        // 부모 노드 속성 보완
        const nodesWithBothParents = updatedNodes.map(node => {
          if (node.parentId) {
            return {...node, parentNode: node.parentId};
          }
          return {...node, parentNode: null}; // parentId가 없으면 parentNode도 명시적으로 null로 설정
        });
        
        // React Flow 상태 업데이트
        setReactFlowNodes(nodesWithBothParents);
        
        // Zustand 상태 업데이트
        setTimeout(() => setZustandNodes(nodesWithBothParents), 50);
      }
    }, 300); // 충분한 시간 여유
  }, [registerReactFlowApi, handleClearAll, getReactFlowNodes, setReactFlowNodes]);
  
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
        <Panel position="top-right" className="bg-white rounded-lg shadow-lg p-3 space-y-2 flex flex-col mr-4 self-center">
          <button
            onClick={handleUndo}
            className={`p-2 rounded-lg hover:bg-gray-100 transition-colors tooltip ${!canUndo ? 'opacity-50 cursor-not-allowed' : ''}`}
            data-tooltip="실행 취소 (Ctrl+Z)"
            aria-label="실행 취소"
            disabled={!canUndo}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <button
            onClick={handleRedo}
            className={`p-2 rounded-lg hover:bg-gray-100 transition-colors tooltip ${!canRedo ? 'opacity-50 cursor-not-allowed' : ''}`}
            data-tooltip="다시 실행 (Ctrl+Shift+Z)"
            aria-label="다시 실행"
            disabled={!canRedo}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          <button
            onClick={handleClearAll}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors tooltip"
            data-tooltip="모두 지우기"
            aria-label="모두 지우기"
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