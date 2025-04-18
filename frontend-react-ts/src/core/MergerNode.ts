import { Node } from '../core/Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { getNodeContent, MergerNodeContent } from '../store/nodeContentStore';
import { syncNodeProperties, mergerNodeSyncConfig } from '../utils/nodePropertySync';

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
    // 공통 유틸리티 사용하여 속성 동기화
    syncNodeProperties(this, mergerNodeSyncConfig, 'merger');
  }

  /**
   * Execute the node's specific logic
   * Always pushes input to Zustand's items array and returns the updated array
   * @param input The input to execute
   * @returns The merged result
   */
  async execute(input: any): Promise<any> {
    try {
      // 실행 시작 표시
      this.context?.markNodeRunning(this.id);
      
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

      // 결과를 property에 반영
      this.property.items = items;
      
      // 디버깅 정보 저장
      this.context?.storeNodeData(this.id, {
        itemCount: items.length,
        strategy: this.property.strategy
      });
      
      // 컨텍스트에 결과 저장
      const result = this.property.strategy === 'array' ? items : this.mergeAsObject(items);
      this.context?.storeOutput(this.id, result);

      this.context?.log(`MergerNode(${this.id}): items count: ${items.length}`);

      // Return merged result according to strategy
      return result;
    } catch (error) {
      // 오류 발생 시 로그 및 노드 상태 업데이트
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.log(`MergerNode(${this.id}): 실행 중 오류 발생: ${errorMessage}`);
      this.context?.markNodeError(this.id, errorMessage);
      
      // null 반환하여 실행 중단
      return null;
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