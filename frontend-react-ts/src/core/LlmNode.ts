import { Node } from '../core/Node';
import { setNodeContent, getNodeContent } from '../store/useNodeContentStore';
import { runLLM, isVisionModel, LLMMode } from '../api/llm';
import { extractImagesFromInput, handleRequest, processForEachOutput } from '../utils/vision';

/**
 * LLM node properties
 */
interface LlmNodeProperty {
  prompt: string;
  temperature: number;
  model: string;
  provider: string;
  ollamaUrl?: string;
  openaiApiKey?: string;
  mode?: LLMMode;
  // Runtime properties for node execution and graph traversal
  executionGraph?: Map<string, any>;
  nodes?: any[];
  edges?: any[];
  nodeFactory?: any;
}

/**
 * Interface for LLM node content in the store
 */
interface LlmNodeContent {
  prompt?: string;
  temperature?: number; 
  model?: string;
  provider?: string;
  ollamaUrl?: string;
  openaiApiKey?: string;
  mode?: LLMMode;
  content?: string;
  responseContent?: string;
  _forceUpdate?: number;
}

/**
 * LLM node that processes input through language models
 */
export class LlmNode extends Node {
  /**
   * Type assertion for the property
   */
  declare property: LlmNodeProperty;
  
  /**
   * Execute the input according to the LLM node's configuration
   * @param input The input to process with the language model
   * @returns The LLM response
   */
  async execute(input: any): Promise<any> {
    this.context.log(`LlmNode(${this.id}): Processing input with ${this.property.provider}/${this.property.model}`);
    
    try {
      // Sync properties from the content store
      this.syncPropertiesFromStore();
      
      // Validate and prepare for execution
      const mode = this.validateAndPrepareMode();
      
      // Process images if in vision mode
      const extractedImages = await this.processImagesIfNeeded(input, mode);
      
      // Resolve prompt template
      const resolvedPrompt = this.resolveTemplate(this.property.prompt, input);
      this.validatePrompt(resolvedPrompt);
      
      // Call the appropriate LLM API
      const response = await this.callAppropriateApi(mode, resolvedPrompt, extractedImages);
      
      // Format response with metadata
      const formattedResponse = this.formatResponse(response, mode);
      
      // Update node content in the store
      this.updateNodeContentInStore(formattedResponse);
      
      // Debug logs for graph structure
      this.logGraphDebugInfo();
      
      return formattedResponse;
    } catch (error) {
      this.context.log(`LlmNode(${this.id}): Error processing through LLM: ${error}`);
      this.context.markNodeError(this.id, String(error));
      throw error;
    }
  }
  
  /**
   * Sync properties from the content store
   */
  private syncPropertiesFromStore(): void {
    const latestContent = getNodeContent(this.id) as LlmNodeContent;
    this.context.log(`LlmNode(${this.id}): Syncing properties from content store`);
    
    // Update properties from store content
    this.property.prompt = latestContent.prompt ?? this.property.prompt ?? '';
    this.property.model = latestContent.model ?? this.property.model ?? 'llama3';
    this.property.temperature = latestContent.temperature ?? this.property.temperature ?? 0.7;
    this.property.provider = latestContent.provider ?? this.property.provider ?? 'ollama';
    this.property.ollamaUrl = latestContent.ollamaUrl ?? this.property.ollamaUrl;
    this.property.openaiApiKey = latestContent.openaiApiKey ?? this.property.openaiApiKey;
    this.property.mode = latestContent.mode ?? this.property.mode ?? 'text';
    
    this.context.log(`LlmNode(${this.id}): Properties after sync - provider: ${this.property.provider}, model: ${this.property.model}, mode: ${this.property.mode}`);
  }
  
