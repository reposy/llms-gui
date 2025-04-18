import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isEqual } from 'lodash';
import { useCallback } from 'react';
import { FileLikeObject, HTTPMethod } from '../types/nodes';

/**
 * 노드 컨텐츠의 기본 인터페이스
 * 모든 노드 타입별 컨텐츠는 이를 확장함
 */
export interface BaseNodeContent {
  isDirty?: boolean;
  label?: string;
  content?: any;
  [key: string]: any;
}

/**
 * 입력 노드 컨텐츠
 */
export interface InputNodeContent extends BaseNodeContent {
  items: (string | FileLikeObject)[];
  textBuffer?: string;
  iterateEachRow: boolean;
}

/**
 * LLM 노드 컨텐츠
 */
export interface LLMNodeContent extends BaseNodeContent {
  prompt: string;
  model: string;
  temperature: number;
  provider: 'ollama' | 'openai';
  ollamaUrl?: string;
  openaiApiKey?: string;
  mode?: 'text' | 'vision';
}

/**
 * 출력 노드 컨텐츠
 */
export interface OutputNodeContent extends BaseNodeContent {
  format: 'json' | 'text';
  content?: string;
}

/**
 * WebCrawler 노드 컨텐츠
 */
export interface WebCrawlerNodeContent extends BaseNodeContent {
  url: string;
  waitForSelector?: string;
  extractSelectors?: Record<string, string>;
  timeout?: number;
  outputFormat?: 'full' | 'text' | 'extracted' | 'html';
}

/**
 * API 노드 컨텐츠
 */
export interface APINodeContent extends BaseNodeContent {
  url: string;
  method: HTTPMethod;
  headers?: Record<string, string>;
  body?: string;
  queryParams?: Record<string, string>;
  useInputAsBody?: boolean;
  contentType?: string;
  bodyFormat?: 'key-value' | 'raw';
  bodyParams?: Array<{ key: string; value: string; enabled: boolean }>;
}

/**
 * 조건부 노드 컨텐츠
 */
export interface ConditionalNodeContent extends BaseNodeContent {
  conditionType: 'contains' | 'greater_than' | 'less_than' | 'equal_to' | 'json_path';
  conditionValue: string;
}

/**
 * Merger 노드 컨텐츠
 */
export interface MergerNodeContent extends BaseNodeContent {
  strategy: 'array' | 'object';
  keys?: string[];
  items: any[];
}

/**
 * JSON 추출 노드 컨텐츠
 */
export interface JSONExtractorNodeContent extends BaseNodeContent {
  path: string;
  defaultValue?: string;
}

/**
 * 그룹 노드 컨텐츠
 */
export interface GroupNodeContent extends BaseNodeContent {
  childNodes: string[];
}

/**
 * 모든 노드 컨텐츠 타입의 유니온 타입
 */
export type NodeContent = 
  | InputNodeContent
  | LLMNodeContent
  | OutputNodeContent
  | WebCrawlerNodeContent
  | APINodeContent
  | ConditionalNodeContent
  | MergerNodeContent
  | JSONExtractorNodeContent
  | GroupNodeContent
  | BaseNodeContent;

/**
 * 모든 노드 타입의 기본값을 제공하는 팩토리 함수
 */
export function createDefaultNodeContent(type: string): NodeContent {
  switch (type) {
    case 'input':
      return {
        items: [],
        textBuffer: '',
        iterateEachRow: false,
        isDirty: false,
        label: 'Input'
      } as InputNodeContent;

    case 'llm':
      return {
        prompt: '',
        model: 'openhermes',
        temperature: 0.7,
        provider: 'ollama',
        ollamaUrl: 'http://localhost:11434',
        mode: 'text',
        isDirty: false,
        label: 'LLM'
      } as LLMNodeContent;

    case 'output':
      return {
        format: 'text',
        content: '',
        isDirty: false,
        label: 'Output'
      } as OutputNodeContent;

    case 'web-crawler':
      return {
        url: '',
        waitForSelector: 'body',
        extractSelectors: {},
        timeout: 3000,
        outputFormat: 'full',
        isDirty: false,
        label: 'Web Crawler'
      } as WebCrawlerNodeContent;

    case 'api':
      return {
        url: '',
        method: 'GET',
        headers: {},
        queryParams: {},
        bodyFormat: 'raw',
        body: '',
        useInputAsBody: false,
        isDirty: false,
        label: 'API'
      } as APINodeContent;

    case 'conditional':
      return {
        conditionType: 'contains',
        conditionValue: '',
        isDirty: false,
        label: 'Conditional'
      } as ConditionalNodeContent;

    case 'merger':
      return {
        strategy: 'array',
        keys: [],
        items: [],
        isDirty: false,
        label: 'Merger'
      } as MergerNodeContent;

    case 'json-extractor':
      return {
        path: '',
        defaultValue: '',
        isDirty: false,
        label: 'JSON Extractor'
      } as JSONExtractorNodeContent;

    case 'group':
      return {
        childNodes: [],
        isDirty: false,
        label: 'Group'
      } as GroupNodeContent;

    default:
      return {
        isDirty: false,
        label: 'Node'
      } as BaseNodeContent;
  }
}

