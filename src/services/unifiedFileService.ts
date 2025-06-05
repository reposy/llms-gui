import { 
  BackendFileMetadata, 
  UnifiedFileMetadata, 
  FileContext, 
  FILE_CONTEXTS,
  API_BASE_URL 
} from '../types/files';

/**
 * 통합 파일 관리 서비스
 * 모든 파일 업로드/다운로드 로직을 중앙화
 */
export class UnifiedFileService {
  private static instance: UnifiedFileService;
  
  public static getInstance(): UnifiedFileService {
    if (!UnifiedFileService.instance) {
      UnifiedFileService.instance = new UnifiedFileService();
    }
    return UnifiedFileService.instance;
  }
  
  /**
   * 파일을 백엔드에 업로드
   * @param file 업로드할 파일
   * @param context 파일 저장 컨텍스트
   * @returns 백엔드 파일 메타데이터
   */
  async uploadFile(file: File, context: FileContext): Promise<BackendFileMetadata> {
    // 로컬 검증
    if (!file.type.startsWith('image/')) {
      throw new Error(`Unsupported file type: ${file.type}. Only images are allowed.`);
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error(`File too large: ${file.size} bytes. Maximum allowed size is ${maxSize} bytes (10MB).`);
    }
    
    // FormData 구성
    const formData = new FormData();
    formData.append('file', file);
    formData.append('context', context);
    
    try {
      const uploadUrl = `${API_BASE_URL}/api/files/upload`;
      console.log(`Uploading file to: ${uploadUrl} with context: ${context}`);
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.detail || response.statusText || 'Upload failed';
        throw new Error(`File upload failed (${response.status}): ${errorMessage}`);
      }
      
      const result: BackendFileMetadata = await response.json();
      console.log(`File uploaded successfully: ${result.fileId}`);
      return result;
      
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }
  
  /**
   * 컨텍스트별 파일 목록 조회
   * @param context 파일 컨텍스트 (없으면 전체)
   * @param limit 조회할 파일 수 제한
   * @returns 파일 목록
   */
  async listFiles(context?: FileContext, limit: number = 100): Promise<BackendFileMetadata[]> {
    try {
      const params = new URLSearchParams();
      if (context) params.append('context', context);
      if (limit) params.append('limit', limit.toString());
      
      const listUrl = `${API_BASE_URL}/api/files?${params.toString()}`;
      console.log(`Listing files: ${listUrl}`);
      
      const response = await fetch(listUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.statusText}`);
      }
      
      return await response.json();
      
    } catch (error) {
      console.error('List files error:', error);
      throw error;
    }
  }
  
  /**
   * 파일 URL 생성
   * @param fileMetadata 파일 메타데이터
   * @returns 접근 가능한 파일 URL
   */
  getFileUrl(fileMetadata: UnifiedFileMetadata & { url?: string }): string {
    if (fileMetadata.url) {
      return `${API_BASE_URL}${fileMetadata.url}`;
    }
    
    // URL이 없는 경우 fileId로부터 추정
    const filename = `${fileMetadata.fileId}.jpg`; // 기본 확장자
    return `${API_BASE_URL}/api/files/${fileMetadata.filePath}/${filename}`;
  }
  
  /**
   * UnifiedFileMetadata를 LocalFileMetadata 형태로 변환 (하위 호환성)
   * 임시 변환용 - 점진적 마이그레이션을 위해
   */
  convertToLegacyFormat(fileMetadata: BackendFileMetadata): any {
    return {
      id: fileMetadata.fileId,
      originalName: fileMetadata.originalFileName,
      contentType: fileMetadata.contentType,
      size: fileMetadata.size,
      objectUrl: this.getFileUrl(fileMetadata),
      uploadedAt: fileMetadata.uploadedAt
    };
  }
}

/**
 * 싱글톤 인스턴스 익스포트
 */
export const unifiedFileService = UnifiedFileService.getInstance(); 