import { Node } from '../core/Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { MergerNodeContent } from '../types/nodes';

/**
 * MergerNode accumulates inputs from multiple upstream nodes
 * and returns the entire collection on each execution.
 */
export class MergerNode extends Node {
  declare property: MergerNodeContent;
  private collectedItems: any[] = [];

  /**
   * Constructor for MergerNode
   */
  constructor(
    id: string, 
    property: MergerNodeContent,
    context?: FlowExecutionContext
  ) {
    super(id, 'merger', property);
    
    // 생성자에서 context를 명시적으로 설정
    if (context) {
      this.context = context;
    }
    
    this.collectedItems = property?.items || [];
    this._log(`Initialized. Initial items count: ${this.collectedItems.length}`);
  }

  /**
   * Execute the node's specific logic.
   * Adds the input (or its elements if it's an array) to the internal collection
   * and returns the *entire* updated collection.
   * @param input The input to execute
   * @returns The entire accumulated array of items.
   */
  async execute(input: any): Promise<any[] | null> {
    this._log(`Executing`);
    this._log(`Received input type: ${typeof input}, isArray: ${Array.isArray(input)}`);

    if (input !== null && input !== undefined) {
      if (Array.isArray(input)) {
        this.collectedItems.push(...input);
        this._log(`Input is an array. Added ${input.length} elements. Total: ${this.collectedItems.length}`);
      } else {
        this.collectedItems.push(input);
        this._log(`Input is not an array. Added 1 element. Total: ${this.collectedItems.length}`);
      }
      
      this._log(`Updating UI store. Total collected items: ${this.collectedItems.length}`);
    } else {
      this._log(`Received null/undefined input, not adding.`);
    }

    this._log(`Returning current accumulated items (${this.collectedItems.length} items).`);
    return [...this.collectedItems];
  }

  /**
   * Merge all inputs as an object using item keys
   */
  private mergeAsObject(items: any[]): Record<string, any> {
    const result: Record<string, any> = {};
    items.forEach((item, index) => {
      const key = this.getItemKey(item, index);
      result[key] = item;
    });
    this._log(`MergerNode(${this.id}): ${Object.keys(result).length}개 항목을 객체로 병합`);
    return result;
  }

  /**
   * Generate a key for an input item in object merge mode
   */
  private getItemKey(input: any, index: number): string {
    if (this.property.strategy === 'object' && this.property.keys && this.property.keys.length > 0) {
      for (const key of this.property.keys) {
        if (input && typeof input === 'object' && key in input) {
          return String(input[key]);
        }
      }
    }
    if (input && typeof input === 'object' && 'id' in input) {
      return String(input.id);
    }
    return `item_${index}`;
  }
} 