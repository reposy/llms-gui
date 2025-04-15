import { Node } from '../core/Node';
import { getRootNodesFromSubset } from '../utils/executionUtils';
import { NodeFactory } from '../core/NodeFactory';

interface GroupNodeProperty {
  label: string;
  // Reference to flow structure (will be provided by FlowRunner)
  nodes?: any[];
  edges?: any[];
  nodeFactory?: any;
  executionGraph?: any;
}

export class GroupNode extends Node {
  declare property: GroupNodeProperty;

  /**
   * Execute logic for a group node by finding and executing root nodes within the group
   * @param input The input to process
   * @returns The processed result
   */
  async execute(input: any): Promise<any> {
    this.context.log(`GroupNode(${this.id}): Processing group with label "${this.property.label}"`);
    
    // Find all nodes that are children of this group
    const childNodes = this.getInternalNodes();
    if (childNodes.length === 0) {
      this.context.log(`GroupNode(${this.id}): No child nodes found in group.`);
      return input; // Just pass through the input
    }
    
    // Find internal edges (edges where both source and target are inside the group)
    const childNodeIds = new Set(childNodes.map(n => n.id));
    const internalEdges = this.property.edges?.filter(edge => 
      childNodeIds.has(edge.source) && childNodeIds.has(edge.target)
    ) || [];
    
    // Find root nodes within the group (nodes with no incoming edges within the group)
    const rootNodeIds = getRootNodesFromSubset(childNodes, internalEdges);
    this.context.log(`GroupNode(${this.id}): Found ${rootNodeIds.length} root nodes inside group: [${rootNodeIds.join(', ')}]`);
    
    if (rootNodeIds.length === 0) {
      this.context.log(`GroupNode(${this.id}): No root nodes found inside group, nothing to execute.`);
      return input; // Just pass through the input
    }
    
    // Execute each root node within the group
    const results = [];
    for (const rootNodeId of rootNodeIds) {
      try {
        // Find the node data
        const nodeData = this.property.nodes?.find(n => n.id === rootNodeId);
        if (!nodeData) {
          this.context.log(`GroupNode(${this.id}): Root node ${rootNodeId} not found. Skipping.`);
          continue;
        }
        
        // Create the node instance
        const rootNode = this.property.nodeFactory.create(
          nodeData.id,
          nodeData.type,
          nodeData.data,
          this.context
        );
        
        // Attach graph structure reference to the node property
        rootNode.property = {
          ...rootNode.property,
          nodes: this.property.nodes,
          edges: this.property.edges,
          nodeFactory: this.property.nodeFactory,
          executionGraph: this.property.executionGraph
        };
        
        // Execute the root node with the input
        this.context.log(`GroupNode(${this.id}): Executing root node ${rootNodeId}`);
        
        // Process each root node with the input, which will trigger execute and propagate to its children
        await rootNode.process(input);
        
        // Get the result from the context
        const nodeState = this.context.getNodeState(rootNodeId);
        if (nodeState?.status === 'success') {
          results.push({
            nodeId: rootNodeId,
            result: nodeState.result
          });
        }
      } catch (error) {
        this.context.log(`GroupNode(${this.id}): Error executing root node ${rootNodeId}: ${error}`);
        // Continue with other roots even if one fails
      }
    }
    
    this.context.log(`GroupNode(${this.id}): Finished executing ${results.length} root nodes`);
    
    // Return the results
    return results;
  }
  
  /**
   * Gets all nodes that are direct children of this group
   * This is different from getChildNodes() which gets connected nodes via edges
   */
  private getInternalNodes(): any[] {
    if (!this.property.nodes) {
      this.context.log(`GroupNode(${this.id}): No nodes property available`);
      return [];
    }
    
    // Get all nodes that have this group as their parent
    const childNodes = this.property.nodes.filter(node => node.parentNode === this.id);
    this.context.log(`GroupNode(${this.id}): Found ${childNodes.length} nodes inside group`);
    return childNodes;
  }
} 