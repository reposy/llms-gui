import { Node } from 'reactflow';
import axios from 'axios';
import { LLMNodeData, NodeType, LLMResult } from '../types/nodes'; // Adjusted import
import { ExecutionContext, NodeState } from '../types/execution';
import { getNodeContent, LLMNodeContent } from '../store/useNodeContentStore';
import { makeExecutionLogPrefix } from '../controller/executionDispatcher';
import { normalizeInputForTemplate } from '../utils/templateUtils';
import { extractValueFromNodeResult, extractValueFromContext } from '../executors/executorDispatcher';

export async function executeLlmNode(params: {
  node: Node<LLMNodeData>;
  inputs: any[];
  context: ExecutionContext;
  setNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  resolveTemplate: (template: string, data: any) => string;
}): Promise<LLMResult> {
  const { node, inputs, context, setNodeState, resolveTemplate } = params;
  const { executionId } = context;
  const nodeId = node.id;

  // Create standardized log prefix
  const logPrefix = makeExecutionLogPrefix(node, context);
  const debugLogPrefix = makeExecutionLogPrefix(node, context, { tag: 'DEBUG' });

  console.log(`${logPrefix} Executing LLM node...`);
  
  // CRITICAL FIX: Add execution mode and iteration tracking at the start
  console.log(`${logPrefix} EXECUTION CONTEXT:`, {
    mode: context.iterationTracking?.executionMode || 'standard',
    iteration: context.iterationTracking ? `${context.iterationTracking.currentIndex + 1}/${context.iterationTracking.totalItems}` : 'N/A',
    executionId: context.executionId,
    hasIterationItem: context.hasIterationItem,
    inputType: context.inputType || (context.iterationItem ? typeof context.iterationItem : 'none'),
    inputValue: context.iterationItem ? 
      (typeof context.iterationItem === 'object' ? 
        `${JSON.stringify(context.iterationItem).substring(0, 100)}...` : 
        context.iterationItem) 
      : 'none'
  });
  
  // DEBUG DUMP: Output complete execution context
  console.log(`${debugLogPrefix} COMPLETE EXECUTION CONTEXT:`, JSON.stringify({
    executionId: context.executionId,
    triggerNodeId: context.triggerNodeId,
    isSubExecution: context.isSubExecution,
    iterationItem: context.iterationItem,
    iterationTracking: context.iterationTracking
  }, null, 2));
  
  // DEBUG DUMP: Output complete inputs array
  console.log(`${debugLogPrefix} COMPLETE INPUTS (${inputs.length}):`, 
    JSON.stringify(inputs.map(input => {
      if (input === null || input === undefined) return input;
      if (typeof input === 'object') {
        return {
          hasValue: 'value' in input,
          hasMeta: '_meta' in input,
          valueType: input.value !== undefined ? typeof input.value : 'N/A',
          metaMode: input._meta?.mode,
          preview: JSON.stringify(input).substring(0, 100)
        };
      }
      return {
        type: typeof input,
        value: String(input).substring(0, 100)
      };
    }), null, 2));

  // CRITICAL FIX: Detailed logging about the execution context for foreach mode
  if (context.iterationTracking?.executionMode === 'foreach') {
    console.log(`${debugLogPrefix} FOREACH EXECUTION MODE DETECTED`, {
      iterationIndex: context.iterationTracking.currentIndex,
      totalItems: context.iterationTracking.totalItems,
      hasIterationItem: context.iterationItem !== undefined,
      iterationItemType: typeof context.iterationItem,
      iterationItemContent: typeof context.iterationItem === 'object' ? 
                           JSON.stringify(context.iterationItem).substring(0, 200) : 
                           String(context.iterationItem)
    });
  }

  // Start executing and update state
  setNodeState(nodeId, {
    status: 'running',
    executionId,
    error: undefined,
    result: undefined, // Clear any previous result
  });

  try {
    // Get content from node content store
    const nodeContent = getNodeContent(nodeId) as LLMNodeContent;
    if (!nodeContent) {
      throw new Error('LLM node content not found in store.');
    }

    // Get input value with highest priority:
    // 1. iterationItem.value (from context)
    // 2. inputs[0].value (from upstream node)
    // 3. inputs[0] (direct)
    // 4. Empty string (fallback)
    let inputValue = null;
    let inputSource = "none";
    
    // CRITICAL FIX: Use our helper function to consistently extract values
    // First check for iterationItem in context
    const contextExtracted = extractValueFromContext(context);
    if (contextExtracted.value !== null) {
      inputValue = contextExtracted.value;
      inputSource = "context.iterationItem";
      
      console.log(`${debugLogPrefix} Using iterationItem from context:`, {
        valueType: typeof inputValue,
        valuePreview: typeof inputValue === 'object' ?
          JSON.stringify(inputValue).substring(0, 100) :
          String(inputValue),
        metadata: contextExtracted.metadata ? {
          mode: contextExtracted.metadata.mode,
          source: contextExtracted.metadata.source
        } : 'none'
      });
    }
    // Then check inputs if context didn't have an iterationItem
    else if (inputs.length > 0) {
      const inputExtracted = extractValueFromNodeResult(inputs[0]);
      inputValue = inputExtracted.value;
      inputSource = "inputs[0]";
      
      console.log(`${debugLogPrefix} Using value from inputs[0]:`, {
        valueType: typeof inputValue,
        valuePreview: typeof inputValue === 'object' ?
          JSON.stringify(inputValue).substring(0, 100) :
          String(inputValue),
        metadata: inputExtracted.metadata ? {
          mode: inputExtracted.metadata.mode,
          source: inputExtracted.metadata.source
        } : 'none'
      });
    }
    // Fallback to empty string
    else {
      inputValue = "";
      inputSource = "fallback-empty";
      
      // CRITICAL ERROR: If we're in foreach mode but have no input, something is wrong
      if (context.iterationTracking?.executionMode === 'foreach') {
        console.error(`${debugLogPrefix} CRITICAL ERROR: No input value found in foreach mode! Check if iterationItem is being passed correctly.`);
      }
    }
    
    // CRITICAL DEBUG: Log the input value we're using
    console.log(`${debugLogPrefix} INPUT RESOLUTION:`, {
      source: inputSource,
      inputValueType: typeof inputValue,
      isNullOrUndefined: inputValue === null || inputValue === undefined,
      valuePreview: inputValue === null || inputValue === undefined ? 
        'null/undefined' : 
        (typeof inputValue === 'object' ? 
          JSON.stringify(inputValue).substring(0, 100) : 
          String(inputValue))
    });
    
    /**
     * Safely converts any input value to a clean string for template resolution
     * Handles both foreach mode (extracting primitives) and standard mode (handling arrays)
     */
    function getSafePromptInput(input: any, isForeachMode: boolean): string {
      // Handle null/undefined
      if (input === null || input === undefined) return '';
      
      // Handle objects (including arrays)
      if (typeof input === 'object') {
        // For foreach mode, prioritize extracting clean primitive values
        if (isForeachMode) {
          console.log(`${debugLogPrefix} FOREACH MODE INPUT SANITIZING:`, {
            hasValueProp: 'value' in input,
            valueType: 'value' in input ? typeof input.value : 'N/A',
            isMeta: '_meta' in input,
            isArray: Array.isArray(input)
          });
          
          // Extract value from { value: x } structure (common in foreach mode)
          if ('value' in input && input.value !== undefined) {
            const extractedValue = input.value;
            // Handle the extracted value being an object
            if (typeof extractedValue === 'object' && extractedValue !== null) {
              // If it's an array with one item, get that item
              if (Array.isArray(extractedValue) && extractedValue.length === 1) {
                return String(extractedValue[0]);
              }
              // Otherwise stringify the object (less common in foreach)
              return JSON.stringify(extractedValue);
            }
            // Return primitives directly as string
            return String(extractedValue);
          }
          
          // Handle arrays in foreach mode - extract item at current index
          if (Array.isArray(input)) {
            const index = context.iterationTracking?.currentIndex ?? 0;
            if (input.length > index) {
              return typeof input[index] === 'object' ? 
                     JSON.stringify(input[index]) : 
                     String(input[index]);
            }
          }
        } 
        // For standard mode, handle arrays and objects differently
        else {
          // For arrays, join elements with newlines
          if (Array.isArray(input)) {
            if (input.length === 0) return '';
            if (input.length === 1) {
              // If single item array, extract that item
              const item = input[0];
              // If the item has a value property, use that
              if (typeof item === 'object' && item !== null && 'value' in item) {
                return typeof item.value === 'object' ? 
                       JSON.stringify(item.value) : 
                       String(item.value);
              }
              // Otherwise, stringify or convert the item
              return typeof item === 'object' ? JSON.stringify(item) : String(item);
            }
            
            // For multi-item arrays, map and join
            return input.map(item => {
              // Extract value property if it exists
              if (typeof item === 'object' && item !== null && 'value' in item) {
                return typeof item.value === 'object' ? 
                       JSON.stringify(item.value) : 
                       String(item.value);
              }
              // Otherwise stringify or convert the item
              return typeof item === 'object' ? JSON.stringify(item) : String(item);
            }).join('\n');
          }
          
          // For non-array objects, check for common properties
          if ('text' in input && input.text !== undefined) {
            return String(input.text);
          }
          if ('value' in input && input.value !== undefined) {
            return typeof input.value === 'object' ? 
                  JSON.stringify(input.value) : 
                  String(input.value);
          }
        }
        
        // Last resort for objects - stringify them
        try {
          return JSON.stringify(input);
        } catch (e) {
          console.error(`${debugLogPrefix} Error stringifying object:`, e);
          return '[Object]';
        }
      }
      
      // For primitives, simply convert to string
      return String(input);
    }
    
    // Determine if we're in foreach mode
    const isForeachMode = context.iterationTracking?.executionMode === 'foreach';
    
    // Get safe input for template resolution
    let finalInputValue = getSafePromptInput(inputValue, isForeachMode);
    
    // FINAL SAFETY CHECK: Catch any remaining [object Object]
    if (finalInputValue.includes('[object Object]')) {
      console.warn(`${debugLogPrefix} SAFETY CHECK FAILED: Found [object Object] in sanitized input!`);
      
      // Try one more direct extraction
      let safetyValue = finalInputValue;
      if (typeof inputValue === 'object' && inputValue !== null) {
        if ('value' in inputValue && typeof inputValue.value !== 'object') {
          safetyValue = String(inputValue.value);
        } else if (isForeachMode && context.iterationItem && 
                   typeof context.iterationItem === 'object' && 
                   'value' in context.iterationItem) {
          safetyValue = String(context.iterationItem.value);
        }
      }
      
      // Log the recovery attempt
      console.log(`${debugLogPrefix} SAFETY RECOVERY:`, {
        before: finalInputValue.substring(0, 50),
        after: safetyValue.substring(0, 50),
        recovered: safetyValue !== finalInputValue
      });
      
      // Update the value if recovery succeeded
      if (safetyValue !== finalInputValue && !safetyValue.includes('[object Object]')) {
        finalInputValue = safetyValue;
      }
    }
    
    // Log the final string value
    console.log(`${debugLogPrefix} FINAL INPUT VALUE:`, {
      originalType: typeof inputValue,
      isArray: Array.isArray(inputValue),
      finalValue: finalInputValue.substring(0, 100) + (finalInputValue.length > 100 ? '...' : ''),
      length: finalInputValue.length,
      isForeachMode: isForeachMode,
      iterationIndex: context.iterationTracking?.currentIndex
    });
    
    // Create template data with sanitized input
    const normalizedInput = normalizeInputForTemplate(finalInputValue);
    const templateData = { input: normalizedInput };
    
    // Log normalized input for verification
    console.log(`${debugLogPrefix} NORMALIZED INPUT:`, {
      before: typeof finalInputValue === 'object' ? 
        JSON.stringify(finalInputValue).substring(0, 100) : String(finalInputValue),
      after: typeof normalizedInput === 'object' ? 
        JSON.stringify(normalizedInput).substring(0, 100) : String(normalizedInput),
      wasNormalized: normalizedInput !== finalInputValue
    });
    
    // VERIFICATION: Check if we're in foreach mode and log template data
    if (context.iterationTracking?.executionMode === 'foreach') {
      console.log(`${debugLogPrefix} FOREACH VERIFICATION:`, {
        iteration: context.iterationTracking.currentIndex + 1,
        totalItems: context.iterationTracking.totalItems,
        inputNodeId: context.iterationTracking.inputNodeId,
        templateData: JSON.stringify(templateData).substring(0, 200)
      });
    }
    
    // Resolve the template with our proper input structure
    let resolvedPrompt = resolveTemplate(nodeContent.prompt || '', templateData);
    
    // CRITICAL: Check if {{input}} was resolved properly
    console.log(`${debugLogPrefix} TEMPLATE RESOLUTION:`, {
      templateBefore: nodeContent.prompt || '',
      dataProvidedToResolver: JSON.stringify(templateData).substring(0, 100),
      resolvedTemplate: resolvedPrompt,
      containsPlaceholder: resolvedPrompt.includes('{{input}}'),
      isEmpty: resolvedPrompt.trim() === '[]' || resolvedPrompt.trim() === '[[]]',
      placeholder: '{{input}}',
      placeholderInTemplate: nodeContent.prompt?.includes('{{input}}'),
      containsError: resolvedPrompt.includes('{{input:ERROR:')
    });

    // CRITICAL FIX: Check if there are any remaining [object Object] strings
    if (resolvedPrompt.includes('[object Object]')) {
      console.warn(`${debugLogPrefix} NORMALIZATION WARNING: Template still contains [object Object] after normalization!`);
      // Try to clean up [object Object] from the resolved prompt as a last resort
      const cleanedPrompt = resolvedPrompt.replace(/\[object Object\]/g, 
        typeof normalizedInput === 'object' ? JSON.stringify(normalizedInput) : String(normalizedInput));
      
      console.log(`${debugLogPrefix} CLEANUP ATTEMPT:`, {
        before: resolvedPrompt.substring(0, 100),
        after: cleanedPrompt.substring(0, 100),
        wasChanged: cleanedPrompt !== resolvedPrompt
      });
      
      // Use the cleaned prompt instead
      if (cleanedPrompt !== resolvedPrompt) {
        console.log(`${debugLogPrefix} Using cleaned prompt instead of original resolved prompt`);
        resolvedPrompt = cleanedPrompt;
      }
    }

    // CRITICAL FIX: Enhanced error detection for template resolution failures
    const hasTemplateResolutionError = 
      // Original placeholder still exists
      (resolvedPrompt.includes('{{input}}') && nodeContent.prompt?.includes('{{input}}')) ||
      // Error marker returned by resolveTemplate
      resolvedPrompt.includes('{{input:ERROR:') || 
      // Empty result when we expected a value
      (nodeContent.prompt?.includes('{{input}}') && resolvedPrompt.trim() === '') ||
      // JSON artifacts from improperly stringified arrays/objects
      (nodeContent.prompt?.includes('{{input}}') && (
        resolvedPrompt.trim().startsWith('[[') || 
        resolvedPrompt.trim().startsWith('"{') || 
        resolvedPrompt.trim() === '[]' || 
        resolvedPrompt.trim() === '{}' ||
        resolvedPrompt.includes('[object Object]')
      ));

    if (hasTemplateResolutionError) {
      const errorMessage = resolvedPrompt.includes('{{input:ERROR:') 
        ? `Template resolution error: ${resolvedPrompt.match(/\{\{input:ERROR:(.*?)\}\}/)?.[1] || 'Unknown error'}`
        : resolvedPrompt.includes('[object Object]')
        ? 'Failed to resolve {{input}} properly - object was not properly stringified. Check input data format.'
        : (resolvedPrompt.trim().startsWith('[[') || resolvedPrompt.trim() === '[]' || resolvedPrompt.trim() === '{}')
        ? 'Failed to resolve {{input}} properly - received stringified object/array. Ensure input is a primitive value.'
        : 'Failed to resolve {{input}} placeholder. Check input data and template.';
        
      console.error(`${logPrefix} CRITICAL ERROR: ${errorMessage}`);
      
      // Detailed error diagnostics
      console.error(`${logPrefix} Template Resolution Diagnostics:`, {
        foreachModeActive: context.iterationTracking?.executionMode === 'foreach',
        iterationNumber: context.iterationTracking?.currentIndex,
        inputSource,
        inputValueType: typeof inputValue,
        inputValueIsNull: inputValue === null,
        inputValueIsUndefined: inputValue === undefined,
        dataForTemplateNull: inputValue === null,
        dataForTemplateUndefined: inputValue === undefined,
        originalTemplate: nodeContent.prompt || ''
      });
      
      setNodeState(nodeId, {
        status: 'error',
        error: errorMessage,
        executionId
      });
      
      throw new Error(errorMessage);
    }

    // VALIDATION: Final check before LLM execution to ensure everything is ready
    console.log(`[LLM EXECUTION] ${nodeId} READY TO EXECUTE:`, { 
      prompt: resolvedPrompt.substring(0, 200) + (resolvedPrompt.length > 200 ? '...' : ''),
      executionId, 
      iterationItem: context.iterationItem ? 
        (typeof context.iterationItem === 'object' ? 
          JSON.stringify(context.iterationItem).substring(0, 100) : 
          String(context.iterationItem)) : 'none',
      iterationIndex: context.iterationTracking?.currentIndex,
      inputSource
    });

    console.log(`${logPrefix} Using model "${nodeContent.model}" with temperature ${nodeContent.temperature}`);

    // Prepare model settings
    const provider = nodeContent.provider || 'ollama';
    const model = nodeContent.model || 'llama3';
    const temperature = nodeContent.temperature !== undefined ? nodeContent.temperature : 0.7;
    const ollamaUrl = nodeContent.ollamaUrl || 'http://localhost:11434';

    // LLM Call implementation based on provider
    let result: string;
    
    if (provider === 'ollama') {
      // Ollama API call
      console.log(`${logPrefix} Calling Ollama API at ${ollamaUrl} for model ${model}`);
      console.log(`${logPrefix} Final prompt being sent:`, resolvedPrompt);
      
      try {
        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            prompt: resolvedPrompt,
            stream: false,
            temperature: temperature,
          }),
        });

        if (!response.ok) {
          throw new Error(`Ollama API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        result = data.response;
        
        // Successful result handling
        console.log(`${logPrefix} Received result:`, result.substring(0, 100) + (result.length > 100 ? '...' : ''));
      } catch (error: any) {
        console.error(`${logPrefix} API error:`, error);
        throw new Error(`Ollama API error: ${error.message}`);
      }
    } else if (provider === 'openai') {
      // OpenAI integration would go here
      throw new Error('OpenAI provider not yet implemented');
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // Update state with success
    setNodeState(nodeId, {
      status: 'success',
      result: {
        text: result,
        model: model,
        provider: provider,
      },
      executionId
    });

    // CRITICAL FIX: Add verification log to confirm state update was requested
    console.log(`${logPrefix} CRITICAL: Setting success state with executionId ${executionId}`, {
      statusSet: 'success',
      resultProvided: true,
      executionIdProvided: !!executionId,
      inForeachMode: context.iterationTracking?.executionMode === 'foreach',
      iterationIndex: context.iterationTracking?.currentIndex,
      totalItems: context.iterationTracking?.totalItems
    });

    // Return the LLM result
    return {
      text: result,
      model: model,
      provider: provider,
    };
  } catch (error: any) {
    console.error(`${logPrefix} Error:`, error);
    
    // Update state with error
    setNodeState(nodeId, {
      status: 'error',
      error: error.message || 'Unknown error executing LLM model',
      executionId
    });
    
    throw error;
  }
} 