import { useCallback } from 'react';
import { createNodeDataHook } from './useNodeDataFactory';
import { MergerNodeContent } from '../types/nodes';

/**
 * Default values for Merger node content
 */
const MERGER_DEFAULTS: Partial<MergerNodeContent> = {
  mergeMode: 'concat',
  joinSeparator: ', ',
  items: []
};

/**
 * Return type for useMergerNodeData hook
 */
interface MergerNodeDataHook {
  content: MergerNodeContent | undefined;
  items: any[];
  itemCount: number;
  mergeMode: string;
  joinSeparator: string;
  updateContent: (updates: Partial<MergerNodeContent>) => void;
  resetItems: () => void;
  addItem: (item: any) => void;
}

/**
 * Custom hook for managing Merger node data
 */
export const useMergerNodeData = createNodeDataHook<MergerNodeContent, MergerNodeDataHook>(
  'merger',
  (params) => {
    const { nodeId, content, updateContent } = params;

    // 아이템 목록
    const items = content?.items || [];
    
    // 아이템 개수
    const itemCount = items.length;
    
    // 병합 모드
    const mergeMode = content?.mergeMode || MERGER_DEFAULTS.mergeMode || 'concat';
    
    // 조인 구분자
    const joinSeparator = content?.joinSeparator || MERGER_DEFAULTS.joinSeparator || ', ';

    // 아이템 목록 초기화
    const resetItems = useCallback(() => {
      updateContent({ items: [] });
    }, [updateContent]);

    // 아이템 추가
    const addItem = useCallback((item: any) => {
      const updatedItems = [...items, item];
      updateContent({ items: updatedItems });
    }, [items, updateContent]);

    return {
      content,
      items,
      itemCount,
      mergeMode,
      joinSeparator,
      updateContent,
      resetItems,
      addItem
    };
  },
  MERGER_DEFAULTS
); 