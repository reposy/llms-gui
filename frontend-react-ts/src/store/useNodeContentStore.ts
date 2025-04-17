import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isEqual } from 'lodash';
import { useCallback } from 'react';

/**
 * 노드 컨텐츠 기본 인터페이스
 * 모든 노드 컨텐츠는 이를 확장함
 */
export interface NodeContent {
  isDirty?: boolean;
  [key: string]: any;
}

/**
 * 노드 컨텐츠 스토어 인터페이스
 */
interface NodeContentStore {
  // 노드 ID를 키로 사용하는 컨텐츠 맵
  content: Record<string, NodeContent>;
  
  // 노드 ID와 컨텐츠를 받아 저장하는 함수
  setNodeContent: (nodeId: string, content: NodeContent) => void;
  
  // 노드 컨텐츠 삭제 함수
  deleteNodeContent: (nodeId: string) => void;
  
  // 노드 ID로 컨텐츠를 조회하는 함수
  getNodeContent: (nodeId: string) => NodeContent;
  
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
}

/**
 * 노드 컨텐츠를 저장하는 Zustand 스토어
 * persist 미들웨어로 로컬 스토리지에 자동 저장
 */
export const useNodeContentStore = create<NodeContentStore>()(
  persist(
    (set, get) => ({
      // 초기 상태: 빈 객체
      content: {},
      
      // 노드 컨텐츠 설정 (기존 컨텐츠와 병합)
      setNodeContent: (nodeId, newContentUpdate) => {
        set((state) => {
          const currentContent = state.content[nodeId] || {};
          
          // Merge update with current content, excluding isDirty temporarily
          const { isDirty: currentDirty, ...currentContentWithoutDirty } = currentContent;
          const { isDirty: newDirtyUpdate, ...newContentUpdateWithoutDirty } = newContentUpdate;
          
          const potentialNewContent = {
            ...currentContentWithoutDirty,
            ...newContentUpdateWithoutDirty
          };

          // Check if the content actually changed (excluding isDirty)
          if (isEqual(currentContentWithoutDirty, potentialNewContent)) {
            // If only isDirty changed, handle that separately
            const finalIsDirty = newDirtyUpdate !== undefined ? newDirtyUpdate : true;
            if (currentDirty !== finalIsDirty) {
              console.log(`[NodeContentStore] Updating only isDirty for ${nodeId} to ${finalIsDirty}`);
              return {
                content: {
                  ...state.content,
                  [nodeId]: { ...currentContent, isDirty: finalIsDirty }
                }
              };
            } else {
              // console.log(`[NodeContentStore] Skipping content update for ${nodeId} - no change.`);
              return {}; // No actual change
            }
          }
          
          // Content changed, determine final isDirty state
          // If newContentUpdate specified isDirty, use it, otherwise default to true
          const finalIsDirty = newDirtyUpdate !== undefined ? newDirtyUpdate : true;
          
          console.log(`[NodeContentStore] Updating content for ${nodeId}:`, { ...potentialNewContent, isDirty: finalIsDirty });
          
          return {
            content: {
              ...state.content,
              [nodeId]: { ...potentialNewContent, isDirty: finalIsDirty }
            }
          };
        });
      },
      
      // 노드 컨텐츠 삭제
      deleteNodeContent: (nodeId) => {
        set((state) => {
          const newContent = { ...state.content };
          delete newContent[nodeId];
          return { content: newContent };
        });
      },
      
      // 노드 컨텐츠 조회
      getNodeContent: (nodeId) => {
        return get().content[nodeId] || {};
      },
      
      // 모든 노드 컨텐츠 조회
      getAllNodeContents: () => {
        return get().content;
      },
      
      // 임포트된 컨텐츠로부터 로드
      loadFromImportedContents: (contents) => {
        set({ content: contents });
      },
      
      // 모든 컨텐츠 초기화
      resetAllContent: () => {
        set({ content: {} });
      },

      // 노드의 dirty 상태 설정
      markNodeDirty: (nodeId, isDirty) => {
        // Use setNodeContent to handle the update, ensuring consistency
        get().setNodeContent(nodeId, { isDirty }); 
      },

      // 노드의 dirty 상태 확인
      isNodeDirty: (nodeId) => {
        const nodeContent = get().content[nodeId];
        return nodeContent && !!nodeContent.isDirty;
      }
    }),
    {
      // 로컬 스토리지 이름
      name: 'node-content-storage',
      
      // 영구 저장에서 제외할 항목 없음 (모든 content 저장)
      partialize: (state) => ({ content: state.content })
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
  isNodeDirty
} = useNodeContentStore.getState();

/**
 * 특정 노드의 컨텐츠를 조회하고 업데이트하는 훅
 * @param nodeId 노드 ID
 * @returns 노드 컨텐츠와 업데이트 함수
 */
export const useNodeContent = (nodeId: string) => {
  const content = useNodeContentStore((state) => state.content[nodeId] || {});
  // Important: Get the setNodeContent function directly from the store instance
  const updateContentFunc = useNodeContentStore((state) => state.setNodeContent);
  
  // Wrap the update function to automatically pass the nodeId
  const updateContentForNode = useCallback((newContent: Partial<NodeContent>) => {
    updateContentFunc(nodeId, newContent);
  }, [nodeId, updateContentFunc]);

  return {
    content,
    updateContent: updateContentForNode
  };
};

/**
 * 특정 타입의 노드 컨텐츠를 위한 타입 별칭
 * 이를 통해 기존 코드와의 호환성 유지
 */
export type InputNodeContent = NodeContent;
export type OutputNodeContent = NodeContent;
export type LLMNodeContent = NodeContent;
export type APINodeContent = NodeContent;
export type JSONExtractorNodeContent = NodeContent;
export type GroupNodeContent = NodeContent;
export type ConditionalNodeContent = NodeContent;
export type MergerNodeContent = NodeContent;
export type WebCrawlerNodeContent = NodeContent; 