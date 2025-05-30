import { createWithEqualityFn } from 'zustand/traditional';
import { persist } from 'zustand/middleware';
import { isEqual } from 'lodash';
import { useCallback } from 'react';
import {
  InputNodeProperty,
  LlmNodeProperty,
  OutputNodeProperty,
  WebCrawlerNodeProperty,
  APINodeProperty,
  ConditionalNodeProperty,
  JSONExtractorNodeProperty,
  GroupNodeProperty,
  NodeProperty,
  MergerNodeProperty,
  HTMLParserNodeProperty,
  NodeTypeMap,
  HTTPMethod,
  RequestBodyType,
  NodeType
} from '../types/nodes';
import { shallow } from 'zustand/shallow';

export function createDefaultNodeProperty(type: string, id: string): NodeProperty {
  switch (type) {
    case 'input':
      return {
        type: 'input',
        items: [],
        commonItems: [],
        chainingItems: [],
        textBuffer: '',
        iterateEachRow: false,
        executionMode: 'batch',
        chainingUpdateMode: 'element',
        accumulationMode: 'always',
      } as InputNodeProperty;
    case 'llm':
      return {
        type: 'llm',
        prompt: '',
        model: 'openhermes',
        temperature: 0.7,
        provider: 'ollama',
        ollamaUrl: 'http://localhost:11434',
        mode: 'text',
      } as LlmNodeProperty;
    case 'output':
      return {
        type: 'output',
        format: 'text',
        content: '',
        mode: 'read',
      } as OutputNodeProperty;
    case 'web-crawler':
      return {
        type: 'web-crawler',
        url: '',
        waitForSelector: '',
        extractSelectors: {},
        timeout: 30000,
        headers: {},
        outputFormat: 'html',
      } as WebCrawlerNodeProperty;
    case 'html-parser':
      return {
        type: 'html-parser',
        extractionRules: []
      } as HTMLParserNodeProperty;
    case 'api':
      return {
        type: 'api',
        url: '',
        method: 'GET' as HTTPMethod,
        requestHeaders: {},
        requestBody: '',
      } as APINodeProperty;
    case 'conditional':
      return {
        type: 'conditional',
        conditionType: 'contains',
        conditionValue: '',
      } as ConditionalNodeProperty;
    case 'merger':
      return {
        type: 'merger',
        mergeMode: 'concat',
        strategy: 'array',
        items: [],
        keys: [],
      } as MergerNodeProperty;
    case 'json-extractor':
      return {
        type: 'json-extractor',
        path: '',
      } as JSONExtractorNodeProperty;
    case 'group':
      return {
        type: 'group',
        isCollapsed: false,
        items: []
      } as GroupNodeProperty;
    default:
      return {} as NodeProperty;
  }
}

interface NodePropertyState {
  contents: Record<string, NodeProperty>;
  /**
   * 노드의 속성 일부(Partial<NodeProperty>)만 받아서 병합 업데이트합니다.
   * 항상 Partial<NodeProperty>만 허용하며, 전체 NodeProperty를 직접 대입하지 않습니다.
   */
  setNodeProperty: (nodeId: string, updates: Partial<NodeProperty>) => void;
  deleteNodeProperty: (nodeId: string) => void;
  /**
   * 노드의 전체 속성(NodeProperty)을 반환합니다. (존재하지 않으면 기본값)
   */
  getNodeProperty: (nodeId: string, nodeType?: string) => NodeProperty;
  getAllNodePropertys: () => Record<string, NodeProperty>;
  loadFromImportedContents: (contents: Record<string, NodeProperty>) => void;
  resetAllContent: () => void;
  cleanupDeletedNodes: (existingNodeIds: string[]) => void;
  isNodeDirty: (nodeId: string) => boolean;
  resetNodeProperty: (nodeId: string) => void;
}

