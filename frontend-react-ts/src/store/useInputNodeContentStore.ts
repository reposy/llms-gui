import { create } from 'zustand';
import { FileLikeObject } from '../types/nodes';
import { getNodeContent, setNodeContent, InputNodeContent } from './nodeContentStore';

/**
 * Custom hook for using InputNode content
 * Provides type-safe access and manipulation of InputNode content
 */
export type { InputNodeContent } from './nodeContentStore';

/**
 * Hook for using InputNode content with type safety
 */
export function useInputNodeContent(nodeId: string) {
  const content = getNodeContent<InputNodeContent>(nodeId, 'input');
  
  // Create a type-safe setter function
  const setContent = (partialContent: Partial<InputNodeContent>) => {
    setNodeContent<InputNodeContent>(nodeId, partialContent);
  };
  
  return {
    content,
    setContent
  };
} 