/**
 * 백엔드 통합 파일 메타데이터 - 새로운 표준 구조
 * 사용자 제안: {fileId, originalFileName, filePath}
 */
export interface UnifiedFileMetadata {
  fileId: string;           // UUID
  originalFileName: string; // 원본 파일명
  filePath: string;         // 컨텍스트 (flow_executor, flow_modal 등)
}

/**
 * 백엔드에서 반환되는 전체 파일 메타데이터
 */
export interface BackendFileMetadata extends UnifiedFileMetadata {
  backendPath: string;      // 실제 백엔드 저장 경로
  url: string;              // 접근 가능한 URL 경로
  contentType: string;      // 파일 MIME 타입
  size: number;             // 파일 크기 (바이트)
  uploadedAt: number;       // 업로드된 시간 (Unix timestamp)
}

/**
 * 파일 업로드 컨텍스트 정의
 */
export const FILE_CONTEXTS = {
  FLOW_EXECUTOR: 'flow_executor',
  FLOW_EDITOR: 'flow_editor',
  INPUT_NODE: 'input_node',
  DEFAULT: 'default'
} as const;

export type FileContext = typeof FILE_CONTEXTS[keyof typeof FILE_CONTEXTS];

/**
 * API 기본 URL 설정
 */
export const API_BASE_URL = 'http://localhost:8000';

// ===== 레거시 타입들 (하위 호환성용, 점진적 제거 예정) =====

/**
 * @deprecated 기존 파일 메타데이터 - BackendFileMetadata 사용 권장
 */
export interface FileMetadata {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  url: string;
  contentType: string;
  size: number;
  uploadedAt: number;
}

/**
 * @deprecated 로컬 파일 메타데이터 - 새로고침 시 사라짐, BackendFileMetadata 사용 권장
 */
export interface LocalFileMetadata {
  id: string;
  originalName: string;
  objectUrl: string;
  contentType: string;
  size: number;
  file: File;
  uploadedAt: number;
}

// ===== 유틸리티 함수들 =====

/**
 * 파일이 이미지인지 확인
 */
export function isImageFile(file: BackendFileMetadata | FileMetadata | LocalFileMetadata | File): boolean {
  if ('contentType' in file) {
    return file.contentType.startsWith('image/');
  } else if ('type' in file) {
    return file.type.startsWith('image/');
  }
  return false;
}

/**
 * MIME 타입 추정
 */
export function guessMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    tiff: 'image/tiff'
  };
  return mimeMap[ext || ''] || 'application/octet-stream';
}

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 파일 크기 제한 확인
 */
export function isFileSizeValid(file: File | BackendFileMetadata | FileMetadata | LocalFileMetadata, maxSize: number = 10 * 1024 * 1024): boolean {
  const size = 'size' in file ? file.size : 0;
  return size > 0 && size <= maxSize;
}

// ===== 레거시 함수들 (하위 호환성용, 점진적 제거 예정) =====

/**
 * @deprecated BackendFileMetadata의 url 필드 사용 권장
 */
export function getFullFileUrl(metadata: FileMetadata): string {
  return `${API_BASE_URL}${metadata.url}`;
}

/**
 * @deprecated 통합 파일 시스템 사용 권장
 */
export function createLocalFileMetadata(file: File): LocalFileMetadata {
  return {
    id: crypto.randomUUID(),
    originalName: file.name,
    contentType: file.type || guessMimeType(file.name),
    size: file.size,
    file: file,
    objectUrl: URL.createObjectURL(file),
    uploadedAt: Date.now()
  };
}

/**
 * @deprecated 통합 파일 시스템에서 자동 관리
 */
export function revokeObjectUrl(metadata: LocalFileMetadata | string): void {
  const url = typeof metadata === 'string' ? metadata : metadata.objectUrl;
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
} 