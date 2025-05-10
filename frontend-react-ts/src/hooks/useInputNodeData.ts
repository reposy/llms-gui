import { useCallback, useState, useEffect } from 'react';
import { InputNodeContent, BaseNodeData } from '../types/nodes';
import { useNodeContentStore } from '../store/useNodeContentStore';
import { uploadFile } from '../services/fileService';
import { formatFileSize, FileMetadata } from '../types/files';

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
  const chainingItems: (string | File | FileMetadata)[] = (content?.chainingItems as (string | File | FileMetadata)[]) || [];
  const commonItems: (string | File | FileMetadata)[] = (content?.commonItems as (string | File | FileMetadata)[]) || [];
  const items: (string | File | FileMetadata)[] = (content?.items as (string | File | FileMetadata)[]) || [];
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

  // 백엔드 서버 연결 여부 상태 관리
  const [serverConnected, setServerConnected] = useState<boolean | null>(null);

  // 컴포넌트 마운트 시 백엔드 서버 연결 체크
  useEffect(() => {
    async function checkServerConnection() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3초 타임아웃
        
        const response = await fetch(`${process.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/files`, {
          method: 'HEAD',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        setServerConnected(response.ok);
        console.log('Backend server connection status:', response.ok ? 'Connected' : 'Not connected');
      } catch (error) {
        console.warn('Failed to connect to backend server:', error);
        setServerConnected(false);
      }
    }
    
    checkServerConnection();
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
   * 공통 또는 개별 항목으로 파일 추가
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
    
    // 백엔드 서버 연결이 없으면 로컬 폴백 모드 사용
    if (serverConnected === false) {
      console.log('Using local fallback mode for file handling');
      
      try {
        // 파일을 그대로 저장 (서버에 업로드하지 않음)
        if (itemType === 'common') {
          const updatedCommonItems = [...commonItems, ...files];
          updateInputContent({ commonItems: updatedCommonItems });
        } else {
          const updatedItems = [...items, ...files];
          updateInputContent({ items: updatedItems });
        }
        
        // 상태 업데이트
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
        console.error("Error in local file handling:", error);
        const errorMessage = error instanceof Error ? error.message : '파일 처리 중 오류가 발생했습니다.';
        setFileProcessing({
          uploading: false,
          error: errorMessage,
          progress: 0
        });
      } finally {
        event.target.value = '';
      }
      
      return;
    }
    
    // 서버 연결이 있는 경우 정상적인 업로드 프로세스 진행
    try {
      // 각 파일을 서버에 업로드하고 메타데이터 수집
      const uploadedMetadataPromises = files.map(async (file) => {
        try {
          const metadata = await uploadFile(file);
          return metadata;
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          
          // 서버 업로드 실패 시 로컬 폴백으로 전환
          if (error instanceof Error && (error.message.includes('404') || error.message.includes('Failed to fetch'))) {
            console.log('Server upload failed, using file object directly');
            return file; // File 객체 그대로 반환
          }
          throw error;
        }
      });
      
      // 모든 업로드 완료 대기
      const uploadedItems = await Promise.all(uploadedMetadataPromises);
      
      // 아이템 목록에 메타데이터 추가
      if (uploadedItems.length > 0) {
        if (itemType === 'common') {
          const updatedCommonItems = [...commonItems, ...uploadedItems];
          updateInputContent({ commonItems: updatedCommonItems });
        } else {
          const updatedItems = [...items, ...uploadedItems];
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
      const errorMessage = error instanceof Error ? error.message : '파일 업로드 중 오류가 발생했습니다.';
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
  }, [commonItems, items, updateInputContent, serverConnected]);

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
    label: content?.label || '',
    fileProcessing,
    resetError,    // 에러 초기화 함수 노출
    serverConnected, // 백엔드 서버 연결 상태
    
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