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
import { useHistory } from '../hooks/useHistory';
import { useClipboard } from '../hooks/useClipboard';
import { useFlowSync } from '../hooks/useFlowSync';
import { useNodeHandlers } from '../hooks/useNodeHandlers';
import { useConsoleErrorOverride } from '../hooks/useConsoleErrorOverride';
import { createNewNode } from '../utils/flowUtils';
// Import Zustand store
import { 
  setNodes, 
  setEdges, 
  useFlowStructureStore,
  setSelectedNodeIds
} from '../store/useFlowStructureStore';

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
  addNodes: (nodes: Node<NodeData>[]) => void;
  forceSync: () => void;
  clearNodes: () => void;
  reactFlowInstance?: ReactFlowInstance<Node<NodeData>, Edge>;
  forceClearLocalState: () => void;
}

interface FlowCanvasProps {
  onNodeSelect: (node: Node<NodeData> | null) => void;
  registerReactFlowApi?: (api: FlowCanvasApi) => void;
  children?: React.ReactNode;
  isRestoringHistory?: boolean;
}

// Component implementation
export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  onNodeSelect,
  registerReactFlowApi,
  children,
  isRestoringHistory = false
}) => {
  const reactFlowRef = useRef<HTMLDivElement>(null);
  const reactFlowInstanceRef = useRef<ReactFlowInstance<Node<NodeData>, Edge> | null>(null);
  const reactFlowApiRef = useRef<FlowCanvasApi | null>(null);
  const didNormalizeRef = useRef<boolean>(false);
  const isRestoringHistoryRef = useRef<boolean>(isRestoringHistory);
  
  // ReactFlow hooks
  const { screenToFlowPosition } = useReactFlow();
  
  // Use Zustand for flow structure instead of local state
  const { nodes, edges, setNodes, setEdges } = useFlowStructureStore();
  
  // Using FlowSync hook to manage local nodes/edges and sync with store
  const { 
    localNodes, 
    localEdges, 
    setLocalNodes, 
    setLocalEdges, 
    onLocalNodesChange, 
    onLocalEdgesChange,
    forceSyncFromStore,
    forceClearLocalState,
    flowResetKey
  } = useFlowSync({ isRestoringHistory: isRestoringHistoryRef });
  
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
    handleCopy 
  } = useClipboard();
  
  // Node handlers now operate on Zustand state
  const { 
    handleConnect,
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
        // Selection logic is now handled by onSelectionChange callback
        if (node) {
          console.log(`[FlowCanvas] Node selected: ${node.id}`);
        } else {
          console.log(`[FlowCanvas] Node selection cleared`);
        }
      }, 
      pushToHistory, 
      isRestoringHistory: isRestoringHistoryRef
    }
  );

  // 렌더링 최적화를 위한 메모이제이션 추가
  const memoizedNodes = useMemo(() => localNodes, [localNodes]);
  const memoizedEdges = useMemo(() => localEdges, [localEdges]);
  
  // 패널 버튼 핸들러를 메모이제이션
  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);
  
  const handleRedo = useCallback(() => {
    redo();
  }, [redo]);
  
  const handleClearAll = useCallback(() => {
    console.log('[FlowCanvas] Clear All button clicked');
    
    // 강제 초기화 모드 활성화
    if ('enableForceClear' in window.flowSyncUtils) {
      window.flowSyncUtils.enableForceClear(true);
    }
    
    // React Flow 인스턴스에 접근하여 직접 노드/엣지 초기화
    if (reactFlowInstanceRef.current) {
      reactFlowInstanceRef.current.setNodes([]);
      reactFlowInstanceRef.current.setEdges([]);
      console.log('[FlowCanvas] Cleared nodes/edges in React Flow instance');
    }
    
    // 로컬 상태 초기화
    setLocalNodes([]);
    setLocalEdges([]);
    console.log('[FlowCanvas] Cleared local nodes/edges state');
    
    // zustand 전역 상태 초기화 (이미 실행됨)
    // setNodes([]);
    // setEdges([]);
    // console.log('[FlowCanvas] Cleared global zustand state');
    
    // 변경사항 커밋 (지연 실행)
    setTimeout(() => {
      // Replace commitStructureToStore() with direct Zustand updates
      // Note: This might be redundant if clearing already updates Zustand immediately
      // Consider if this timeout logic is still necessary
      console.log('[FlowCanvas] Committing empty state to store (post-clear)');
      setNodes([]); // Explicitly ensure Zustand is empty
      setEdges([]);
      
      // 일정 시간 후 강제 초기화 모드 비활성화
      if ('enableForceClear' in window.flowSyncUtils) {
        window.flowSyncUtils.enableForceClear(false);
      }
    }, 300);
  }, [setNodes, setLocalNodes, setLocalEdges, setEdges]);
  
  // 선택 변경을 처리하는 핸들러 최적화
  const handleSelectionChange = useCallback(({ nodes = [] }: { nodes: Node[] }) => {
    if (isRestoringHistoryRef.current) return;

    const selectedIds = nodes.map(node => node.id);
    const currentSelectedIds = useFlowStructureStore.getState().selectedNodeIds;
    
    if (!isEqual(currentSelectedIds, selectedIds)) {
      console.log('Selection changed:', selectedIds);
      setSelectedNodeIds(selectedIds);
    }
  }, [isRestoringHistoryRef]);
  
  // 메모이제이션된 FlowCanvas 렌더링 프롭스
  const flowProps = useMemo(() => {
    // 디버그: ReactFlow에 전달되는 nodes의 position 로그
    memoizedNodes.forEach((node, idx) => {
      console.log(`[FlowCanvas] ReactFlow nodes[${idx}] id=${node.id} position=`, node.position);
    });
    return {
      nodes: memoizedNodes,
      edges: memoizedEdges,
      onNodesChange: onLocalNodesChange,
      onEdgesChange: onLocalEdgesChange,
      onConnect: handleConnect,
      nodeTypes,
      onSelectionChange: handleSelectionChange
    };
  }, [
    memoizedNodes, 
    memoizedEdges, 
    onLocalNodesChange, 
    onLocalEdgesChange, 
    handleConnect,
    handleSelectionChange
  ]);

  // Detect if we're in a paste operation using global flags
  const isJustAfterPaste = (window as any)._devFlags?.hasJustPasted;
  const pasteVersion = (window as any)._devFlags?.pasteVersion || 0;

  // Debug paste activity in ReactFlow state
  useEffect(() => {
    if (isJustAfterPaste) {
      console.log(`[FlowCanvas] Detected paste operation, using pasteVersion=${pasteVersion}`);
    }
  }, [isJustAfterPaste, pasteVersion]);
  
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
      
      const newNode = createNewNode(nodeType, position);
      
      // Add node to local state
      setLocalNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setLocalNodes]
  );
  
  // Selection consistency check - run only once after initial mount
  // This ensures multi-selection drag works even after a refresh
  useEffect(() => {
    // Skip if we're restoring history
    if (isRestoringHistoryRef.current) return;
    
    // We only need to normalize selection state once after initial mount
    if (!didNormalizeRef.current) {
      // Selection state is now managed by React Flow only; skip normalization check
      // const hasAnySelection = useFlowStructureStore.getState().selectedNodeIds.length > 0;
      // if (hasAnySelection) {
      //   console.log("[FlowCanvas] Running one-time selection normalization");
      //   // selectionHandlers.normalizeSelectionState();
      // } else {
      //   console.log("[FlowCanvas] Skipping normalization - no selection to normalize");
      // }
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
    
    // Enhanced API with custom methods
    const enhancedApi: FlowCanvasApi = {
      // Add nodes directly to ReactFlow (use with caution)
      addNodes: (newNodes: Node<NodeData>[]) => {
        console.log('[FlowCanvas] API.addNodes called with:', newNodes);
        if (reactFlowInstance) {
          const currentNodes = reactFlowInstance.getNodes();
          reactFlowInstance.setNodes([...currentNodes, ...newNodes]);
        }
      },
      
      // Force synchronization from Zustand store to ReactFlow
      forceSync: () => {
        console.log('[FlowCanvas] API.forceSync called, enforcing state from Zustand store');
        forceSyncFromStore();
      },
      
      // 새로운 메소드: React Flow의 모든 노드를 완전히 지움
      clearNodes: () => {
        console.log('[FlowCanvas] API.clearNodes called, removing all nodes from React Flow');
        
        // 강제 초기화 모드 활성화
        if ('enableForceClear' in window.flowSyncUtils) {
          window.flowSyncUtils.enableForceClear(true);
        }
        
        if (reactFlowInstance) {
          // React Flow 인스턴스에 직접 빈 배열 설정
          reactFlowInstance.setNodes([]);
          reactFlowInstance.setEdges([]);
          
          // 로컬 상태도 초기화
          setLocalNodes([]);
          setLocalEdges([]);
          
          // zustand 상태도 초기화
          setNodes([]);
          setEdges([]);
          
          // 강제로 상태 커밋
          console.log('[FlowCanvas] All nodes and edges cleared from React Flow');
          
          // 일정 시간 후 강제 초기화 모드 비활성화
          setTimeout(() => {
            if ('enableForceClear' in window.flowSyncUtils) {
              window.flowSyncUtils.enableForceClear(false);
            }
          }, 500);
        }
      },
      
      // React Flow 인스턴스 직접 노출
      reactFlowInstance: reactFlowInstance,
      
      forceClearLocalState: forceClearLocalState
    };
    
    // Set the API reference for external components
    reactFlowApiRef.current = enhancedApi;
    
    // Register the API if a callback was provided
    if (registerReactFlowApi) {
      registerReactFlowApi(enhancedApi);
    }
  }, [forceSyncFromStore, registerReactFlowApi, setLocalNodes, setLocalEdges, setNodes, setEdges, forceClearLocalState]);
  
  // useEffect to handle sync from URL parameters
  useEffect(() => {
    // Attempt to load flow from URL if present
    const params = new URLSearchParams(window.location.search);
    const importParam = params.get('import');
    
    if (importParam) {
      console.log('[FlowCanvas] Import param detected:', importParam);
      
      try {
        // Try to decode the import parameter
        const decoded = atob(importParam);
        const importData = JSON.parse(decoded);
        
        // Handle importData based on expected structure
        if (importData && importData.nodes && importData.edges) {
          console.log('[FlowCanvas] Applying imported flow data');
          setLocalNodes(importData.nodes);
          setLocalEdges(importData.edges);
        }
      } catch (err) {
        console.error('[FlowCanvas] Error parsing import data:', err);
      }
    }
  }, [setLocalNodes, setLocalEdges]);

  // Handle Paste action
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return; // Don't interfere with text input pasting
      }
      const text = event.clipboardData?.getData('text/plain');
      if (!text) return;

      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.nodes && parsed.edges) {
          event.preventDefault();
          const { nodes: pastedNodes, edges: pastedEdges } = parsed;

          // Set local state first
          setLocalNodes((nds) => [...nds, ...pastedNodes]);
          setLocalEdges((eds) => [...eds, ...pastedEdges]);
          
          // Immediately update Zustand store after paste
          console.log('[FlowCanvas][Paste] Committing pasted structure to store');
          setNodes([...localNodes, ...pastedNodes]);
          setEdges([...localEdges, ...pastedEdges]);

          // Mark that a paste happened for debugging/potential coordination
          if (!(window as any)._devFlags) (window as any)._devFlags = {};
          (window as any)._devFlags.hasJustPasted = true;
          (window as any)._devFlags.pasteVersion = ((window as any)._devFlags.pasteVersion || 0) + 1;
          setTimeout(() => { (window as any)._devFlags.hasJustPasted = false; }, 100); // Reset flag
        }
      } catch (e) {
        // Not valid JSON or not the expected format, ignore
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  // Update dependencies: add localNodes, localEdges, setNodes, setEdges
  }, [setLocalNodes, setLocalEdges, localNodes, localEdges, setNodes, setEdges]);

  return (
    <div 
      ref={reactFlowRef} 
      className="w-full h-full relative"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        // 메모이제이션된 프롭스 사용
        {...flowProps}
        key={flowResetKey}
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
        onInit={registerApi}
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
   onNodeSelect: (node: Node<NodeData> | null) => void;
   registerReactFlowApi?: (api: FlowCanvasApi) => void;
   children?: React.ReactNode;
}

// This wrapper might be unnecessary if FlowEditor directly renders FlowCanvas within ReactFlowProvider
export const FlowCanvasWrapper: React.FC<FlowCanvasWrapperProps> = (props) => (
    <ReactFlowProvider>
        <FlowCanvas {...props} />
    </ReactFlowProvider>
);