/**
 * 동적 속성 주입을 위한 유틸리티 함수들
 * 
 * 프로젝트 원칙 준수:
 * - 일관성: 모든 노드에서 동일한 방식으로 동적 속성 처리
 * - 단순성: 명확한 인터페이스와 최소한의 복잡성
 * - 단일 진입점: 모든 동적 속성 처리를 하나의 함수로
 * - 확장성: 새로운 노드 타입 추가 시 쉽게 확장 가능
 */

/**
 * 동적 속성 주입을 위한 입력 타입
 */
export interface DynamicPropertyInput {
  nodeType: string;
  property: Record<string, any>;
}

/**
 * 지원되는 노드 타입들 (확장 가능)
 */
const SUPPORTED_DYNAMIC_NODE_TYPES = ['llm', 'api', 'web-crawler'] as const;
type SupportedNodeType = typeof SUPPORTED_DYNAMIC_NODE_TYPES[number];

/**
 * 입력에서 동적 속성 객체를 추출하는 함수
 * 
 * @param input - 노드 입력 (배열 또는 단일 값)
 * @param nodeType - 현재 노드 타입
 * @returns 추출된 동적 속성 또는 null
 */
export const extractDynamicProperty = (
  input: any,
  nodeType: string
): Record<string, any> | null => {
  if (!input) return null;

  // 배열인 경우 각 요소 검사
  if (Array.isArray(input)) {
    for (const item of input) {
      const dynamicProp = extractDynamicPropertyFromItem(item, nodeType);
      if (dynamicProp) return dynamicProp;
    }
  } else {
    // 단일 값인 경우
    const dynamicProp = extractDynamicPropertyFromItem(input, nodeType);
    if (dynamicProp) return dynamicProp;
  }

  return null;
};

/**
 * 단일 아이템에서 동적 속성을 추출하는 내부 함수
 */
function extractDynamicPropertyFromItem(
  item: any,
  nodeType: string
): Record<string, any> | null {
  // 객체가 아니면 무시
  if (!item || typeof item !== 'object') return null;

  // DynamicPropertyInput 형태인지 확인
  if (!('nodeType' in item) || !('property' in item)) return null;

  const dynamicInput = item as DynamicPropertyInput;

  // nodeType 검증: 현재 노드와 일치하지 않으면 무시
  if (dynamicInput.nodeType !== nodeType) return null;

  // 지원되는 노드 타입인지 확인
  if (!SUPPORTED_DYNAMIC_NODE_TYPES.includes(dynamicInput.nodeType as SupportedNodeType)) {
    console.warn(`[DynamicProperty] Unsupported node type: ${dynamicInput.nodeType}`);
    return null;
  }

  // property가 객체인지 확인
  if (!dynamicInput.property || typeof dynamicInput.property !== 'object') {
    console.warn(`[DynamicProperty] Invalid property for ${dynamicInput.nodeType}`);
    return null;
  }

  console.log(`[DynamicProperty] Found dynamic property for ${nodeType}:`, dynamicInput.property);
  return dynamicInput.property;
}

/**
 * 동적 속성과 기본 속성을 병합하는 함수
 * 
 * @param baseProperty - 기본 노드 속성
 * @param dynamicProperty - 동적으로 주입된 속성
 * @returns 병합된 속성 (동적 속성이 우선순위)
 */
export const mergeDynamicProperty = (
  baseProperty: Record<string, any>,
  dynamicProperty: Record<string, any> | null
): Record<string, any> => {
  if (!dynamicProperty) return baseProperty;

  // 전체 교체 방식: 동적 속성이 기본 속성을 덮어씀
  const mergedProperty = {
    ...baseProperty,
    ...dynamicProperty
  };

  console.log(`[DynamicProperty] Merged properties:`, {
    base: baseProperty,
    dynamic: dynamicProperty,
    merged: mergedProperty
  });

  return mergedProperty;
};

/**
 * 입력에서 동적 속성을 제거한 클린 입력을 반환하는 함수
 * 
 * @param input - 원본 입력
 * @param nodeType - 현재 노드 타입
 * @returns 동적 속성이 제거된 입력
 */
export const removeActualInputFromDynamic = (
  input: any,
  nodeType: string
): any => {
  if (!input) return input;

  if (Array.isArray(input)) {
    // 배열에서 동적 속성 객체들을 제거
    const filtered = input.filter(item => {
      if (!item || typeof item !== 'object') return true;
      if (!('nodeType' in item) || !('property' in item)) return true;
      return (item as DynamicPropertyInput).nodeType !== nodeType;
    });
    
    return filtered.length > 0 ? filtered : input;
  } else {
    // 단일 값이 동적 속성 객체라면 빈 문자열 반환
    if (input && typeof input === 'object' && 
        'nodeType' in input && 'property' in input &&
        (input as DynamicPropertyInput).nodeType === nodeType) {
      return '';
    }
    return input;
  }
}; 