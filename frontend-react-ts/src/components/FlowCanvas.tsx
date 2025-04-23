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
  OnInit
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Import custom hooks
import { useClipboard } from '../hooks/useClipboard';
import { useNodeHandlers } from '../hooks/useNodeHandlers';
import { useConsoleErrorOverride } from '../hooks/useConsoleErrorOverride';
import { createNewNode } from '../utils/flow/flowUtils';
import { updateNodeParentRelationships, prepareNodesForReactFlow } from '../utils/flow/nodeUtils';
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
      
      console.log(`[onDrop] 노드 타입 ${nodeType} 드롭됨, 위치=(${position.x}, ${position.y})`);
      
      // 1. 먼저 새 노드 생성
      const newNode = createNewNode(nodeType, position);
      console.log(`[onDrop] 새 노드 생성: id=${newNode.id}, type=${newNode.type}`);
      
      // 2. 드롭 위치에 그룹 노드가 있는지 확인
      const groupNodes = nodes.filter(node => node.type === 'group');
      console.log(`[onDrop] 그룹 노드 개수: ${groupNodes.length}`);
      
      let parentGroupId = null;
      let parentGroupNode = null;
      
      // 그룹 노드들을 순회하며 새 노드가 그룹 내에 위치하는지 확인
      for (const groupNode of groupNodes) {
        const groupWidth = groupNode.width || 1200;
        const groupHeight = groupNode.height || 700;
        // 그룹 노드의 영역을 계산 (position, width, height 사용)
        if (
          position.x >= groupNode.position.x && 
          position.x <= groupNode.position.x + groupWidth &&
          position.y >= groupNode.position.y && 
          position.y <= groupNode.position.y + groupHeight
        ) {
          // 이 그룹 노드 내부에 드롭됨
          parentGroupId = groupNode.id;
          parentGroupNode = groupNode;
          console.log(`[onDrop] 드롭 위치가 그룹 ${groupNode.id} 내부에 있음. 경계=(${groupNode.position.x}, ${groupNode.position.y}, ${groupNode.position.x + groupWidth}, ${groupNode.position.y + groupHeight})`);
          break;
        } else {
          console.log(`[onDrop] 드롭 위치가 그룹 ${groupNode.id} 내부에 없음. 경계=(${groupNode.position.x}, ${groupNode.position.y}, ${groupNode.position.x + groupWidth}, ${groupNode.position.y + groupHeight})`);
        }
      }
      
      // 3. 부모 그룹이 발견되면 parentId 설정 및 좌표 변환
      if (parentGroupId && parentGroupNode) {
        console.log(`[onDrop] 노드 ${newNode.id}에 부모 그룹 ${parentGroupId} 설정`);
        
        // 절대 좌표를 부모 기준의 상대 좌표로 변환
        const absoluteX = position.x;
        const absoluteY = position.y;
        const relativeX = absoluteX - parentGroupNode.position.x;
        const relativeY = absoluteY - parentGroupNode.position.y;
        
        console.log(`[onDrop] 좌표 변환: 절대(${absoluteX}, ${absoluteY}) -> 상대(${relativeX}, ${relativeY})`);
        
        // 부모 ID 및 상대 좌표 설정
        newNode.parentId = parentGroupId;
        // React Flow 내부 속성도 설정 
        (newNode as any).parentNode = parentGroupId; 
        newNode.position = {
          x: relativeX, 
          y: relativeY
        };
      } else {
        console.log(`[onDrop] 노드 ${newNode.id}에 부모 그룹 없음`);
      }
      
      // 4. 노드 배열 재정렬하여 그룹 노드가 자식 노드보다 앞에 오도록 함
      const existingGroupNodes = [...nodes.filter(n => n.type === 'group')];
      const existingNonGroupNodes = [...nodes.filter(n => n.type !== 'group')];
      
      // 업데이트된 노드 배열: 그룹 -> 기존 일반 노드 -> 새 노드
      const updatedNodes = [...existingGroupNodes, ...existingNonGroupNodes, newNode];
      console.log(`[onDrop] Zustand 상태 업데이트: 노드 ${newNode.id} 추가됨. parentId=${newNode.parentId || '없음'}`);
      setZustandNodes(updatedNodes);
    },
    [screenToFlowPosition, setZustandNodes, nodes]
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

  // 노드의 부모-자식 관계를 업데이트하는 효과
  const updatingParentRelationsRef = useRef(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 이미 업데이트 중이거나 노드가 없으면 건너뜀
    if (updatingParentRelationsRef.current || nodes.length === 0) return;
    
    // 이전 타임아웃이 있으면 취소
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    // 짧은 지연 후 업데이트 수행 (연속적인 변경이 일어날 경우 마지막 변경 후에만 실행)
    updateTimeoutRef.current = setTimeout(() => {
      // 업데이트 플래그 설정
      updatingParentRelationsRef.current = true;
      
      try {
        // 부모-자식 관계 업데이트
        const updatedNodes = updateNodeParentRelationships(nodes);
        
        // React Flow 내부 상태와 Zustand 상태 비교
        const reactFlowNodes = getReactFlowNodes() as Node<NodeData>[];
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[FlowCanvas] React Flow 내부 노드 수: ${reactFlowNodes.length}, Zustand 노드 수: ${nodes.length}`);
          
          // 부모 관계가 있는 노드 확인
          const zustandParentNodes = nodes.filter(node => node.parentId).length;
          const reactFlowParentNodes = reactFlowNodes.filter((node: any) => node.parentId || node.parentNode).length;
          console.log(`[FlowCanvas] 부모가 있는 노드 - Zustand: ${zustandParentNodes}, React Flow: ${reactFlowParentNodes}`);
        }
        
        // 변경이 있는지 확인 (부모 ID와 parentNode 속성 모두 비교)
        const hasChanges = updatedNodes.some((updatedNode, index) => {
          if (index >= nodes.length) return false; // 배열 길이 차이 대응
          
          const originalNode = nodes[index];
          const rfNode = reactFlowNodes.find(n => n.id === originalNode.id);
          
          return updatedNode.parentId !== originalNode.parentId || 
                 (rfNode && (rfNode as any).parentNode !== (updatedNode.parentId || null));
        });
        
        // 변경이 있을 경우에만 상태 업데이트
        if (hasChanges) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[FlowCanvas] 부모-자식 관계가 변경되어 노드 상태 업데이트');
          }
          
          // ReactFlow용 노드 배열 생성 (parentNode 속성 등 설정)
          const nodesForReactFlow = prepareNodesForReactFlow(updatedNodes);
          
          // React Flow 내부 상태 직접 업데이트 (먼저)
          setReactFlowNodes(nodesForReactFlow);
          
          // 약간의 지연 후 Zustand 상태 업데이트 (동기화 문제 방지)
          setTimeout(() => {
            setZustandNodes(updatedNodes);
          }, 10);
        }
      } finally {
        // 업데이트 완료 플래그 설정
        updatingParentRelationsRef.current = false;
        updateTimeoutRef.current = null;
      }
    }, 300); // 300ms 딜레이로 여러 변경이 연속적으로 일어날 경우 최종 상태에서만 업데이트
    
    // 컴포넌트 언마운트 시 타임아웃 정리
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
    };
  }, [nodes, setZustandNodes, getReactFlowNodes, setReactFlowNodes]);

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