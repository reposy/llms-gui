import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { getNodeProperty, createDefaultNodeProperty } from '../store/useNodePropertyStore';

/**
 * 노드 팩토리 클래스
 * 노드 인스턴스를 생성하고 관리하는 책임을 가짐
 */
export class NodeFactory {
  private nodes: Map<string, Node>;
  private readonly typeDefaults: Record<string, any> = {};
  private nodeTypes: Record<string, (id: string, property: Record<string, any>, context?: FlowExecutionContext) => Node> = {};
  private dynamicProperties: Map<string, any> = new Map(); // 동적으로 적용될 Property 저장

  constructor() {
    this.nodes = new Map<string, Node>();
  }

  /**
   * 특정 노드 유형의 기본값을 등록
   * @param type 노드 유형
   * @param defaults 기본 속성
   */
  registerTypeDefaults(type: string, defaults: any): void {
    this.typeDefaults[type] = defaults;
  }

  /**
   * 노드 타입을 인스턴스에 등록
   */
  register(type: string, factoryFn: (id: string, property: Record<string, any>, context?: FlowExecutionContext) => Node): void {
    this.typeDefaults[type] = this.typeDefaults[type] || {};
    this.nodeTypes = this.nodeTypes || {};
    if (!this.nodeTypes) this.nodeTypes = {};
    this.nodeTypes[type] = factoryFn;
  }

  /**
   * 지정된 유형의 노드 인스턴스 생성
   * @param id 노드 ID
   * @param type 노드 유형
   * @param props 노드 속성
   * @param context 실행 컨텍스트 (선택 사항)
   * @returns 생성된 노드 인스턴스
   */
  create(
    id: string, 
    type: string, 
    props: Record<string, any> = {},
    context?: FlowExecutionContext
  ): Node {
    // 1. 노드 팩토리 함수 가져오기
    const factoryFn = this.nodeTypes[type];
    if (!factoryFn) {
      const registeredTypes = Object.keys(this.nodeTypes);
      console.error(`Node type "${type}" not found. Registered types: ${registeredTypes.join(', ')}`);
      throw new Error(`Unknown node type: ${type}. Check console for registered types.`);
    }

    // 2. 노드 콘텐츠 가져오기 (스토어에서)
    const storedContent = getNodeProperty(id, type);
    
    // 3. 속성 준비 - 전달된 props를 우선으로 하여 병합
    // 기본값 -> 스토어 값 -> 전달된 props -> 동적 Property 순으로 우선순위
    const defaultProperty = createDefaultNodeProperty(type, id);
    
    let nodeContent: any = { ...defaultProperty };
    if (storedContent && typeof storedContent === 'object') {
      nodeContent = { ...nodeContent, ...storedContent };
    }
    if (props && typeof props === 'object') {
      nodeContent = { ...nodeContent, ...props };
    }
    
    // [ForEach 동적 Property 적용] 
    const dynamicProperty = this.getDynamicProperties(type);
    if (dynamicProperty && typeof dynamicProperty === 'object') {
      nodeContent = { ...nodeContent, ...dynamicProperty };
      console.log(`[NodeFactory] Applied dynamic property for ${type}:`, dynamicProperty);
    }
    
    // [스키마 변환] WebCrawler 노드의 레거시 스키마를 현재 스키마로 변환
    if (type === 'web-crawler') {
      nodeContent = this.convertWebCrawlerSchema(nodeContent);
    }
    
    console.log(`[NodeFactory] Creating ${type} node ${id} with final properties:`, nodeContent);

    // 4. 항상 라벨이 있는지 확인
    if (!nodeContent.label) {
      nodeContent.label = props.label || `${type.charAt(0).toUpperCase() + type.slice(1)} Node`;
    }
    
    // [로그 추가] 생성 시점에 property 전체를 출력
    console.log(`[NodeFactory] Creating node:`, { id, type, property: nodeContent });
    
    if (type === 'llm') {
      console.log(`[NodeFactory] LLMNode final properties:`, {
        prompt: nodeContent.prompt,
        model: nodeContent.model,
        provider: nodeContent.provider,
        temperature: nodeContent.temperature
      });
    }
    
    // 5. 노드 인스턴스 생성
    const node = factoryFn(id, nodeContent, context);
    if (!node) {
      throw new Error(`Failed to create node instance for type: ${type}`);
    }
    
    // 6. 생성된 노드 저장
    this.nodes.set(id, node);
    
    return node;
  }

  /**
   * ID로 노드 조회
   * @param id 노드 ID
   * @returns 노드 인스턴스 또는 undefined
   */
  getNode(id: string): Node | undefined {
    return this.nodes.get(id);
  }

  /**
   * 등록된 모든 노드 삭제
   */
  clear(): void {
    this.nodes.clear();
  }

