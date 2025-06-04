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
    // 기본값 -> 스토어 값 -> 전달된 props 순으로 우선순위
    const defaultProperty = createDefaultNodeProperty(type, id);
    const typeDefaults = this.typeDefaults[type] || {};
    
    let nodeContent = { ...defaultProperty };
    if (factoryFn.nodeTypeDefaults && typeof factoryFn.nodeTypeDefaults === 'object') {
      nodeContent = { ...nodeContent, ...factoryFn.nodeTypeDefaults };
    }
    if (storedContent && typeof storedContent === 'object') {
      nodeContent = { ...nodeContent, ...storedContent };
    }
    if (props && typeof props === 'object') {
      nodeContent = { ...nodeContent, ...props };
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
   * 현재 등록된 노드 타입 목록 반환 (디버깅용)
   */
  getRegisteredTypes(): string[] {
    return Object.keys(this.nodeTypes);
  }
}

// 싱글턴 인스턴스 export
export const globalNodeFactory = new NodeFactory();
