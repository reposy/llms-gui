import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { LLMNodeContent } from '../types/nodes.ts';
import { runLLM } from '../services/llmService.ts';
import { LLMRequestParams } from '../services/llm/types.ts';
import { LocalFileMetadata } from '../types/files';

/**
 * LLM node for generating text via LLM providers
 */
export class LlmNode extends Node {
  declare property: LLMNodeContent;
  
  constructor(id: string, property: Record<string, any> = {}, context?: FlowExecutionContext) {
    super(id, 'llm', property);
    
    if (context) {
      this.context = context;
    }
  }

  /**
   * Replace template variables in the prompt with actual values
   */
  private resolvePrompt(input: any): string {
    // context가 있으면 context의 getNodeContentFunc를, 없으면 this.property를 사용
    let prompt = '';
    let nodeContent: LLMNodeContent | undefined = undefined;
    if (this.context && typeof this.context.getNodeContentFunc === 'function') {
      nodeContent = this.context.getNodeContentFunc(this.id, this.type) as LLMNodeContent;
      prompt = nodeContent?.prompt ?? this.property.prompt ?? '';
    } else {
      prompt = this.property.prompt ?? '';
    }
    
    // 파일 또는 파일 메타데이터인 경우 파일명을 사용
    if (input instanceof File) {
      this._log(`Replacing {{input}} with file name: ${input.name}`);
      return prompt.replace(/\{\{input\}\}/g, input.name);
    } 
    else if (input && typeof input === 'object' && 'originalName' in input) {
      this._log(`Replacing {{input}} with file name: ${input.originalName}`);
      return prompt.replace(/\{\{input\}\}/g, input.originalName);
    }
    // 배열인 경우 텍스트 항목들을 결합
    else if (Array.isArray(input)) {
      const textItems = input
        .filter(item => typeof item === 'string')
        .join('\n');
      return prompt.replace(/\{\{input\}\}/g, textItems);
    }
    // 문자열인 경우 그대로 사용
    else if (typeof input === 'string') {
      return prompt.replace(/\{\{input\}\}/g, input);
    }
    // 객체인 경우 JSON 문자열로 변환
    else if (input && typeof input === 'object') {
      try {
        return prompt.replace(/\{\{input\}\}/g, JSON.stringify(input, null, 2));
      } catch (e) {
        this._log('Failed to stringify object input, using placeholder.');
        return prompt.replace(/\{\{input\}\}/g, '[Object]');
      }
    }
    // 기타 타입은 문자열로 변환
    else {
      return prompt.replace(/\{\{input\}\}/g, String(input ?? ''));
    }
  }

  /**
   * 입력에서 이미지 파일과 메타데이터 추출
   */
  private extractImages(input: any): {
    files: File[],
    metaData: LocalFileMetadata[]
  } {
    const files: File[] = [];
    const metaData: LocalFileMetadata[] = [];
    
    // 단일 File 객체
    if (input instanceof File && input.type.startsWith('image/')) {
      files.push(input);
      this._log(`Found single image file: ${input.name}`);
    }
    // 단일 LocalFileMetadata 객체
    else if (input && typeof input === 'object' && 'file' in input && 'objectUrl' in input) {
      if (input.file?.type?.startsWith('image/')) {
        metaData.push(input as LocalFileMetadata);
        this._log(`Found single local image metadata: ${input.originalName}`);
      }
    }
    // 배열 입력
    else if (Array.isArray(input)) {
      // 배열에서 이미지 파일 추출
      for (const item of input) {
        if (item instanceof File && item.type.startsWith('image/')) {
          files.push(item);
          this._log(`Found image file in array: ${item.name}`);
        }
        else if (item && typeof item === 'object' && 'file' in item && 'objectUrl' in item) {
          const localImage = item as LocalFileMetadata;
          if (localImage.file?.type?.startsWith('image/')) {
            metaData.push(localImage);
            this._log(`Found local image metadata in array: ${localImage.originalName}`);
          }
        }
      }
    }
    
    return { files, metaData };
  }
  
