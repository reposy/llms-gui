import { Node } from '../core/Node';
import { FlowExecutionContext } from './FlowExecutionContext';

interface MergerNodeProperty {
  strategy: 'array' | 'object';
  keys?: string[];
  // Reference to flow structure (will be provided by FlowRunner)
  nodes?: any[];
  edges?: any[];
}

/**
 * MergerNode accumulates inputs from multiple upstream nodes
 * and aggregates them according to a specified strategy.
 */
export class MergerNode extends Node {
  declare property: MergerNodeProperty;
  
  // 내부적으로 수집된 항목들을 저장
  private items: any[] = [];

  /**
   * Constructor for MergerNode
   */
  constructor(
    id: string, 
    property: Record<string, any>, 
    context?: FlowExecutionContext
  ) {
    super(id, 'merger', property, context);
    
    // Initialize with defaults if not provided
    this.property = {
      ...property,
      strategy: property.strategy || 'array'
    };
  }

  /**
   * Execute the node's specific logic
   * Accumulates the input with previous results and produces a merged output
   * @param input The input to execute
   * @returns The merged result
   */
  async execute(input: any): Promise<any> {
    // 입력 항목을 배열에 추가
    this.items.push(input);
    
    this.context?.log(`MergerNode(${this.id}): 새 입력 추가, 현재 ${this.items.length}개 항목 수집됨`);
    
    // 선택된 전략에 따라 결과 병합
    if (this.property.strategy === 'array') {
      return this.items; // 배열 형태로 그대로 반환
    } else {
      return this.mergeAsObject(this.items); // 객체 형태로 병합하여 반환
    }
  }

  /**
   * Reset accumulated items
   */
  resetItems(): void {
    this.context?.log(`MergerNode(${this.id}): 누적된 항목 초기화`);
    this.items = [];
  }

  /**
   * Merge all inputs as an object using item keys
   */
  private mergeAsObject(items: any[]): Record<string, any> {
    const result: Record<string, any> = {};
    
    // Convert items to object with keys
    items.forEach((item, index) => {
      const key = this.getItemKey(item, index);
      result[key] = item;
    });
    
    this.context?.log(`MergerNode(${this.id}): ${Object.keys(result).length}개 항목을 객체로 병합`);
    return result;
  }

  /**
   * Generate a key for an input item in object merge mode
   */
  private getItemKey(input: any, index: number): string {
    // If keys are provided and we're using object strategy, try to extract a key
    if (this.property.strategy === 'object' && this.property.keys && this.property.keys.length > 0) {
      for (const key of this.property.keys) {
        if (input && typeof input === 'object' && key in input) {
          return String(input[key]);
        }
      }
    }
    
    // If the input is an object with an id property, use that
    if (input && typeof input === 'object' && 'id' in input) {
      return String(input.id);
    }
    
    // Use a sequential index as the default key
    return `item_${index}`;
  }
} 