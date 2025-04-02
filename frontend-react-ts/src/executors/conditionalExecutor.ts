import { Node } from 'reactflow';
import { ConditionalNodeData } from '../types/nodes';
import { ExecutionContext, NodeState } from '../types/execution';
import { extractValue, evaluateCondition } from '../utils/executionUtils';

// Define the expected return structure for conditional branching
interface ConditionalExecutionResult {
  outputHandle: 'trueHandle' | 'falseHandle'; // The ID of the handle to activate
  value: any; // The original input value (inputs[0]) to pass downstream
}

// Define the expected parameters for the executor
interface ExecuteConditionalNodeParams {
  node: Node<ConditionalNodeData>;
  inputs: any[];
  context: ExecutionContext;
}

/**
 * Executes a Conditional node.
 * Evaluates the input based on the configured condition.
 * Returns an object indicating which output handle ('trueHandle' or 'falseHandle') 
 * should be activated and passes the original input value along that path.
 */
export function executeConditionalNode(params: ExecuteConditionalNodeParams): ConditionalExecutionResult {
  const { node, inputs, context } = params;
  const nodeId = node.id;
  const nodeData = node.data;
  const { executionId } = context;

  console.log(`[ExecuteNode ${nodeId}] (Conditional) Executing with context:`, context);

  // Store the original input data to pass through
  const originalInput = inputs.length > 0 ? inputs[0] : null;
  const conditionType = nodeData.conditionType || 'contains'; // Default condition type
  const conditionValue = nodeData.conditionValue || '';
  let valueToCheck = originalInput; // Value to use for evaluation might change (e.g., for json_path)
  let conditionResult: boolean;

  console.log(`[ExecuteNode ${nodeId}] (Conditional) Input:`, originalInput);
  console.log(`[ExecuteNode ${nodeId}] (Conditional) Type:`, conditionType);
  console.log(`[ExecuteNode ${nodeId}] (Conditional) Value:`, conditionValue);

  // --- Evaluate the Condition --- 
  if (conditionType === 'json_path') {
    // Use extractValue for JSONPath type. The conditionValue *is* the path.
    valueToCheck = extractValue(originalInput, conditionValue);
    console.log(`[ExecuteNode ${nodeId}] (Conditional) Value extracted by JSONPath "${conditionValue}":`, valueToCheck);
    // For JSONPath, evaluation checks truthiness of extracted value
    conditionResult = !!valueToCheck;
    console.log(`[ExecuteNode ${nodeId}] (Conditional) Evaluation result (JSONPath):`, conditionResult);
  } else {
    // Use evaluateCondition for other types, using the original input for comparison
    valueToCheck = originalInput; 
    conditionResult = evaluateCondition(conditionType, valueToCheck, conditionValue);
    console.log(`[ExecuteNode ${nodeId}] (Conditional) Evaluation result:`, conditionResult);
  }

  // --- Determine Output Path and Return Result Object --- 
  if (conditionResult) {
    console.log(`[ExecuteNode ${nodeId}] (Conditional) Condition TRUE. Activating 'trueHandle' with value:`, originalInput);
    return {
      outputHandle: 'trueHandle',
      value: originalInput
    };
  } else {
    console.log(`[ExecuteNode ${nodeId}] (Conditional) Condition FALSE. Activating 'falseHandle' with value:`, originalInput);
    return {
      outputHandle: 'falseHandle',
      value: originalInput
    };
  }
} 