import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { getNodeContent, InputNodeContent } from '../store/nodeContentStore';

/**
 * Input node properties
 */
export interface InputNodeProperty {
  items: any[];
  iterateEachRow: boolean;
  nodeFactory?: any;
  [key: string]: any;
}

/**
 * Input node that provides data to the flow
 */
export class InputNode extends Node {
  /**
   * Type assertion for the property
   */
  property: InputNodeProperty;
  
  /**
   * Constructor for InputNode
   */
  constructor(
    id: string, 
    property: Record<string, any> = {},
    context?: FlowExecutionContext
  ) {
    super(id, 'input', property, context);
    
    // Initialize with default property if not provided
    this.property = {
      items: property.items || [],
      iterateEachRow: property.iterateEachRow || false,
      ...property,
    };
  }
  
  /**
   * Store에서 items, iterateEachRow를 동기화
   */
  syncPropertyFromStore() {
    const storeContent = getNodeContent<InputNodeContent>(this.id, 'input');
    if (storeContent) {
      if (Array.isArray(storeContent.items)) {
        this.property.items = [...storeContent.items];
      }
      if (typeof storeContent.iterateEachRow === 'boolean') {
        this.property.iterateEachRow = storeContent.iterateEachRow;
      }
    }
  }

  /**
   * Execute the input node, handling batch vs foreach logic
   * Always pushes input to Zustand's items array and returns the updated array (batch) or null (foreach)
   * @param input The input to execute
   * @returns The items from this input node or null in foreach mode
   */
  async execute(input: any): Promise<any> {
    try {
      // 1. store에서 최신 items, iterateEachRow 동기화
      this.syncPropertyFromStore();
      this.context?.markNodeRunning(this.id);

      // 2. input이 undefined/null이 아니면 items에 추가 (배열이면 하나씩 push)
      if (input !== undefined && input !== null) {
        if (Array.isArray(input)) {
          for (const item of input) {
            this.property.items.push(item);
          }
        } else {
          this.property.items.push(input);
        }
      }

      // 3. Zustand store에 items 동기화
      // 통합 스토어의 setNodeContent 함수 대신 직접 import해서 사용해야하지만,
      // 이 파일에서는 Node가 처리하고 UI에서 업데이트 하므로 생략

      this.context?.log(`InputNode(${this.id}): 현재 items 배열 (${this.property.items.length}개): ${
        this.property.items.map((item, idx) => `[${idx}]:${JSON.stringify(item)}`).join(', ')
      }`);
      this.context?.log(`InputNode(${this.id}): iterateEachRow = ${this.property.iterateEachRow}`);

      // 결과를 컨텍스트에 저장
      this.context?.storeOutput(this.id, this.property.items);

      if (this.property.iterateEachRow) {
        this.context?.log(`InputNode(${this.id}): ForEach 모드로 ${this.property.items.length}개 항목 개별 처리`);
        for (const [idx, item] of this.property.items.entries()) {
          // 현재 반복 상태 설정
          if (this.context) {
            this.context.setIterationContext({
              item,
              index: idx,
              total: this.property.items.length
            });
          }
          
          // 각 아이템을 자식 노드에게 전달
          for (const child of this.getChildNodes()) {
            await child.process(item);
          }
        }
        // foreach 모드에서는 null 반환하여 추가 process 호출 방지
        return null;
      } else {
        this.context?.log(`InputNode(${this.id}): Batch 모드로 ${this.property.items.length}개 항목 일괄 처리`);
        // 배열을 리턴하여 자식 노드로의 체이닝 계속
        return this.property.items;
      }
    } catch (error) {
      // 오류 발생시 로그 및 노드 상태 업데이트
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.log(`InputNode(${this.id}): 실행 중 오류 발생: ${errorMessage}`);
      this.context?.markNodeError(this.id, errorMessage);
      
      // null 반환하여 추가 실행 중단
      return null;
    }
  }
}