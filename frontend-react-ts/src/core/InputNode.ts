import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { getNodeContent, setNodeContent } from '../store/useInputNodeContentStore';
import { InputNodeContent } from '../store/useInputNodeContentStore';

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
    const storeContent = getNodeContent(this.id) as InputNodeContent;
    if (storeContent && Array.isArray(storeContent.items)) {
      this.property.items = [...storeContent.items];
    }
    if (typeof storeContent.iterateEachRow === 'boolean') {
      this.property.iterateEachRow = storeContent.iterateEachRow;
    }
  }

  /**
   * Execute the input node, handling batch vs foreach logic
   * Always pushes input to Zustand's items array and returns the updated array (batch) or null (foreach)
   * @param input The input to execute
   * @returns The items from this input node or null in foreach mode
   */
  async execute(input: any): Promise<any> {
    // 1. store에서 최신 items, iterateEachRow 동기화
    this.syncPropertyFromStore();

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
    setNodeContent(this.id, { items: [...this.property.items] } as Partial<InputNodeContent>);

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