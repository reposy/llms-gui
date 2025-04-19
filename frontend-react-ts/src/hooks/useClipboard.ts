import { useCallback, useRef } from 'react';
import { useReactFlow, XYPosition, Node, Edge } from '@xyflow/react';
import { NodeData } from '../types/nodes';
import { 
  pasteClipboardContents, 
  hasClipboardData,
  PasteResult,
  copyNodesAndEdgesFromInstance
} from '../utils/ui/clipboardUtils';
import { useFlowStructureStore, setSelectedNodeIds as setZustandSelectedNodeIds } from '../store/useFlowStructureStore';
import { setNodeContent, getAllNodeContents as getAllNodeContentsFromStore } from '../store/useNodeContentStore';
import { pushSnapshot } from '../store/useHistoryStore';
import { cloneDeep } from 'lodash';

// Remove complex _devFlags related to async paste logic
declare global {
  interface Window {
    _devFlags?: { 
      [key: string]: any; 
      pasteVersion?: number; // Keep for potential key changes
      debugMode?: boolean; 
    };
  }
}

// Initialize flags
if (typeof window !== 'undefined') {
  if (!window._devFlags) {
    window._devFlags = { 
      pasteVersion: 0,
      debugMode: false 
    };
  } else {
    window._devFlags.pasteVersion = window._devFlags.pasteVersion ?? 0;
    window._devFlags.debugMode = window._devFlags.debugMode ?? false;
  }
}

// Keep z-index boost
const PASTE_Z_INDEX_BOOST = 10;

export interface UseClipboardReturnType {
  handleCopy: () => void;
  handlePaste: (position?: XYPosition) => void;
  canPaste: boolean;
  pasteVersion: number; // Keep exporting pasteVersion
}

