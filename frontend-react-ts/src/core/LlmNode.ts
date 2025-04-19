import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { LLMNodeContent, useNodeContentStore } from '../store/useNodeContentStore.ts';
import { runLLM } from '../services/llmService.ts';
import { LLMRequestParams } from '../services/llm/types.ts';
import { readFileAsBase64 } from '../utils/data/fileUtils.ts';

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
         // For objects that are not Files, stringify them
         if (!(input instanceof File) && !('path' in input && 'name' in input)) {
             return prompt.replace(/\{\{input\}\}/g, JSON.stringify(input, null, 2));
         } else {
             // For File or FileLikeObject, maybe use a placeholder or filename?
             const fileName = (input as any).name || '[File Input]';
             this.context?.log(`LlmNode(${this.id}): Replacing {{input}} with file name: ${fileName}`);
             return prompt.replace(/\{\{input\}\}/g, fileName); // Or handle differently?
         }
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
   * Generates a prefix string based on the input files for vision mode.
   * Returns '[filename.ext] ' for single file input.
   * Returns '[file1.jpg, file2.png] ' for array input.
   * Returns '' otherwise.
   */
  private _getResultPrefix(input: any): string {
    if (this.property.mode !== 'vision') {
      return ''; // Only apply prefix in vision mode
    }

    if (input instanceof File) {
      return `[${input.name}] `;
    } else if (Array.isArray(input)) {
      const filenames = input
        .filter((item): item is File => item instanceof File)
        .map(file => file.name);
      if (filenames.length > 0) {
        return `[${filenames.join(', ')}] `;
      }
    }

    return ''; // No applicable prefix found
  }

  /**
   * Execute the LLM node
   * @param input The input to process
   * @returns The LLM response text or null on error
   */
  async execute(input: any): Promise<string | null> {
    this.context?.log(`${this.type}(${this.id}): Entering execute`); 
    this.context?.markNodeRunning(this.id);

    // --- Get properties and validate --- 
    const currentProps = this.property;
    const provider = currentProps?.provider;
    const model = currentProps?.model;
    const mode = currentProps.mode ?? 'text';
    const prompt = currentProps.prompt ?? '';
    
    if (!provider || !model) {
      const errorMsg = "Missing required properties: provider or model.";
      this.context?.markNodeError(this.id, errorMsg);
      this.context?.log(`${this.type}(${this.id}): Error - ${errorMsg}. Properties were: ${JSON.stringify(currentProps)}`);
      return null;
    }
    this.context?.log(`${this.type}(${this.id}): Mode: ${mode}, Provider: ${provider}, Model: ${model}`);

    try {
      // --- Prepare input data (images and prompt) --- 
      let imageData: { base64: string, mimeType: string }[] | undefined = undefined;
      let finalPrompt = prompt;

      if (mode === 'vision') {
        let inputArray: any[] = [];
        if (Array.isArray(input)) {
            inputArray = input;
        } else if (input instanceof File) {
            inputArray = [input];
        } else if (input && typeof input === 'object' && 'path' in input && 'name' in input) {
            // TODO: How to handle FileLikeObject - needs access to the actual File
            this.context?.log(`${this.type}(${this.id}): Warning - FileLikeObject received, cannot process for vision without File.`);
            inputArray = []; // Cannot process
        } else if (typeof input === 'string' && /.(jpg|jpeg|png|gif|bmp)$/i.test(input)) {
            // TODO: Handle string paths? Needs access to File object.
            this.context?.log(`${this.type}(${this.id}): Warning - Image path string received, cannot process for vision without File.`);
            inputArray = []; // Cannot process
        } else {
           this.context?.log(`${this.type}(${this.id}): Vision mode selected, but input is not an image or array of images. Input type: ${typeof input}`);
           // Proceed without images, or potentially error?
           // For now, let's proceed, llmService won't get images.
        }

        const fileObjects = inputArray.filter((item): item is File => item instanceof File);
        if (fileObjects.length > 0) {
          try {
            this.context?.log(`${this.type}(${this.id}): Converting ${fileObjects.length} files to Base64...`);
            const fileReadPromises = fileObjects.map(async (file) => {
              const base64 = await readFileAsBase64(file);
              return {
                base64: base64.split(',')[1], // Extract only base64 data
                mimeType: file.type // Include the MIME type
              };
            });
            imageData = await Promise.all(fileReadPromises);
            this.context?.log(`${this.type}(${this.id}): Successfully converted images to Base64 with MIME types.`);
          } catch (base64Error) {
            this.context?.log(`${this.type}(${this.id}): Error converting files to Base64: ${base64Error}. Proceeding without images.`);
            // Continue without images
          }
        } else {
             this.context?.log(`${this.type}(${this.id}): No valid File objects found for vision mode.`);
        }
      } else { // mode === 'text' or fallback
        finalPrompt = this.resolvePrompt(input);
        this.context?.log(`${this.type}(${this.id}): Resolved prompt for text mode: ${finalPrompt.substring(0, 100)}...`);
      }

      // --- Validate vision input and prepare LLM params --- 
      if (mode === 'vision' && (!imageData || imageData.length === 0)) {
        const errorMsg = "Vision mode requires valid image input.";
        this.context?.log(`${this.type}(${this.id}): Error - ${errorMsg}`);
        this.context?.markNodeError(this.id, errorMsg);
        return null;
      }

      const params: LLMRequestParams = {
        provider,
        model,
        prompt: finalPrompt,
        temperature: currentProps.temperature ?? 0.7,
        ollamaUrl: currentProps.ollamaUrl,
        openaiApiKey: currentProps.openaiApiKey,
        images: imageData
      };
      this.context?.log(`${this.type}(${this.id}): Calling llmService...`);

      // --- Call LLM Service --- 
      const llmResult = await runLLM(params);
      if (!llmResult) { throw new Error('LLM service returned null.'); }

      // --- Process and prepend prefix to the result --- 
      let resultText = llmResult.response;
      const prefix = this._getResultPrefix(input);
      if (prefix) {
        resultText = prefix + resultText;
        this.context?.log(`${this.type}(${this.id}): Prepended prefix: ${prefix.substring(0, 50)}...`);
      }

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