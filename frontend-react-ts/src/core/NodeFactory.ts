import { Node } from './Node';
import { getNodeFactory, getAllNodeTypes } from './NodeRegistry';
import { FlowExecutionContext } from './FlowExecutionContext';
import { getNodeContent, createDefaultNodeContent } from '../store/useNodeContentStore.ts';

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
    const storedContent = getNodeContent(id, type);
    
    // 3. 속성 준비
    // - 스토어에 저장된 콘텐츠가 있으면 사용
    // - 없으면 제공된 props와 기본값 결합
    const nodeContent = storedContent && Object.keys(storedContent).length > 0
      ? storedContent
      : {
          ...createDefaultNodeContent(type, id),
          ...this.typeDefaults[type] || {},
          ...props
        };
    
    // 4. 항상 라벨이 있는지 확인
    if (!nodeContent.label) {
      nodeContent.label = props.label || `${type.charAt(0).toUpperCase() + type.slice(1)} Node`;
    }
    
    // 5. 노드 인스턴스 생성
    let node: Node;
    
    // 특별한 컨텍스트 처리가 필요한 노드(예: GroupNode)와 일반 노드 구분
    if (type === 'group' && context) {
      node = factoryFn(id, nodeContent, context);
    } else {
      node = factoryFn(id, nodeContent);
      
      // 생성 후 컨텍스트 설정(필요한 경우)
      if (context && typeof node.setContext === 'function') {
        node.setContext(context);
      }
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
}

// 싱글턴 인스턴스 export
export const globalNodeFactory = new NodeFactory();

// 앱 시작 시점에 반드시 노드 타입 등록 (중복 등록 안전)
import { registerAllNodeTypes } from './NodeRegistry';
registerAllNodeTypes(globalNodeFactory);
