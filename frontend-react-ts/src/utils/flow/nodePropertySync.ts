import { Node } from '../../core/Node';
import { getNodeContent, NodeContent } from '../../store/nodeContentStore';

/**
 * 속성 타입별 동기화 처리 함수를 위한 타입 정의
 */
export type PropertySyncHandler<T> = (sourceValue: any, targetProp: any) => T | undefined;

/**
 * 기본 타입에 대한 핸들러 맵 (문자열, 숫자, 불리언, 배열, 객체)
 */
const defaultHandlers: Record<string, PropertySyncHandler<any>> = {
  string: (value, _) => typeof value === 'string' ? value : undefined,
  number: (value, _) => typeof value === 'number' ? value : undefined,
  boolean: (value, _) => typeof value === 'boolean' ? value : undefined,
  array: (value, _) => Array.isArray(value) ? [...value] : undefined,
  object: (value, _) => typeof value === 'object' && value !== null ? {...value} : undefined
};

/**
 * 속성 동기화 설정을 정의하기 위한 인터페이스
 */
export interface PropertySyncConfig {
  propertyName: string;             // 노드 property에서의 속성 이름 
  contentName?: string;             // 스토어 content에서의 속성 이름 (없으면 propertyName과 동일)
  type?: keyof typeof defaultHandlers | PropertySyncHandler<any>; // 타입 또는 커스텀 핸들러
  required?: boolean;               // 필수 속성 여부
  defaultValue?: any;               // 기본값
}

/**
 * 속성 설정을 기반으로 노드 속성을 스토어에서 동기화하는 함수
 * 
 * @param node 대상 노드
 * @param configs 속성 동기화 설정 배열
 * @param nodeType 노드 타입 (스토어에서 컨텐츠 조회시 필요)
 */
export function syncNodeProperties(
  node: Node, 
  configs: PropertySyncConfig[],
  nodeType?: string
): void {
  // 스토어에서 노드 컨텐츠 가져오기 
  const content = getNodeContent(node.id, nodeType || node.type);
  if (!content) return;

  // 각 속성 설정에 대해 동기화 수행
  for (const config of configs) {
    const { 
      propertyName,
      contentName = propertyName, // 기본값은 propertyName과 동일
      type = 'string',            // 기본 타입은 문자열
      required = false,
      defaultValue
    } = config;

    // 소스 값 가져오기 (스토어 컨텐츠)
    const sourceValue = content[contentName];
    
    // 값이 없고 필수가 아니면 건너뛰기
    if (sourceValue === undefined && !required) continue;

    // 핸들러 선택 (문자열로 지정된 경우 기본 핸들러에서 가져오기)
    const handler = typeof type === 'string' 
      ? defaultHandlers[type] 
      : type;

    // 핸들러 적용하여 값 변환
    const processedValue = handler(sourceValue, node.property[propertyName]);
    
    // 변환된 값이 있으면 할당, 없고 필수면 기본값 할당
    if (processedValue !== undefined) {
      node.property[propertyName] = processedValue;
    } else if (required && defaultValue !== undefined) {
      node.property[propertyName] = defaultValue;
    }
  }
}

/**
 * 특정 노드 타입에 대한 속성 동기화 설정을 생성하는 헬퍼 함수
 */
export function createSyncConfig<T extends NodeContent>(configs: PropertySyncConfig[]): PropertySyncConfig[] {
  return configs;
}

/**
 * 입력 노드의 속성 동기화 설정
 */
export const inputNodeSyncConfig = createSyncConfig<NodeContent>([
  { propertyName: 'items', type: 'array', defaultValue: [] },
  { propertyName: 'iterateEachRow', type: 'boolean', defaultValue: false },
  { propertyName: 'textBuffer', type: 'string' }
]);

/**
 * LLM 노드의 속성 동기화 설정
 */
export const llmNodeSyncConfig = createSyncConfig<NodeContent>([
  { propertyName: 'prompt', type: 'string', required: true, defaultValue: '' },
  { propertyName: 'model', type: 'string', required: true, defaultValue: 'openhermes' },
  { propertyName: 'temperature', type: 'number', required: true, defaultValue: 0.7 },
  { propertyName: 'provider', type: 'string', required: true, defaultValue: 'ollama' },
  { propertyName: 'ollamaUrl', type: 'string', defaultValue: 'http://localhost:11434' },
  { propertyName: 'openaiApiKey', type: 'string' },
  { propertyName: 'mode', type: 'string', defaultValue: 'text' }
]);

/**
 * 출력 노드의 속성 동기화 설정
 */
export const outputNodeSyncConfig = createSyncConfig<NodeContent>([
  { propertyName: 'format', type: 'string', required: true, defaultValue: 'text' },
  { propertyName: 'content', type: 'string' },
  { propertyName: 'data', type: 'object' }
]);

/**
 * 웹 크롤러 노드의 속성 동기화 설정
 */
export const webCrawlerNodeSyncConfig = createSyncConfig<NodeContent>([
  { propertyName: 'url', type: 'string', required: true, defaultValue: '' },
  { propertyName: 'waitForSelector', type: 'string', defaultValue: 'body' },
  { propertyName: 'extractSelectors', type: 'object', defaultValue: {} },
  { propertyName: 'timeout', type: 'number', defaultValue: 3000 },
  { propertyName: 'outputFormat', type: 'string', defaultValue: 'full' }
]);

/**
 * Merger 노드의 속성 동기화 설정
 */
export const mergerNodeSyncConfig = createSyncConfig<NodeContent>([
  { propertyName: 'items', type: 'array', defaultValue: [] },
  { propertyName: 'strategy', type: 'string', defaultValue: 'array' },
  { propertyName: 'keys', type: 'array' }
]);

/**
 * JSON 추출기 노드의 속성 동기화 설정
 */
export const jsonExtractorNodeSyncConfig = createSyncConfig<NodeContent>([
  { propertyName: 'path', type: 'string', required: true, defaultValue: '' },
  { propertyName: 'defaultValue', type: 'string' }
]);

/**
 * API 노드의 속성 동기화 설정
 */
export const apiNodeSyncConfig = createSyncConfig<NodeContent>([
  { propertyName: 'url', type: 'string', required: true, defaultValue: '' },
  { propertyName: 'method', type: 'string', required: true, defaultValue: 'GET' },
  { propertyName: 'headers', type: 'object', defaultValue: {} },
  { propertyName: 'queryParams', type: 'object', defaultValue: {} },
  { propertyName: 'body', type: 'string' },
  { propertyName: 'bodyFormat', type: 'string', defaultValue: 'raw' },
  { propertyName: 'useInputAsBody', type: 'boolean', defaultValue: false }
]);

/**
 * 조건부 노드의 속성 동기화 설정
 */
export const conditionalNodeSyncConfig = createSyncConfig<NodeContent>([
  { propertyName: 'conditionType', type: 'string', defaultValue: 'contains' },
  { propertyName: 'conditionValue', type: 'string', defaultValue: '' }
]);

/**
 * 그룹 노드의 속성 동기화 설정
 */
export const groupNodeSyncConfig = createSyncConfig<NodeContent>([
  { propertyName: 'childNodes', type: 'array', defaultValue: [] }
]); 