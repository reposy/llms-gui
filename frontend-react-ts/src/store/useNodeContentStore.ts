import { createWithEqualityFn } from 'zustand/traditional';
import { persist } from 'zustand/middleware';
import { isEqual } from 'lodash';
import { useCallback } from 'react';
import { 
  InputNodeContent,
  LLMNodeContent, 
  OutputNodeContent, 
  WebCrawlerNodeContent, 
  APINodeContent, 
  ConditionalNodeContent, 
  JSONExtractorNodeContent,
  GroupNodeContent, 
  NodeContent,
  MergerNodeContent,
  HTMLParserNodeContent,
  NodeTypeMap,
  HTTPMethod,
  RequestBodyType,
  NodeType
} from '../types/nodes'; 
import { shallow } from 'zustand/shallow';

/**
 * Creates the default content for a given node type.
 * These objects should ONLY contain properties defined in the specific *NodeContent types.
 * Base properties like label/isDirty are set by the consumer of this function.
 */
export function createDefaultNodeContent(type: string, id: string): NodeContent {
  switch (type) {
    case 'input':
      return {
        items: [],
        commonItems: [],
        chainingItems: [],
        textBuffer: '',
        iterateEachRow: false,
        executionMode: 'batch',
        chainingUpdateMode: 'element',
        accumulationMode: 'always',
      } as InputNodeContent;

    case 'llm':
      return {
        prompt: '',
        model: 'openhermes',
        temperature: 0.7,
        provider: 'ollama',
        ollamaUrl: 'http://localhost:11434',
        mode: 'text',
      } as LLMNodeContent;

    case 'output':
      return {
        format: 'text',
        content: '',
        mode: 'read',
      } as OutputNodeContent;

    case 'web-crawler':
      return {
        url: '',
        waitForSelector: '',
        extractSelectors: {},
        timeout: 30000,
        headers: {},
        outputFormat: 'html',
      } as WebCrawlerNodeContent;

    case 'html-parser':
      return { 
        extractionRules: []
      } as HTMLParserNodeContent;

    case 'api':
      return {
        url: '',
        method: 'GET' as HTTPMethod,
        requestBodyType: 'none' as RequestBodyType,
        requestHeaders: {},
        requestBody: '',
      } as APINodeContent;

    case 'conditional':
      return {
        conditionType: 'contains',
        conditionValue: '',
      } as ConditionalNodeContent;
    
    case 'merger':
      return {
        mergeMode: 'concat',
        strategy: 'array',
        items: [],
        keys: [],
      } as MergerNodeContent;

    case 'json-extractor':
      return {
        path: '',
      } as JSONExtractorNodeContent;

    case 'group':
      return {
        isCollapsed: false,
      } as GroupNodeContent;

    default:
      console.warn(`Creating default content for unknown node type: ${type}. Returning empty object.`);
      return {} as NodeContent;
  }
}

/**
 * 노드 컨텐츠 스토어 인터페이스
 */
interface NodeContentState {
  // 노드 ID를 키로 사용하는 컨텐츠 맵
  contents: Record<string, NodeContent>;
  
  // 노드 ID와 컨텐츠를 받아 저장하는 함수
  setNodeContent: <T extends NodeContent>(nodeId: string, content: Partial<T>) => void;
  
  // 노드 컨텐츠 삭제 함수
  deleteNodeContent: (nodeId: string) => void;
  
  // 노드 ID로 컨텐츠를 조회하는 함수 (타입 안전한 버전)
  getNodeContent: <K extends keyof NodeTypeMap | string>(nodeId: string, nodeType?: K) => 
    K extends keyof NodeTypeMap ? NodeTypeMap[K] : 
    K extends NodeType ? NodeContent : 
    NodeContent;
  
  // 모든 컨텐츠를 가져오는 함수
  getAllNodeContents: () => Record<string, NodeContent>;
  
  // 임포트된 컨텐츠를 로드하는 함수
  loadFromImportedContents: (contents: Record<string, NodeContent>) => void;
  
  // 모든 컨텐츠를 초기화하는 함수
  resetAllContent: () => void;

  // 존재하지 않는 노드의 컨텐츠를 정리하는 함수
  cleanupDeletedNodes: (existingNodeIds: string[]) => void;
  
  // 노드가 dirty 상태인지 확인하는 함수
  isNodeDirty: (nodeId: string) => boolean;
  
  // 노드 컨텐츠 리셋 함수
  resetNodeContent: (nodeId: string) => void;
}

/**
 * 노드 컨텐츠를 저장하는 Zustand 스토어
 * persist 미들웨어로 로컬 스토리지에 자동 저장
 */
