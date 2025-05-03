import { useCallback, useState } from 'react';
import { useNodeContentStore, InputNodeContent, NodeContent } from '../store/useNodeContentStore';

/**
 * InputNode 데이터 관리 훅 (세 가지 아이템 목록 지원)
 * 
 * Input 노드의 상태(chainingItems, commonItems, items, textBuffer, chainingUpdateMode, iterateEachRow)
 * 를 관리하고 관련 액션 핸들러를 제공합니다. 모든 상태는 useNodeContentStore와 동기화됩니다.
 */
export const useInputNodeData = ({ nodeId }: { nodeId: string }) => {
  // useNodeContentStore 훅 사용
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);
  
  // 노드 컨텐츠 가져오기
  const content = useNodeContentStore(
    useCallback(
      (state) => state.getNodeContent<InputNodeContent>(nodeId, 'input'),
      [nodeId]
    )
  );

  // 컨텐츠 필드 접근 (기본값 처리 포함)
  const chainingItems: (string | File)[] = (content?.chainingItems as (string | File)[]) || [];
  const commonItems: (string | File)[] = (content?.commonItems as (string | File)[]) || [];
  const items: (string | File)[] = (content?.items as (string | File)[]) || [];
  const textBuffer: string = content?.textBuffer || '';
  const iterateEachRow: boolean = content?.iterateEachRow || false;
  const chainingUpdateMode: 'common' | 'replaceCommon' | 'element' | 'none' = content?.chainingUpdateMode || 'element';

  // 텍스트 아이템 편집 상태 관리 (로컬 UI 상태)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  /**
   * 부분적인 컨텐츠 업데이트 유틸리티 함수
   */
  const updateInputContent = useCallback((updates: Partial<Omit<InputNodeContent, keyof NodeContent>>) => {
    setNodeContent<InputNodeContent>(nodeId, {
      ...content,
      ...updates,
    });
  }, [nodeId, content, setNodeContent]);

  /**
   * 텍스트 버퍼 변경 핸들러
   */
  const handleTextChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateInputContent({ textBuffer: event.target.value });
  }, [updateInputContent]);

  /**
   * 공통 또는 개별 항목으로 텍스트 추가
   */
  const handleAddText = useCallback((itemType: 'common' | 'element') => {
    const trimmedText = textBuffer.trim();
    if (!trimmedText) return;
    
    if (itemType === 'common') {
      const updatedCommonItems = [...commonItems, trimmedText];
      updateInputContent({ 
        commonItems: updatedCommonItems,
        textBuffer: '' // 버퍼 비우기
      });
    } else {
      const updatedItems = [...items, trimmedText];
      updateInputContent({ 
        items: updatedItems,
        textBuffer: '' // 버퍼 비우기
      });
    }
  }, [textBuffer, commonItems, items, updateInputContent]);

  /**
   * 처리 모드 (Batch/Foreach) 토글
   */
  const handleToggleProcessingMode = useCallback(() => {
    updateInputContent({ iterateEachRow: !iterateEachRow });
  }, [iterateEachRow, updateInputContent]);

  /**
   * 자동 Chaining 업데이트 모드 변경
   */
  const handleUpdateChainingMode = useCallback((newMode: 'common' | 'replaceCommon' | 'element' | 'none') => {
    updateInputContent({ chainingUpdateMode: newMode });
  }, [updateInputContent]);


  /**
   * 공통 또는 개별 항목으로 파일 추가
   */
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, itemType: 'common' | 'element') => {
    if (!event.target.files?.length) return;
    const files = Array.from(event.target.files);
    
    try {
      const newFiles: File[] = files; // File 객체 그대로 사용

      if (newFiles.length > 0) {
        if (itemType === 'common') {
          const updatedCommonItems = [...commonItems, ...newFiles];
          updateInputContent({ commonItems: updatedCommonItems });
        } else {
          const updatedItems = [...items, ...newFiles];
          updateInputContent({ items: updatedItems });
        }
      }
    } catch (error) {
       console.error("Error processing files:", error);
    } finally {
       event.target.value = ''; 
    }
  }, [commonItems, items, updateInputContent]);

  /**
   * 특정 인덱스의 아이템 삭제 (chaining, common, element 구분)
   */
  const handleDeleteItem = useCallback((index: number, itemType: 'chaining' | 'common' | 'element') => {
    if (itemType === 'chaining') {
      if (index < 0 || index >= chainingItems.length) return;
      const updatedChainingItems = [...chainingItems];
      updatedChainingItems.splice(index, 1);
      updateInputContent({ chainingItems: updatedChainingItems });
    } else if (itemType === 'common') {
      if (index < 0 || index >= commonItems.length) return;
      const updatedCommonItems = [...commonItems];
      updatedCommonItems.splice(index, 1);
      updateInputContent({ commonItems: updatedCommonItems });
    } else {
      if (index < 0 || index >= items.length) return;
      const updatedItems = [...items];
      updatedItems.splice(index, 1);
      updateInputContent({ items: updatedItems });
    }
  }, [chainingItems, commonItems, items, updateInputContent]);

  /**
   * 모든 아이템 또는 특정 타입 아이템 삭제
   */
  const handleClearItems = useCallback((itemType: 'chaining' | 'common' | 'element' | 'all' = 'all') => {
    const updates: Partial<InputNodeContent> = {};
    if (itemType === 'chaining' || itemType === 'all') {
      updates.chainingItems = [];
    }
    if (itemType === 'common' || itemType === 'all') {
      updates.commonItems = [];
    }
    if (itemType === 'element' || itemType === 'all') {
      updates.items = [];
    }
    if (Object.keys(updates).length > 0) {
      updateInputContent(updates);
    }
  }, [updateInputContent]);

  /**
   * Chaining 아이템을 Common 또는 Element 아이템으로 이동
   */
  const handleMoveChainingItem = useCallback((index: number, targetType: 'common' | 'element') => {
    if (index < 0 || index >= chainingItems.length) return;

    const itemToMove = chainingItems[index];
    const updatedChainingItems = [...chainingItems];
    updatedChainingItems.splice(index, 1);

    let updatedCommonItems = [...commonItems];
    let updatedItems = [...items];

    if (targetType === 'common') {
      updatedCommonItems.push(itemToMove);
    } else {
      updatedItems.push(itemToMove);
    }

    updateInputContent({ 
      chainingItems: updatedChainingItems,
      commonItems: updatedCommonItems,
      items: updatedItems
    });
    setEditingText('');
  }, [chainingItems, commonItems, items, updateInputContent]);

  /**
   * 텍스트 아이템 편집 시작 (UI 상태 설정)
   */
  const handleStartEditingTextItem = useCallback((index: number, itemType: 'common' | 'element') => {
    const targetArray = itemType === 'common' ? commonItems : items;
    if (index >= 0 && index < targetArray.length && typeof targetArray[index] === 'string') {
      setEditingItemId(`${itemType}-${index}`);
      setEditingText(targetArray[index] as string);
    }
  }, [commonItems, items]);

  /**
   * 편집 중인 텍스트 변경 (UI 상태 설정)
   */
  const handleEditingTextChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditingText(event.target.value);
  }, []);

  /**
   * 텍스트 아이템 편집 완료 (Store 업데이트)
   */
  const handleFinishEditingTextItem = useCallback(() => {
    if (!editingItemId) return;

    const [itemType, indexStr] = editingItemId.split('-');
    const index = parseInt(indexStr, 10);

    if (itemType === 'common') {
      if (index >= 0 && index < commonItems.length && typeof commonItems[index] === 'string') {
        const updatedCommonItems = [...commonItems];
        updatedCommonItems[index] = editingText;
        updateInputContent({ commonItems: updatedCommonItems });
      }
    } else if (itemType === 'element') {
      if (index >= 0 && index < items.length && typeof items[index] === 'string') {
        const updatedItems = [...items];
        updatedItems[index] = editingText;
        updateInputContent({ items: updatedItems });
      }
    }
    setEditingItemId(null);
    setEditingText('');
  }, [editingItemId, editingText, commonItems, items, updateInputContent]);

  /**
   * 텍스트 아이템 편집 취소 (UI 상태 리셋)
   */
  const handleCancelEditingTextItem = useCallback(() => {
    setEditingItemId(null);
    setEditingText('');
  }, []);

  // Define specific clear handlers
  const handleClearChainingItems = useCallback(() => handleClearItems('chaining'), [handleClearItems]);
  const handleClearCommonItems = useCallback(() => handleClearItems('common'), [handleClearItems]);
  const handleClearElementItems = useCallback(() => handleClearItems('element'), [handleClearItems]);

  return {
    // 상태 값
    chainingItems,
    commonItems,
    items,
    textBuffer,
    iterateEachRow,
    chainingUpdateMode,
    editingItemId, // UI 편집 상태 노출
    editingText,   // UI 편집 상태 노출
    
    // 핸들러 함수
    handleTextChange,
    handleAddText,
    handleFileChange,
    handleDeleteItem,
    handleClearItems, // Generic clear handler
    handleToggleProcessingMode,
    handleUpdateChainingMode,
    handleMoveChainingItem, // Add this back (used as handleMoveItem in Config)
    handleStartEditingTextItem,
    handleEditingTextChange,
    handleFinishEditingTextItem,
    handleCancelEditingTextItem,
    
    // Specific clear handlers for Config/ItemList
    handleClearChainingItems,
    handleClearCommonItems,
    handleClearElementItems,
  };
}; 