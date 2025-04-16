import { Node } from './Node';
import { runLLM, LLMProvider } from '../api/llm';
import { callOllamaVisionWithPaths } from '../utils/llm/ollamaClient';
import { FlowExecutionContext } from './FlowExecutionContext';

/**
 * LLM Node properties
 */
export interface LlmNodeProperty {
  prompt: string;
  temperature: number;
  model: string;
  provider: LLMProvider;
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
  property: LlmNodeProperty;

  constructor(
    id: string,
    property: Record<string, any> = {},
    context?: FlowExecutionContext
  ) {
    super(id, 'llm', property, context);

    // Initialize with default properties if not provided
    this.property = {
      // Handle empty string values correctly by using 'in' operator
      prompt: 'prompt' in property ? property.prompt : '',
      temperature: 'temperature' in property ? property.temperature : 0.7,
      model: 'model' in property ? property.model : 'openhermes',
      provider: 'provider' in property ? property.provider : 'ollama',
      ollamaUrl: 'ollamaUrl' in property ? property.ollamaUrl : 'http://localhost:11434',
      openaiApiKey: 'openaiApiKey' in property ? property.openaiApiKey : '',
      mode: 'mode' in property ? property.mode : 'text',
      // Preserve any other properties
      ...property
    };
  }

  /**
   * Resolve the prompt template with the input value
   */
  private resolvePrompt(input: any): string {
    let prompt = this.property.prompt;
    
    // Replace {{input}} with the actual input
    if (typeof input === 'string') {
      prompt = prompt.replace(/\{\{input\}\}/g, input);
    } else if (Array.isArray(input)) {
      // Join array elements with newlines for text input
      const textInput = input
        .filter(item => typeof item === 'string' && !/\.(jpg|jpeg|png|gif|bmp)$/i.test(item))
        .join('\n');
      prompt = prompt.replace(/\{\{input\}\}/g, textInput);
    } else if (input && typeof input === 'object') {
      prompt = prompt.replace(/\{\{input\}\}/g, JSON.stringify(input));
    }
    
    return prompt;
  }

  /**
   * 이미지 파일 경로만 필터링
   */
  private filterImagePaths(input: any): string[] {
    if (!Array.isArray(input)) {
      // 단일 항목을 배열로 변환
      input = [input];
    }
    
    // 이미지 파일만 필터링
    return input.filter((item: string | any) => 
      typeof item === 'string' && 
      /\.(jpg|jpeg|png|gif|bmp)$/i.test(item)
    );
  }

  /**
   * Execute the LLM node
   * @param input The input to process
   * @returns The LLM response
   */
  async execute(input: any): Promise<any> {
    try {
      const resolvedPrompt = this.resolvePrompt(input);
      
      // Mark node as running
      this.context?.markNodeRunning(this.id);
      
      let result;
      
      // 비전 모드인 경우 이미지 파일만 필터링
      if (this.property.mode === 'vision') {
        const imagePaths = this.filterImagePaths(input);
        
        if (imagePaths.length === 0) {
          throw new Error('Vision mode requires at least one image file path.');
        }
        
        // 이미지 경로 로깅
        this.context?.log(`LlmNode(${this.id}): Processing vision with ${imagePaths.length} images: ${imagePaths.join(', ')}`);
        
        result = await callOllamaVisionWithPaths({ 
          model: this.property.model, 
          prompt: resolvedPrompt, 
          imagePaths,
          temperature: this.property.temperature
        });
      } else {
        // 텍스트 모드 처리
        this.context?.log(`LlmNode(${this.id}): Processing text with prompt: ${resolvedPrompt.substring(0, 100)}...`);
        
        const apiResponse = await runLLM({
          provider: this.property.provider,
          model: this.property.model,
          prompt: resolvedPrompt,
          temperature: this.property.temperature
        });
        
        result = apiResponse.response;
      }
      
      // Store the output in the context
      this.context?.storeOutput(this.id, result);
      
      return result;
    } catch (error) {
      // Log and mark the node as failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.log(`LlmNode(${this.id}): Execution failed: ${errorMessage}`);
      this.context?.markNodeError(this.id, errorMessage);
      
      // Re-throw to allow parent process method to handle
      throw error;
    }
  }
} 