export const useNodeContentStore = createWithEqualityFn<NodeContentState>()(
  persist(
    (set, get) => ({
      contents: {},

      setNodeContent: <T extends NodeContent>(nodeId: string, contentUpdate: Partial<T>) => set(state => {
        // 타입 체크 방식 변경 - as로 타입 단언 대신 안전한 방식 사용
        const nodeType = (contentUpdate as any).type || 'unknown';
        const currentContent = state.contents[nodeId] || createDefaultNodeContent(nodeType, nodeId);
        
        const newContent = { 
          ...currentContent,
          ...contentUpdate,
          isDirty: true // 항상 dirty로 마킹
        };

        if (!isEqual(currentContent, newContent)) {
          return { 
            contents: { 
              ...state.contents, 
              [nodeId]: newContent 
            }
          };
        } else {
           return state; 
        }
      }),

      deleteNodeContent: (nodeId) => set(state => {
        const { [nodeId]: removedContent, ...rest } = state.contents;
        return { contents: rest };
      }),

      getNodeContent: <K extends keyof NodeTypeMap | string>(nodeId: string, nodeType?: K) => {
        const state = get();
        const content = state.contents[nodeId];
        
        if (content) {
          return content as (K extends keyof NodeTypeMap ? NodeTypeMap[K] : K extends NodeType ? NodeContent : NodeContent);
        }
        
        // 컨텐츠가 없으면 기본값 생성
        if (nodeType) {
          return createDefaultNodeContent(nodeType as string, nodeId) as (K extends keyof NodeTypeMap ? NodeTypeMap[K] : K extends NodeType ? NodeContent : NodeContent);
        }
        
        return {} as (K extends keyof NodeTypeMap ? NodeTypeMap[K] : K extends NodeType ? NodeContent : NodeContent);
      },

      getAllNodeContents: () => get().contents,

      loadFromImportedContents: (contents) => set({ contents }),

      resetAllContent: () => set({ contents: {} }),

      cleanupDeletedNodes: (existingNodeIds) => set(state => {
        const updatedContents: Record<string, NodeContent> = {};
        
        existingNodeIds.forEach(nodeId => {
          if (state.contents[nodeId]) {
            updatedContents[nodeId] = state.contents[nodeId];
          }
        });
        
        return { contents: updatedContents };
      }),
      
      isNodeDirty: (nodeId) => {
        const content = get().contents[nodeId];
        return content ? !!content.isDirty : false;
      },
      
      resetNodeContent: (nodeId) => set(state => {
        const content = state.contents[nodeId];
        if (!content) return state;
        
        // Get the node type from the content or infer it
        const nodeType = inferNodeType(content);
        if (!nodeType) return state;
        
        // Create fresh default content
        const freshContent = createDefaultNodeContent(nodeType, nodeId);
        
        return {
          contents: {
            ...state.contents,
            [nodeId]: {
              ...freshContent,
              label: content.label // Preserve the label
            }
          }
        };
      })
    }),
    {
      name: 'node-content-storage',
      partialize: (state) => {
        // Filter out large content items before persisting to localStorage
        const filteredContents: Record<string, any> = {};
        
        Object.entries(state.contents).forEach(([nodeId, content]) => {
          // Deep clone to avoid modifying the original state
          const persistedContent = JSON.parse(JSON.stringify(content));
          
          // Handle potential large string fields
          if (typeof persistedContent?.content === 'string' && 
              persistedContent.content.length > 1000) {
            persistedContent.content = persistedContent.content.substring(0, 1000) + '... [truncated]';
          }
          
          // Handle LLM node response content
          if (typeof persistedContent?.responseContent === 'string' && 
              persistedContent.responseContent.length > 1000) {
            persistedContent.responseContent = persistedContent.responseContent.substring(0, 1000) + '... [truncated]';
          }
          
          filteredContents[nodeId] = persistedContent;
        });
        
        return { contents: filteredContents };
      }
    }
  ),
  shallow // Use shallow equality for the store
);

/**
 * 노드 타입 추론 함수
 */
function inferNodeType(content: NodeContent): string | null {
  // LLM 노드
  if ('prompt' in content && 'model' in content) {
    return 'llm';
  }
  
  // API 노드
  if ('url' in content && 'method' in content && 'requestBodyType' in content) {
    return 'api';
  }
  
  // Output 노드
  if ('format' in content && 'content' in content && 'mode' in content) {
    return 'output';
  }
  
  // JSON Extractor 노드
  if ('path' in content && !('url' in content)) {
    return 'json-extractor';
  }
  
  // Group 노드
  if ('isCollapsed' in content && Object.keys(content).length <= 3) {
    return 'group';
  }
  
  // Conditional 노드
  if ('conditionType' in content && 'conditionValue' in content) {
    return 'conditional';
  }
  
  // Merger 노드
  if ('strategy' in content && 'keys' in content) {
    return 'merger';
  }
  
  // Web Crawler 노드
  if ('url' in content && 'extractSelectors' in content) {
    return 'web-crawler';
  }
  
  // HTML Parser 노드
  if ('extractionRules' in content) {
    return 'html-parser';
  }
  
  return null;
}

// 직접 스토어 상태와 액션에 접근하기 위한 헬퍼 함수들
export const getAllNodeContents = () => useNodeContentStore.getState().getAllNodeContents();
export const getNodeContent = <K extends keyof NodeTypeMap | string>(nodeId: string, nodeType?: K): 
  K extends keyof NodeTypeMap ? NodeTypeMap[K] : 
  K extends NodeType ? NodeContent :
  NodeContent => 
  useNodeContentStore.getState().getNodeContent(nodeId, nodeType as any);
export const setNodeContent = <T extends NodeContent>(nodeId: string, content: Partial<T>) => useNodeContentStore.getState().setNodeContent(nodeId, content);
export const loadFromImportedContents = (contents: Record<string, NodeContent>) => useNodeContentStore.getState().loadFromImportedContents(contents);
export const resetAllContent = () => useNodeContentStore.getState().resetAllContent();

// 컴포넌트에서 사용하기 위한 커스텀 훅
export function useNodeContent<T extends NodeContent = NodeContent>(
  nodeId: string,
  nodeType?: string
) {
  return useNodeContentStore(
    useCallback(
      (state) => ({
        content: state.getNodeContent(nodeId, nodeType as any) as T,
        isContentDirty: state.isNodeDirty(nodeId),
        setContent: (updates: Partial<T>) => state.setNodeContent(nodeId, updates),
        resetContent: () => state.resetNodeContent(nodeId)
      }),
      [nodeId, nodeType]
    ),
    shallow
  );
}

// 타입 정의
export type NodeContentRecord = {
  [nodeId: string]: NodeContent;
};