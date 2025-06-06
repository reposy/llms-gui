// PDF Export 관련 타입 정의

export interface PDFExportOptions {
  /** PDF 파일명 (확장자 제외) */
  filename: string;
  /** 내보낼 내용의 모드 */
  mode: 'outputs' | 'join' | 'raw';
  /** 마크다운 렌더링 모드 (join 모드에서만 사용) */
  markdownMode?: 'text' | 'markdown';
  /** 향후 확장: 압축 옵션 */
  compression?: PDFCompressionOptions;
}

export interface PDFCompressionOptions {
  /** 이미지 품질 (0.1 ~ 1.0) */
  imageQuality: number;
  /** 캔버스 스케일 */
  scale: number;
  /** 최대 파일 크기 (MB) */
  maxSizeMB?: number;
}

export interface PDFExportResult {
  /** 생성 성공 여부 */
  success: boolean;
  /** 생성된 파일명 */
  filename?: string;
  /** 예상 파일 크기 (MB) */
  estimatedSizeMB?: number;
  /** 오류 메시지 */
  error?: string;
}

export interface PDFExportCallbacks {
  /** 내보내기 시작 시 호출 */
  onStart?: () => void;
  /** 진행률 업데이트 시 호출 */
  onProgress?: (progress: number) => void;
  /** 완료 시 호출 */
  onComplete?: (result: PDFExportResult) => void;
  /** 오류 시 호출 */
  onError?: (error: Error) => void;
} 