  /**
   * Validate the mode and ensure the model supports vision if needed
   * @returns The validated mode ('text' or 'vision')
   */
  private validateAndPrepareMode(): LLMMode {
    const mode = this.property.mode || 'text';
    
    // Check if model supports vision mode
    const supportsVision = isVisionModel(this.property.provider as any, this.property.model);
    this.context.log(`LlmNode(${this.id}): Model ${this.property.model} ${supportsVision ? 'supports' : 'does not support'} vision features`);
    
    // If vision mode is selected, verify it's supported
    if (mode === 'vision' && !supportsVision) {
      this.context.log(`LlmNode(${this.id}): ERROR - Vision mode selected but model ${this.property.model} doesn't support vision features`);
      
      // Update the content store to set text mode
      setNodeContent(this.id, { mode: 'text' }, true);
      
      throw new Error(`모델 "${this.property.model}"은(는) 비전 기능을 지원하지 않습니다. 비전을 지원하는 모델로 변경하거나 텍스트 모드를 사용하세요.`);
    }
    
    // Log the raw prompt from properties before any processing
    this.context.log(`LlmNode(${this.id}): Raw prompt from property: "${this.property.prompt}"`);
    this.context.log(`LlmNode(${this.id}): Raw prompt length: ${this.property.prompt?.length || 0} characters`);
    
    // Check if prompt is undefined or empty
    if (!this.property.prompt) {
      this.context.log(`LlmNode(${this.id}): WARNING - Empty prompt in property!`);
      this.property.prompt = ''; // Set to empty string to avoid errors
    }
    
    return mode;
  }
  
  /**
   * Process images from input if in vision mode
   * @param input The input to process
   * @param mode The current LLM mode
   * @returns Array of extracted images if in vision mode, empty array otherwise
   */
  private async processImagesIfNeeded(input: any, mode: LLMMode): Promise<string[]> {
    // Only process images in vision mode
    if (mode !== 'vision') {
      return [];
    }
    
    this.context.log(`LlmNode(${this.id}): Extracting images from input for vision mode`);
    this.context.log(`LlmNode(${this.id}): Input type: ${typeof input}, isArray: ${Array.isArray(input)}`);
    
    // First process the input structure (especially for ForEach nodes)
    input = processForEachOutput(input);
    this.context.log(`LlmNode(${this.id}): After ForEach processing: ${typeof input}, isArray: ${Array.isArray(input)}`);
    
    if (input !== null && input !== undefined) {
      if (typeof input === 'object') {
        this.context.log(`LlmNode(${this.id}): Object keys: ${Object.keys(input)}`);
        
        // If input has a 'content' property that might contain the image
        if (input.content && typeof input.content === 'string' && 
            (input.content.startsWith('data:image/') || 
             input.content.match(/^[A-Za-z0-9+/=]+$/))) {
          this.context.log(`LlmNode(${this.id}): Found image in content property`);
          return [input.content];
        }
        
        // If input has a 'file' or 'image' property
        if (input.file || input.image) {
          this.context.log(`LlmNode(${this.id}): Found file/image property`);
          const fileOrImage = input.file || input.image;
          return await extractImagesFromInput(fileOrImage);
        }
      }
    }
    
    // Try to extract images from the original input
    const extractedImages = await extractImagesFromInput(input);
    
    // Log the results of extraction attempt
    this.context.log(`LlmNode(${this.id}): Extracted ${extractedImages.length} images`);
    if (extractedImages.length > 0) {
      const firstImagePreview = extractedImages[0].substring(0, 30) + '...';
      this.context.log(`LlmNode(${this.id}): First image preview: ${firstImagePreview}`);
    }
    
    // Check if we have any images
    if (extractedImages.length === 0) {
      this.context.log(`LlmNode(${this.id}): ERROR - No images found in input for vision mode`);
      this.context.log(`LlmNode(${this.id}): Input details: ${JSON.stringify(input, null, 2).substring(0, 200)}...`);
      
      // For better UX, automatically fall back to text mode in the UI
      setNodeContent(this.id, { mode: 'text' }, true);
      
      throw new Error('비전 모드는 이미지 입력이 필요합니다. InputNode에서 이미지를 연결하거나 Text 모드로 전환해주세요.');
    }
    
    this.context.log(`LlmNode(${this.id}): Found ${extractedImages.length} images for vision mode`);
    return extractedImages;
  }
  
