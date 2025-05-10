import { FileMetadata, LocalFileMetadata } from '../../types/files';
import { DisplayableItem } from './adaptDisplayableItem';

/**
 * 입력 아이템 표시 형식 정의
 */
export interface DisplayableItem {
  display: string;
  isFile: boolean;
  isLarge?: boolean;
  type?: string;
  objectUrl?: string;  // 추가: objectURL 참조
}

/**
 * 입력 아이템을 표시 형식으로 변환
 * 
 * @param items 입력 아이템 배열 (문자열, File 객체, FileMetadata 객체, LocalFileMetadata 객체)
 * @param type 아이템 유형 ('common', 'element', 'chaining')
 * @returns 표시용 형식으로 변환된 아이템 배열
 */
export function formatItemsForDisplay(
  items: (string | File | FileMetadata | LocalFileMetadata)[], 
  type: 'common' | 'element' | 'chaining'
): DisplayableItem[] {
  if (!items || !Array.isArray(items)) {
    return [];
  }

  return items.map(item => {
    // 문자열 처리
    if (typeof item === 'string') {
      return {
        display: item.length > 30 ? `${item.substring(0, 30)}...` : item,
        isFile: false,
      };
    } 
    // File 객체 처리
    else if (item instanceof File) {
      return {
        display: item.name,
        isFile: true,
        isLarge: item.size > 1024 * 1024, // 1MB 이상인 경우 대용량 표시
        type: item.type || 'application/octet-stream'
      };
    }
    // LocalFileMetadata 객체 처리
    else if (typeof item === 'object' && 'objectUrl' in item) {
      const metadata = item as LocalFileMetadata;
      return {
        display: metadata.originalName,
        isFile: true,
        isLarge: metadata.size > 1024 * 1024, // 1MB 이상인 경우 대용량 표시
        type: metadata.contentType,
        objectUrl: metadata.objectUrl // objectURL 추가
      };
    }
    // FileMetadata 객체 처리
    else if (typeof item === 'object' && 'originalName' in item && 'contentType' in item) {
      const metadata = item as FileMetadata;
      return {
        display: metadata.originalName,
        isFile: true,
        isLarge: metadata.size > 1024 * 1024, // 1MB 이상인 경우 대용량 표시
        type: metadata.contentType
      };
    }
    // 기타 타입 (예상치 못한 입력)
    else {
      return {
        display: '[Unknown Item]',
        isFile: false,
      };
    }
  });
} 