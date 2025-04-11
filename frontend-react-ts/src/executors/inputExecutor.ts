import { Node } from 'reactflow';
import { InputNodeData } from '../types/nodes';
import { ExecutionContext } from '../types/execution';
import { getNodeContent, InputNodeContent } from '../store/useNodeContentStore';

// Define the expected parameters for the executor
interface ExecuteInputNodeParams {
  node: Node<InputNodeData>;
  input: any;
  context: ExecutionContext;
}

/**
 * Executes an Input node.
 * Retrieves the node's internal content (text rows, files, etc) and returns it
 * as the output for downstream nodes.
 * 
 * The InputNode class now handles the foreach/batch behavior internally.
 */
export function executeInputNode({ node, input, context }: ExecuteInputNodeParams): any {
  const nodeId = node.id;
  const nodeData = node.data as InputNodeData;
  
  console.log(`[InputExecutor] (${nodeId}) Starting execution`);
  
  // Get internal content from node data and node content store
  let items: any[] = [];
  
  // First check node.data which contains runtime state
  if (nodeData.items && nodeData.items.length > 0) {
    items = [...nodeData.items];
    console.log(`[InputExecutor] (${nodeId}) Using ${items.length} items from node.data`);
  } 
  // If no items in node.data, check node content store
  else {
    const nodeContent = getNodeContent(nodeId) as InputNodeContent;
    if (nodeContent?.items && nodeContent.items.length > 0) {
      items = [...nodeContent.items];
      console.log(`[InputExecutor] (${nodeId}) Using ${items.length} items from content store`);
    }
    // If text property exists, use it
    else if (nodeData.text) {
      // Convert text to array of lines
      items = nodeData.text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
      console.log(`[InputExecutor] (${nodeId}) Created ${items.length} items from text property`);
    }
  }
  
  // If we couldn't find any items, log a warning
  if (items.length === 0) {
    console.warn(`[InputExecutor] (${nodeId}) No items found in node data or content store`);
    console.log(`[InputExecutor] (${nodeId}) Node data:`, nodeData);
    return null;
  }
  
  console.log(`[InputExecutor] (${nodeId}) Returning ${items.length} items:`, items);
  return items;
} 