  /**
   * Main execution method for the LLMNode
   */
  async execute(input: any): Promise<string | null> {
    console.log('[LLMNode] execute input:', input);
    this._log('Executing LLMNode');

    // 필수 속성 확인
    const provider = this.property?.provider;
    const model = this.property?.model;
    if (!provider || !model) {
      const errorMsg = "Missing required properties: provider or model.";
      this._log(`Error - ${errorMsg}`);
      this.context?.markNodeError(this.id, errorMsg);
      return null;
    }

    // 모드 및 프롬프트 설정
    const mode = this.property.mode || 'text';
    this._log(`Config - Mode: ${mode}, Provider: ${provider}, Model: ${model}`);
    
    // 프롬프트 템플릿 처리
    const finalPrompt = this.resolvePrompt(input);
    console.log('[LLMNode] final prompt after input replace:', finalPrompt);
    
    // 이미지 추출
    const { files: imageFiles, metaData: localImageMetadata } = this.extractImages(input);
    this._log(`Found ${imageFiles.length} image files and ${localImageMetadata.length} local image metadata`);
    
    // 비전 모드 검증
    if (mode === 'vision' && imageFiles.length === 0 && localImageMetadata.length === 0 && 
        (finalPrompt.trim() === this.property.prompt?.trim() || !finalPrompt.trim())) {
      const errorMsg = "Vision mode requires at least one image or non-empty prompt.";
      this._log(`Error - ${errorMsg}`);
      this.context?.markNodeError(this.id, errorMsg);
      return null;
    }
    
    // API 요청 파라미터 구성
    const params: LLMRequestParams = {
      provider,
      model,
      prompt: finalPrompt,
      temperature: this.property.temperature,
      maxTokens: this.property.maxTokens,
      mode,
      inputFiles: imageFiles.length > 0 ? imageFiles : undefined,
      localImages: localImageMetadata.length > 0 ? localImageMetadata : undefined,
      ollamaUrl: this.property.ollamaUrl,
      openaiApiKey: this.property.openaiApiKey,
    };

    try {
      // LLM 서비스 호출
      this._log(`Calling LLM service with: ${params.mode} mode, ${imageFiles.length + localImageMetadata.length} images`);
      console.log('[LLMNode] Sending to LLM service:', params);
      const result = await runLLM(params);
      if (!result) {
        throw new Error('LLM service returned null or undefined unexpectedly.');
      }
      
      // 비전 모드 결과 형식화
      let resultText = result.response;
      
      // 응답이 undefined인 경우 빈 문자열로 대체
      if (resultText === undefined || resultText === null) {
        this._log('Warning: LLM response is undefined or null, using empty string instead');
        resultText = '';
      }
      
      if (mode === 'vision') {
        let metadataInfo = '';
        
        if (localImageMetadata.length > 0) {
          // 각 이미지마다 한 줄의 메타데이터 추가
          metadataInfo = localImageMetadata.map((img, index) => {
            return `IMAGE[${index+1}]=${img.originalName}|${img.contentType || 'unknown'}|${this._formatSize(img.size)}|${img.objectUrl}`;
          }).join('\n') + '\n\n';
          
          // 메타데이터를 결과 앞에 추가
          resultText = metadataInfo + resultText;
        } else if (imageFiles.length > 0) {
          // File 객체의 경우 객체 정보 추출
          metadataInfo = imageFiles.map((file, index) => {
            const url = URL.createObjectURL(file); // 임시 URL 생성
            return `IMAGE[${index+1}]=${file.name}|${file.type}|${this._formatSize(file.size)}|${url}`;
          }).join('\n') + '\n\n';
          
          resultText = metadataInfo + resultText;
        }
      }
      
      this._log(`LLM call successful, result length: ${resultText?.length || 0}`);
      
      // 로그로 실제 결과 값 출력 (디버깅용)
      this._log(`Result value: "${resultText}"`);
      
      console.log('[LLMNode] LLM service response:', resultText);
      
      return resultText;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.markNodeError(this.id, errorMessage);
      this._log(`Error during LLM service call: ${errorMessage}`);
      return null;
    }
  }
  
  /**
   * 파일 크기를 읽기 쉬운 형식으로 변환
   */
  private _formatSize(bytes: number): string {
    if (!bytes) return 'N/A';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)}${units[unitIndex]}`;
  }
} 