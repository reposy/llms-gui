/**
 * Debug utilities for testing and validating application behavior
 */
import { getAllNodeContents, NodeContent } from '../store/useNodeContentStore';
import { undo, redo } from '../store/useHistoryStore';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { getNodeState } from '../store/useNodeStateStore';
import { Node } from '@xyflow/react';
import { NodeData } from '../types/nodes';

/**
 * Tests the undo/redo functionality with clipboard operations
 * 
 * This function performs the following tests:
 * 1. Records the current state of all nodes and their contents
 * 2. Performs undo (if undo is available)
 * 3. Records the state after undo
 * 4. Performs redo (if redo is available)
 * 5. Records the state after redo
 * 6. Logs detailed information about the states at each step
 * 
 * @returns An object with the test results
 */
export const testUndoRedoWithClipboard = () => {
  console.log('----------- CLIPBOARD & UNDO/REDO TEST -----------');
  
  // Step 1: Record current state
  const initialNodes = useFlowStructureStore.getState().nodes;
  const initialEdges = useFlowStructureStore.getState().edges;
  const initialNodeContents = getAllNodeContents();
  
  console.log(`Current state: ${initialNodes.length} nodes, ${initialEdges.length} edges, ${Object.keys(initialNodeContents).length} content entries`);
  
  // Check node selection
  const initialSelectedNodes = initialNodes.filter(node => node.selected);
  console.log(`Selected nodes: ${initialSelectedNodes.length}`, 
    initialSelectedNodes.map(n => ({ id: n.id, type: n.type })));
  
  // Save node state details for first selected node (if any)
  let detailedNodeState = null;
  if (initialSelectedNodes.length > 0) {
    const nodeId = initialSelectedNodes[0].id;
    const nodeContent = initialNodeContents[nodeId];
    const nodeState = getNodeState(nodeId);
    
    detailedNodeState = {
      id: nodeId,
      type: initialSelectedNodes[0].type,
      position: initialSelectedNodes[0].position,
      data: initialSelectedNodes[0].data,
      content: nodeContent,
      state: nodeState
    };
    
    console.log('Detailed node state for first selected node:', detailedNodeState);
  }
  
  // Step 2: Perform undo if available
  let afterUndoState = null;
  const canUndo = initialNodes.length > 0; // Simplified check
  
  if (canUndo) {
    console.log('Performing undo...');
    undo();
    
    // Record state after undo
    const nodesAfterUndo = useFlowStructureStore.getState().nodes;
    const edgesAfterUndo = useFlowStructureStore.getState().edges;
    const contentsAfterUndo = getAllNodeContents();
    const selectedNodesAfterUndo = nodesAfterUndo.filter(node => node.selected);
    
    afterUndoState = {
      nodeCount: nodesAfterUndo.length,
      edgeCount: edgesAfterUndo.length,
      contentCount: Object.keys(contentsAfterUndo).length,
      selectedCount: selectedNodesAfterUndo.length,
      selectedNodes: selectedNodesAfterUndo.map(n => ({ id: n.id, type: n.type }))
    };
    
    console.log('After undo:', afterUndoState);
    
    // Check if our detailed node still exists
    if (detailedNodeState) {
      const nodeId = detailedNodeState.id;
      const nodeExists = nodesAfterUndo.some(n => n.id === nodeId);
      const contentExists = !!contentsAfterUndo[nodeId];
      
      console.log(`Tracked node ${nodeId} after undo: exists=${nodeExists}, content exists=${contentExists}`);
      
      if (nodeExists && contentExists) {
        const contentAfterUndo = contentsAfterUndo[nodeId];
        console.log('Content comparison for node:', {
          before: detailedNodeState.content,
          after: contentAfterUndo,
          isEqual: JSON.stringify(detailedNodeState.content) === JSON.stringify(contentAfterUndo)
        });
      }
    }
  } else {
    console.log('Cannot undo - no history available');
  }
  
  // Step 3: Perform redo if we did an undo
  let afterRedoState = null;
  
  if (afterUndoState) {
    console.log('Performing redo...');
    redo();
    
    // Record state after redo
    const nodesAfterRedo = useFlowStructureStore.getState().nodes;
    const edgesAfterRedo = useFlowStructureStore.getState().edges;
    const contentsAfterRedo = getAllNodeContents();
    const selectedNodesAfterRedo = nodesAfterRedo.filter(node => node.selected);
    
    afterRedoState = {
      nodeCount: nodesAfterRedo.length,
      edgeCount: edgesAfterRedo.length,
      contentCount: Object.keys(contentsAfterRedo).length,
      selectedCount: selectedNodesAfterRedo.length,
      selectedNodes: selectedNodesAfterRedo.map(n => ({ id: n.id, type: n.type }))
    };
    
    console.log('After redo:', afterRedoState);
    
    // Check if our detailed node was restored
    if (detailedNodeState) {
      const nodeId = detailedNodeState.id;
      const nodeExists = nodesAfterRedo.some(n => n.id === nodeId);
      const contentExists = !!contentsAfterRedo[nodeId];
      
      console.log(`Tracked node ${nodeId} after redo: exists=${nodeExists}, content exists=${contentExists}`);
      
      if (nodeExists && contentExists) {
        const contentAfterRedo = contentsAfterRedo[nodeId];
        console.log('Content comparison for node after redo:', {
          original: detailedNodeState.content,
          restored: contentAfterRedo,
          isEqual: JSON.stringify(detailedNodeState.content) === JSON.stringify(contentAfterRedo)
        });
      }
    }
  }
  
  console.log('----------- TEST COMPLETE -----------');
  
  return {
    initialState: {
      nodeCount: initialNodes.length,
      edgeCount: initialEdges.length,
      contentCount: Object.keys(initialNodeContents).length,
      selectedCount: initialSelectedNodes.length
    },
    afterUndo: afterUndoState,
    afterRedo: afterRedoState,
    detailedNode: detailedNodeState ? {
      id: detailedNodeState.id,
      type: detailedNodeState.type,
      hasContent: !!detailedNodeState.content
    } : null
  };
};

