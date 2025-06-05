import { useCallback, useState } from 'react';
import { InputNodeProperty, BaseNodeData } from '../types/nodes';
import { useNodePropertyStore } from '../store/useNodePropertyStore';
import { BackendFileMetadata, FILE_CONTEXTS, isFileSizeValid } from '../types/files';
import { useUnifiedFileUpload } from './useUnifiedFileUpload';

/**
 * InputNode 데이터 관리 훅 (통합 파일 시스템 사용)
 * 
 * Input 노드의 상태를 관리하고 관련 액션 핸들러를 제공합니다.
 * 모든 상태는 useNodePropertyStore와 동기화되며, 파일은 백엔드에 저장됩니다.
 */
export const useInputNodeData = ({ nodeId }: { nodeId: string }) => {
  // useNodePropertyStore 훅 사용
  const setNodeProperty = useNodePropertyStore(state => state.setNodeProperty);
  
  // 통합 파일 업로드 훅 사용 (Flow Editor 컨텍스트)
  const { 
    uploading: fileUploading, 
    error: uploadError, 
    progress: uploadProgress,
    handleFileChange: unifiedFileChange,
    clearError: clearUploadError
  } = useUnifiedFileUpload(FILE_CONTEXTS.FLOW_EDITOR);
  
  // 노드 컨텐츠 가져오기
  const content = useNodePropertyStore(
    useCallback(
      (state) => state.getNodeProperty(nodeId, 'input') as InputNodeProperty,
      [nodeId]
    )
  );

  // 컨텐츠 필드 접근 (기본값 처리 포함) - 이제 BackendFileMetadata 타입 지원
  const chainingItems: (string | BackendFileMetadata)[] = (content?.chainingItems as (string | BackendFileMetadata)[]) || [];
  const commonItems: (string | BackendFileMetadata)[] = (content?.commonItems as (string | BackendFileMetadata)[]) || [];
  const items: (string | BackendFileMetadata)[] = (content?.items as (string | BackendFileMetadata)[]) || [];
  const textBuffer: string = content?.textBuffer || '';
  const iterateEachRow: boolean = content?.iterateEachRow || false;
  const chainingUpdateMode: 'common' | 'replaceCommon' | 'element' | 'replaceElement' | 'none' = content?.chainingUpdateMode || 'element';

  // 텍스트 아이템 편집 상태 관리 (로컬 UI 상태)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // Input 컨텐츠 업데이트 헬퍼
  const updateInputContent = useCallback((updates: Partial<InputNodeProperty>) => {
    setNodeProperty(nodeId, 'input', { ...content, ...updates });
  }, [nodeId, content, setNodeProperty]);

  // 텍스트 추가
  const handleAddText = useCallback((itemType: 'common' | 'element' | 'chaining') => {
    if (!textBuffer.trim()) return;

    const newTextItem = textBuffer.trim();
    
    if (itemType === 'common') {
      const updatedCommonItems = [...commonItems, newTextItem];
      updateInputContent({ commonItems: updatedCommonItems, textBuffer: '' });
    } else if (itemType === 'element') {
      const updatedItems = [...items, newTextItem];
      updateInputContent({ items: updatedItems, textBuffer: '' });
    } else if (itemType === 'chaining') {
      const updatedChainingItems = [...chainingItems, newTextItem];
      updateInputContent({ chainingItems: updatedChainingItems, textBuffer: '' });
    }
  }, [textBuffer, commonItems, items, chainingItems, updateInputContent]);

  // 파일 변경 핸들러 (통합 파일 시스템 사용)
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, itemType: 'common' | 'element') => {
    if (!event.target.files?.length) return;

    console.log(`Flow Editor - File selection for ${itemType}:`, Array.from(event.target.files).map(f => f.name));
    
    try {
      // 통합 파일 업로드 사용
      const result = await unifiedFileChange(event);

      if (result.success && result.files.length > 0) {
        // 업로드된 파일들을 BackendFileMetadata로 추가
        if (itemType === 'common') {
          const updatedCommonItems = [...commonItems, ...result.files];
          updateInputContent({ commonItems: updatedCommonItems });
        } else {
          const updatedItems = [...items, ...result.files];
          updateInputContent({ items: updatedItems });
        }
        
        console.log(`Flow Editor - Successfully uploaded ${result.files.length} files to ${itemType}`);
      } else {
        console.error('Flow Editor - File upload failed:', result.error);
      }
    } catch (error) {
      console.error('Flow Editor - File upload error:', error);
    }
  }, [commonItems, items, updateInputContent, unifiedFileChange]);

  // 아이템 삭제
  const handleDeleteItem = useCallback((index: number, itemType: 'common' | 'element' | 'chaining') => {
    if (itemType === 'common') {
      const updatedCommonItems = commonItems.filter((_, i) => i !== index);
      updateInputContent({ commonItems: updatedCommonItems });
    } else if (itemType === 'element') {
      const updatedItems = items.filter((_, i) => i !== index);
      updateInputContent({ items: updatedItems });
    } else if (itemType === 'chaining') {
      const updatedChainingItems = chainingItems.filter((_, i) => i !== index);
      updateInputContent({ chainingItems: updatedChainingItems });
    }
  }, [commonItems, items, chainingItems, updateInputContent]);

  // 아이템 이동
  const handleMoveItem = useCallback((index: number, targetType: 'common' | 'element') => {
    // 구현 필요 시 추가
  }, []);

  // 모든 아이템 클리어
  const handleClearItems = useCallback(() => {
    updateInputContent({ 
      commonItems: [], 
      items: [], 
      chainingItems: [],
      textBuffer: '' 
    });
  }, [updateInputContent]);

  // 텍스트 편집 시작
  const startEditing = useCallback((itemId: string, currentText: string) => {
    setEditingItemId(itemId);
    setEditingText(currentText);
  }, []);

  // 텍스트 편집 완료
  const finishEditing = useCallback(() => {
    if (editingItemId && editingText.trim()) {
      // 편집 로직 구현 필요 시 추가
    }
    setEditingItemId(null);
    setEditingText('');
  }, [editingItemId, editingText]);

  // 텍스트 편집 취소
  const cancelEditing = useCallback(() => {
    setEditingItemId(null);
    setEditingText('');
  }, []);

  return {
    // 상태
    chainingItems,
    commonItems,
    items,
    textBuffer,
    iterateEachRow,
    chainingUpdateMode,
    editingItemId,
    editingText,
    
    // 파일 업로드 상태
    fileUploading,
    uploadError,
    uploadProgress,
    
    // 액션
    updateInputContent,
    handleAddText,
    handleFileChange,
    handleDeleteItem,
    handleMoveItem,
    handleClearItems,
    
    // 텍스트 편집
    startEditing,
    finishEditing,
    cancelEditing,
    setEditingText,
    
    // 에러 관리
    clearUploadError,
    
    // 백엔드 연결 상태 (항상 true - 백엔드 기반 시스템)
    serverConnected: true
  };
}; 