export const useNodePropertyStore = createWithEqualityFn<NodePropertyState>()(
  persist(
    (set, get) => ({
      contents: {},
      setNodeProperty: (nodeId, updates) => set(state => {
        const nodeType = (updates as any).type || 'unknown';
        const currentContent = state.contents[nodeId] || createDefaultNodeProperty(nodeType, nodeId);
        const newContent = {
          ...currentContent,
          ...updates,
          isDirty: true
        } as NodeProperty;
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
      deleteNodeProperty: (nodeId) => set(state => {
        const { [nodeId]: removedContent, ...rest } = state.contents;
        return { contents: rest };
      }),
      getNodeProperty: (nodeId, nodeType) => {
        const state = get();
        const content = state.contents[nodeId];
        if (content) {
          return content;
        }
        if (nodeType) {
          return createDefaultNodeProperty(nodeType as string, nodeId);
        }
        return {} as NodeProperty;
      },
      getAllNodePropertys: () => get().contents,
      loadFromImportedContents: (contents) => set({ contents }),
      resetAllContent: () => set({ contents: {} }),
      cleanupDeletedNodes: (existingNodeIds) => set(state => {
        const updatedContents: Record<string, NodeProperty> = {};
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
      resetNodeProperty: (nodeId) => set(state => {
        const content = state.contents[nodeId];
        if (!content) return state;
        const nodeType = inferNodeType(content);
        if (!nodeType) return state;
        const freshContent = createDefaultNodeProperty(nodeType, nodeId);
        return {
          contents: {
            ...state.contents,
            [nodeId]: {
              ...freshContent,
              label: content.label
            }
          }
        };
      })
    }),
    {
      name: 'node-content-storage',
      partialize: (state) => {
        const filteredContents: Record<string, any> = {};
        Object.entries(state.contents).forEach(([nodeId, content]) => {
          const persistedContent = JSON.parse(JSON.stringify(content));
          if (typeof persistedContent?.content === 'string' &&
              persistedContent.content.length > 1000) {
            persistedContent.content = persistedContent.content.substring(0, 1000) + '... [truncated]';
          }
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
  shallow
);

function inferNodeType(content: NodeProperty): string | null {
  if ('prompt' in content && 'model' in content) {
    return 'llm';
  }
  if ('url' in content && 'method' in content && 'requestBodyType' in content) {
    return 'api';
  }
  if ('format' in content && 'content' in content && 'mode' in content) {
    return 'output';
  }
  if ('path' in content && !('url' in content)) {
    return 'json-extractor';
  }
  if ('isCollapsed' in content && Object.keys(content).length <= 3) {
    return 'group';
  }
  if ('conditionType' in content && 'conditionValue' in content) {
    return 'conditional';
  }
  if ('strategy' in content && 'keys' in content) {
    return 'merger';
  }
  if ('url' in content && 'extractSelectors' in content) {
    return 'web-crawler';
  }
  if ('extractionRules' in content) {
    return 'html-parser';
  }
  return null;
}

export const getAllNodePropertys = () => useNodePropertyStore.getState().getAllNodePropertys();
export const getNodeProperty = (nodeId: string, nodeType?: string): NodeProperty =>
  useNodePropertyStore.getState().getNodeProperty(nodeId, nodeType as any);
export const setNodeProperty = (nodeId: string, content: Partial<NodeProperty>) => useNodePropertyStore.getState().setNodeProperty(nodeId, content);
export const loadFromImportedContents = (contents: Record<string, NodeProperty>) => useNodePropertyStore.getState().loadFromImportedContents(contents);
export const resetAllContent = () => useNodePropertyStore.getState().resetAllContent();

export function useNodeProperty<T extends NodeProperty = NodeProperty>(
  nodeId: string,
  nodeType?: string
) {
  return useNodePropertyStore(
    useCallback(
      (state) => ({
        content: state.getNodeProperty(nodeId, nodeType as any) as T,
        isContentDirty: state.isNodeDirty(nodeId),
        setContent: (updates: Partial<T>) => state.setNodeProperty(nodeId, updates),
        resetContent: () => state.resetNodeProperty(nodeId)
      }),
      [nodeId, nodeType]
    ),
    shallow
  );
}

export type NodePropertyRecord = {
  [nodeId: string]: NodeProperty;
}; 