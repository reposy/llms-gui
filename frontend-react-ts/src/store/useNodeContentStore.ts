import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isEqual } from 'lodash';
import { useCallback } from 'react';
// Import types from the central definition file
import { 
  FileLikeObject, HTTPMethod, ExtractionRule, 
  BaseNodeContent, InputNodeContent, LLMNodeContent, OutputNodeContent, 
  WebCrawlerNodeContent, APINodeContent, ConditionalNodeContent, 
  MergerNodeContent, JSONExtractorNodeContent, GroupNodeContent, 
  HTMLParserNodeContent, NodeContent // Import the union type as well
} from '../types/nodes'; 
import { shallow } from 'zustand/shallow'; // Use shallow for store selectors
// Remove self-import attempt
// import { useNodeContentStore, OutputNodeContent, NodeContent } from '../store/useNodeContentStore';

/**
 * 노드 컨텐츠의 기본 인터페이스 - REMOVED (imported from types/nodes)
 */
/*
export interface BaseNodeContent { ... }
*/

/**
 * 입력 노드 컨텐츠 - REMOVED (imported from types/nodes)
 */
/*
export interface InputNodeContent extends BaseNodeContent { ... }
*/

/**
 * LLM 노드 컨텐츠 - REMOVED (imported from types/nodes)
 */
/*
export interface LLMNodeContent extends BaseNodeContent { ... }
*/

/**
 * 출력 노드 컨텐츠
 */
export interface OutputNodeContent extends BaseNodeContent {
  format: 'json' | 'text';
  content?: string;
  mode?: 'read' | 'write';
}

/**
 * Represents the content specific to a Web Crawler node.
 */
export interface WebCrawlerNodeContent {
  type: 'web-crawler';
  label: string;
  url?: string;
  waitForSelectorOnPage?: string;
  iframeSelector?: string;
  waitForSelectorInIframe?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * HTML Parser 노드 콘텐츠
 */
export interface HTMLParserNodeContent extends BaseNodeContent {
  extractionRules?: ExtractionRule[];
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
 * 모든 노드 컨텐츠 타입의 유니온 타입 - REMOVED (imported from types/nodes)
 */
/*
export type NodeContent = ...;
*/

/**
 * Creates the default content for a given node type.
 */
// Ensure this function uses the imported types correctly
export function createDefaultNodeContent(type: string, id: string): NodeContent {
  switch (type) {
    case 'input':
      return {
        chainingItems: [],
        commonItems: [],
        items: [],
        textBuffer: '',
        iterateEachRow: false,
        chainingUpdateMode: 'element', // Ensure this matches the imported type's possibilities
        isDirty: false,
        label: 'Input'
      } as InputNodeContent; // Use imported type for assertion

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
      } as LLMNodeContent; // Use imported type

    case 'output':
      return {
        format: 'text',
        content: '',
        mode: 'read',
        isDirty: false,
        label: 'Output'
      } as OutputNodeContent;

    case 'web-crawler':
      return {
        // type: 'web-crawler', // type is not part of NodeContent generally
        label: `Web Crawler ${id.substring(0, 4)}`,
        url: '',
        waitForSelector: '', // Corrected field name based on types/nodes.ts likely
        extractSelectors: {},
        timeout: 30000,
        headers: {},
        includeHtml: false,
        outputFormat: 'text' // Default reasonable format
      } satisfies WebCrawlerNodeContent; // Use satisfies if possible, or 'as' with imported type

    case 'html-parser':
      return {
        extractionRules: [],
        isDirty: false,
        label: 'HTML Parser'
      } as HTMLParserNodeContent;

    case 'api':
      return {
        url: '',
        method: 'GET' as HTTPMethod, // Assert specific type from import
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
        // strategy: 'array', // Removed, check types/nodes.ts
        mergeMode: 'concat', // Match definition in types/nodes.ts
        arrayStrategy: 'flatten', // Match definition
        items: [],
        isDirty: false,
        label: 'Merger'
      } as MergerNodeContent;

    case 'json-extractor':
      return {
        path: '',
        // defaultValue: '', // Check if exists in types/nodes.ts
        isDirty: false,
        label: 'JSON Extractor'
      } as JSONExtractorNodeContent;

    case 'group':
      return {
        // childNodes: [], // Check if exists in types/nodes.ts
        isCollapsed: false, // Match definition
        isDirty: false,
        label: 'Group'
      } as GroupNodeContent;

    default:
      console.warn(`Creating default content for unknown node type: ${type}`);
      return { label: `Node ${id.substring(0, 4)}` } as BaseNodeContent; // Default to Base
  }
}

/**
 * 노드 컨텐츠 스토어 인터페이스
 */
interface NodeContentState {
  // 노드 ID를 키로 사용하는 컨텐츠 맵
  contents: Record<string, NodeContent>; // Use the imported union type
  