  /**
   * WebCrawler 노드의 레거시 스키마를 현재 스키마로 변환
   * Store 데이터에서 올바른 필드를 우선적으로 찾아 사용
   */
  private convertWebCrawlerSchema(nodeContent: Record<string, any>): Record<string, any> {
    const converted = { ...nodeContent };
    
    console.log(`[NodeFactory] Original WebCrawler schema:`, nodeContent);
    
    // 1단계: Store에서 현재 스키마 필드들이 이미 있다면 우선 사용
    const hasCurrentSchema = 
      converted.waitForSelectorOnPage || 
      converted.iframeSelector || 
      converted.waitForSelectorInIframe || 
      converted.extractElementSelector;
    
    if (hasCurrentSchema) {
      console.log(`[NodeFactory] Current schema already present, using existing values:`, {
        waitForSelectorOnPage: converted.waitForSelectorOnPage,
        iframeSelector: converted.iframeSelector,
        waitForSelectorInIframe: converted.waitForSelectorInIframe,
        extractElementSelector: converted.extractElementSelector
      });
      return converted;
    }
    
    // 2단계: 레거시 스키마가 있다면 변환
    let hasConversions = false;
    
    // 레거시 waitForSelector -> waitForSelectorOnPage
    if ('waitForSelector' in converted && converted.waitForSelector && !converted.waitForSelectorOnPage) {
      converted.waitForSelectorOnPage = converted.waitForSelector;
      hasConversions = true;
      console.log(`[NodeFactory] Converted waitForSelector: "${converted.waitForSelector}" -> waitForSelectorOnPage`);
    }
    
    // 레거시 extractSelectors 객체 처리
    if ('extractSelectors' in converted && typeof converted.extractSelectors === 'object') {
      const extractSelectors = converted.extractSelectors;
      console.log(`[NodeFactory] Processing extractSelectors:`, extractSelectors);
      
      // extractSelectors 내부의 다양한 필드들을 현재 스키마로 매핑
      const mappings = [
        { from: 'iframeSelector', to: 'iframeSelector' },
        { from: 'waitForSelectorInIframe', to: 'waitForSelectorInIframe' },
        { from: 'extractElementSelector', to: 'extractElementSelector' },
        { from: 'selector', to: 'extractElementSelector' },
        { from: 'waitForSelectorOnPage', to: 'waitForSelectorOnPage' },
        { from: 'waitSelector', to: 'waitForSelectorOnPage' }
      ];
      
      for (const { from, to } of mappings) {
        if (extractSelectors[from] && !converted[to]) {
          converted[to] = extractSelectors[from];
          hasConversions = true;
          console.log(`[NodeFactory] Converted extractSelectors.${from}: "${extractSelectors[from]}" -> ${to}`);
        }
      }
    }
    
    // 다른 가능한 레거시 필드들 처리
    const directMappings = [
      { from: 'waitSelector', to: 'waitForSelectorOnPage' },
      { from: 'selector', to: 'extractElementSelector' }
    ];
    
    for (const { from, to } of directMappings) {
      if (converted[from] && !converted[to]) {
        converted[to] = converted[from];
        hasConversions = true;
        console.log(`[NodeFactory] Converted ${from}: "${converted[from]}" -> ${to}`);
      }
    }
    
    // 스키마 변환 후 로그
    if (hasConversions) {
      console.log(`[NodeFactory] WebCrawler schema conversion completed:`, {
        waitForSelectorOnPage: converted.waitForSelectorOnPage,
        iframeSelector: converted.iframeSelector,
        waitForSelectorInIframe: converted.waitForSelectorInIframe,
        extractElementSelector: converted.extractElementSelector
      });
    } else {
      console.log(`[NodeFactory] No WebCrawler schema conversions needed or applied`);
    }
    
    return converted;
  }

  /**
   * 현재 등록된 노드 타입 목록 반환 (디버깅용)
   */
  getRegisteredTypes(): string[] {
    return Object.keys(this.nodeTypes);
  }

  /**
   * 동적 Property 설정 (ForEach 모드에서 사용)
   * @param nodeType 노드 타입
   * @param property 적용할 Property
   */
  setDynamicProperties(nodeType: string, property: any): void {
    this.dynamicProperties.set(nodeType, property);
    console.log(`[NodeFactory] Dynamic property set for ${nodeType}:`, property);
  }

  /**
   * 동적 Property 가져오기
   * @param nodeType 노드 타입
   * @returns 동적 Property 또는 undefined
   */
  getDynamicProperties(nodeType: string): any {
    return this.dynamicProperties.get(nodeType);
  }

  /**
   * 동적 Property 초기화
   */
  clearDynamicProperties(): void {
    this.dynamicProperties.clear();
  }
}

// 싱글턴 인스턴스 export
export const globalNodeFactory = new NodeFactory();
