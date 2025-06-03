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
          
          // ✅ 파일명에서 확장자 제거 및 타임스탬프 생성
          const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
          const timestamp = new Date().toLocaleString();
          
          let result: ImportResult;
          
          // Flow Chain 데이터인지 단일 Flow 데이터인지 판단
          if (isFlowChainData(data)) {
            result = importFlowChainData(data, nameWithoutExtension, timestamp, options);
          } else if (isFlowData(data)) {
            result = importSingleFlowData(data, nameWithoutExtension, timestamp, options);
          } else {
            throw new Error('지원하지 않는 파일 형식입니다. Flow 또는 FlowChain JSON 파일을 선택해주세요.');
          }
          
          resolve(result);
        } catch (error) {
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