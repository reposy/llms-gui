import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { getNodeContent } from '../store/useInputNodeContentStore';

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
  private syncPropertyFromStore() {
    const storeContent = getNodeContent(this.id);
    if (storeContent && Array.isArray(storeContent.items)) {
      this.property.items = [...storeContent.items];
    }
    if (typeof storeContent.iterateEachRow === 'boolean') {
      this.property.iterateEachRow = storeContent.iterateEachRow;
    }
  }

  /**
   * Execute the input node, handling batch vs foreach logic
   * @param input The input to execute
   * @returns The items from this input node or null in foreach mode
   */
  async execute(input: any): Promise<any> {
    // 1. store에서 최신 items, iterateEachRow 동기화
    this.syncPropertyFromStore();

    // 2. input이 null/undefined/빈객체({})가 아니면 items에 추가
    const isEmptyObject = (val: any) => typeof val === 'object' && val !== null && Object.keys(val).length === 0;
    if (input !== null && input !== undefined && !isEmptyObject(input)) {
      this.context?.log(`InputNode(${this.id}): 체이닝 입력 추가: ${JSON.stringify(input).substring(0, 100)}...`);
      this.property.items.push(input);
    }

    this.context?.log(`InputNode(${this.id}): 현재 items 배열 (${this.property.items.length}개): ${
      this.property.items.map((item, idx) => `[${idx}]:${JSON.stringify(item)}`).join(', ')
    }`);
    this.context?.log(`InputNode(${this.id}): iterateEachRow = ${this.property.iterateEachRow}`);

    if (this.property.iterateEachRow) {
      this.context?.log(`InputNode(${this.id}): ForEach 모드로 ${this.property.items.length}개 항목 개별 처리`);
      for (const [idx, item] of this.property.items.entries()) {
        for (const child of this.getChildNodes()) {
          await child.process(item);
        }
      }
      return null;
    } else {
      this.context?.log(`InputNode(${this.id}): Batch 모드로 ${this.property.items.length}개 항목 일괄 처리 (JSON.stringify)`);
      return JSON.stringify(this.property.items);
    }
  }
}