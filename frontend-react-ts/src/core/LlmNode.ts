import { Node } from '../core/Node';
import { setNodeContent, getNodeContent } from '../store/useNodeContentStore';

/**
 * LLM node properties
 */
interface LlmNodeProperty {
  prompt: string;
  temperature: number;
  model: string;
  provider: string;
  ollamaUrl?: string;
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
      
      this.context.log(`LlmNode(${this.id}): Properties after sync - provider: ${this.property.provider}, model: ${this.property.model}`);
      
      // Log the raw prompt from properties before any processing
      this.context.log(`LlmNode(${this.id}): Raw prompt from property: "${this.property.prompt}"`);
      this.context.log(`LlmNode(${this.id}): Raw prompt length: ${this.property.prompt?.length || 0} characters`);
      
      // Check if prompt is undefined or empty
      if (!this.property.prompt) {
        this.context.log(`LlmNode(${this.id}): WARNING - Empty prompt in property!`);
        this.property.prompt = ''; // Set to empty string to avoid errors
      }
      
      // Resolve the template with the input
      const resolvedPrompt = this.resolveTemplate(this.property.prompt, input);
      
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
      const response = await this.callLlmApi(resolvedPrompt);
      
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
  private async callLlmApi(prompt: string, retryCount = 0): Promise<string> {
    const { provider, model, temperature, ollamaUrl } = this.property;
    const MAX_RETRIES = 3;
    
    this.context.log(`LlmNode(${this.id}): Calling LLM API with provider: ${provider}, model: ${model}, retry: ${retryCount}/${MAX_RETRIES}`);
    
    // Defensive check - never send empty prompts to API
    if (!prompt || prompt.trim() === '') {
      throw new Error(`Cannot call LLM API with empty prompt`);
    }
    
    if (provider === 'ollama') {
      try {
        const url = (ollamaUrl ?? 'http://localhost:11434') + '/api/generate';
        
        // Create request payload and log it for debugging
        const requestPayload = {
          model,
          prompt,
          stream: false,
          temperature: temperature ?? 0.7
        };
        
        // Log the complete request payload including the prompt
        this.context.log(`LlmNode(${this.id}): Full request payload: ${JSON.stringify(requestPayload)}`);
        this.context.log(`LlmNode(${this.id}): Prompt in payload: "${prompt}"`);
        this.context.log(`LlmNode(${this.id}): Prompt length in payload: ${prompt.length} characters`);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Charset': 'utf-8'
          },
          body: JSON.stringify(requestPayload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          this.context.log(`LlmNode(${this.id}): API error - status: ${response.status}, text: ${errorText}`);
          throw new Error(`LLM API error: ${response.status}: ${errorText}`);
        }

        // Get raw text instead of directly parsing as JSON - only read once!
        const rawResponseText = await response.text();
        
        // Log the raw response text length for debugging (not full content for privacy)
        this.context.log(`LlmNode(${this.id}): Raw API response length: ${rawResponseText.length} characters`);
        
        // Try to parse the JSON
        let data;
        try {
          data = JSON.parse(rawResponseText);
          this.context.log(`LlmNode(${this.id}): Successfully parsed response JSON`);
        } catch (parseError) {
          this.context.log(`LlmNode(${this.id}): Error parsing JSON response: ${parseError}`);
          throw new Error(`Failed to parse LLM API response: ${parseError}. Raw response: ${rawResponseText.substring(0, 200)}...`);
        }
        
        // Handle model loading case with retry limit
        if (data.done_reason === 'load') {
          this.context.log(`LlmNode(${this.id}): Model is still loading (done_reason = "load")`);
          
          if (retryCount < MAX_RETRIES) {
            this.context.log(`LlmNode(${this.id}): Retrying in 1 second (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return await this.callLlmApi(prompt, retryCount + 1); // Retry with incremented counter
          } else {
            this.context.log(`LlmNode(${this.id}): Max retries (${MAX_RETRIES}) reached for model loading`);
            // Fall through to normal response handling, which will provide a fallback message
          }
        }
        
        // Log response data structure
        if (data) {
          this.context.log(`LlmNode(${this.id}): Response data contains keys: ${Object.keys(data).join(', ')}`);
          if (data.response !== undefined) {
            this.context.log(`LlmNode(${this.id}): Response field type: ${typeof data.response}, length: ${typeof data.response === 'string' ? data.response.length : 'N/A'}`);
          } else {
            this.context.log(`LlmNode(${this.id}): Response field missing from API response`);
          }
        }
        
        // Handle the response more robustly
        let result = '';
        if (data.response !== undefined && data.response !== null) {
          if (typeof data.response === 'string' && data.response.trim() === '') {
            if (data.done_reason === 'load') {
              this.context.log(`LlmNode(${this.id}): Warning: Empty response with "load" done_reason after max retries`);
              result = `[Model ${model} is still loading. Please try again in a moment.]`;
            } else {
              this.context.log(`LlmNode(${this.id}): Warning: Empty response string from API, using full data object`);
              result = JSON.stringify(data);
            }
          } else {
            result = typeof data.response === 'string' ? data.response : JSON.stringify(data.response);
          }
        } else {
          this.context.log(`LlmNode(${this.id}): No 'response' field in API response, using full data object`);
          result = JSON.stringify(data);
        }
        
        // Final check to ensure we never return empty string
        if (!result || result.trim() === '') {
          this.context.log(`LlmNode(${this.id}): Empty result after processing, falling back to placeholder`);
          result = `[No content returned from ${provider}/${model}]`;
        }
        
        return result;
      } catch (error) {
        this.context.log(`LlmNode(${this.id}): Error calling LLM API: ${error}`);
        throw error;
      }
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
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
      // On error, return the original template to ensure we don't lose the prompt
      return template;
    }
  }
} 