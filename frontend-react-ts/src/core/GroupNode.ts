import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';

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
  // 결과 수집을 위한 배열
  private items: any[] = [];

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
   * Prepares the necessary data structures for executing the group's internal flow.
   * Filters nodes/edges, builds the execution graph, identifies root and leaf nodes.
   * @returns An object containing execution context details, or null if preparation fails.
   */
  private _prepareInternalExecution() {
    // Get nodes, edges, factory from properties
    const allNodes = this.property.nodes || [];
    const allEdges = this.property.edges || [];
    const nodeFactory = this.property.nodeFactory;

    if (!nodeFactory || allNodes.length === 0) {
      this.context?.log(`${this.type}(${this.id}): No node factory or nodes found. Cannot prepare execution.`);
      return null;
    }

    // Filter internal nodes and edges belonging to this group
    const internalNodes = allNodes.filter((n: any) => n.parentId === this.id);
    const internalNodeIds = new Set(internalNodes.map((n: any) => n.id));
    const internalEdges = allEdges.filter((e: any) => 
        internalNodeIds.has(e.source) && internalNodeIds.has(e.target)
    );
    this.context?.log(`${this.type}(${this.id}): Prepared with ${internalNodes.length} internal nodes and ${internalEdges.length} internal edges.`);

    // Build internal execution graph
    const executionGraph = this.buildExecutionGraph(internalNodes, internalEdges);
    
    // Find internal root nodes (nodes with no incoming edges within the group)
    const rootNodeIds = this.findRootNodes(executionGraph, internalNodes);
    this.context?.log(`${this.type}(${this.id}): Found ${rootNodeIds.length} internal root nodes: ${rootNodeIds.join(', ')}`);

    // Identify internal leaf nodes (nodes with no outgoing edges within the group)
    const internalLeafNodeIds = new Set(
      internalNodes
        .map((n: any) => n.id)
        .filter((nodeId: string) => (executionGraph.get(nodeId) || []).length === 0)
    );
    this.context?.log(`${this.type}(${this.id}): Identified ${internalLeafNodeIds.size} internal leaf nodes: ${Array.from(internalLeafNodeIds).join(', ')}`);

    return { internalNodes, executionGraph, rootNodeIds, internalLeafNodeIds, nodeFactory };
  }


  /**
   * Execute logic for a group node by finding and executing root nodes within the group
   * @param input The input to process
   * @returns The processed result (array of accumulated leaf node results)
   */
  async execute(input: any): Promise<any> {
    this.context?.log(`${this.type}(${this.id}): Executing group node`);
    this.items = []; // 매 GroupNode 실행마다 items 초기화

    try {
      // 1. Prepare internal execution context (nodes, graph, roots, leaves)
      const prepResult = this._prepareInternalExecution();
      if (!prepResult) {
        this.context?.log(`${this.type}(${this.id}): Group execution preparation failed.`);
        return null; // Preparation failed
      }
      const { internalNodes, executionGraph, rootNodeIds, internalLeafNodeIds, nodeFactory } = prepResult;

      // If no root nodes found inside, stop execution
      if (rootNodeIds.length === 0) {
        this.context?.log(`${this.type}(${this.id}): No root nodes found inside the group. Group execution stopped.`);
        return null; // 결과 없이 종료
      }

      // 2. Execute internal flow starting from root nodes
      const executedNodes = new Set<string>(); // Track executed nodes within this run

      // --- Start processing all internal root nodes concurrently --- 
      const executionPromises = rootNodeIds.map(rootNodeId => {
          const nodeData = internalNodes.find((n: any) => n.id === rootNodeId);
          if (!nodeData) {
              this.context?.log(`${this.type}(${this.id}): Root node ${rootNodeId} data not found during execution. Skipping.`);
              return Promise.resolve(); // Skip missing node
          }
          // Process the node and its chain, accumulating results from leaf nodes
          return this._processInternalNodeAndCollectLeafResult( // Renamed method call
              nodeData,
              input,
              executionGraph, 
              executedNodes,
              nodeFactory,
              internalLeafNodeIds // Pass leaf node IDs for result collection
          );
      });

      // Wait for all branches starting from root nodes to complete
      await Promise.all(executionPromises);
      this.context?.log(`${this.type}(${this.id}): All internal root branches finished processing.`);
      // ------------------------------------------------------------------
      
      // 3. Collect results from internal leaf nodes
      this.items = []; // Reset items before collecting final results
      for (const leafNodeId of internalLeafNodeIds) {
        // Get the potentially accumulated array of outputs for this leaf node
        const leafOutputs = this.context?.getOutput(leafNodeId);
        if (Array.isArray(leafOutputs) && leafOutputs.length > 0) {
          this.context?.log(`${this.type}(${this.id}): Collecting ${leafOutputs.length} results for leaf node ${leafNodeId}`);
          this.items.push(...leafOutputs); // Spread the results into the group's items
        } else {
          // Log if a leaf node didn't produce output (or context returned non-array)
          this.context?.log(`${this.type}(${this.id}): No output collected for leaf node ${leafNodeId}.`);
        }
      }
      
      this.context?.log(`${this.type}(${this.id}): Finished executing group, returning collected ${this.items.length} results.`);
      return this.items; // Return the array of results collected from leaf nodes

    } catch (error) {
      // Catch any unexpected errors during group execution orchestration
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.log(`${this.type}(${this.id}): Error in group execution orchestration: ${errorMessage}`);
      this.context?.markNodeError(this.id, `Group execution failed: ${errorMessage}`); // Mark the group node itself as errored
      return null; // 오류 발생 시 null 반환
    }
  }

  /**
   * Processes a single node within the group's internal flow using its `process` method.
   * If the processed node is a leaf node within the group and finishes successfully, 
   * its result is retrieved from the context and added to `this.items`.
   */
  private async _processInternalNodeAndCollectLeafResult( // Renamed method
    nodeData: any, // Consider using a more specific type if available e.g., ReactFlowNode
    input: any,
    executionGraph: Map<string, string[]>, // Graph of internal connections
    executedNodes: Set<string>, // Tracks nodes executed in this specific group run
    nodeFactory: any, // Consider defining a type for the factory
    internalLeafNodeIds: Set<string> // Set of IDs for leaf nodes within this group
  ): Promise<void> { // This method accumulates results in this.items, doesn't return directly
    const nodeId = nodeData.id;

    // Prevent re-execution within the same group run (handles diamond shapes in graph)
    if (executedNodes.has(nodeId)) {
      this.context?.log(`${this.type}(${this.id}): Node ${nodeId} already processed in this group execution. Skipping.`);
      return;
    }
    executedNodes.add(nodeId);

    // Mark the node as running in the global context
    this.context?.markNodeRunning(nodeId);

    try {
        // Create the actual node instance using the factory
        const nodeInstance = nodeFactory.create(
            nodeData.id,
            nodeData.type as string,
            nodeData.data, // Pass node-specific data/settings
            this.context // Pass the execution context
        );

        // Provide necessary graph structure info to the node instance (if needed by its logic)
        nodeInstance.property = {
            ...nodeInstance.property,
            nodes: this.property.nodes, // Full graph nodes
            edges: this.property.edges, // Full graph edges
            nodeFactory: this.property.nodeFactory, // Factory reference
            executionGraph: executionGraph // Internal graph specific to this group
        };

        this.context?.log(`${this.type}(${this.id}): Processing internal node ${nodeId} with input...`);
        // Execute the node's logic and trigger downstream processing via its process method
        await nodeInstance.process(input);
        this.context?.log(`${this.type}(${this.id}): Finished processing internal node ${nodeId}.`);

    } catch (error) {
        // This catch block handles errors specifically from creating or calling process on nodeInstance
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.context?.log(`${this.type}(${this.id}): Error occurred while processing internal node ${nodeId}: ${errorMessage}`);
        // The error state (e.g., 'error') should ideally be marked on the node 
        // within its own 'process' or 'execute' method, or by the context if process throws.
        // Avoid marking error redundantly here if possible.
        // Allow other branches of the group execution to continue.
    }
  }

  /**
   * Builds an execution graph (adjacency list) for the nodes within the group.
   * @param nodes - Array of node data objects belonging to the group.
   * @param edges - Array of edge data objects connecting nodes within the group.
   * @returns A Map where keys are source node IDs and values are arrays of target node IDs.
   */
  private buildExecutionGraph(nodes: any[], edges: any[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    // Use the provided (already filtered) nodes
    for (const node of nodes) {
      graph.set(node.id, []);
    }
    
    // Use the provided (already filtered) edges
    for (const edge of edges) {
      const sourceId = edge.source;
      const targetId = edge.target;
      
      // Check if both source and target nodes exist in the internal node list
      if (graph.has(sourceId) && graph.has(targetId)) {
          const children = graph.get(sourceId)!; // Already checked existence
          children.push(targetId);
          // graph.set(sourceId, children); // No need to set again, children is a reference
      } else {
          this.context?.log(`${this.type}(${this.id}): Edge (${edge.id}) connects nodes outside the current group filter. Source: ${sourceId}, Target: ${targetId}. Skipping edge.`);
      }
    }
    
    return graph;
  }

  /**
   * Finds root nodes within the group (nodes with no incoming edges from other nodes in the group).
   * @param graph - The internal execution graph.
   * @param nodes - Array of node data objects belonging to the group.
   * @returns An array of root node IDs.
   */
  private findRootNodes(graph: Map<string, string[]>, nodes: any[]): string[] {
    const allNodeIds = new Set(nodes.map(n => n.id));
    const allChildren = new Set<string>();
    for (const children of graph.values()) {
        children.forEach(childId => allChildren.add(childId));
    }
    
    return nodes
        .map(n => n.id)
        .filter(nodeId => !allChildren.has(nodeId) && allNodeIds.has(nodeId)); // Ensure the node is actually in the group node list
  }
}