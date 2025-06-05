import { useState, useCallback } from 'react';
import { BackendFileMetadata, FileContext, FILE_CONTEXTS } from '../types/files';
import { unifiedFileService } from '../services/unifiedFileService';

// 파일 업로드 상태
interface FileUploadState {
  uploading: boolean;
  error: string | null;
  progress: number;
  uploadedFiles: BackendFileMetadata[];
}

// 파일 업로드 결과
interface FileUploadResult {
  success: boolean;
  files: BackendFileMetadata[];
  error?: string;
}

/**
 * 통합 파일 업로드 훅
 * 모든 파일 업로드 로직을 중앙화하여 일관된 사용자 경험 제공
 */
export const useUnifiedFileUpload = (context: FileContext = FILE_CONTEXTS.DEFAULT) => {
  const [uploadState, setUploadState] = useState<FileUploadState>({
    uploading: false,
    error: null,
    progress: 0,
    uploadedFiles: []
  });

  /**
   * 파일 업로드 실행
   * @param files 업로드할 파일들
   * @returns 업로드 결과
   */
  const uploadFiles = useCallback(async (files: File[]): Promise<FileUploadResult> => {
    if (files.length === 0) {
      return { success: false, files: [], error: 'No files selected' };
    }

    setUploadState({
      uploading: true,
      error: null,
      progress: 0,
      uploadedFiles: []
    });

    try {
      const uploadedFiles: BackendFileMetadata[] = [];
      
      // 파일 크기 검증
      const invalidFiles = files.filter(file => !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024);
      if (invalidFiles.length > 0) {
        throw new Error(`Invalid files: ${invalidFiles.map(f => f.name).join(', ')}. Only images under 10MB are allowed.`);
      }

      // 각 파일 순차 업로드
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Uploading file ${i + 1}/${files.length}: ${file.name}`);
        
        try {
          const result = await unifiedFileService.uploadFile(file, context);
          uploadedFiles.push(result);
          
          // 진행률 업데이트
          const progress = Math.round(((i + 1) / files.length) * 100);
          setUploadState(prev => ({
            ...prev,
            progress,
            uploadedFiles: [...uploadedFiles]
          }));
          
        } catch (fileError) {
          console.error(`Failed to upload ${file.name}:`, fileError);
          // 개별 파일 업로드 실패는 전체 프로세스를 중단하지 않음
          continue;
        }
      }

      // 최종 성공 상태
      setUploadState({
        uploading: false,
        error: null,
        progress: 100,
        uploadedFiles
      });

      // 진행률 표시기 잠시 후 리셋
      setTimeout(() => {
        setUploadState(prev => ({
          ...prev,
          progress: 0
        }));
      }, 1500);

      return {
        success: true,
        files: uploadedFiles
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'File upload failed';
      console.error('File upload error:', error);
      
      setUploadState({
        uploading: false,
        error: errorMessage,
        progress: 0,
        uploadedFiles: []
      });

      return {
        success: false,
        files: [],
        error: errorMessage
      };
    }
  }, [context]);

  /**
   * 파일 입력 핸들러 (React input onChange)
   */
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>): Promise<FileUploadResult> => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    const result = await uploadFiles(files);
    
    // input 필드 초기화 (같은 파일 재선택 허용)
    event.target.value = '';
    
    return result;
  }, [uploadFiles]);

  /**
   * 드래그 앤 드롭 핸들러
   */
  const handleDrop = useCallback(async (event: React.DragEvent): Promise<FileUploadResult> => {
    event.preventDefault();
    const files = event.dataTransfer.files ? Array.from(event.dataTransfer.files) : [];
    return await uploadFiles(files);
  }, [uploadFiles]);

  /**
   * 에러 상태 초기화
   */
  const clearError = useCallback(() => {
    setUploadState(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  return {
    // 상태
    uploading: uploadState.uploading,
    error: uploadState.error,
    progress: uploadState.progress,
    uploadedFiles: uploadState.uploadedFiles,
    
    // 액션
    uploadFiles,
    handleFileChange,
    handleDrop,
    clearError
  };
}; 