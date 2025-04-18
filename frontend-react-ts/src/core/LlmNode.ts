import { Node } from './Node';
import { runLLM, LLMProvider } from '../api/llm';
import { callOllamaVisionWithPaths } from '../utils/llm/ollamaClient';
import { FlowExecutionContext } from './FlowExecutionContext';
import { getNodeContent, LLMNodeContent } from '../store/nodeContentStore';

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
   * Synchronize property from Zustand store before execution
   */
  syncPropertyFromStore(): void {
    try {
      // Get the node content from store
      const content = getNodeContent<LLMNodeContent>(this.id, 'llm');
      
      if (content) {
        // Update properties if they exist in the store
        this.property.prompt = content.prompt || this.property.prompt;
        this.property.temperature = content.temperature ?? this.property.temperature;
        this.property.model = content.model || this.property.model;
        this.property.provider = content.provider || this.property.provider;
        this.property.ollamaUrl = content.ollamaUrl || this.property.ollamaUrl;
        this.property.openaiApiKey = content.openaiApiKey || this.property.openaiApiKey;
        this.property.mode = content.mode || this.property.mode;
        
        this.context?.log(`LlmNode(${this.id}): Successfully synced properties from store`);
      } else {
        this.context?.log(`LlmNode(${this.id}): No content found in store`);
      }
    } catch (error) {
      this.context?.log(`LlmNode(${this.id}): Error syncing properties: ${error}`);
    }
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
      // 배열의 각 요소를 적절히 문자열로 변환
      const textInput = input.map(item => {
        if (item === null || item === undefined) {
          return 'null';
        } else if (typeof item === 'object') {
          // 객체는 JSON으로 변환
          return JSON.stringify(item, null, 2);
        } else {
          return String(item);
        }
      }).join('\n');
      
      this.context?.log(`LlmNode(${this.id}): 배열 입력 변환 결과 (일부): ${textInput.substring(0, 100)}...`);
      prompt = prompt.replace(/\{\{input\}\}/g, textInput);
    } else if (input && typeof input === 'object') {
      // 단일 객체인 경우 예쁘게 포맷팅된 JSON으로 변환
      prompt = prompt.replace(/\{\{input\}\}/g, JSON.stringify(input, null, 2));
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
      // 실행 시작 표시
      this.context?.markNodeRunning(this.id);
      
      // Ensure properties are synced from store before execution
      this.syncPropertyFromStore();
      
      // 디버그: 실행 시점 property 전체 로그
      this.context?.log(`[디버그] LLMNode(${this.id}) property: ` + JSON.stringify(this.property));

      // 필수 property 체크 (prompt, model, provider)
      if (!this.property.prompt || !this.property.model || !this.property.provider) {
        const missing = [
          !this.property.prompt ? 'prompt' : null,
          !this.property.model ? 'model' : null,
          !this.property.provider ? 'provider' : null
        ].filter(Boolean).join(', ');
        const errorMsg = `LLMNode(${this.id}): Required property missing: ${missing}`;
        this.context?.log(errorMsg);
        this.context?.markNodeError(this.id, errorMsg);
        throw new Error(errorMsg);
      }

      const resolvedPrompt = this.resolvePrompt(input);
      
      let result;
      
      // 비전 모드인 경우 이미지 파일만 필터링
      if (this.property.mode === 'vision') {
        const imagePaths = this.filterImagePaths(input);
        
        if (imagePaths.length === 0) {
          const errorMsg = "비전 모드인데, 이미지가 입력되지 않았습니다.";
          this.context?.log(`LlmNode(${this.id}): ${errorMsg}`);
          this.context?.markNodeError(this.id, errorMsg);
          throw new Error(errorMsg);
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
      
      // Mark the node as successful
      this.context?.markNodeSuccess(this.id, result);
      
      return result;
    } catch (error) {
      // Log and mark the node as failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.log(`LlmNode(${this.id}): Execution failed: ${errorMessage}`);
      this.context?.markNodeError(this.id, errorMessage);
      
      // 에러 발생 시 null 반환으로 체이닝 중단
      return null;
    }
  }
} 