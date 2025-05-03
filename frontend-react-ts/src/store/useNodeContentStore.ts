import { create } from 'zustand';
import { createWithEqualityFn } from 'zustand/traditional';
import { persist } from 'zustand/middleware';
import { isEqual } from 'lodash';
import { useCallback } from 'react';
// Import types from the central definition file
import { 
  InputNodeContent,
  LLMNodeContent, 
  OutputNodeContent, 
  WebCrawlerNodeContent, 
  APINodeContent, 
  ConditionalNodeContent, 
  JSONExtractorNodeData, // Note: Assuming JSONExtractor uses NodeData, not Content specific type
  GroupNodeContent, 
  NodeContent, // Import the union type
  HTTPMethod, // Import necessary utility types
  RequestBodyType,
  // ExtractionRule, // Appears unused
  // FileLikeObject // Appears unused
} from '../types/nodes'; 
import { shallow } from 'zustand/shallow'; // Use shallow for store selectors

/**
 * Creates the default content for a given node type.
 * These objects should ONLY contain properties defined in the specific *NodeContent types
 * from types/nodes.ts (or *NodeData for types without a specific Content type like JSONExtractor).
 * Base properties like label/isDirty are NOT set here.
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
        // isDirty: false, // Base property, remove
      } as InputNodeContent;

    case 'llm':
      return {
        prompt: '',
        model: 'openhermes',
        temperature: 0.7,
        provider: 'ollama',
        ollamaUrl: 'http://localhost:11434',
        mode: 'text',
        // isDirty: false, // Base property, remove
      } as LLMNodeContent;

    case 'output':
      return {
        format: 'text',
        content: '', // content is part of OutputNodeContent
        mode: 'read',
        // isDirty: false, // Base property, remove
      } as OutputNodeContent;

    case 'web-crawler':
      return {
        url: '',
        waitForSelector: '',
        extractSelectors: {},
        timeout: 30000,
        headers: {},
        outputFormat: 'html',
        // isDirty: false, // Not part of WebCrawlerNodeContent
      } as WebCrawlerNodeContent;

    // HTML Parser case might be needed if used, ensure type exists in types/nodes.ts
    /* case 'html-parser': 
      return { extractionRules: [] } as HTMLParserNodeData; // Or HTMLParserNodeContent if defined
    */

    case 'api':
      return {
        url: '',
        method: 'GET' as HTTPMethod,
        requestBodyType: 'none' as RequestBodyType,
        requestHeaders: {},
        requestBody: '',
        // isDirty: false, // Base property, remove
      } as APINodeContent;

    case 'conditional':
      return {
        conditionType: 'contains',
        conditionValue: '',
        // isDirty: false, // Base property, remove
      } as ConditionalNodeContent;
    
    // Merger case might be needed if used, ensure type exists in types/nodes.ts
    /* case 'merger':
      return {
        mergeMode: 'concat', 
        arrayStrategy: 'flatten',
        items: [],
      } as MergerNodeData; // Or MergerNodeContent if defined
    */

    case 'json-extractor': // Uses NodeData as per previous check
      return {
        path: '',
        // isDirty: false, // Base property, remove
      } as JSONExtractorNodeData;

    case 'group':
      return {
        isCollapsed: false,
        // isDirty: false, // Base property, remove
      } as GroupNodeContent;

    default:
      console.warn(`Creating default content for unknown node type: ${type}. Returning empty object.`);
      // Return an empty object or minimal structure compatible with NodeContent union
      return {} as NodeContent; // Return type must satisfy NodeContent
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

  // 존재하지 않는 노드의 컨텐츠를 정리하는 함수
  cleanupDeletedNodes: (existingNodeIds: string[]) => void;
}

/**
 * 노드 컨텐츠를 저장하는 Zustand 스토어
 * persist 미들웨어로 로컬 스토리지에 자동 저장
 */
export const useNodeContentStore = createWithEqualityFn<NodeContentState>()(
  persist(
    (set, get) => ({
      contents: {},

      setNodeContent: (nodeId, contentUpdate) => set(state => {
        const currentContent = state.contents[nodeId] || createDefaultNodeContent(contentUpdate.type || 'unknown', nodeId); 
        
        const newContent = { 
          ...currentContent,
          ...contentUpdate,
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
        const newContents = { ...state.contents };
        delete newContents[nodeId];
        return { contents: newContents };
      }),

      getNodeContent: (nodeId: string, nodeType?: string): NodeContent => {
        const content = get().contents[nodeId];
        if (!content) {
          if (nodeType) {
            return createDefaultNodeContent(nodeType, nodeId); 
          } else {
             console.warn(`Content for node ${nodeId} not found and nodeType not provided. Cannot create default.`);
             return {} as NodeContent; 
          }
        }
        return content; 
      },

      getAllNodeContents: () => get().contents,
      
      loadFromImportedContents: (contents) => {
        console.log('[NodeContentStore] Loading imported contents', contents);
        set({ contents });
      },
      
      resetAllContent: () => {
        set({ contents: {} });
      },

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
      onRehydrateStorage: () => (state) => {
        console.log('Node content hydrated:', state);
      }
    }
  ),
  shallow
);

// 직접 접근 가능한 함수들
export const { 
  getNodeContent, 
  setNodeContent, 
  deleteNodeContent,
  getAllNodeContents,
  loadFromImportedContents,
  resetAllContent,
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
  const contentSelector = useCallback(
    (state: NodeContentState) => state.getNodeContent(nodeId, nodeType) as T,
    [nodeId, nodeType]
  );
  const content = useNodeContentStore(contentSelector);

  const setNodeContent = useNodeContentStore(state => state.setNodeContent);

  const updateContent = useCallback(
    (partialContent: Partial<T>) => {
      setNodeContent<T>(nodeId, { ...partialContent, type: nodeType || content?.type });
    },
    [nodeId, nodeType, setNodeContent, content?.type]
  );

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