export const useClipboard = (): UseClipboardReturnType => {
  const reactFlowInstance = useReactFlow<Node>(); // Keep generic Node type if needed
  const { getViewport, fitView, getNodes, getEdges, setViewport, screenToFlowPosition } = reactFlowInstance;
  const { nodes, edges, setNodes, setEdges } = useFlowStructureStore();
  
  // Keep pasteVersionRef if needed for key changes
  const pasteVersionRef = useRef<number>(window._devFlags?.pasteVersion || 0);
  const isManualPasteInProgressRef = useRef<boolean>(false); // Keep simple lock

  // Keep calculateNodesBoundingBox and focusViewportOnNodes if used directly
  const calculateNodesBoundingBox = useCallback((nodeIds: string[]) => {
    const allNodes = getNodes();
    const targetNodes = allNodes.filter(node => nodeIds.includes(node.id));
    if (targetNodes.length === 0) return null;
    let minX = targetNodes[0].position.x;
    let minY = targetNodes[0].position.y;
    let maxX = minX + (targetNodes[0].width || 200);
    let maxY = minY + (targetNodes[0].height || 100);
    targetNodes.forEach(node => {
      const nodeWidth = node.width || 200;
      const nodeHeight = node.height || 100;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    });
    return { minX, minY, maxX, maxY };
  }, [getNodes]);

  const focusViewportOnNodes = useCallback((nodeIds: string[], animate = true) => {
    if (!nodeIds.length) return;
    try {
      // 애니메이션 매개변수가 false일 때는 지속 시간을 0으로 설정
      const duration = animate ? 800 : 0;
      
      if (nodeIds.length === 1) {
        const node = getNodes().find(n => n.id === nodeIds[0]);
        if (node) {
          const nodeCenter = {
            x: node.position.x + (node.width || 200) / 2,
            y: node.position.y + (node.height || 100) / 2
          };
          // 현재 뷰포트 정보 가져오기
          const { zoom } = getViewport();
          // 노드 하나일 때는 현재 줌보다 약간 확대해서 더 잘 보이게 함
          const targetZoom = Math.min(Math.max(zoom, 1.2), 1.8); // 줌 레벨을 1.2~1.8 사이로 조정
          
          console.log(`[Clipboard] Focusing on single node at (${nodeCenter.x}, ${nodeCenter.y}) with zoom ${targetZoom}${animate ? ' with animation' : ' without animation'}`);
          
          setViewport(
            { 
              x: -nodeCenter.x * targetZoom + window.innerWidth / 2,
              y: -nodeCenter.y * targetZoom + window.innerHeight / 2,
              zoom: targetZoom
            },
            { duration }
          );
        }
      } else {
        // 여러 노드일 경우 fitView 사용하되 패딩과 줌 제약을 조정
        console.log(`[Clipboard] Fitting view to ${nodeIds.length} nodes${animate ? ' with animation' : ' without animation'}`);
        
        fitView({
          padding: 0.3, // 패딩 증가로 더 여유있게 보임
          duration,
          nodes: getNodes().filter(node => nodeIds.includes(node.id)),
          minZoom: 0.7, // 최소 줌 레벨 증가
          maxZoom: 1.5, // 최대 줌 레벨 약간 제한
          includeHiddenNodes: false
        });
      }
      console.log(`[Clipboard] Focused viewport on ${nodeIds.length} pasted nodes${animate ? ' with animation' : ' without animation'}`);
    } catch (e) {
      console.warn('[Clipboard] Error focusing viewport:', e);
    }
  }, [getNodes, getViewport, setViewport, fitView]);

  // Keep handleCopy as is (assuming clipboardUtils.copyNodesAndEdgesFromInstance works)
  const handleCopy = useCallback(() => {
    console.log('[useClipboard DEBUG] handleCopy 함수 호출됨');
    
    try {
      const selectedNodes = getNodes().filter(node => node.selected);
      console.log('[useClipboard DEBUG] 선택된 노드 수:', selectedNodes.length);
      
      if (selectedNodes.length === 0) {
        console.log('[useClipboard DEBUG] 선택된 노드가 없습니다.');
        return;
      }
      
      const allEdges = getEdges();
      console.log('[useClipboard DEBUG] 모든 엣지 수:', allEdges.length);
      
      // Assert the type of selectedNodes before passing
      const copiedCount = copyNodesAndEdgesFromInstance(selectedNodes as Node<NodeData>[], allEdges);
      
      if (copiedCount > 0) {
        console.log(`[Clipboard] Copied ${copiedCount} nodes to clipboard.`);
      }
    } catch (error) {
      console.error('[useClipboard DEBUG] 복사 중 오류 발생:', error);
    }
  }, [getNodes, getEdges]);

  const handlePaste = useCallback((position?: XYPosition) => {
    console.log('[useClipboard DEBUG] handlePaste 함수 호출됨');
    console.log('[useClipboard DEBUG] 위치 데이터:', position);
    
    // 1. Check data & lock
    if (!hasClipboardData()) {
      console.warn('[Clipboard] No clipboard data found to paste.');
      return;
    }
    
    console.log('[useClipboard DEBUG] 클립보드 데이터 확인됨');
    
    if (isManualPasteInProgressRef.current) {
      console.warn('[Clipboard] Paste already in progress, skipping.');
      return;
    }
    isManualPasteInProgressRef.current = true;
    console.log('[useClipboard DEBUG] 붙여넣기 작업 시작됨');

    // 2. Prepare paste data
    const pasteResult: PasteResult | null = pasteClipboardContents(position);
    if (!pasteResult) { 
      console.warn('[useClipboard DEBUG] pasteClipboardContents 함수 결과 없음');
      isManualPasteInProgressRef.current = false;
      return;
    }
    
    console.log('[useClipboard DEBUG] pasteClipboardContents 함수 결과 수신됨');
    const { 
      newNodes: pastedNodes, 
      newEdges: pastedEdges, 
      nodeContents: pastedNodeContentsInfo,
      newNodeIds
    } = pasteResult;

    if (!pastedNodes || pastedNodes.length === 0) {
      console.warn('[Clipboard] No nodes were generated from clipboard data.');
      isManualPasteInProgressRef.current = false;
      return;
    }

    // 3. Prepare final nodes/edges (apply z-index boost)
    const finalNodes = pastedNodes.map((node: Node<NodeData>) => ({ 
      ...node,
      selected: false, // Start deselected, select later
      zIndex: (node.zIndex || 0) + PASTE_Z_INDEX_BOOST 
    }));
    const finalEdges = pastedEdges.map(edge => ({ ...edge, selected: false })); // Start edges deselected

    console.log(`[Clipboard] Pasting ${finalNodes.length} nodes and ${finalEdges.length} edges`);
    console.log(`[Clipboard] New node IDs: ${newNodeIds.join(', ')}`);
    
    try {
      // --- Simplified State Update --- 
      // 1. Get current state from Zustand
      const currentNodes = useFlowStructureStore.getState().nodes;
      const currentEdges = useFlowStructureStore.getState().edges;
      const currentContents = getAllNodeContentsFromStore();

      // 2. Create new state arrays
      const nextNodes = [...currentNodes, ...finalNodes];
      const nextEdges = [...currentEdges, ...finalEdges];
      let nextContents = { ...currentContents };
      Object.values(pastedNodeContentsInfo).forEach(({ nodeId, content }) => {
         nextContents[nodeId] = content; // Assume content is already deep copied
      });

      // 3. Update Zustand stores
      setNodes(nextNodes); 
      setEdges(nextEdges);
      // Directly update contents in the content store (assuming setNodeContent handles individual updates)
      Object.values(pastedNodeContentsInfo).forEach(({ nodeId, content }) => {
          setNodeContent(nodeId, content);
      });
      console.log(`[Clipboard] Updated structure and content stores.`);

      // 4. Push history snapshot (using the newly calculated states)
      pushSnapshot({ 
        nodes: cloneDeep(nextNodes), // Deep copy for snapshot
        edges: cloneDeep(nextEdges),
        contents: cloneDeep(nextContents)
      }); 
      console.log('[Clipboard] Pushed snapshot to history.');
      
      // --- Simplified Post-Paste UI Updates (Run after state update) ---
      // Use setTimeout to allow React Flow to render the new nodes/edges first
      setTimeout(() => {
         // 5. Update selection in Zustand
         setZustandSelectedNodeIds(newNodeIds);
         console.log('[Clipboard] Set selection to new nodes.');

         // 6. Focus viewport 기능 비활성화 (뷰포트 이동 없음)
         // focusViewportOnNodes(newNodeIds, false); // 뷰포트 이동 제거

         // 7. Release paste lock
         isManualPasteInProgressRef.current = false;
         console.log('[Clipboard] Paste operation complete and lock released.');
      }, 50); // 50ms로 약간 지연시켜 React Flow가 노드를 렌더링할 시간 확보

    } catch (error) {
      console.error('[Clipboard] Error during paste operation:', error);
       isManualPasteInProgressRef.current = false; // Ensure lock is released on error
    } 

  }, [ 
    // Dependencies: Include necessary functions and state setters
    screenToFlowPosition, 
    setNodes, 
    setEdges, 
    setNodeContent, 
    pushSnapshot, 
    getNodes, // Keep for focusViewportOnNodes
    focusViewportOnNodes,
    setZustandSelectedNodeIds // Add Zustand selection action
  ]);

  // Check if pasting is possible
  const canPaste = hasClipboardData();

  return { 
    handleCopy, 
    handlePaste, 
    canPaste,
    // Return current paste version if needed by parent component for key changes
    pasteVersion: pasteVersionRef.current 
  };
}; 