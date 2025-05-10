import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { useNodeContentStore } from '../store/useNodeContentStore.ts';
import { LLMNodeContent } from '../types/nodes.ts';
import { runLLM } from '../services/llmService.ts';
import { LLMRequestParams } from '../services/llm/types.ts';
import { filterImageFiles, hasImageExtension } from '../utils/data/fileUtils.ts';
import { ExecutionContext } from '../types/execution';
import { FileMetadata, isImageFile, getFullFileUrl, LocalFileMetadata } from '../types/files';

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
  private imageMetadata: (FileMetadata | LocalFileMetadata)[] = [];

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
         // For objects that are not Files or file metadata, stringify them
         if (!(input instanceof File) && !('file' in input) && !('path' in input && 'name' in input)) {
             return prompt.replace(/\{\{input\}\}/g, JSON.stringify(input, null, 2));
         } else {
             // For File, LocalFileMetadata or FileLikeObject, use filename
             const fileName = (input as any).name || (input as any).originalName || '[File Input]';
             this._log(`Replacing {{input}} with file name: ${fileName}`);
             return prompt.replace(/\{\{input\}\}/g, fileName);
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
   * LLM에 전달할 이미지 메타데이터 준비
   * @param input 입력 데이터
   * @returns 이미지 메타데이터 배열
   */
  private _extractImageMetadata(input: any): (FileMetadata | LocalFileMetadata)[] {
    const metadata: (FileMetadata | LocalFileMetadata)[] = [];
    
    // 배열 입력 처리
    if (Array.isArray(input)) {
      input.forEach(item => {
        // LocalFileMetadata 객체 감지 및 이미지 확인
        if (item && typeof item === 'object' && 'objectUrl' in item && 'file' in item) {
          if (isImageFile(item as LocalFileMetadata)) {
            metadata.push(item as LocalFileMetadata);
            this._log(`Found local image metadata: ${(item as LocalFileMetadata).originalName}`);
          }
        }
        // FileMetadata 객체 감지 및 이미지 확인
        else if (item && typeof item === 'object' && 'url' in item && 'contentType' in item) {
          if (isImageFile(item as FileMetadata)) {
            metadata.push(item as FileMetadata);
            this._log(`Found image metadata: ${(item as FileMetadata).originalName}`);
          }
        }
      });
    } 
    // 단일 LocalFileMetadata 객체 처리
    else if (input && typeof input === 'object' && 'objectUrl' in input && 'file' in input) {
      if (isImageFile(input as LocalFileMetadata)) {
        metadata.push(input as LocalFileMetadata);
        this._log(`Found single local image metadata: ${(input as LocalFileMetadata).originalName}`);
      }
    }
    // 단일 FileMetadata 객체 처리
    else if (input && typeof input === 'object' && 'url' in input && 'contentType' in input) {
      if (isImageFile(input as FileMetadata)) {
        metadata.push(input as FileMetadata);
        this._log(`Found single image metadata: ${(input as FileMetadata).originalName}`);
      }
    }
    
    return metadata;
  }

  /**
   * 이미지 메타데이터를 마크다운 형식으로 변환
   * @returns 마크다운 이미지 참조 문자열
   */
  private _getImageMarkdown(): string {
    if (!this.imageMetadata.length) return '';
    
    return this.imageMetadata
      .map(img => {
        if ('objectUrl' in img) {
          // LocalFileMetadata의 경우 objectUrl 사용
          return `![${img.originalName}](${img.objectUrl})`;
        } else {
          // FileMetadata의 경우 기존 방식 유지
          return `![${img.originalName}](${getFullFileUrl(img.url)})`;
        }
      })
      .join('\n') + '\n\n';
  }

  /**
   * Generates a prefix string based on the input files for vision mode.
   * Returns file information for the response prefix.
   */
  private _getResultPrefix(input: any): string {
    if (this.property.mode !== 'vision') {
      return '';
    }
    
    // 이미지 메타데이터가 있는 경우 해당 정보 포함
    if (this.imageMetadata.length > 0) {
      return this.imageMetadata.map(img => `[${img.originalName}]`).join(' ') + '\n\n';
    }
    
    // 기존 File 객체 처리 유지 (호환성)
    if (input instanceof File) {
      return `[${input.name}]\n\n`;
    } else if (Array.isArray(input)) {
      const filenames = input
        .filter((item): item is File => item instanceof File)
        .map(file => file.name);
      if (filenames.length > 0) {
        return filenames.map(name => `[${name}]`).join(' ') + '\n\n';
      }
    }
    
    return '';
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
                  } else if (item && typeof item === 'object' && 'file' in item && 'objectUrl' in item) {
                      // LocalFileMetadata 처리
                      const fileMeta = item as LocalFileMetadata;
                      if (isImageFile(fileMeta)) {
                          imageFiles.push(fileMeta.file);
                      }
                  } else if (item instanceof File) {
                      this._log(`Skipping non-image file in vision mode: ${item.name}`);
                  }
              });
              inputFileObjects = imageFiles;

              if (textInputs.length > 0) {
                  const combinedTextInput = textInputs.join('\n');
                  finalPrompt = this.resolvePrompt(combinedTextInput);
              }
          } else { // text mode
              input.forEach(item => {
                  if (typeof item === 'string') {
                      textInputs.push(item);
                  } else if (item instanceof File) {
                      this._log(`File in text mode: ${item.name} - ignored, only file content would be used.`);
                  } else if (item && typeof item === 'object') {
                      // Try to stringify object for text mode
                      try {
                          const objJson = JSON.stringify(item, null, 2);
                          textInputs.push(objJson);
                      } catch (e) {
                          this._log(`Failed to stringify object for text input: ${e}`);
                      }
                  }
              });
              if (textInputs.length > 0) {
                  finalPrompt = this.resolvePrompt(textInputs.join('\n'));
              }
          }
      }
      // 2. Input is File
      else if (input instanceof File) {
          this._log(`Input is File: ${input.name}`);
          if (mode === 'vision' && input.type.startsWith('image/')) {
              inputFileObjects = [input];
          }
          finalPrompt = this.resolvePrompt(input);
      }
      // 3. Input is LocalFileMetadata
      else if (input && typeof input === 'object' && 'file' in input && 'objectUrl' in input) {
          const fileMeta = input as LocalFileMetadata;
          this._log(`Input is LocalFileMetadata: ${fileMeta.originalName}`);
          if (mode === 'vision' && isImageFile(fileMeta)) {
              inputFileObjects = [fileMeta.file];
          }
          finalPrompt = this.resolvePrompt(fileMeta);
      }
      // 4. Input is String
      else if (typeof input === 'string') {
          this._log('Input is String.');
          textInputs.push(input);
          finalPrompt = this.resolvePrompt(input);
      }
      // 5. Other Object
      else if (input && typeof input === 'object') {
          this._log('Input is Object.');
          try {
              const objJson = JSON.stringify(input, null, 2);
              textInputs.push(objJson);
              finalPrompt = this.resolvePrompt(objJson);
          } catch (e) {
              this._log(`Error stringifying object: ${e}`);
              finalPrompt = this.resolvePrompt('[Complex Object]');
          }
      }
      // 6. Other primitive types
      else {
          this._log(`Input is primitive type: ${typeof input}`);
          const stringValue = String(input ?? '');
          textInputs.push(stringValue);
          finalPrompt = this.resolvePrompt(stringValue);
      }

      return {
          finalPrompt,
          inputFileObjects,
          textInputs
      };
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

    // 이미지 메타데이터 추출
    this.imageMetadata = this._extractImageMetadata(input);
    
    // 입력 준비
    const preparedInputs = this._prepareLlmInputs(input, mode, basePrompt);
    this._log(`Prepared LLM inputs. Final prompt: ${preparedInputs.finalPrompt.substring(0,50)}..., Images: ${preparedInputs.inputFileObjects?.length ?? 0}`);

    // 입력 유효성 검사
    const preparedInputValidationError = this._validatePreparedInputs(mode, input, preparedInputs);
    if (preparedInputValidationError) {
      this.context?.markNodeError(this.id, preparedInputValidationError);
      this._log(`Error after preparing inputs: ${preparedInputValidationError}`);
      return null;
    }

    // 비전 모드이지만 이미지 없이 프롬프트도 없는 경우 오류
    if (mode === 'vision' && 
        (!preparedInputs.inputFileObjects || preparedInputs.inputFileObjects.length === 0) && 
        this.imageMetadata.length === 0 &&
        (!preparedInputs.finalPrompt || preparedInputs.finalPrompt.trim() === '' || preparedInputs.finalPrompt.trim() === basePrompt.trim())) {
      const errorMsg = "Vision mode requires at least one image or a non-empty prompt if no images are provided.";
      this.context?.markNodeError(this.id, errorMsg);
      this._log(`Error: ${errorMsg}`);
      return null;
    }

    // 로컬 이미지와 서버 이미지 분리
    const serverImages = this.imageMetadata.filter(img => !('objectUrl' in img)) as FileMetadata[];
    const localImages = this.imageMetadata.filter(img => 'objectUrl' in img) as LocalFileMetadata[];

    // API 호출 파라미터 구성
    const params: LLMRequestParams = {
      provider: this.property.provider!,
      model: this.property.model!,
      prompt: preparedInputs.finalPrompt,
      temperature: this.property.temperature,
      maxTokens: this.property.maxTokens,
      mode: mode,
      // 기존 File 객체 지원 (호환성) - 로컬 이미지가 없을 경우에만 사용
      inputFiles: localImages.length > 0 ? undefined : preparedInputs.inputFileObjects,
      // 이미지 메타데이터 추가
      imageMetadata: serverImages.length > 0 ? serverImages : undefined,
      // 로컬 이미지 메타데이터 추가
      localImages: localImages.length > 0 ? localImages : undefined,
      // 서비스별 설정
      ollamaUrl: this.property.ollamaUrl,
      openaiApiKey: this.property.openaiApiKey,
    };

    try {
      // LLM 서비스 호출
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