import { Node } from 'reactflow';
import axios from 'axios';
import { APINodeData } from '../types/nodes';
import { ExecutionContext, NodeState } from '../types/execution';

// Define the expected parameters for the executor
interface ExecuteApiNodeParams {
  node: Node<APINodeData>;
  input: any;
  context: ExecutionContext;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  resolveTemplate: (template: string, data: any, context?: any) => string;
}

export async function executeApiNode(params: ExecuteApiNodeParams): Promise<any> {
  const { node, input, context, resolveTemplate } = params;
  const nodeId = node.id;
  const nodeData = node.data;
  const { executionId } = context;

  console.log(`[ExecuteNode ${nodeId}] (API) Executing with context:`, context);

  const resolvedUrl = resolveTemplate(nodeData.url || '', input, context);
  const resolvedBody = nodeData.body ? resolveTemplate(nodeData.body || '', input, context) : undefined;
  let resolvedHeaders: Record<string, string> = {}; // Ensure type safety

  console.log(`[ExecuteNode ${nodeId}] (API) Resolved URL:`, resolvedUrl);
  console.log(`[ExecuteNode ${nodeId}] (API) Resolved Body:`, resolvedBody);

  if (!resolvedUrl) {
    throw new Error("API URL resolves to empty or null.");
  }

  // Safely parse headers
  try {
    if (nodeData.headers) {
      // Try parsing headers - ensure it's a valid JSON string first
      if (typeof nodeData.headers === 'string' && nodeData.headers.trim().startsWith('{')) {
           resolvedHeaders = JSON.parse(nodeData.headers);
      } else if (typeof nodeData.headers === 'object' && nodeData.headers !== null) {
          // If it's already an object (needs check for null)
          resolvedHeaders = nodeData.headers as Record<string, string>; // Add type assertion if needed
      } else {
          console.warn(`[ExecuteNode ${nodeId}] (API) Headers are not a valid JSON string or object:`, nodeData.headers);
      }
    }
    console.log(`[ExecuteNode ${nodeId}] (API) Resolved Headers:`, resolvedHeaders);
  } catch (e: any) {
    console.error(`[ExecuteNode ${nodeId}] (API) Failed to parse headers JSON:`, e);
    throw new Error(`Failed to parse headers JSON: ${e.message}`);
  }
  
  // Safely parse body
  let requestBody = undefined;
  try {
      if (resolvedBody) {
          requestBody = JSON.parse(resolvedBody);
          console.log(`[ExecuteNode ${nodeId}] (API) Parsed Body:`, requestBody);
      }
  } catch (e: any) {
    console.error(`[ExecuteNode ${nodeId}] (API) Failed to parse body JSON:`, e);
    throw new Error(`Failed to parse body JSON: ${e.message}`);
  }

  try {
    const response = await axios({
      method: nodeData.method || 'GET',
      url: resolvedUrl,
      headers: resolvedHeaders,
      data: requestBody,
      // Add timeout? validateStatus?
    });
    const output = response.data;
    console.log(`[ExecuteNode ${nodeId}] (API) Received output:`, output);
    return output;
  } catch (apiError: any) {
    console.error(`[ExecuteNode ${nodeId}] (API) API Call Error:`, apiError.response?.data || apiError.message);
    const errorDetail = apiError.response?.data?.detail || apiError.response?.data || apiError.message;
    const statusText = apiError.response?.statusText || 'Unknown Error';
    throw new Error(`API Call Error (${statusText}): ${errorDetail}`);
  }
} 