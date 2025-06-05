import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { LlmNodeProperty } from '../types/nodes';
import { runLLM } from '../services/llmService';
import { LLMRequestParams } from '../services/llm/types';
import { LocalFileMetadata, BackendFileMetadata } from '../types/files';
import { FileMetadata } from '../types/files';

/**
 * LLM node for generating text via LLM providers
 */
export class LlmNode extends Node {
  declare property: LlmNodeProperty;
  
  constructor(id: string, property: LlmNodeProperty = {
    type: 'llm',
    provider: 'ollama',
    model: '',
    prompt: '',
    temperature: 0.7,
    mode: 'text',
  }, context?: FlowExecutionContext) {
    super(id, 'llm', property);
    
    if (context) {
      this.context = context;
    }
  }

  /**
   * Replace template variables in the prompt with actual values
   */
  private resolvePrompt(input: any, effectiveProperty?: LlmNodeProperty): string {
    let prompt = '';
    
    // effectiveProperty가 전달되면 우선 사용, 없으면 기존 로직 사용
    if (effectiveProperty) {
      prompt = effectiveProperty.prompt ?? '';
    } else if (this.context && typeof this.context.getNodePropertyFunc === 'function') {
      const nodeContent = this.context.getNodePropertyFunc(this.id, this.type) as LlmNodeProperty;
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
      const textItems = input.filter(item => typeof item === 'string');
      const joined = textItems.join('\n\n');
      const replaced = prompt.replace(/\{\{input\}\}/g, joined);
      return replaced;
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
   * BackendFileMetadata를 FileMetadata로 변환 (파일 객체화 책임)
   */
  private convertBackendFileToFileMetadata(backendFile: BackendFileMetadata): FileMetadata {
    return {
      id: backendFile.fileId, // fileId를 id로 매핑
      originalName: backendFile.originalFileName,
      filename: backendFile.originalFileName, // 원본 파일명을 filename으로도 사용
      path: backendFile.backendPath, // 백엔드 경로를 path로 사용
      url: backendFile.url, // 백엔드 URL을 그대로 사용
      contentType: backendFile.contentType,
      size: backendFile.size,
      uploadedAt: backendFile.uploadedAt
    };
  }

  /**
   * 입력에서 이미지 파일과 메타데이터 추출 (통합 파일 시스템 지원)
   */
  private extractImages(input: any): {
    files: File[],
    metaData: LocalFileMetadata[],
    serverFiles: FileMetadata[]
  } {
    const files: File[] = [];
    const metaData: LocalFileMetadata[] = [];
    const serverFiles: FileMetadata[] = [];
    
    // 단일 File 객체
    if (input instanceof File && input.type.startsWith('image/')) {
      files.push(input);
      this._log(`Found single image file: ${input.name}`);
    }
    // 단일 BackendFileMetadata 객체 (새로운 통합 시스템) - FileMetadata로 변환
    else if (input && typeof input === 'object' && 'fileId' in input && 'originalFileName' in input) {
      const converted = this.convertBackendFileToFileMetadata(input as BackendFileMetadata);
      serverFiles.push(converted);
      this._log(`Found single backend file metadata, converted to FileMetadata: ${converted.originalName}`);
    }
    // 단일 FileMetadata 객체
    else if (input && typeof input === 'object' && 'originalName' in input && 'url' in input) {
      serverFiles.push(input as FileMetadata);
      this._log(`Found single file metadata: ${input.originalName}`);
    }
    // 단일 LocalFileMetadata 객체 (레거시)
    else if (input && typeof input === 'object' && 'file' in input && 'objectUrl' in input) {
      if (input.file?.type?.startsWith('image/')) {
        metaData.push(input as LocalFileMetadata);
        this._log(`Found single local image metadata: ${input.originalName}`);
      }
    }
    // 배열 입력
    else if (Array.isArray(input)) {
      for (const item of input) {
        if (item instanceof File && item.type.startsWith('image/')) {
          files.push(item);
          this._log(`Found image file in array: ${item.name}`);
        }
        else if (item && typeof item === 'object' && 'fileId' in item && 'originalFileName' in item) {
          const converted = this.convertBackendFileToFileMetadata(item as BackendFileMetadata);
          serverFiles.push(converted);
          this._log(`Found backend file metadata in array, converted to FileMetadata: ${converted.originalName}`);
        }
        else if (item && typeof item === 'object' && 'originalName' in item && 'url' in item) {
          serverFiles.push(item as FileMetadata);
          this._log(`Found file metadata in array: ${item.originalName}`);
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
    
    return { files, metaData, serverFiles };
  }
  
  /**
   * Main execution method for the LLMNode
   */
  async execute(input: any): Promise<string | null> {
    console.log('[LLMNode] execute input:', input);
    this._log('Executing LLMNode');

    try {
      // 속성 가져오기 (컨텍스트 우선, fallback으로 this.property)
      let effectiveProperty: LlmNodeProperty;
      if (this.context && typeof this.context.getNodePropertyFunc === 'function') {
        effectiveProperty = this.context.getNodePropertyFunc(this.id, this.type) as LlmNodeProperty;
      } else {
        effectiveProperty = this.property as LlmNodeProperty;
      }

      // 필수 속성 확인
      const provider = effectiveProperty?.provider;
      const model = effectiveProperty?.model;
      if (!provider || !model) {
        const errorMsg = "Missing required properties: provider or model.";
        this._log(`Error - ${errorMsg}`);
        this.context?.markNodeError(this.id, errorMsg);
        return null;
      }

      // 모드 및 프롬프트 설정
      const mode = effectiveProperty.mode || 'text';
      this._log(`Config - Mode: ${mode}, Provider: ${provider}, Model: ${model}`);
      
      // 프롬프트 템플릿 처리
      const finalPrompt = this.resolvePrompt(input, effectiveProperty);
      console.log('[LLMNode] final prompt after input replace:', finalPrompt);
      
      // 이미지 추출
      const { files: imageFiles, metaData: localImageMetadata, serverFiles } = this.extractImages(input);
      this._log(`Found ${imageFiles.length} image files, ${localImageMetadata.length} local image metadata, and ${serverFiles.length} server files`);
      
      // 비전 모드 검증
      if (mode === 'vision' && imageFiles.length === 0 && localImageMetadata.length === 0 && serverFiles.length === 0 &&
          (finalPrompt.trim() === effectiveProperty.prompt?.trim() || !finalPrompt.trim())) {
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
        temperature: effectiveProperty.temperature,
        maxTokens: effectiveProperty.maxTokens,
        mode,
        inputFiles: imageFiles.length > 0 ? imageFiles : undefined,
        localImages: localImageMetadata.length > 0 ? localImageMetadata : undefined,
        imageMetadata: serverFiles.length > 0 ? serverFiles : undefined,
        ollamaUrl: effectiveProperty.ollamaUrl,
        openaiApiKey: effectiveProperty.openaiApiKey,
      };

      // LLM 서비스 호출
      this._log(`Calling LLM service with: ${params.mode} mode, ${imageFiles.length + localImageMetadata.length + serverFiles.length} images`);
      console.log('[LLMNode] Sending to LLM service:', params);
      const result = await runLLM(params);
      if (!result) {
        throw new Error('LLM service returned null or undefined unexpectedly.');
      }
      
      // 비전 모드 결과 형식화 - 마크다운 이미지 표시를 위한 파일 경로 형식
      let resultText = result.response;
      
      // 응답이 undefined인 경우 빈 문자열로 대체
      if (resultText === undefined || resultText === null) {
        this._log('Warning: LLM response is undefined or null, using empty string instead');
        resultText = '';
      }
      
      if (mode === 'vision') {
        const imagePaths: string[] = [];
        
        // FileMetadata에서 파일 경로 추출
        if (serverFiles.length > 0) {
          serverFiles.forEach((file) => {
            const filePath = file.originalName || 'unknown';
            imagePaths.push(filePath);
            this._log(`Using FileMetadata path: ${filePath}`);
          });
        }
        
        // LocalFileMetadata에서 파일 경로 추출
        if (localImageMetadata.length > 0) {
          localImageMetadata.forEach((img) => {
            // originalName을 그대로 사용 (경로 정보가 포함되어 있으면 그대로, 파일명만 있어도 그대로)
            const filePath = img.originalName || img.file?.name || 'unknown';
            imagePaths.push(filePath);
            this._log(`Using LocalFileMetadata path: ${filePath}`);
          });
        }
        
        // File 객체에서 파일 경로 추출
        if (imageFiles.length > 0) {
          imageFiles.forEach((file) => {
            // webkitRelativePath가 있으면 우선 사용, 없으면 file.name 사용
            // 임의로 images/ 프리픽스를 추가하지 않음
            const filePath = (file as any).webkitRelativePath || file.name;
            imagePaths.push(filePath);
            this._log(`Using File path: ${filePath} (webkitRelativePath: ${(file as any).webkitRelativePath || 'none'})`);
          });
        }
        
        // 파일 경로 정보를 응답 첫 줄에 추가
        if (imagePaths.length > 0) {
          let pathInfo = '';
          if (imagePaths.length === 1) {
            // 단일 파일: [파일경로]
            pathInfo = `[${imagePaths[0]}]`;
          } else {
            // 다중 파일: ["파일경로1", "파일경로2", ...]
            const quotedPaths = imagePaths.map(path => `"${path}"`);
            pathInfo = `[${quotedPaths.join(', ')}]`;
          }
          
          // 파일 경로 정보를 결과 앞에 추가
          resultText = pathInfo + '\n\n' + resultText;
          this._log(`Added image path info: ${pathInfo}`);
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
} 