import { useCallback } from 'react';
import { useNodeContentStore, InputNodeContent, NodeContent } from '../store/useNodeContentStore';
import { FileLikeObject } from '../types/nodes';

/**
 * InputNode 데이터 관리 훅 (useNodeContentStore 기반 통합 버전)
 * 
 * Input 노드의 상태(items, textBuffer, iterateEachRow)를 관리하고,
 * 관련 액션 핸들러를 제공합니다. 모든 상태는 useNodeContentStore와 동기화됩니다.
 */
export const useInputNodeData = ({ nodeId }: { nodeId: string }) => {
  // useNodeContentStore 훅 사용
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);
  
  // 노드 컨텐츠 가져오기 (selector 사용, InputNodeContent 타입 지정)
  // getNodeContent는 노드가 없거나 타입이 다를 경우 기본값을 반환하도록 설계됨
  const content = useNodeContentStore(
    useCallback(
      (state) => state.getNodeContent<InputNodeContent>(nodeId, 'input'),
      [nodeId]
    )
  );

  // 컨텐츠 필드 접근 (기본값 처리 포함)
  const items: (string | FileLikeObject)[] = content?.items || [];
  const textBuffer: string = content?.textBuffer || '';
  const iterateEachRow: boolean = content?.iterateEachRow || false;

  /**
   * 부분적인 컨텐츠 업데이트를 위한 유틸리티 함수
   * 항상 전체 InputNodeContent 객체 구조를 유지하며 업데이트합니다.
   */
  const updateInputContent = useCallback((updates: Partial<Omit<InputNodeContent, keyof NodeContent>>) => {
    // 현재 content 객체를 기반으로 업데이트 적용
    setNodeContent<InputNodeContent>(nodeId, {
      ...content, // 기존 content 보존 (label 등 Base 속성 포함)
      ...updates, // 새로운 변경 사항 적용
    });
  }, [nodeId, content, setNodeContent]);


  /**
   * 텍스트 버퍼 변경 핸들러
   */
  const handleTextChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateInputContent({ textBuffer: event.target.value });
  }, [updateInputContent]);

  /**
   * 텍스트 버퍼 내용을 아이템으로 추가하는 핸들러
   */
  const handleAddText = useCallback(() => {
    const trimmedText = textBuffer.trim();
    if (!trimmedText) return;
    
    const updatedItems = [...items, trimmedText];
    updateInputContent({ 
      items: updatedItems,
      textBuffer: '' // 텍스트 추가 후 버퍼 비우기
    });
  }, [textBuffer, items, updateInputContent]);

  /**
   * 처리 모드 (Batch/Foreach) 토글 핸들러
   */
  const handleToggleProcessingMode = useCallback(() => {
    updateInputContent({ 
      iterateEachRow: !iterateEachRow
    });
  }, [iterateEachRow, updateInputContent]);

  /**
   * 파일 읽기 Promise 헬퍼
   */
   const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  /**
   * 파일 입력 변경 핸들러
   * File 객체를 FileLikeObject로 변환하여 items에 추가합니다.
   */
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    const files = Array.from(event.target.files);
    
    try {
      const newFileObjects: FileLikeObject[] = [];
      for (const file of files) {
        const fileObj: FileLikeObject = {
          file: file.name,
          type: file.type,
          // 필요한 경우 파일 내용을 읽어서 포함 (예: 텍스트 파일)
          // content: file.type.startsWith('text/') ? await readFileAsText(file) : undefined,
        };
        newFileObjects.push(fileObj);
      }

      if (newFileObjects.length > 0) {
        console.log(`[useInputNodeData] Adding ${newFileObjects.length} FileLikeObjects to items.`);
        // 이전 items와 새로운 FileLikeObject들을 합칩니다.
        const updatedItems = [...items, ...newFileObjects];
        updateInputContent({ items: updatedItems });
      }
    } catch (error) {
       console.error("Error processing files:", error);
       // 사용자에게 오류 알림 등의 처리 추가 가능
    } finally {
       // 파일 입력 초기화 (동일 파일 재업로드 가능하도록)
       event.target.value = ''; 
    }
  }, [items, updateInputContent]);

  /**
   * 특정 인덱스의 아이템 삭제 핸들러
   */
  const handleDeleteItem = useCallback((index: number) => {
    if (index < 0 || index >= items.length) return; // 유효하지 않은 인덱스
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    updateInputContent({ items: updatedItems });
  }, [items, updateInputContent]);

  /**
   * 모든 아이템 삭제 핸들러
   */
  const handleClearItems = useCallback(() => {
    updateInputContent({ items: [] });
  }, [updateInputContent]);

  return {
    // 상태 값
    items,
    textBuffer,
    iterateEachRow,
    
    // 핸들러 함수
    handleTextChange,
    handleAddText,
    handleFileChange,
    handleDeleteItem,
    handleClearItems,
    handleToggleProcessingMode,

    // 직접 content를 수정해야 할 경우를 위한 함수 (주의해서 사용)
    // setContent: updateInputContent 
    // setNodeContent 원본을 직접 노출하는 것보다 updateInputContent를 제공하는 것이 안전함
  };
}; 