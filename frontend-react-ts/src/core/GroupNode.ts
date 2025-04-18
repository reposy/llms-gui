import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { GroupNodeContent, useNodeContentStore } from '../store/useNodeContentStore';
import { getRootNodeIds } from '../utils/flow/flowUtils';

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
   * Constructor for GroupNode
   */
  constructor(
    id: string,
    property: Record<string, any> = {},
    context?: FlowExecutionContext
  ) {
    super(id, 'group', property, context);
    // Ensure label has a default value
    this.property.label = property.label || 'Group';
  }

  /**
   * Execute logic for a group node by finding and executing root nodes within the group
   * @param input The input to process
   * @returns The processed result
   */
  async execute(input: any): Promise<any> {
    this.context?.log(`${this.type}(${this.id}): Executing group node`);

    // Get the latest content (mainly childNodes) directly from the store
    const nodeContent = useNodeContentStore.getState().getNodeContent<GroupNodeContent>(this.id, this.type);
    
    // For Group node, the primary property is the structure within it.
    // The `property` field passed during construction likely contains 
    // the nodes and edges *within* this group from the main flow structure.
    const groupNodes = this.property.nodes || []; // Assuming nodes within group are passed in property
    const groupEdges = this.property.edges || []; // Assuming edges within group are passed in property
    const nodeFactory = this.property.nodeFactory; // Need factory to create instances

    if (!nodeFactory || groupNodes.length === 0) {
      this.context?.log(`${this.type}(${this.id}): No node factory or nodes found within the group property. Cannot execute.`);
      return null; // Cannot proceed without factory or nodes
    }

    // Identify root nodes *within* the group
    const groupRootNodeIds = getRootNodeIds(groupNodes, groupEdges);
    this.context?.log(`${this.type}(${this.id}): Found ${groupRootNodeIds.length} root nodes within group: ${groupRootNodeIds.join(', ')}`);

    if (groupRootNodeIds.length === 0) {
        this.context?.log(`${this.type}(${this.id}): No root nodes found inside the group. Group execution stopped.`);
        return null; // No entry point for the group's internal flow
    }

    // Execute each root node within the group, passing the group's input
    for (const rootNodeId of groupRootNodeIds) {
      // Prevent infinite loops if a group somehow contains itself or similar issues
      if (this.context?.hasExecutedNode(rootNodeId)) {
        this.context?.log(`${this.type}(${this.id}): Skipping already executed node within group: ${rootNodeId}`);
        continue;
      }
      
      const nodeData = groupNodes.find((n: any) => n.id === rootNodeId);
      if (!nodeData) {
        this.context?.log(`${this.type}(${this.id}): Root node ${rootNodeId} data not found within group. Skipping.`);
        continue;
      }

      try {
        this.context?.log(`${this.type}(${this.id}): Executing group root node: ${rootNodeId}`);
        const nodeInstance = nodeFactory.create(
          nodeData.id,
          nodeData.type as string,
          nodeData.data,
          this.context // Pass the same context down
        );
        
        // IMPORTANT: Provide the group's internal structure to the node instance
        // so its getChildNodes can resolve correctly within the group context.
        nodeInstance.property = {
          ...nodeInstance.property,
          nodes: groupNodes,
          edges: groupEdges,
          nodeFactory: nodeFactory
        };

        await nodeInstance.process(input); // Start processing with the group's input
        
        // Mark as executed within this context to prevent re-execution in this run
        this.context?.markNodeExecuted(rootNodeId);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.context?.log(`${this.type}(${this.id}): Error executing node ${rootNodeId} within group: ${errorMessage}`);
        // Optionally mark the group itself as error? Or just the internal node?
        // For now, just log and continue with other roots if they exist.
      }
    }

    this.context?.log(`${this.type}(${this.id}): Finished executing group`);
    // What should a group node return? Usually, it might return the result of its designated 
    // "output" node, or perhaps null if it just orchestrates internal flow.
    // For now, return the original input, assuming it doesn't modify the main flow data directly.
    return input; 
  }
  
  /**
   * Gets all nodes that are direct children of this group
   * This is different from getChildNodes() which gets connected nodes via edges
   */
  private getInternalNodes(): any[] {
    if (!this.property.nodes) {
      this.context?.log(`GroupNode(${this.id}): No nodes property available`);
      return [];
    }
    
    // Get all nodes that have this group as their parent
    const childNodes = this.property.nodes.filter(node => node.parentNode === this.id);
    this.context?.log(`GroupNode(${this.id}): Found ${childNodes.length} nodes inside group`);
    return childNodes;
  }
} 