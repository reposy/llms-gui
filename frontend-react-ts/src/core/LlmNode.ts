import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { LLMNodeContent, useNodeContentStore } from '../store/useNodeContentStore.ts';
import { runLLM, LLMResponse } from '../services/llmService.ts';
import { getImageFilePath } from '../utils/files.ts';

/**
 * LLM Node properties
 */
export interface LlmNodeProperty {
  prompt: string;
  temperature: number;
  model: string;
  provider: string;
  ollamaUrl?: string;
  openaiApiKey?: string;
  mode?: 'text' | 'vision';
  nodeFactory?: any;
  [key: string]: any;
}

/**
 * LLM node for generating text via LLM providers
 */
export class LlmNode extends Node {
  declare property: LLMNodeContent;

  constructor(id: string, property: Record<string, any> = {}, context?: FlowExecutionContext) {
    super(id, 'llm', property, context);
  }

  /**
   * Resolve the prompt template with the input value
   */
  private resolvePrompt(input: any): string {
    let prompt = this.property.prompt;
    const nodeContent = useNodeContentStore.getState().getNodeContent<LLMNodeContent>(this.id, this.type);
    if (nodeContent.prompt) {
      prompt = nodeContent.prompt;
    }
    
    // Replace {{input}} with the actual input
    if (typeof input === 'string') {
      return prompt.replace(/\{\{input\}\}/g, input);
    } else if (Array.isArray(input)) {
      const textInput = input.map(item => {
        if (item === null || item === undefined) return 'null';
        if (typeof item === 'object') return JSON.stringify(item, null, 2);
        return String(item);
      }).join('\n');
      this.context?.log(`LlmNode(${this.id}): Array input converted to text: ${textInput.substring(0, 100)}...`);
      return prompt.replace(/\{\{input\}\}/g, textInput);
    } else if (input && typeof input === 'object') {
       try {
         return prompt.replace(/\{\{input\}\}/g, JSON.stringify(input, null, 2));
       } catch (e) {
         this.context?.log(`LlmNode(${this.id}): Failed to stringify object input, using placeholder.`);
         return prompt.replace(/\{\{input\}\}/g, '[Object Input]');
       }
    } else {
      // Handle null, undefined, numbers, booleans etc.
      return prompt.replace(/\{\{input\}\}/g, String(input ?? ''));
    }
  }

  /**
   * Execute the LLM node
   * @param input The input to process
   * @returns The LLM response
   */
  async execute(input: any): Promise<string | null> {
    this.context?.log(`${this.type}(${this.id}): Executing`);
    
    // Get the latest content directly from the store within execute
    const nodeContent = useNodeContentStore.getState().getNodeContent<LLMNodeContent>(this.id, this.type);

    // Validate necessary properties are present from the store
    if (!nodeContent.provider || !nodeContent.model || !nodeContent.prompt) {
      const errorMsg = "Missing required properties: provider, model, or prompt.";
      this.context?.markNodeError(this.id, errorMsg);
      this.context?.log(`${this.type}(${this.id}): Error - ${errorMsg}`);
      return null;
    }

    const { 
      provider, 
      model, 
      temperature = 0.7,
      prompt,
      ollamaUrl, 
      openaiApiKey, 
      mode 
    } = nodeContent;
    
    this.context?.log(`${this.type}(${this.id}): Mode: ${mode}, Provider: ${provider}, Model: ${model}`);

    try {
      let llmResult: LLMResponse | null = null;
      const filledPrompt = this.resolvePrompt(input);
      this.context?.log(`${this.type}(${this.id}): Resolved prompt: ${filledPrompt.substring(0, 100)}...`);

      if (mode === 'vision' && Array.isArray(input)) {
        const imageItems = input
          .map(item => {
            // Handle both string paths and FileLikeObjects
            if (typeof item === 'string') {
              // Assume string is a path
              return { path: item, name: item.split('/').pop() || item }; 
            } else if (item && typeof item === 'object' && 'path' in item && 'name' in item) {
              return item as { path: string; name: string };
            } else if (item instanceof File) { // Handle actual File objects if they appear
              // Need a way to get the persistent path if it's just a File object
              // For now, use the name, assuming it's in the upload dir.
              // This might need adjustment based on how File objects are stored/referenced.
              console.warn(`LlmNode(${this.id}): Received File object, using name to construct path.`);
              const filePathInfo = getImageFilePath(item); // Use the function for File objects
              return filePathInfo;
            }
            return null;
          })
          .filter((item): item is { path: string; name: string } => item !== null && !!item.path && item.path.length > 0);
          
        // Get just the paths for the API call (assuming API needs paths)
        const imagePaths = imageItems.map(item => item.path);

        if (imagePaths.length === 0) {
          throw new Error("Vision mode requires at least one valid image path or FileLikeObject in the input array.");
        }
        
        this.context?.log(`${this.type}(${this.id}): Vision mode with ${imagePaths.length} images: [${imagePaths.join(', ')}]`);
        
        // TODO: Implement vision call using appropriate service/function when available
        const errorMsg = `Vision mode for provider '${provider}' is not currently implemented or service function is missing.`;
        this.context?.markNodeError(this.id, errorMsg);
        this.context?.log(`${this.type}(${this.id}): Error - ${errorMsg}`);
        return null;

      } else {
        // Text mode
        if (mode === 'vision') {
          this.context?.log(`${this.type}(${this.id}): Warning - Vision mode expects an array input, but received non-array. Treating as text mode.`);
        }
        this.context?.log(`${this.type}(${this.id}): Text mode execution using runLLM`);

        llmResult = await runLLM({
          provider,
          model,
          prompt: filledPrompt,
          temperature,
          ollamaUrl, 
          openaiApiKey 
        });
      }

      if (!llmResult) {
         throw new Error('LLM call returned null or failed unexpectedly.');
      }

      const resultText = llmResult.response;
      this.context?.log(`${this.type}(${this.id}): Execution successful, result length: ${resultText.length}`);
      this.context?.storeOutput(this.id, resultText);
      return resultText;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.markNodeError(this.id, errorMessage);
      this.context?.log(`${this.type}(${this.id}): Error - ${errorMessage}`);
      return null;
    }
  }
} 