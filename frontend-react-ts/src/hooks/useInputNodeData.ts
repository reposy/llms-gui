import { useCallback, useState, useEffect } from 'react';
import { InputNodeContent, BaseNodeData } from '../types/nodes';
import { useNodeContentStore } from '../store/useNodeContentStore';
import { formatFileSize, FileMetadata, LocalFileMetadata, createLocalFileMetadata, isFileSizeValid, revokeObjectUrl } from '../types/files';

// 파일 처리 상태 인터페이스
interface FileProcessingState {
  uploading: boolean;
  error: string | null;
  progress: number;
}

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
      (state) => state.getNodeContent(nodeId, 'input') as InputNodeContent,
      [nodeId]
    )
  );

  // 컨텐츠 필드 접근 (기본값 처리 포함)
  const chainingItems: (string | File | FileMetadata | LocalFileMetadata)[] = (content?.chainingItems as (string | File | FileMetadata | LocalFileMetadata)[]) || [];
  const commonItems: (string | File | FileMetadata | LocalFileMetadata)[] = (content?.commonItems as (string | File | FileMetadata | LocalFileMetadata)[]) || [];
  const items: (string | File | FileMetadata | LocalFileMetadata)[] = (content?.items as (string | File | FileMetadata | LocalFileMetadata)[]) || [];
  const textBuffer: string = content?.textBuffer || '';
  const iterateEachRow: boolean = content?.iterateEachRow || false;
  const chainingUpdateMode: 'common' | 'replaceCommon' | 'element' | 'replaceElement' | 'none' = content?.chainingUpdateMode || 'element';

  // 텍스트 아이템 편집 상태 관리 (로컬 UI 상태)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // 파일 처리 상태 (업로드 중, 에러, 진행률)
  const [fileProcessing, setFileProcessing] = useState<FileProcessingState>({
    uploading: false,
    error: null,
    progress: 0
  });

  // ObjectURL 정리를 위한 효과
  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시 남아있는 objectURL 정리
      [...chainingItems, ...commonItems, ...items].forEach(item => {
        if (typeof item === 'object' && 'objectUrl' in item) {
          revokeObjectUrl(item.objectUrl);
        }
      });
    };
  }, []);

  /**
   * 파일 처리 오류 초기화 함수
   */
  const resetError = useCallback(() => {
    setFileProcessing(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  /**
   * 부분적인 컨텐츠 업데이트 유틸리티 함수
   */
  const updateInputContent = useCallback((updates: Partial<Omit<InputNodeContent, keyof BaseNodeData>>) => {
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
    const newIterateEachRow = !iterateEachRow;
    updateInputContent({
      iterateEachRow: newIterateEachRow,
      executionMode: newIterateEachRow ? 'foreach' : 'batch'
    });
  }, [iterateEachRow, updateInputContent]);

  /**
   * 자동 Chaining 업데이트 모드 변경
   */
  const handleUpdateChainingMode = useCallback((newMode: 'common' | 'replaceCommon' | 'element' | 'replaceElement' | 'none') => {
    updateInputContent({ chainingUpdateMode: newMode });
  }, [updateInputContent]);

  /**
   * 공통 또는 개별 항목으로 파일 추가 (로컬 메모리에 저장)
   */
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, itemType: 'common' | 'element') => {
    if (!event.target.files?.length) return;
    const files = Array.from(event.target.files);
    
    // 파일 처리 상태 초기화
    setFileProcessing({
      uploading: true,
      error: null,
      progress: 0
    });
    
    try {
      // 파일 크기 검증
      const invalidFiles = files.filter(file => !isFileSizeValid(file, 10 * 1024 * 1024));
      if (invalidFiles.length > 0) {
        throw new Error(`파일 크기는 10MB 이하여야 합니다: ${invalidFiles.map(f => f.name).join(', ')}`);
      }
      
      // 각 파일에 대해 LocalFileMetadata 생성
      const fileMetadataList = files.map(file => createLocalFileMetadata(file));
      
      // 생성된 메타데이터 추가
      if (fileMetadataList.length > 0) {
        if (itemType === 'common') {
          const updatedCommonItems = [...commonItems, ...fileMetadataList];
          updateInputContent({ commonItems: updatedCommonItems });
        } else {
          const updatedItems = [...items, ...fileMetadataList];
          updateInputContent({ items: updatedItems });
        }
      }
      
      // 업로드 완료 상태 설정
      setFileProcessing({
        uploading: false,
        error: null,
        progress: 100
      });
      
      // 진행률 표시기 잠시 후 리셋
      setTimeout(() => {
        setFileProcessing(prev => ({
          ...prev,
          progress: 0
        }));
      }, 1500);
      
    } catch (error) {
      // 에러 처리
      const errorMessage = error instanceof Error ? error.message : '파일 처리 중 오류가 발생했습니다.';
      console.error("Error processing files:", error);
      setFileProcessing({
        uploading: false,
        error: errorMessage,
        progress: 0
      });
    } finally {
      // input 필드 초기화 (같은 파일 재선택 허용)
      event.target.value = ''; 
    }
  }, [commonItems, items, updateInputContent]);

  // 항상 서버가 연결되어 있지 않은 것으로 처리 (로컬 파일 저장 모드)
  const serverConnected = false;

  /**
   * 특정 인덱스의 아이템 삭제 (chaining, common, element 구분)
   */
  const handleDeleteItem = useCallback((index: number, itemType: 'chaining' | 'common' | 'element') => {
    let targetArray;
    let updatedArray;
    
    if (itemType === 'chaining') {
      if (index < 0 || index >= chainingItems.length) return;
      targetArray = chainingItems;
      updatedArray = [...chainingItems];
    } else if (itemType === 'common') {
      if (index < 0 || index >= commonItems.length) return;
      targetArray = commonItems;
      updatedArray = [...commonItems];
    } else {
      if (index < 0 || index >= items.length) return;
      targetArray = items;
      updatedArray = [...items];
    }
    
    // objectURL 정리 (LocalFileMetadata 객체인 경우)
    const itemToDelete = targetArray[index];
    if (typeof itemToDelete === 'object' && 'objectUrl' in itemToDelete) {
      revokeObjectUrl(itemToDelete.objectUrl);
    }
    
    updatedArray.splice(index, 1);
    
    if (itemType === 'chaining') {
      updateInputContent({ chainingItems: updatedArray });
    } else if (itemType === 'common') {
      updateInputContent({ commonItems: updatedArray });
    } else {
      updateInputContent({ items: updatedArray });
    }
  }, [chainingItems, commonItems, items, updateInputContent]);

  /**
   * 모든 아이템 또는 특정 타입 아이템 삭제
   */
  const handleClearItems = useCallback((itemType: 'chaining' | 'common' | 'element' | 'all' = 'all') => {
    const updates: Partial<InputNodeContent> = {};
    
    // ObjectURL 정리
    if (itemType === 'chaining' || itemType === 'all') {
      chainingItems.forEach(item => {
        if (typeof item === 'object' && 'objectUrl' in item) {
          revokeObjectUrl(item.objectUrl);
        }
      });
      updates.chainingItems = [];
    }
    
    if (itemType === 'common' || itemType === 'all') {
      commonItems.forEach(item => {
        if (typeof item === 'object' && 'objectUrl' in item) {
          revokeObjectUrl(item.objectUrl);
        }
      });
      updates.commonItems = [];
    }
    
    if (itemType === 'element' || itemType === 'all') {
      items.forEach(item => {
        if (typeof item === 'object' && 'objectUrl' in item) {
          revokeObjectUrl(item.objectUrl);
        }
      });
      updates.items = [];
    }
    
    if (Object.keys(updates).length > 0) {
      updateInputContent(updates);
    }
  }, [chainingItems, commonItems, items, updateInputContent]);

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
    label: content?.label || '',
    fileProcessing,
    resetError,    // 에러 초기화 함수 노출
    serverConnected, // 항상 false 반환
    
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