/**
 * 노드 컨텐츠 스토어 인터페이스
 */
interface NodeContentStore {
  // 노드 ID를 키로 사용하는 컨텐츠 맵
  contents: Record<string, NodeContent>;
  
  // 노드 ID와 컨텐츠를 받아 저장하는 함수
  setNodeContent: <T extends NodeContent>(nodeId: string, content: Partial<T>) => void;
  
  // 노드 컨텐츠 삭제 함수
  deleteNodeContent: (nodeId: string) => void;
  
  // 노드 ID로 컨텐츠를 조회하는 함수
  getNodeContent: <T extends NodeContent = NodeContent>(nodeId: string, nodeType?: string) => T;
  
  // 모든 컨텐츠를 가져오는 함수
  getAllNodeContents: () => Record<string, NodeContent>;
  
  // 임포트된 컨텐츠를 로드하는 함수
  loadFromImportedContents: (contents: Record<string, NodeContent>) => void;
  
  // 모든 컨텐츠를 초기화하는 함수
  resetAllContent: () => void;

  // 노드의 dirty 상태를 설정하는 함수
  markNodeDirty: (nodeId: string, isDirty: boolean) => void;
  
  // 노드의 dirty 상태를 확인하는 함수
  isNodeDirty: (nodeId: string) => boolean;
  
  // 존재하지 않는 노드의 컨텐츠를 정리하는 함수
  cleanupDeletedNodes: (existingNodeIds: string[]) => void;
}

/**
 * 노드 컨텐츠를 저장하는 Zustand 스토어
 * persist 미들웨어로 로컬 스토리지에 자동 저장
 */
