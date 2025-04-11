import { Node } from '../core/Node';
import { getOutgoingConnections } from '../utils/flowUtils';

interface MergerNodeProperty {
  strategy: 'array' | 'object';
  keys?: string[];
  // Reference to flow structure (will be provided by FlowRunner)
  nodes?: any[];
  edges?: any[];
}

export class MergerNode extends Node {
  declare property: MergerNodeProperty;
  
  // Buffer to store inputs across multiple executions
  private buffer: Record<string, any> = {};
  private bufferCount: number = 0;

  async process(input: any): Promise<any> {
    this.context.log(`MergerNode(${this.id}): Merging inputs using ${this.property.strategy} strategy`);
    
    // Store the input in the buffer
    this.storeInput(input);
    
    // Merge based on the selected strategy
    return this.property.strategy === 'array' 
      ? this.mergeAsArray() 
      : this.mergeAsObject();
  }

  /**
   * Store an input in the buffer
   */
  private storeInput(input: any): void {
    const bufferKey = this.getBufferKey(input);
    this.buffer[bufferKey] = input;
    this.bufferCount++;
    this.context.log(`MergerNode(${this.id}): Stored input #${this.bufferCount} with key ${bufferKey}`);
  }

  /**
   * Generate a key for storing the input
   */
  private getBufferKey(input: any): string {
    // If keys are provided and we're using object strategy, try to extract a key
    if (this.property.strategy === 'object' && this.property.keys && this.property.keys.length > 0) {
      for (const key of this.property.keys) {
        if (input && typeof input === 'object' && key in input) {
          return String(input[key]);
        }
      }
    }
    
    // Use a sequential buffer count as the default key
    return `input_${this.bufferCount}`;
  }

  /**
   * Merge all stored inputs as an array
   */
  private mergeAsArray(): any[] {
    const result = Object.values(this.buffer);
    this.context.log(`MergerNode(${this.id}): Merged ${result.length} inputs as array`);
    return result;
  }

  /**
   * Merge all stored inputs as an object
   */
  private mergeAsObject(): Record<string, any> {
    this.context.log(`MergerNode(${this.id}): Merged ${Object.keys(this.buffer).length} inputs as object`);
    return { ...this.buffer };
  }
} 