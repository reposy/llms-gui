import { FlowExecutionContext } from './FlowExecutionContext';
import { Node as FlowNode, Edge } from '@xyflow/react';

/**
 * Base Node class that all nodes extend
 */
export abstract class Node {
  /**
   * Node ID
   */
  public readonly id: string;
  
  /**
   * Node type (e.g., 'input', 'llm', 'api', 'output', etc.)
   */
  public readonly type: string;

  /**
   * Node properties (configuration) - to be overridden by subclasses
   */
  public property: Record<string, any> = {};

  /**
   * Execution context for the node
   */
  protected context?: FlowExecutionContext;

  /**
   * Constructor for the base Node
   * @param id Node ID
   * @param type Node type
   * @param property Node properties
   */
  constructor(
    id: string, 
    type: string, 
    property: Record<string, any> = {}
  ) {
    this.id = id;
    this.type = type;
    this.property = property;
  }

  /**
   * Simple logging helper that uses context logger when available
   * @param message The message to log
   */
  protected _log(message: string): void {
    if (this.context?.log) {
      this.context.log(`${this.type}(${this.id}): ${message}`);
    } else {
      console.log(`[${this.type}:${this.id}] (no context log) ${message}`);
    }
  }

  /**
   * Get array of child nodes using the node factory and the current execution context.
   * This method ensures that the latest graph structure from the context is used
   * and attempts to reuse existing node instances from the factory's cache.
   * 
   * @returns Array of child Node instances.
   */
  getChildNodes(): Node[] {
    if (!this.context) {
      console.error(`[Node:${this.id}] getChildNodes: CRITICAL - this.context is UNDEFINED when called.`);
      return [];
    }
    if (!this.context.nodeFactory) {
      console.error(`[Node:${this.id}] getChildNodes: CRITICAL - this.context.nodeFactory is UNDEFINED. Context executionId: ${this.context.executionId}`);
      return []; 
    }
    
    const { nodeFactory, nodes: contextNodes, edges: contextEdges, log: contextLog } = this.context;
    
    // 로그 헬퍼를 _log로 교체
    const log = (message: string) => this._log(message);

    // 컨텍스트의 엣지 정보에서 직접 자식 노드 ID 계산 (childIds 필드 대신)
    const childNodeIds = contextEdges
      .filter((edge: Edge) => edge.source === this.id)
      .map((edge: Edge) => edge.target);

    if (childNodeIds.length === 0) {
      return [];
    }

    log(`Found ${childNodeIds.length} child node ID(s): [${childNodeIds.join(', ')}] based on context edges.`);

    return childNodeIds
      .map((childId: string) => {
        let nodeInstance = nodeFactory.getNode(childId);

        if (nodeInstance) {
          log(`Reusing existing instance for child node ${childId}.`);
          if (nodeFactory && (!nodeInstance.property.nodeFactory)) {
            nodeInstance.property.nodeFactory = nodeFactory;
          }
        } else {
          log(`No existing instance found for child ${childId}. Creating new one.`);
          const nodeData = contextNodes.find((n: FlowNode) => n.id === childId);
          if (!nodeData) {
            log(`Node data for child ${childId} not found in context nodes.`);
            return null;
          }
          if (typeof nodeData.type !== 'string') {
            log(`Node data for child ${childId} has invalid or missing type: ${nodeData.type}. Skipping creation.`);
            return null;
          }
          try {
            nodeInstance = nodeFactory.create(
              nodeData.id,
              nodeData.type,
              nodeData.data,
              this.context // 컨텍스트 전달
            );
          } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              log(`Error creating child node instance ${childId} (type: ${nodeData?.type}): ${errorMessage}`);
              return null;
          }
        }
        
        return nodeInstance;
      })
      .filter((node): node is Node => node !== null);
  }

  /**
   * Process input through this node and chain through child nodes
   * This provides common lifecycle management for all nodes
   * 
   * @param input The input to process
   * @param context The execution context for this specific execution run
   * @returns Promise that resolves when this node and its descendants have finished processing
   */
  async process(input: any, context: FlowExecutionContext): Promise<void> {
    // Set the context for this specific execution run
    this.context = context;
    
    if (!this.context) {
      console.error(`[Node:${this.id}] Execution context provided to process() is invalid.`);
      return;
    }
    
    // From this point onwards, this.context is guaranteed to be FlowExecutionContext
    const currentContext = this.context; // Use a const for clarity within the scope if preferred
    
    currentContext.markNodeRunning(this.id);
    this._log('Process started.');

    try {
      this._log('Calling execute...');
      // execute uses this.context, which is now set
      const output = await this.execute(input);
      this._log(`Execute returned. Output type: ${typeof output}, isArray: ${Array.isArray(output)}`);

      if (output !== null && output !== undefined) {
        if (Array.isArray(output)) {
          if (output.length > 0) {
            this._log(`Execute returned an array with ${output.length} items. Storing each item.`);
            for (const item of output) {
              currentContext.storeOutput(this.id, item); 
            }
            currentContext.markNodeSuccess(this.id, output); 
            this._log('Marked success with array result.');
          } else {
             this._log('Execute returned empty array.');
             currentContext.markNodeSuccess(this.id, []); 
          }
        } else {
          this._log('Execute returned a single item. Storing it.');
          currentContext.storeOutput(this.id, output); 
          currentContext.markNodeSuccess(this.id, output);
        }
        
        this._log(`Context is VALID before getChildNodes. executionId: ${currentContext.executionId}`);
        
        // getChildNodes uses this.context, which is set
        const children = this.getChildNodes(); 
        if (children.length > 0) {
           this._log(`Executing ${children.length} child node(s) in parallel. Context executionId: ${currentContext.executionId}`);
           const childPromises = children.map(child => {
             this._log(`Preparing child ${child.id}. Output type to child: ${typeof output}, isArray: ${Array.isArray(output)}. Context executionId: ${currentContext.executionId}`);
             if (!child) {
                 console.error(`[Node:${this.id}] Null child found in children array.`);
                 return Promise.resolve(); // Skip null child
             }
             // 변경: 컨텍스트를 명시적으로 전달하여 컨텍스트 손실 방지
             // Always use currentContext here, not this.context which could potentially be modified
             return child.process(output, currentContext); 
           });
           await Promise.all(childPromises); 
           this._log(`Finished executing child node(s). Context executionId: ${currentContext.executionId}`);
        } else {
           this._log('No child nodes to execute.');
        }
      } else {
           this._log('Execute returned null or undefined. Stopping branch.');
           currentContext.markNodeSuccess(this.id, output); 
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Use currentContext which should still be valid unless the error corrupted it somehow
      // But the original this.context reference is what matters for logging/marking
      if (currentContext) { // 변경: this.context 대신 currentContext 사용
        this._log(`Error during execution: ${errorMessage}`);
        currentContext.markNodeError(this.id, errorMessage);
      } else {
        console.error(`[Node:${this.id}] Error during execution (CONTEXT LOST IN CATCH): ${errorMessage}`, error);
      }
    }
    
    // Check currentContext again before final log - 변경: this.context 대신 currentContext 사용
    if (currentContext) {
        this._log('Process finished.');
    } else {
        console.log(`[Node:${this.id}] Process finished (CONTEXT WAS LOST).`);
    }
  }

  /**
   * Execute the core functionality of the node
   * To be implemented by subclasses
   * 
   * @param input The input to process
   * @returns The processed result
   */
  abstract execute(input: any): Promise<any>;
} 