/**
 * Logs detailed information about a specific node's content
 * Useful for debugging content restoration issues
 * 
 * @param nodeId The ID of the node to inspect
 */
export const inspectNodeContent = (nodeId: string) => {
  const nodeContents = getAllNodeContents();
  const content = nodeContents[nodeId];
  
  console.log(`----- Node Content Inspection: ${nodeId} -----`);
  console.log('Content exists:', !!content);
  
  if (content) {
    // Content type might be in data or inferred from properties
    const possibleType = inferContentType(content);
    console.log('Content type:', possibleType);
    console.log('Content keys:', Object.keys(content));
    console.log('Full content:', content);
    
    // Special handling for common node types
    if ('prompt' in content) {
      console.log('LLM Node Prompt:', content.prompt);
    }
    
    if ('items' in content) {
      console.log('Input Node Items:', content.items);
    }
    
    if ('isCollapsed' in content) {
      console.log('Group Node Collapsed:', content.isCollapsed);
    }
    
    if ('url' in content) {
      console.log('API Node URL:', content.url);
      console.log('API Node Method:', content.method);
    }
  }
  
  console.log('----- End Node Content Inspection -----');
  
  return { exists: !!content, content };
};

/**
 * Infers the type of node content based on its properties
 */
const inferContentType = (content: NodeContent): string => {
  if ('prompt' in content) return 'llm';
  if ('url' in content) return 'api';
  if ('items' in content && !('conditionType' in content)) return 'input';
  if ('isCollapsed' in content) return 'group';
  if ('conditionType' in content) return 'conditional';
  if ('path' in content) return 'jsonextractor';
  if ('format' in content || 'mode' in content) return 'output';
  if ('items' in content && Array.isArray(content.items)) return 'merger';
  return 'unknown';
};

/**
 * Verify synchronization between ReactFlow and Zustand stores
 * This helps diagnose issues where pasted nodes disappear
 * 
 * @param reactFlowNodes - The nodes from ReactFlow instance (getNodes() result)
 * @returns Object with synchronization verification results
 */
