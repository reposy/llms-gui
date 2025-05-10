/**
 * DisplayableItem과 ItemDisplay 간의 변환을 위한 어댑터 함수
 */

// ItemDisplay 인터페이스 정의 (InputItemList.tsx와 동일한 구조)
export interface ItemDisplay {
  id: string;            // 고유 ID (렌더링 키 및 편집 식별용)
  originalIndex: number; // 원본 배열에서의 인덱스
  display: string;       // 표시될 텍스트 (파일 이름 또는 텍스트 내용)
  fullContent: string;   // 전체 텍스트 내용 (편집/펼치기용)
  type: string;          // 데이터 타입 ('text', 'image/jpeg', 등)
  isFile: boolean;       // 파일 여부
  isEditing?: boolean;   // 현재 편집 중인지 여부 (텍스트 항목 전용)
  objectUrl?: string;    // 파일 객체에 대한 브라우저 메모리 URL
}

// DisplayableItem 인터페이스 정의 (formatInputItems.ts와 동일한 구조)
export interface DisplayableItem {
  display: string;     // 표시될 텍스트
  isFile: boolean;     // 파일 여부
  isLarge?: boolean;   // 큰 파일 여부
  type?: string;       // 파일 타입
  objectUrl?: string;  // 파일 객체에 대한 브라우저 메모리 URL
}

/**
 * DisplayableItem을 ItemDisplay로 변환하는 어댑터 함수
 * @param item DisplayableItem 객체
 * @param index 아이템 인덱스
 * @returns ItemDisplay 객체
 */
export function adaptDisplayableItem(
  item: DisplayableItem,
  index: number
): ItemDisplay {
  return {
    id: `item-${index}`,
    originalIndex: index,
    display: item.display,
    fullContent: item.display, // DisplayableItem에는 fullContent가 없으므로 display 값 사용
    type: item.type || (item.isFile ? 'application/octet-stream' : 'text'),
    isFile: item.isFile,
    isEditing: false,
    objectUrl: item.objectUrl // objectURL 전달
  };
} 