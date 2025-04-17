import { Node } from '../core/Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { getNodeContent, setNodeContent } from '../store/nodeContentStore';
import { MergerNodeContent } from '../store/nodeContents/common';

interface MergerNodeProperty {
  strategy: 'array' | 'object';
  keys?: string[];
  // Reference to flow structure (will be provided by FlowRunner)
  nodes?: any[];
  edges?: any[];
  items?: any[]; // Ensure items is always present
}

/**
 * MergerNode accumulates inputs from multiple upstream nodes
 * and aggregates them according to a specified strategy.
 */
export class MergerNode extends Node {
  declare property: MergerNodeProperty;

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
      strategy: property.strategy || 'array',
      items: property.items || [],
    };
  }

  /**
   * Synchronize property.items from Zustand store before execution
   */
  syncPropertyFromStore(): void {
    const content = getNodeContent(this.id) as MergerNodeContent;
    if (content && Array.isArray(content.items)) {
      this.property.items = [...content.items];
    } else {
      this.property.items = [];
    }
  }

  /**
   * Execute the node's specific logic
   * Always pushes input to Zustand's items array and returns the updated array
   * @param input The input to execute
   * @returns The merged result
   */
  async execute(input: any): Promise<any> {
    this.context?.log(`MergerNode(${this.id}): execute() called with input: ${JSON.stringify(input)}`);

    // Use property.items (already synced)
    let items = Array.isArray(this.property.items) ? [...this.property.items] : [];

    // If input is not undefined/null, always push (including empty objects/arrays)
    if (input !== undefined && input !== null) {
      if (Array.isArray(input)) {
        items.push(...input);
      } else {
        items.push(input);
      }
    }

    // Update Zustand store with new items array, cast as Partial<MergerNodeContent>
    setNodeContent(this.id, { items } as Partial<MergerNodeContent>);
    this.property.items = items;

    this.context?.log(`MergerNode(${this.id}): items updated in Zustand, count: ${items.length}`);

    // Return merged result according to strategy
    if (this.property.strategy === 'array') {
      return items;
    } else {
      return this.mergeAsObject(items);
    }
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
    this.context?.log(`MergerNode(${this.id}): ${Object.keys(result).length}개 항목을 객체로 병합`);
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