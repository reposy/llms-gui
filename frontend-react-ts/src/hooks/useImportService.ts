import { useCallback } from 'react';
import { FlowData } from '../utils/data/importExportUtils';
import { useFlowExecutorStore } from '../store/useFlowExecutorStore';
import { importFlowToFlowChain } from '../utils/flow/flowExecutorUtils';

export interface ImportOptions {
  /** 대상 FlowChain ID (없으면 새 Chain 생성) */
  targetChainId?: string;
  /** 새 FlowChain 이름 (targetChainId가 없을 때 사용) */
  newChainName?: string;
  /** Import 성공 콜백 */
  onSuccess?: (result: ImportResult) => void;
  /** Import 실패 콜백 */
  onError?: (error: Error) => void;
}

export interface ImportResult {
  /** Import 유형 */
  type: 'flow' | 'flowchain';
  /** 생성/업데이트된 FlowChain ID */
  chainId: string;
  /** 생성된 Flow ID (단일 Flow Import 시) */
  flowId?: string;
  /** Import된 Flow 개수 */
  flowCount: number;
  /** 파일명 */
  filename: string;
}

/**
 * 중앙화된 Import 서비스 훅
 * 모든 Import 기능을 단일 진입점으로 통합
 */
export const useImportService = () => {
  const store = useFlowExecutorStore();
  
  /**
   * 파일 선택 다이얼로그를 열고 Import 수행
   */
  const openFileImport = useCallback((options: ImportOptions = {}) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const result = await importFromFile(file, options);
        options.onSuccess?.(result);
      } catch (error) {
        const importError = error instanceof Error ? error : new Error(String(error));
        options.onError?.(importError);
        console.error('[useImportService] Import failed:', importError);
      }
    };
    
    input.click();
  }, []);
  
  /**
   * 파일에서 직접 Import 수행
   */
  const importFromFile = useCallback(async (file: File, options: ImportOptions = {}): Promise<ImportResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const json = event.target?.result as string;
          const data = JSON.parse(json);
          
          console.log('[importFromFile] Starting import process with data:', {
            hasStoreSnapshot: !!data.storeSnapshot,
            version: data.version,
            dataKeys: Object.keys(data),
            isStoreSnapshotData: isStoreSnapshotData(data),
            isFlowChainData: isFlowChainData(data),
            isFlowData: isFlowData(data)
          });
          
          // ✅ 파일명에서 확장자 제거 및 타임스탬프 생성
          const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
          const timestamp = new Date().toLocaleString();
          
          let result: ImportResult;
          
          // v1.3 storeSnapshot 형식 확인
          if (isStoreSnapshotData(data)) {
            console.log('[importFromFile] Detected storeSnapshot format, using importStoreSnapshotData');
            result = importStoreSnapshotData(data, nameWithoutExtension, timestamp, options);
          }
          // Flow Chain 데이터인지 단일 Flow 데이터인지 판단
          else if (isFlowChainData(data)) {
            console.log('[importFromFile] Detected flowChain format, using importFlowChainData');
            result = importFlowChainData(data, nameWithoutExtension, timestamp, options);
          } else if (isFlowData(data)) {
            console.log('[importFromFile] Detected single flow format, using importSingleFlowData');
            result = importSingleFlowData(data, nameWithoutExtension, timestamp, options);
          } else {
            console.error('[importFromFile] Unsupported format detected:', data);
            throw new Error('지원하지 않는 파일 형식입니다. Flow 또는 FlowChain JSON 파일을 선택해주세요.');
          }
          
          console.log('[importFromFile] Import completed with result:', result);
          resolve(result);
        } catch (error) {
          console.error('[importFromFile] Import failed:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
      };
      
      reader.readAsText(file);
    });
  }, []);
  
  /**
   * Flow Chain 데이터 Import
   */
  const importFlowChainData = useCallback((data: any, filename: string, timestamp: string, options: ImportOptions): ImportResult => {
    // 새 FlowChain 생성
    const chainName = options.newChainName || `FlowChain - ${filename}, ${timestamp}`;
    const newChainId = store.addFlowChain(chainName);
    
    let flowCount = 0;
    
    // FlowChain 내의 모든 Flow들을 Import
    if (data.flowChains && Array.isArray(data.flowChains)) {
      // 새 export 형식 (v1.2)
      data.flowChains.forEach((chain: any) => {
        if (chain.flowMap) {
          Object.values(chain.flowMap).forEach((flowData: any) => {
            if (isFlowData(flowData)) {
              importFlowToFlowChain(newChainId, flowData as FlowData, `${filename}-flow-${flowCount + 1}`);
              flowCount++;
            }
          });
        }
      });
    } else if (data.flowIds && data.flowMap) {
      // 기존 export 형식
      data.flowIds.forEach((flowId: string) => {
        const flowData = data.flowMap[flowId];
        if (isFlowData(flowData)) {
          importFlowToFlowChain(newChainId, flowData as FlowData, `${filename}-flow-${flowCount + 1}`);
          flowCount++;
        }
      });
    }
    
    return {
      type: 'flowchain',
      chainId: newChainId,
      flowCount,
      filename
    };
  }, [store]);
  
  /**
   * 단일 Flow 데이터 Import  
   */
  const importSingleFlowData = useCallback((data: FlowData, filename: string, timestamp: string, options: ImportOptions): ImportResult => {
    let chainId = options.targetChainId;
    
    // 대상 Chain이 없으면 새로 생성
    if (!chainId) {
      const chainName = options.newChainName || `FlowChain - ${filename}, ${timestamp}`;
      chainId = store.addFlowChain(chainName);
    }
    
    // Flow Import
    const flowId = importFlowToFlowChain(chainId, data, filename);
    
    return {
      type: 'flow',
      chainId,
      flowId,
      flowCount: 1,
      filename
    };
  }, [store]);
  
  /**
   * Store Snapshot 데이터 Import (v1.3)
   */
  const importStoreSnapshotData = useCallback((data: any, filename: string, timestamp: string, options: ImportOptions): ImportResult => {
    const snapshot = data.storeSnapshot;
    
    console.log('[importStoreSnapshotData] Starting import with snapshot:', snapshot);
    
    // 기존 상태 백업 (필요시 복원을 위해)
    const currentState = useFlowExecutorStore.getState();
    
    try {
      // Store 상태 완전 복원
      if (snapshot.flowChainMap) {
        console.log('[importStoreSnapshotData] Importing flowChainMap:', Object.keys(snapshot.flowChainMap));
        
        // 기존 FlowChain들 제거
        Object.keys(currentState.flowChainMap).forEach(chainId => {
          store.removeFlowChain(chainId);
        });
        
        // 새 FlowChain들 추가
        Object.entries(snapshot.flowChainMap).forEach(([chainId, chain]: [string, any]) => {
          console.log(`[importStoreSnapshotData] Processing chain ${chainId}:`, {
            name: chain.name,
            flowIds: chain.flowIds,
            flowMapKeys: Object.keys(chain.flowMap || {})
          });
          
          // FlowChain 생성 (addFlowChain 사용 후 ID 변경)
          const newChainId = store.addFlowChain(chain.name);
          console.log(`[importStoreSnapshotData] Created new chain with ID: ${newChainId}, target ID: ${chainId}`);
          
          // 생성된 Chain의 ID를 원래 ID로 변경
          const storeState = useFlowExecutorStore.getState();
          if (storeState.flowChainMap[newChainId] && chainId !== newChainId) {
            console.log(`[importStoreSnapshotData] Renaming chain from ${newChainId} to ${chainId}`);
            // flowChainMap에서 새 ID를 기존 ID로 변경
            storeState.flowChainMap[chainId] = storeState.flowChainMap[newChainId];
            delete storeState.flowChainMap[newChainId];
            
            // flowChainIds 배열에서도 변경
            const chainIndex = storeState.flowChainIds.indexOf(newChainId);
            if (chainIndex !== -1) {
              storeState.flowChainIds[chainIndex] = chainId;
            }
          }
          
          // FlowChain의 속성을 안전하게 복원
          const storeChain = storeState.flowChainMap[chainId];
          if (storeChain) {
            console.log(`[importStoreSnapshotData] Before safe assignment - current chain:`, {
              flowIds: storeChain.flowIds,
              flowMapKeys: Object.keys(storeChain.flowMap || {})
            });
            
            // flowMap 복원 시 각 flow 객체 검증 및 복구
            const importedFlowMap = chain.flowMap || {};
            const validatedFlowMap: Record<string, any> = {};
            
            Object.entries(importedFlowMap).forEach(([flowId, flow]) => {
              console.log(`[importStoreSnapshotData] Validating flow ${flowId}:`, {
                flowId,
                hasFlow: !!flow,
                flowName: (flow as any)?.name,
                flowType: typeof flow,
                flowKeys: flow ? Object.keys(flow) : 'none'
              });
              
              // Flow 객체가 유효한지 검증
              if (flow && typeof flow === 'object' && flowId) {
                const flowObj = flow as any; // Type assertion for accessing properties
                
                // Flow 객체 구조 검증 및 복구
                const validatedFlow = {
                  ...flowObj,
                  id: flowObj.id || flowId, // id가 없으면 flowId 사용
                  name: flowObj.name || `Imported Flow ${flowId.slice(-8)}`, // name이 없으면 기본값
                  flowChainId: chainId, // flowChainId 업데이트
                  status: flowObj.status || 'idle',
                  inputs: flowObj.inputs || [],
                  lastResults: flowObj.lastResults || null,
                  error: flowObj.error || undefined,
                  // 필수 그래프 관련 속성들 기본값 설정
                  nodeMap: flowObj.nodeMap || {},
                  graphMap: flowObj.graphMap || {},
                  nodeInstances: flowObj.nodeInstances || {},
                  rootIds: flowObj.rootIds || [],
                  leafIds: flowObj.leafIds || [],
                  nodeStates: flowObj.nodeStates || {}
                };
                
                validatedFlowMap[flowId] = validatedFlow;
                console.log(`[importStoreSnapshotData] Flow ${flowId} validated successfully with name: ${validatedFlow.name}`);
              } else {
                console.warn(`[importStoreSnapshotData] Skipping invalid flow ${flowId}:`, flow);
              }
            });
            
            storeChain.flowMap = validatedFlowMap;
            
            // flowIds를 검증된 flowMap의 실제 키들로 재구성
            const validFlowIds = (chain.flowIds || []).filter((flowId: string) => 
              flowId && validatedFlowMap[flowId]
            );
            
            // flowMap에 있지만 flowIds에 없는 항목들을 추가
            const missingFlowIds = Object.keys(validatedFlowMap).filter(flowId => 
              !validFlowIds.includes(flowId)
            );
            
            storeChain.flowIds = [...validFlowIds, ...missingFlowIds];
            
            // 다른 속성들 복원
            storeChain.status = chain.status || 'idle';
            storeChain.selectedFlowIds = (chain.selectedFlowIds || []).filter((flowId: string) => 
              flowId && validatedFlowMap[flowId]
            );
            if (chain.error !== undefined) storeChain.error = chain.error;
            if (chain.inputs !== undefined) storeChain.inputs = chain.inputs;
            
            console.log(`[importStoreSnapshotData] After safe assignment - updated chain:`, {
              flowIds: storeChain.flowIds,
              flowMapKeys: Object.keys(storeChain.flowMap || {}),
              flowIdsDetail: storeChain.flowIds?.map(id => ({ id, exists: !!storeChain.flowMap?.[id] }))
            });
          }
        });
      }
      
      // focusedFlowChainId 복원
      if (snapshot.focusedFlowChainId) {
        console.log(`[importStoreSnapshotData] Setting focused chain to: ${snapshot.focusedFlowChainId}`);
        store.setFocusedFlowChainId(snapshot.focusedFlowChainId);
      }
      
      // stage 복원
      if (snapshot.stage) {
        store.setStage(snapshot.stage);
      }
      
      // 최종 상태 확인
      const finalState = useFlowExecutorStore.getState();
      console.log('[importStoreSnapshotData] Final state after import:', {
        flowChainIds: finalState.flowChainIds,
        focusedFlowChainId: finalState.focusedFlowChainId,
        flowChainMapKeys: Object.keys(finalState.flowChainMap)
      });
      
      // 전체 flowChain 개수 계산
      const flowCount: number = Object.values(snapshot.flowChainMap || {}).reduce(
        (total: number, chain: any) => total + (Number(chain.flowIds?.length) || 0), 
        0
      );
      
      return {
        type: 'flowchain',
        chainId: snapshot.focusedFlowChainId || Object.keys(snapshot.flowChainMap || {})[0] || '',
        flowCount,
        filename
      };
    } catch (error) {
      console.error('[importStoreSnapshotData] Error importing store snapshot:', error);
      throw new Error(`Store snapshot import 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [store]);
  
  return {
    openFileImport,
    importFromFile
  };
};

/**
 * FlowChain 데이터인지 확인
 */
function isFlowChainData(data: any): boolean {
  return (
    data && 
    typeof data === 'object' && 
    (
      // 새 형식 (v1.2)
      (data.flowChains && Array.isArray(data.flowChains)) ||
      // 기존 형식
      (data.flowIds && Array.isArray(data.flowIds) && data.flowMap && typeof data.flowMap === 'object')
    )
  );
}

/**
 * 단일 Flow 데이터인지 확인
 */
function isFlowData(data: any): boolean {
  return (
    data && 
    typeof data === 'object' && 
    data.nodes && 
    Array.isArray(data.nodes) && 
    data.edges && 
    Array.isArray(data.edges)
  );
}

/**
 * Store Snapshot 데이터인지 확인
 */
function isStoreSnapshotData(data: any): boolean {
  const result = (
    data && 
    typeof data === 'object' && 
    data.storeSnapshot && 
    typeof data.storeSnapshot === 'object'
  );
  
  console.log('[isStoreSnapshotData] Checking format:', {
    hasData: !!data,
    isObject: typeof data === 'object',
    hasStoreSnapshot: !!data?.storeSnapshot,
    storeSnapshotType: typeof data?.storeSnapshot,
    result: result,
    dataKeys: data ? Object.keys(data) : 'none',
    storeSnapshotKeys: data?.storeSnapshot ? Object.keys(data.storeSnapshot) : 'none'
  });
  
  return result;
} 