  // 노드 ID와 컨텐츠를 받아 저장하는 함수
  setNodeContent: <T extends NodeContent>(nodeId: string, content: Partial<T>) => void;
  
  // 노드 컨텐츠 삭제 함수
  deleteNodeContent: (nodeId: string) => void;
  
  // 노드 ID로 컨텐츠를 조회하는 함수
  getNodeContent: (nodeId: string, nodeType?: string) => NodeContent;
  
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
export const useNodeContentStore = create<NodeContentState>()(
  persist(
    (set, get) => ({
      contents: {},

      setNodeContent: (nodeId, contentUpdate) => set(state => {
        const currentContent = state.contents[nodeId] || createDefaultNodeContent(contentUpdate.type || 'unknown', nodeId); // Ensure default creation on update if missing
        
        // Perform a shallow merge, but handle potential deep objects if necessary
        const newContent = { 
          ...currentContent,
          ...contentUpdate,
          isDirty: true, // Mark as dirty on any update
        };

        // Optimization: Only update if content has actually changed
        if (!isEqual(currentContent, newContent)) {
          return { 
            contents: { 
              ...state.contents, 
              [nodeId]: newContent 
            }
          };
        } else {
           // console.log(`Node content for ${nodeId} unchanged, skipping update.`);
           // Return original state if no change
           return state; 
        }
      }),

      deleteNodeContent: (nodeId) => set(state => {
        const newContents = { ...state.contents };
        delete newContents[nodeId];
        return { contents: newContents };
      }),

      // getNodeContent now correctly uses the imported NodeContent type
      getNodeContent: (nodeId: string, nodeType?: string): NodeContent => {
        const content = get().contents[nodeId];
        if (!content) {
          // If content doesn't exist, create default content based on nodeType
          if (nodeType) {
            // console.warn(`Content for node ${nodeId} not found, creating default for type ${nodeType}.`);
            const defaultContent = createDefaultNodeContent(nodeType, nodeId);
            // Return the created default content WITHOUT setting it in the store here.
            // Let the caller decide whether to set it using setNodeContent action.
            return defaultContent; 
          } else {
             console.warn(`Content for node ${nodeId} not found and nodeType not provided. Cannot create default.`);
             // Return a minimal base content or handle as error
             return { label: `Node ${nodeId}` } as BaseNodeContent; // Return base content instead of {}?
          }
        }
        return content; // Return existing content, assert type NodeContent
      },

      getAllNodeContents: () => get().contents,
      
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
      name: 'node-content-storage',
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
 * @returns 노드 컨텐츠와 업데이트 함수를 포함한 객체
 */
export function useNodeContent<T extends NodeContent = NodeContent>(
  nodeId: string,
  nodeType?: string // nodeType is now optional, but still useful for getNodeContent
) {
  // Select the content using the store's getNodeContent
  const contentSelector = useCallback(
    (state: NodeContentState) => state.getNodeContent(nodeId, nodeType) as T, // Cast to T
    [nodeId, nodeType]
  );
  const content = useNodeContentStore(contentSelector, shallow); // Use shallow compare

  // Get the setNodeContent function from the store
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);

  // Create a stable update function using useCallback
  const updateContent = useCallback(
    (partialContent: Partial<T>) => {
      // Call the store's setNodeContent, ensuring type is passed if available
      // The store's setNodeContent logic should handle default creation/merging
      setNodeContent<T>(nodeId, { ...partialContent, type: nodeType || content?.type });
    },
    [nodeId, nodeType, setNodeContent, content?.type] // Add content.type as dependency
  );

  // Return the content and the memoized update function
  return { content, updateContent };
}

// 하위 호환성을 위한 레거시 함수들
export {
  useNodeContent as useInputNodeContent,
  getNodeContent as getInputNodeContent,
  setNodeContent as setInputNodeContent
};

// Update NodeContentRecord to include HTMLParserNodeContent
export type NodeContentRecord = {
  [nodeId: string]: NodeContent; // Use the imported union type
}; 

// Duplicate ExtractionRule removed
/*
export interface ExtractionRule { ... }
*/