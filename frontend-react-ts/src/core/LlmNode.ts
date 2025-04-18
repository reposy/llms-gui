import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { LLMNodeContent, useNodeContentStore } from '../store/useNodeContentStore.ts';
import { runLLM, LLMResponse } from '../services/llmService.ts';
import { readFileAsBase64 } from '../utils/files.ts';

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
    this.context?.log(`${this.type}(${this.id}): Entering execute`); 

    const currentProps = this.property; // Use the property directly

    this.context?.log(`[DEBUG] ${this.type}(${this.id}): Checking properties: ${JSON.stringify(currentProps)}`); 

    const providerValue = currentProps?.provider; // Optional chaining for safety
    const modelValue = currentProps?.model;

    this.context?.log(`[DEBUG] ${this.type}(${this.id}): Raw provider: '${providerValue}', Raw model: '${modelValue}'`);

    // Validate necessary properties are present
    if (!providerValue || !modelValue) { 
      const errorMsg = "Missing required properties: provider or model.";
      this.context?.markNodeError(this.id, errorMsg);
      this.context?.log(`${this.type}(${this.id}): Error - ${errorMsg}. Properties were: ${JSON.stringify(currentProps)}`);
      return null; 
    }
    
    // Now we know providerValue and modelValue are truthy strings
    const provider = providerValue as 'ollama' | 'openai'; // Cast now safer
    const model = modelValue as string;
    const prompt = currentProps.prompt ?? ''; 
    const temperature = currentProps.temperature ?? 0.7; 
    const ollamaUrl = currentProps.ollamaUrl; 
    const openaiApiKey = currentProps.openaiApiKey; 
    const mode = currentProps.mode ?? 'text';
    
    this.context?.log(`${this.type}(${this.id}): Mode: ${mode}, Provider: ${provider}, Model: ${model}`);

    try {
      let llmResult: LLMResponse | null = null;
      let filledPrompt: string; // Declare variable for prompt

      // --- Vision Mode Handling ---
      if (mode === 'vision') {
        let inputArray: any[] = [];
        let treatAsText = false;

        // Check if input is a single valid item or an array of items
        if (Array.isArray(input)) {
            inputArray = input;
        } else if (input instanceof File) { // Accept File object directly
            inputArray = [input]; 
        } else if (typeof input === 'string') {
            // TODO: Handle string paths - needs access to the actual File object
            // For now, we cannot process string paths directly in the browser to get Base64
            this.context?.log(`${this.type}(${this.id}): Warning - Received string path ('${input}') for vision mode. Cannot get Base64. Treating as text.`);
            treatAsText = true;
        } else if (input && typeof input === 'object' && 'path' in input && 'name' in input) {
             // Handle FileLikeObject if needed, assuming it has enough info or a File reference
             // For now, treat as text if we don't have the File object.
             this.context?.log(`${this.type}(${this.id}): Warning - Received FileLikeObject without direct File access. Treating as text.`);
            treatAsText = true; 
        } else {
            // Invalid input for vision mode
            this.context?.log(`${this.type}(${this.id}): Warning - Vision mode received invalid input type (${typeof input}). Treating as text mode.`);
            treatAsText = true; // Fallback to text mode
        }

        if (!treatAsText) {
            this.context?.log(`${this.type}(${this.id}): Vision mode processing input: ${JSON.stringify(inputArray.map(f => f instanceof File ? f.name : f))}`);

            // Filter for actual File objects
            const fileObjects = inputArray.filter((item): item is File => item instanceof File);
            
            if (fileObjects.length === 0) {
                 this.context?.log(`${this.type}(${this.id}): Warning - No valid File objects found in input for Base64 conversion. Treating as text.`);
                 treatAsText = true;
            } else {
                try {
                    // Convert File objects to Base64 strings
                    this.context?.log(`${this.type}(${this.id}): Converting ${fileObjects.length} files to Base64...`);
                    const base64Promises = fileObjects.map(file => readFileAsBase64(file));
                    const base64Images = await Promise.all(base64Promises);
                    
                    // We might need to strip the data URL prefix (e.g., "data:image/png;base64,") for the ollama library
                    const base64DataOnly = base64Images.map(dataUrl => dataUrl.split(',')[1]);

                    this.context?.log(`${this.type}(${this.id}): Successfully converted images to Base64.`);

                    // Call runLLM with Base64 image data
                    llmResult = await runLLM({
                      provider,
                      model,
                      prompt: prompt, // Pass the original prompt for vision
                      temperature,
                      ollamaUrl,
                      openaiApiKey,
                      images: base64DataOnly // Pass the Base64 encoded data array
                    });

                } catch (base64Error) {
                    this.context?.log(`${this.type}(${this.id}): Error converting files to Base64: ${base64Error}. Falling back to text mode.`);
                    treatAsText = true;
                }
            }
        }

        // If vision mode failed or decided to treat as text
        if (treatAsText) {
             this.context?.log(`${this.type}(${this.id}): Falling back to text mode execution.`);
             filledPrompt = this.resolvePrompt(input); // Use resolvePrompt here as well
             this.context?.log(`${this.type}(${this.id}): Resolved prompt for text fallback: ${filledPrompt.substring(0, 100)}...`);
             llmResult = await runLLM({
                provider,
                model,
                prompt: filledPrompt, // Use the input-replaced prompt for text mode
                temperature,
                ollamaUrl, 
                openaiApiKey,
                // No images passed for text mode
              });
        }

      } else {
        // --- Text Mode Handling ---
        this.context?.log(`${this.type}(${this.id}): Text mode execution using runLLM`);
        filledPrompt = this.resolvePrompt(input); // Call resolvePrompt here
        this.context?.log(`${this.type}(${this.id}): Resolved prompt: ${filledPrompt.substring(0, 100)}...`);
        llmResult = await runLLM({
          provider,
          model,
          prompt: filledPrompt,
          temperature,
          ollamaUrl, 
          openaiApiKey 
          // No images passed for text mode
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