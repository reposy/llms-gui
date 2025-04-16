import { Node } from '../core/Node';
import { setNodeContent, getNodeContent } from '../store/useNodeContentStore';
import { callOllama } from '../utils/llm/ollamaClient';
import { runLLM, isVisionModel, LLMMode } from '../api/llm';

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
      // Sync the node property with the latest content from the store
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
      
      // Check if model supports vision mode
      const supportsVision = isVisionModel(this.property.provider as any, this.property.model);
      this.context.log(`LlmNode(${this.id}): Model ${this.property.model} ${supportsVision ? 'supports' : 'does not support'} vision features`);
      
      // Use the mode set by the user but validate it first
      let mode = this.property.mode || 'text';
      let imageInput: File | Blob | null = null;
      
      // If vision mode is selected, verify it's supported and extract image
      if (mode === 'vision') {
        // First check if the model supports vision
        if (!supportsVision) {
          this.context.log(`LlmNode(${this.id}): ERROR - Vision mode selected but model ${this.property.model} doesn't support vision features`);
          
          // Update the content store to set text mode
          setNodeContent(this.id, { mode: 'text' }, true);
          
          throw new Error(`모델 "${this.property.model}"은(는) 비전 기능을 지원하지 않습니다. 비전을 지원하는 모델로 변경하거나 텍스트 모드를 사용하세요.`);
        }
        
        // Try to extract an image from the input
        if (input instanceof File || input instanceof Blob) {
          imageInput = input;
          this.context.log(`LlmNode(${this.id}): Found File/Blob input for vision mode`);
        } 
        else if (input && typeof input === 'object' && 'file' in input && input.file instanceof File) {
          imageInput = input.file;
          this.context.log(`LlmNode(${this.id}): Found wrapped File object for vision mode`);
        }
        else if (Array.isArray(input) && input.length > 0) {
          const firstItem = input[0];
          if (firstItem instanceof File || firstItem instanceof Blob) {
            imageInput = firstItem;
            this.context.log(`LlmNode(${this.id}): Found File/Blob in array for vision mode`);
          } 
          else if (firstItem && typeof firstItem === 'object' && 'file' in firstItem && firstItem.file instanceof File) {
            imageInput = firstItem.file;
            this.context.log(`LlmNode(${this.id}): Found wrapped File in array for vision mode`);
          }
        }
        
        // If no image is found in vision mode, throw a clear error
        if (!imageInput) {
          this.context.log(`LlmNode(${this.id}): ERROR - Vision mode selected but no image found in input`);
          
          // For better UX, automatically fall back to text mode in the UI
          setNodeContent(this.id, { mode: 'text' }, true);
          
          throw new Error('비전 모드는 이미지 입력이 필요합니다. 이미지 노드를 연결하거나 텍스트 모드로 전환해주세요.');
        }
      }
      
      // For text mode, just log that we're using it
      if (mode === 'text') {
        this.context.log(`LlmNode(${this.id}): Using text mode`);
      }
      
      // Log the raw prompt from properties before any processing
      this.context.log(`LlmNode(${this.id}): Raw prompt from property: "${this.property.prompt}"`);
      this.context.log(`LlmNode(${this.id}): Raw prompt length: ${this.property.prompt?.length || 0} characters`);
      
      // Check if prompt is undefined or empty
      if (!this.property.prompt) {
        this.context.log(`LlmNode(${this.id}): WARNING - Empty prompt in property!`);
        this.property.prompt = ''; // Set to empty string to avoid errors
      }
      
      // Resolve the template with the input
      // For vision mode with File/Blob input, we'll handle template substitution in the API layer
      const resolvedPrompt = mode === 'vision' && imageInput 
        ? this.property.prompt 
        : this.resolveTemplate(this.property.prompt, input);
      
      // More detailed logging of the prompt
      this.context.log(`LlmNode(${this.id}): Resolved prompt: "${resolvedPrompt}"`);
      this.context.log(`LlmNode(${this.id}): Resolved prompt length: ${resolvedPrompt.length} characters`);
      
      // Defensive check - ensure we never send empty prompt
      if (!resolvedPrompt || resolvedPrompt.trim() === '') {
        const errorMsg = `Empty prompt after resolution. Original prompt: "${this.property.prompt}"`;
        this.context.log(`LlmNode(${this.id}): ERROR - ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // Additional logging to identify potential encoding issues
      this.context.log(`LlmNode(${this.id}): Input type: ${typeof input}`);
      if (typeof input === 'string') {
        this.context.log(`LlmNode(${this.id}): Input string length: ${input.length}`);
      } else if (input === null || input === undefined) {
        this.context.log(`LlmNode(${this.id}): Input is ${input === null ? 'null' : 'undefined'}`);
      } else if (typeof input === 'object') {
        this.context.log(`LlmNode(${this.id}): Input is object with keys: ${Object.keys(input).join(', ')}`);
      }
      
      // Call the LLM endpoint with the provider/model from node property
      const response = await this.callLlmApi(resolvedPrompt, imageInput);
      
      // Verify response is valid
      if (!response) {
        this.context.log(`LlmNode(${this.id}): Warning: Empty response received from callLlmApi`);
      } else {
        this.context.log(`LlmNode(${this.id}): LLM response received: "${response.substring(0, 100)}..." (length: ${response.length})`);
      }
      
      // Update the node's content for UI display
      // Force update with timestamp to ensure UI renders the new content
      const contentUpdate: LlmNodeContent = { 
        content: response,
        _forceUpdate: Date.now() 
      };
      
      setNodeContent(this.id, contentUpdate, true);
      this.context.log(`LlmNode(${this.id}): Updated UI content with LLM response (length: ${response?.length || 0})`);
      
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
      
      return response;
    } catch (error) {
      this.context.log(`LlmNode(${this.id}): Error processing through LLM: ${error}`);
      this.context.markNodeError(this.id, String(error));
      throw error;
    }
  }
  
  /**
   * Call the LLM API with the given prompt
   */
  private async callLlmApi(prompt: string, imageInput: File | Blob | null = null): Promise<string> {
    const { provider, model, temperature, ollamaUrl, openaiApiKey, mode } = this.property;
    
    this.context.log(`LlmNode(${this.id}): Calling LLM API with provider: ${provider}, model: ${model}, mode: ${mode}`);
    
    // Defensive check - never send empty prompts to API
    if (!prompt || prompt.trim() === '') {
      throw new Error(`Cannot call LLM API with empty prompt`);
    }
    
    try {
      // Use the unified LLM API
      const result = await runLLM({
        provider: provider as any,
        model,
        prompt,
        mode: imageInput ? 'vision' : (mode as any || 'text'),
        inputImage: imageInput || undefined,
        temperature,
        ollamaUrl,
        openaiApiKey
      });
      
      // 모드 정보를 응답에 추가
      const actualMode = result.mode || (imageInput ? 'vision' : 'text');
      const responseWithModeInfo = `[Mode: ${actualMode}] [Model: ${model}]\n\n${result.response}`;
      
      return responseWithModeInfo;
    } catch (error) {
      this.context.log(`LlmNode(${this.id}): Error calling LLM API: ${error}`);
      throw error;
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
      
      // Replace {{input}} with the actual input
      let result = template.replace(/\{\{\s*input\s*\}\}/g, inputStr);
      
      // Log template resolution info
      this.context.log(`LlmNode(${this.id}): Template resolution details:`);
      this.context.log(`LlmNode(${this.id}): - Original template: "${template}"`);
      this.context.log(`LlmNode(${this.id}): - Template length: ${template.length}`);
      this.context.log(`LlmNode(${this.id}): - Input string: "${inputStr.substring(0, 50)}${inputStr.length > 50 ? '...' : ''}"`);
      this.context.log(`LlmNode(${this.id}): - Result: "${result.substring(0, 50)}${result.length > 50 ? '...' : ''}"`);
      this.context.log(`LlmNode(${this.id}): - Result length: ${result.length}`);
      
      return result;
    } catch (error) {
      this.context.log(`LlmNode(${this.id}): Error resolving template: ${error}`);
      
      // Fallback - return template as is with error note
      return `${template} [TEMPLATE_ERROR: ${error}]`;
    }
  }
} 