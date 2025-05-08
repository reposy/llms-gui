import { create } from 'zustand';
import { FileLikeObject, InputNodeContent } from '../types/nodes';
import { getNodeContent, setNodeContent } from './useNodeContentStore';

/**
 * Custom hook for using InputNode content
 * Provides type-safe access and manipulation of InputNode content
 */

/**
 * Hook for using InputNode content with type safety
 */
export function useInputNodeContent(nodeId: string) {
  const content = getInputNodeContent(nodeId);
  
  // Create a type-safe setter function
  const setContent = (partialContent: Partial<InputNodeContent>) => {
    setNodeContent<InputNodeContent>(nodeId, partialContent);
  };
  
  return {
    content,
    setContent
  };
}

// InputNodeContent 형태의 콘텐츠를 가져오는 함수
export function getInputNodeContent(nodeId: string) {
  // 타입 제네릭을 제거하고 결과를 타입 캐스팅
  const content = getNodeContent(nodeId, 'input') as InputNodeContent;
  return content;
} 