export const verifyStoreSync = (reactFlowNodes: any[]) => {
  // Get nodes from Zustand
  const zustandNodes = useFlowStructureStore.getState().nodes;
  const nodeContents = getAllNodeContents();
  
  // Compare node counts
  const rfNodeCount = reactFlowNodes.length;
  const zustandNodeCount = zustandNodes.length;
  const contentCount = Object.keys(nodeContents).length;
  
  const isSyncedWithZustand = rfNodeCount === zustandNodeCount;
  const allNodesHaveContent = zustandNodes.every(node => !!nodeContents[node.id]);
  
  console.log('\n▶️ ReactFlow <-> Zustand Synchronization Report:');
  console.log(`   ReactFlow node count: ${rfNodeCount}`);
  console.log(`   Zustand node count: ${zustandNodeCount}`);
  console.log(`   Node content entries: ${contentCount}`);
  console.log(`   Status: ${isSyncedWithZustand ? '✅ SYNCED' : '❌ DESYNCED'}`);
  
  let missingInReactFlow: Node<NodeData>[] = [];
  let missingInZustand: any[] = [];
  let missingContent: Node<NodeData>[] = [];
  
  // Find nodes only in Zustand but not in ReactFlow
  if (!isSyncedWithZustand) {
    const rfNodeIds = new Set(reactFlowNodes.map(n => n.id));
    const zustandNodeIds = new Set(zustandNodes.map(n => n.id));
    
    missingInReactFlow = zustandNodes.filter(n => !rfNodeIds.has(n.id));
    missingInZustand = reactFlowNodes.filter(n => !zustandNodeIds.has(n.id));
    
    if (missingInReactFlow.length > 0) {
      console.log('\n❌ Nodes missing from ReactFlow but present in Zustand:');
      missingInReactFlow.forEach(node => {
        console.log(`   - Node ${node.id} (${node.type || node.data?.type}): x=${node.position.x}, y=${node.position.y}`);
      });
    }
    
    if (missingInZustand.length > 0) {
      console.log('\n⚠️ Nodes in ReactFlow but missing from Zustand:');
      missingInZustand.forEach(node => {
        console.log(`   - Node ${node.id} (${node.type || node.data?.type})`);
      });
    }
  }
  
  // Check for nodes without content
  if (!allNodesHaveContent) {
    missingContent = zustandNodes.filter(node => !nodeContents[node.id]);
    console.log('\n🔍 Nodes missing content:');
    missingContent.forEach(node => {
      console.log(`   - Node ${node.id} (${node.type || node.data?.type})`);
    });
  }
  
  // Check for parent-child relationship integrity
  const groupNodes = zustandNodes.filter(node => node.type === 'group');
  const childNodes = zustandNodes.filter(node => node.parentNode);
  
  console.log(`\n🔄 Group node relationships:`);
  console.log(`   - Found ${groupNodes.length} group nodes`);
  console.log(`   - Found ${childNodes.length} child nodes with parentNode set`);
  
  // Verify all parentNode references point to existing nodes
  const invalidParentRefs = childNodes.filter(
    node => !zustandNodes.some(n => n.id === node.parentNode)
  );
  
  if (invalidParentRefs.length > 0) {
    console.log('\n⚠️ Nodes with invalid parentNode references:');
    invalidParentRefs.forEach(node => {
      console.log(`   - Node ${node.id} references non-existent parent "${node.parentNode}"`);
    });
  }
  
  console.log('\n');
  
  return {
    isSynced: isSyncedWithZustand && allNodesHaveContent,
    rfNodeCount,
    zustandNodeCount,
    contentCount,
    missingInReactFlow: missingInReactFlow.map(n => ({ id: n.id, type: n.type || n.data?.type })),
    missingInZustand: missingInZustand.map(n => ({ id: n.id, type: n.type || n.data?.type })),
    missingContent: missingContent.map(n => ({ id: n.id, type: n.type || n.data?.type })),
    invalidParentRefs: invalidParentRefs.map(n => ({ id: n.id, parentRef: n.parentNode }))
  };
};
