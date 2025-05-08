import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { useNodeContentStore } from '../store/useNodeContentStore.ts';
import { LLMNodeContent } from '../types/nodes.ts';
import { runLLM } from '../services/llmService.ts';
import { LLMRequestParams } from '../services/llm/types.ts';
import { filterImageFiles, hasImageExtension } from '../utils/data/fileUtils.ts';

/**
 * Represents the prepared inputs for the LLM service call.
 */
interface PreparedLlmInputs {
  finalPrompt: string;
  inputFileObjects: File[] | undefined;
  textInputs: string[]; // Keep track of extracted text for validation purposes
}

/**
 * LLM node for generating text via LLM providers
 */
export class LlmNode extends Node {
  declare property: LLMNodeContent;

  constructor(id: string, property: Record<string, any> = {}, context?: FlowExecutionContext) {
    super(id, 'llm', property);
    
    // 생성자에서 context를 명시적으로 설정 (NodeFactory에서 전달될 때 사용됨)
    if (context) {
      this.context = context;
    }
  }

  /**
   * Resolve the prompt template with the input value
   */
  private resolvePrompt(input: any): string {
    let prompt = this.property.prompt;
    const nodeContent = useNodeContentStore.getState().getNodeContent(this.id, this.type) as LLMNodeContent;
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
      this._log(`Array input converted to text: ${textInput.substring(0, 100)}...`);
      return prompt.replace(/\{\{input\}\}/g, textInput);
    } else if (input && typeof input === 'object') {
       try {
         // For objects that are not Files, stringify them
         if (!(input instanceof File) && !('path' in input && 'name' in input)) {
             return prompt.replace(/\{\{input\}\}/g, JSON.stringify(input, null, 2));
         } else {
             // For File or FileLikeObject, maybe use a placeholder or filename?
             const fileName = (input as any).name || '[File Input]';
             this._log(`Replacing {{input}} with file name: ${fileName}`);
             return prompt.replace(/\{\{input\}\}/g, fileName); // Or handle differently?
         }
       } catch (e) {
         this._log('Failed to stringify object input, using placeholder.');
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
   * Validates that required node properties (provider, model) are set.
   * @returns An error message string if validation fails, otherwise null.
   */
  private _validateRequiredProperties(): string | null {
      const provider = this.property?.provider;
      const model = this.property?.model;

      if (!provider || !model) {
          const errorMsg = "Missing required properties: provider or model.";
          this._log(`Error - ${errorMsg}. Properties were: ${JSON.stringify(this.property)}`);
          return errorMsg;
      }
      return null; // Validation passed
  }

  /**
   * Prepares the final prompt, image file objects, and extracted text inputs
   * based on the input data, mode, and base prompt.
   * @param input The raw input to the node.
   * @param mode The execution mode ('text' or 'vision').
   * @param basePrompt The initial prompt string from node properties.
   * @returns An object containing the prepared inputs.
   */
  private _prepareLlmInputs(input: any, mode: 'text' | 'vision', basePrompt: string): PreparedLlmInputs {
      let finalPrompt = basePrompt;
      let inputFileObjects: File[] | undefined = undefined;
      let textInputs: string[] = [];

      // 1. Input is Array
      if (Array.isArray(input)) {
          this._log('Input is Array.');
          if (mode === 'vision') {
              const imageFiles: File[] = [];
              input.forEach(item => {
                  if (typeof item === 'string') {
                      textInputs.push(item);
                  } else if (item instanceof File && item.type.startsWith('image/')) {
                      imageFiles.push(item);
                  } else if (item instanceof File) {
                      this._log(`Skipping non-image file in vision mode: ${item.name}`);
                  }
              });
              inputFileObjects = imageFiles;

              if (textInputs.length > 0) {
                  const combinedTextInput = textInputs.join('\n');
                  finalPrompt = this.resolvePrompt(combinedTextInput);
              } else {
                  finalPrompt = basePrompt; // Use original if no text found
              }
              this._log(`Vision mode (Array) - Found ${inputFileObjects?.length ?? 0} images, ${textInputs.length} text pieces.`);
          } else { // mode === 'text'
              finalPrompt = this.resolvePrompt(input); // resolvePrompt handles array for text mode
          }

      // 2. Input is File
      } else if (input instanceof File) {
          this._log(`Input is File: ${input.name}`);
          if (mode === 'vision') {
              if (input.type.startsWith('image/')) {
                  inputFileObjects = [input];
                  finalPrompt = basePrompt; // Use original prompt for single image
              } else {
                  // Treat non-image file as text input (using filename)
                  const filenameText = input.name;
                  textInputs.push(filenameText);
                  finalPrompt = this.resolvePrompt(filenameText);
                  inputFileObjects = []; // No image file to pass
                  this._log('Vision mode (File) - Input File is not an image, treating as text.');
              }
          } else { // mode === 'text'
              finalPrompt = this.resolvePrompt(input); // resolvePrompt uses filename for text mode
          }

      // 3. Input is String
      } else if (typeof input === 'string') {
          this._log('Input is String.');
          textInputs.push(input); // Treat string as text input regardless of mode
          finalPrompt = this.resolvePrompt(input);
          inputFileObjects = []; // Cannot use string as image input
          if (mode === 'vision' && hasImageExtension(input)) {
               this._log('Vision mode (String) - Warning: Image path string received, cannot process as image. Treated as text.');
          }

      // 4. Input is Object (and not File or Array)
      } else if (input && typeof input === 'object') {
          this._log('Input is Object.');
          // Treat object as text input (resolvePrompt handles stringification)
          const objectAsString = JSON.stringify(input, null, 2); // Example stringification
          textInputs.push(objectAsString); // Store the stringified version
          finalPrompt = this.resolvePrompt(input);
          inputFileObjects = []; // Cannot use plain object as image input
          if (mode === 'vision') {
              this._log('Vision mode (Object) - Treating object as text.');
          }

      // 5. Other Input Types (null, undefined, number, boolean)
      } else {
          this._log(`Input is ${typeof input}.`);
          const stringifiedInput = String(input ?? ''); // Convert to string
          textInputs.push(stringifiedInput); // Store the stringified version
          finalPrompt = this.resolvePrompt(input); // resolvePrompt handles stringification
          inputFileObjects = []; // Cannot use this type as image input
          if (mode === 'vision') {
               this._log(`Vision mode (${typeof input}) - Treating as text.`);
          }
      }

      return { finalPrompt, inputFileObjects, textInputs };
  }

  /**
   * Validates the prepared inputs, especially for vision mode.
   * Checks if vision mode was intended but ended up with no usable content.
   * @param mode The execution mode ('text' or 'vision').
   * @param originalInput The original input passed to the execute method.
   * @param preparedInputs The result from _prepareLlmInputs.
   * @returns An error message string if validation fails, otherwise null.
   */
  private _validatePreparedInputs(
      mode: 'text' | 'vision',
      originalInput: any,
      preparedInputs: PreparedLlmInputs
  ): string | null {
      const { inputFileObjects, textInputs } = preparedInputs;

      if (mode === 'vision' && (!inputFileObjects || inputFileObjects.length === 0)) {
          // Case 1: Input was an array, but yielded neither images nor text.
          if (Array.isArray(originalInput) && textInputs.length === 0) {
              return "Vision mode received array input but found neither valid image files nor text content.";
          }
          // Case 2: Input was a single file, but it wasn't an image type.
          if (originalInput instanceof File && !originalInput.type.startsWith('image/')) {
              return `Vision mode received a file (${originalInput.name}) that is not an image.`;
          }
          // Log if proceeding without images, but text was extracted from non-array/file inputs
          if (!Array.isArray(originalInput) && !(originalInput instanceof File) && textInputs.length > 0) {
              this._log('Vision mode proceeding with text only (input was not Array or File).');
          }
          // Log if proceeding without images, but text was extracted from an array
          else if (Array.isArray(originalInput) && textInputs.length > 0) {
               this._log('Vision mode proceeding with text only (no images found in array).');
          }
      }
      // If it's text mode, or vision mode with images/text, validation passes
      return null;
  }

  /**
   * Validates core node properties and prepares initial configuration.
   * @throws Error if required properties (provider, model) are missing.
   * @returns Object containing mode and basePrompt.
   */
  private _validateAndPrepareNodeConfig(): { mode: 'text' | 'vision'; basePrompt: string } {
    const propError = this._validateRequiredProperties();
    if (propError) {
      this.context?.markNodeError(this.id, propError);
      this._log(`Error - ${propError}`);
      throw new Error(propError);
    }

    const mode = this.property.mode ?? 'text';
    const basePrompt = this.property.prompt ?? '';
    this._log(`Config - Mode: ${mode}, Provider: ${this.property.provider}, Model: ${this.property.model}`);
    return { mode, basePrompt };
  }

  /**
   * Calls the LLM service with prepared parameters and formats the result.
   * @param params The parameters for the LLM service call.
   * @param originalInput The original input passed to the execute method (used for prefix generation).
   * @throws Error if LLM service returns null or undefined.
   * @returns The formatted result text from the LLM.
   */
  private async _callLlmServiceAndFormatResult(params: LLMRequestParams, originalInput: any): Promise<string> {
    this._log(`Calling LLM service with provider: ${params.provider}, model: ${params.model}, mode: ${params.mode}`);

    const llmResult = await runLLM(params);
    if (llmResult === null || llmResult === undefined) {
      const errorMsg = 'LLM service returned null or undefined unexpectedly.';
      this.context?.markNodeError(this.id, errorMsg);
      this._log(`Error - ${errorMsg}`);
      throw new Error(errorMsg);
    }

    let resultText = llmResult.response;
    const prefix = this._getResultPrefix(originalInput); // Prefix based on original input type
    if (prefix) {
      resultText = prefix + resultText;
      this._log(`Prepended prefix: ${prefix.substring(0, 50)}...`);
    }
    this._log(`LLM call successful, result length: ${resultText.length}`);
    return resultText;
  }

  /**
   * Main execution method for the LLMNode.
   * Validates properties, prepares inputs, calls the LLM service, and handles results.
   * @param input The input data, which can be a string, File, or array of these.
   * @returns The generated text from the LLM, or null if an error occurs.
   */
  async execute(input: any): Promise<string | null> {
    this._log('Executing LLMNode');

    const validationError = this._validateRequiredProperties();
    if (validationError) {
      this.context?.markNodeError(this.id, validationError);
      // _log for this error is already in _validateRequiredProperties
      return null;
    }

    const config = this._validateAndPrepareNodeConfig();
    if (!config) { // Error already logged and marked in the helper
      return null;
    }
    const { mode, basePrompt } = config;
    this._log(`Mode: ${mode}, Base prompt: ${basePrompt.substring(0, 50)}...`);

    const preparedInputs = this._prepareLlmInputs(input, mode, basePrompt);
    this._log(`Prepared LLM inputs. Final prompt: ${preparedInputs.finalPrompt.substring(0,50)}..., Images: ${preparedInputs.inputFileObjects?.length ?? 0}`);

    const preparedInputValidationError = this._validatePreparedInputs(mode, input, preparedInputs);
    if (preparedInputValidationError) {
      this.context?.markNodeError(this.id, preparedInputValidationError);
      this._log(`Error after preparing inputs: ${preparedInputValidationError}`);
      return null;
    }

    // If vision mode, but no images and no text prompt, it's an issue.
    if (mode === 'vision' && 
        (!preparedInputs.inputFileObjects || preparedInputs.inputFileObjects.length === 0) && 
        (!preparedInputs.finalPrompt || preparedInputs.finalPrompt.trim() === '' || preparedInputs.finalPrompt.trim() === basePrompt.trim())) {
      const errorMsg = "Vision mode requires at least one image or a non-empty prompt if no images are provided.";
      this.context?.markNodeError(this.id, errorMsg);
      this._log(`Error: ${errorMsg}`);
      return null;
    }

    const params: LLMRequestParams = {
      provider: this.property.provider!,
      model: this.property.model!,
      prompt: preparedInputs.finalPrompt,
      temperature: this.property.temperature,
      maxTokens: this.property.maxTokens,
      mode: mode, // Pass the determined mode
      inputFiles: preparedInputs.inputFileObjects, // Pass the File objects for vision
      ollamaUrl: this.property.ollamaUrl,
      openaiApiKey: this.property.openaiApiKey,
    };

    try {
      const result = await this._callLlmServiceAndFormatResult(params, input);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.markNodeError(this.id, errorMessage);
      this._log(`Error during LLM service call: ${errorMessage}`);
      return null;
    }
  }
} 