import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';

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
   * Execute the input node, handling batch vs foreach logic
   * @param input The input to execute
   * @returns The items from this input node or null in foreach mode
   */
  async execute(input: any): Promise<any> {
    this.context?.log(`InputNode(${this.id}) 실행 시작`);

    // foreach 모드: 각 항목을 개별적으로 자식 노드로 전달
    if (this.property.iterateEachRow) {
      for (const item of this.property.items) {
        for (const child of this.getChildNodes()) {
          await child.process(item);
        }
      }
      return null; // foreach 모드는 process에서 chaining을 중단
    } 
    // batch 모드: 모든 항목을 배열로 한번에 자식 노드에 전달
    else {
      const batchData = this.property.items;
      for (const child of this.getChildNodes()) {
        await child.process(batchData);
      }
      return batchData; // batch 모드는 items 배열을 그대로 반환
    }
  }
}