  /**
   * Validate that the prompt is not empty
   * @param prompt The prompt to validate
   */
  private validatePrompt(prompt: string): void {
    // Log the resolved prompt
    this.context.log(`LlmNode(${this.id}): Resolved prompt: "${prompt}"`);
    this.context.log(`LlmNode(${this.id}): Resolved prompt length: ${prompt.length} characters`);
    
    // Defensive check - ensure we never send empty prompt
    if (!prompt || prompt.trim() === '') {
      const errorMsg = `Empty prompt after resolution. Original prompt: "${this.property.prompt}"`;
      this.context.log(`LlmNode(${this.id}): ERROR - ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
  
  /**
   * Call the appropriate LLM API based on mode
   * @param mode The LLM mode (text or vision)
   * @param prompt The resolved prompt
   * @param images Array of image data for vision mode
   * @returns The LLM response text
   */
  private async callAppropriateApi(mode: LLMMode, prompt: string, images: string[]): Promise<string> {
    if (mode === 'vision') {
      // Handle vision request
      this.context.log(`LlmNode(${this.id}): Calling vision API with ${images.length} images`);
      
      return handleRequest({
        provider: this.property.provider as any,
        model: this.property.model,
        prompt,
        input: images,
        mode: 'vision',
        temperature: this.property.temperature,
        baseUrl: this.property.ollamaUrl,
        logger: (msg: string) => this.context.log(msg)
      });
    } else {
      // Handle text request using the existing runLLM function
      this.context.log(`LlmNode(${this.id}): Calling text API`);
      
      const result = await runLLM({
        provider: this.property.provider as any,
        model: this.property.model,
        prompt,
        temperature: this.property.temperature,
        ollamaUrl: this.property.ollamaUrl,
        openaiApiKey: this.property.openaiApiKey,
        mode: 'text'
      });
      
      return result.response;
    }
  }
  
  /**
   * Format the response with mode and model information
   * @param response The raw response from the LLM
   * @param mode The LLM mode
   * @returns The formatted response
   */
  private formatResponse(response: string, mode: LLMMode): string {
    // Verify response is valid
    if (!response) {
      this.context.log(`LlmNode(${this.id}): Warning: Empty response received from API`);
    } else {
      this.context.log(`LlmNode(${this.id}): LLM response received: "${response.substring(0, 100)}..." (length: ${response.length})`);
    }
    
    // Add mode and model info to the response
    const formattedResponse = `[Mode: ${mode}] [Model: ${this.property.model}]\n\n${response || ''}`;
    return formattedResponse;
  }
  
  /**
   * Update the node's content in the store
   * @param response The formatted response to store
   */
  private updateNodeContentInStore(response: string): void {
    // Force update with timestamp to ensure UI renders the new content
    const contentUpdate: LlmNodeContent = { 
      content: response,
      _forceUpdate: Date.now() 
    };
    
    setNodeContent(this.id, contentUpdate, true);
    this.context.log(`LlmNode(${this.id}): Updated UI content with LLM response (length: ${response?.length || 0})`);
  }
  
  /**
   * Log debug information about the execution graph
   */
  private logGraphDebugInfo(): void {
    // DEBUG: Check execution graph property
    if (this.property.executionGraph) {
      this.context.log(`LlmNode(${this.id}): Execution graph is available (${this.property.executionGraph instanceof Map ? 'as Map' : 'not as Map'})`);
      if (this.property.executionGraph instanceof Map) {
        this.context.log(`LlmNode(${this.id}): Execution graph has ${this.property.executionGraph.size} nodes`);
        this.context.log(`LlmNode(${this.id}): Graph contains this node: ${this.property.executionGraph.has(this.id)}`);
        if (this.property.executionGraph.has(this.id)) {
          const graphNode = this.property.executionGraph.get(this.id);
          this.context.log(`LlmNode(${this.id}): Child IDs in graph: ${graphNode?.childIds.join(', ') || 'none'}`);
        }
      }
    } else {
      this.context.log(`LlmNode(${this.id}): WARNING - No execution graph available!`);
    }
    
    // DEBUG: Check nodes and edges properties
    if (this.property.nodes && this.property.edges) {
      this.context.log(`LlmNode(${this.id}): Nodes and edges properties are available`);
      this.context.log(`LlmNode(${this.id}): Node count: ${this.property.nodes.length}, Edge count: ${this.property.edges.length}`);
      
      // Find edges leaving this node
      const outgoingEdges = this.property.edges.filter(edge => edge.source === this.id);
      this.context.log(`LlmNode(${this.id}): Outgoing edges: ${outgoingEdges.length}`);
      outgoingEdges.forEach(edge => {
        this.context.log(`LlmNode(${this.id}): Edge ${edge.id}: ${edge.source} -> ${edge.target}`);
      });
    } else {
      this.context.log(`LlmNode(${this.id}): WARNING - Nodes or edges property is missing!`);
    }
  }

  /**
   * Resolve template placeholders in the prompt
   */
  private resolveTemplate(template: string, input: any): string {
    if (!template) {
      this.context.log(`LlmNode(${this.id}): resolveTemplate called with empty template`);
      return '';
    }
    
    try {
      // First, check if the template has any {{input}} placeholders
      const hasInputPlaceholder = /\{\{\s*input\s*\}\}/g.test(template);
      this.context.log(`LlmNode(${this.id}): Template contains {{input}} placeholder: ${hasInputPlaceholder}`);
      
      // If no placeholders, return the template as-is
      if (!hasInputPlaceholder) {
        this.context.log(`LlmNode(${this.id}): No placeholders found, using template as-is: "${template}"`);
        return template;
      }
      
      // If input is undefined or null, replace with a placeholder
      if (input === undefined || input === null) {
        this.context.log(`LlmNode(${this.id}): Input is ${input === null ? 'null' : 'undefined'}, replacing placeholder with '[NO_INPUT]'`);
        return template.replace(/\{\{\s*input\s*\}\}/g, '[NO_INPUT]');
      }
      
      // Safely convert input to string based on its type
      let inputStr = this.convertInputToString(input);
      
      // Replace {{input}} with the actual input
      let result = template.replace(/\{\{\s*input\s*\}\}/g, inputStr);
      
      // Log template resolution info
      this.logTemplateResolutionDetails(template, inputStr, result);
      
      return result;
    } catch (error) {
      this.context.log(`LlmNode(${this.id}): Error resolving template: ${error}`);
      
      // Fallback - return template as is with error note
      return `${template} [TEMPLATE_ERROR: ${error}]`;
    }
  }

  /**
   * Convert input to string based on its type
   */
  private convertInputToString(input: any): string {
    let inputStr = '';
    
    if (typeof input === 'string') {
      inputStr = input.trim() === '' ? '[EMPTY_STRING]' : input;
      this.context.log(`LlmNode(${this.id}): Input is string type, length: ${input.length}`);
    } else if (typeof input === 'object') {
      try {
        // Check if object is empty
        if (Object.keys(input).length === 0) {
          inputStr = '[EMPTY_OBJECT]';
          this.context.log(`LlmNode(${this.id}): Input is empty object`);
        } else {
          inputStr = JSON.stringify(input, null, 2);
          this.context.log(`LlmNode(${this.id}): Input is object, stringified to length: ${inputStr.length}`);
        }
      } catch (e) {
        this.context.log(`LlmNode(${this.id}): Error stringifying input: ${e}`);
        inputStr = '[OBJECT_STRINGIFY_ERROR]';
      }
    } else {
      inputStr = String(input);
      this.context.log(`LlmNode(${this.id}): Input is ${typeof input} type, converted to string`);
    }
    
    return inputStr;
  }

  /**
   * Log template resolution details
   */
  private logTemplateResolutionDetails(template: string, inputStr: string, result: string): void {
    this.context.log(`LlmNode(${this.id}): Template resolution details:`);
    this.context.log(`LlmNode(${this.id}): - Original template: "${template}"`);
    this.context.log(`LlmNode(${this.id}): - Template length: ${template.length}`);
    this.context.log(`LlmNode(${this.id}): - Input string: "${inputStr.substring(0, 50)}${inputStr.length > 50 ? '...' : ''}"`);
    this.context.log(`LlmNode(${this.id}): - Result: "${result.substring(0, 50)}${result.length > 50 ? '...' : ''}"`);
    this.context.log(`LlmNode(${this.id}): - Result length: ${result.length}`);
  }
} 