import { Node } from '../core/Node';
import { FlowExecutionContext } from '../core/FlowExecutionContext';

/**
 * LLM node properties
 */
interface LlmNodeProperty {
  prompt: string;
  temperature: number;
  model: string;
  provider: string;
  ollamaUrl?: string;
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
   * Process the input according to the LLM node's configuration
   */
  async process(input: any): Promise<any> {
    this.context.log(`LlmNode(${this.id}): Processing input with ${this.property.provider}/${this.property.model}`);
    
    try {
      // Resolve the template with the input
      const resolvedPrompt = this.resolveTemplate(this.property.prompt, input);
      this.context.log(`LlmNode(${this.id}): Resolved prompt: ${resolvedPrompt.substring(0, 100)}...`);
      
      // Call the LLM endpoint with the provider/model from node property
      const response = await this.callLlmApi(resolvedPrompt);
      
      this.context.log(`LlmNode(${this.id}): LLM response received`);
      return response;
    } catch (error) {
      this.context.log(`LlmNode(${this.id}): Error processing through LLM: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get child nodes that should be executed next
   */
  getChildNodes(): Node[] {
    return [];
  }
  
  /**
   * Call the LLM API with the given prompt
   */
  private async callLlmApi(prompt: string): Promise<string> {
    const { provider, model, temperature, ollamaUrl } = this.property;
    
    this.context.log(`LlmNode(${this.id}): Calling LLM API with provider: ${provider}, model: ${model}`);
    
    // Mock implementation for API call
    return await new Promise((resolve) => {
      setTimeout(() => {
        resolve(`This is a mock response from ${provider} ${model} with temperature ${temperature} for prompt: "${prompt.substring(0, 50)}..."`);
      }, 500);
    });
  }
  
  /**
   * Resolve template variables in the prompt
   */
  private resolveTemplate(template: string, input: any): string {
    if (!template) return '';
    
    try {
      // Replace {{input}} with the actual input
      let result = template.replace(/\{\{\s*input\s*\}\}/g, 
        typeof input === 'string' 
          ? input 
          : (typeof input === 'object' ? JSON.stringify(input, null, 2) : String(input))
      );
      
      return result;
    } catch (error) {
      this.context.log(`LlmNode(${this.id}): Error resolving template: ${error}`);
      return template; // Return the original template on error
    }
  }
} 