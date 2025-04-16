import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 노드 컨텐츠 기본 인터페이스
 * 모든 노드 컨텐츠는 이를 확장함
 */
export interface NodeContent {
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
      setNodeContent: (nodeId, content) => {
        set((state) => ({
          content: {
            ...state.content,
            [nodeId]: {
              ...state.content[nodeId],
              ...content
            }
          }
        }));
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
  loadFromImportedContents
} = useNodeContentStore.getState();

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