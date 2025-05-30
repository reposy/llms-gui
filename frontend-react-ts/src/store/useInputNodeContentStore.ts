import { create } from 'zustand';
import { FileLikeObject, InputNodeProperty } from '../types/nodes';
import { getNodeProperty, setNodeProperty } from './useNodePropertyStore';

/**
 * Custom hook for using InputNode content
 * Provides type-safe access and manipulation of InputNode content
 */

/**
 * Hook for using InputNode content with type safety
 */
export function useInputNodeProperty(nodeId: string) {
  const content = getInputNodeProperty(nodeId);
  
  // Create a type-safe setter function
  const setContent = (partialContent: Partial<InputNodeProperty>) => {
    setNodeProperty<InputNodeProperty>(nodeId, partialContent);
  };
  
  return {
    content,
    setContent
  };
}

// InputNodeProperty 형태의 콘텐츠를 가져오는 함수
export function getInputNodeProperty(nodeId: string) {
  // 타입 제네릭을 제거하고 결과를 타입 캐스팅
  const content = getNodeProperty(nodeId, 'input') as InputNodeProperty;
  return content;
} 