export const useNodeContentStore = create<NodeContentStore>()(
  persist(
    (set, get) => ({
      // 초기 상태: 빈 객체
      contents: {},
      
      // 노드 컨텐츠 설정 (기존 컨텐츠와 병합)
      setNodeContent: <T extends NodeContent>(nodeId: string, newContentUpdate: Partial<T>) => {
        set((state) => {
          // 현재 컨텐츠 가져오기 (없으면 빈 객체)
          const currentContent = state.contents[nodeId] || {};
          
          // Determine the final isDirty state
          // If newContentUpdate has an isDirty field, use it, otherwise default to true
          const finalIsDirty = (newContentUpdate as any).isDirty !== undefined 
                               ? (newContentUpdate as any).isDirty 
                               : true;

          // Directly merge the update with the current content
          const newContent = {
            ...currentContent,
            ...newContentUpdate,
            isDirty: finalIsDirty // Ensure isDirty is correctly set
          };
          
          // Optimization: Check if the object reference is the same AND isDirty is same.
          // This avoids unnecessary updates if the exact same update object is passed multiple times.
          // However, usually a new object is created for updates, making this less effective.
          // Let Zustand handle shallow equality checks on the top level.
          // A simple reference check might be sufficient if performance becomes an issue.
          // if (state.contents[nodeId] === newContent && currentContent.isDirty === finalIsDirty) {
          //   return state; // Avoid update if object reference and isDirty are identical
          // }

          console.log(`[NodeContentStore] Updating content for ${nodeId}:`, newContent);
          
          return {
            contents: {
              ...state.contents,
              [nodeId]: newContent
            }
          };
        });
      },
      
      // 노드 컨텐츠 삭제
      deleteNodeContent: (nodeId) => {
        set((state) => {
          const newContents = { ...state.contents };
          delete newContents[nodeId];
          return { contents: newContents };
        });
      },
      
      // 노드 컨텐츠 조회 (타입 파라미터로 타입 안전성 보장)
      getNodeContent: <T extends NodeContent = NodeContent>(nodeId: string, nodeType?: string): T => {
        const content = get().contents[nodeId];
        
        // 컨텐츠가 있으면 반환
        if (content) {
          return content as T;
        }
        
        // 컨텐츠가 없고 노드 타입이 제공되었다면 기본값 생성
        if (nodeType) {
          return createDefaultNodeContent(nodeType) as T;
        }
        
        // 둘 다 없으면 빈 객체 반환
        return {} as T;
      },
      
      // 모든 노드 컨텐츠 조회
      getAllNodeContents: () => {
        return get().contents;
      },
      
      // 임포트된 컨텐츠로부터 로드
      loadFromImportedContents: (contents) => {
        console.log('[NodeContentStore] Loading imported contents', contents);
        set({ contents });
      },
      
      // 모든 컨텐츠 초기화
      resetAllContent: () => {
        set({ contents: {} });
      },

      // 노드의 dirty 상태 설정
      markNodeDirty: (nodeId, isDirty) => {
        set((state) => {
          const currentContent = state.contents[nodeId];
          if (!currentContent) return state;
          
          return {
            contents: {
              ...state.contents,
              [nodeId]: { ...currentContent, isDirty }
            }
          };
        });
      },

      // 노드의 dirty 상태 확인
      isNodeDirty: (nodeId) => {
        const nodeContent = get().contents[nodeId];
        return nodeContent ? !!nodeContent.isDirty : false;
      },
      
      // 존재하지 않는 노드의 컨텐츠 정리
      cleanupDeletedNodes: (existingNodeIds) => {
        set((state) => {
          const existingNodeIdSet = new Set(existingNodeIds);
          const newContents = { ...state.contents };
          
          Object.keys(newContents).forEach(nodeId => {
            if (!existingNodeIdSet.has(nodeId)) {
              delete newContents[nodeId];
            }
          });
          
          if (Object.keys(newContents).length !== Object.keys(state.contents).length) {
            console.log(`[NodeContentStore] Cleaned up ${Object.keys(state.contents).length - Object.keys(newContents).length} deleted nodes`);
            return { contents: newContents };
          }
          
          return state;
        });
      }
    }),
    {
      // 로컬 스토리지 이름
      name: 'node-content-storage',
      
      // 영구 저장에서 제외할 항목 없음 (모든 contents 저장)
      partialize: (state) => ({ contents: state.contents })
    }
  )
);

// 직접 접근 가능한 함수들
export const { 
  getNodeContent, 
  setNodeContent, 
  deleteNodeContent,
  getAllNodeContents,
  loadFromImportedContents,
  resetAllContent,
  markNodeDirty,
  isNodeDirty,
  cleanupDeletedNodes
} = useNodeContentStore.getState();

/**
 * 특정 노드의 컨텐츠를 조회하고 업데이트하는 훅
 * @param nodeId 노드 ID
 * @param nodeType 노드 타입 (기본값 생성에 사용)
 * @returns 노드 컨텐츠와 업데이트 함수
 */
export function useNodeContent<T extends NodeContent = NodeContent>(
  nodeId: string,
  nodeType?: string
) {
  const content = useNodeContentStore(
    (state) => state.getNodeContent<T>(nodeId, nodeType)
  );
  
  const updateContentFunc = useNodeContentStore((state) => state.setNodeContent);
  
  // 노드 ID를 자동으로 전달하는 래퍼 함수
  const updateContent = useCallback((newContent: Partial<T>) => {
    updateContentFunc<T>(nodeId, newContent);
  }, [nodeId, updateContentFunc]);

  return {
    content,
    updateContent
  };
}

// 하위 호환성을 위한 레거시 함수들
export {
  useNodeContent as useInputNodeContent,
  getNodeContent as getInputNodeContent,
  setNodeContent as setInputNodeContent
}; 