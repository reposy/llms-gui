import { LLMRequestParams, LLMServiceResponse, LLMProviderService } from './llm/types';
import { readFileAsBase64 } from '../utils/data/fileUtils';
import { getFullFileUrl, isImageFile, LocalFileMetadata } from '../types/files';

/**
 * Ollama API 호출 함수 (fetch 사용)
 * @deprecated Prefer OllamaService class implementation.
 */
// async function callOllamaFunc(...) { ... } // Deprecated 함수 제거

/**
 * Implements the LLMProviderService interface for the Ollama provider.
 */
class OllamaService implements LLMProviderService {
  /**
   * Base64 인코딩된 이미지 URL 로드
   * @param url 이미지 URL
   * @returns Base64 인코딩된 문자열
   */
  private async _loadImageAsBase64(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      return await this._blobToBase64(blob);
    } catch (error) {
      console.error('Error loading image:', error);
      throw error;
    }
  }
  
  /**
   * Blob을 Base64로 변환
   * @param blob Blob 객체
   * @returns Base64 인코딩된 문자열
   */
  private _blobToBase64(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to Base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async generate(params: LLMRequestParams): Promise<LLMServiceResponse> {
    const {
      model,
      prompt,
      temperature = 0.7,
      maxTokens,
      mode,
      inputFiles, // 기존 File[] | undefined
      imageMetadata, // FileMetadata[] | undefined
      localImages, // 추가: LocalFileMetadata[] | undefined
      ollamaUrl = 'http://localhost:11434'
    } = params;

    console.log(`Ollama Service: Generating response for model ${model}`);
    console.log(`File objects: ${inputFiles?.length ?? 0}, Image metadata: ${imageMetadata?.length ?? 0}, Local images: ${localImages?.length ?? 0}`);

    try {
      // API 엔드포인트 결정
      const endpoint = `${ollamaUrl}/api/generate`;
      
      // 요청 본문 구성
      const requestBody: any = {
        model,
        prompt,
        temperature,
        stream: false, // 스트리밍 비활성화
      };
      
      // 토큰 제한 설정 (선택 사항)
      if (maxTokens) {
        requestBody.num_predict = maxTokens;
      }
      
      // 비전 모드 처리 (이미지 포함)
      if (mode === 'vision') {
        let images: string[] = [];
        
        // 1. 이미지 메타데이터 처리
        if (imageMetadata && imageMetadata.length > 0) {
          console.log(`Ollama Service: Processing ${imageMetadata.length} image metadata objects`);
          
          try {
            // 각 이미지 메타데이터 처리
            for (const metadata of imageMetadata) {
              const fullUrl = getFullFileUrl(metadata.url);
              const base64Image = await this._loadImageAsBase64(fullUrl);
              images.push(base64Image);
              console.log(`Loaded image from URL: ${metadata.originalName}`);
            }
          } catch (error) {
            console.error('Error processing image metadata:', error);
          }
        }
        
        // 2. 로컬 파일 메타데이터 처리 (LocalFileMetadata)
        if (localImages && localImages.length > 0) {
          console.log(`Ollama Service: Processing ${localImages.length} local image metadata objects`);
          
          try {
            for (const localImage of localImages) {
              const base64Image = await readFileAsBase64(localImage.file);
              images.push(base64Image);
              console.log(`Loaded image from local file: ${localImage.originalName}`);
            }
          } catch (error) {
            console.error('Error processing local image metadata:', error);
          }
        }
        
        // 3. 기존 File 객체 처리 (호환성 유지)
        if (inputFiles && inputFiles.length > 0) {
          console.log(`Ollama Service: Processing ${inputFiles.length} File objects`);
          
          // 이미지 파일만 필터링 및 처리
          const imageFiles = inputFiles.filter(file => isImageFile(file));
          
          try {
            for (const file of imageFiles) {
              const base64Image = await readFileAsBase64(file);
              images.push(base64Image);
              console.log(`Loaded image from File: ${file.name}`);
            }
          } catch (error) {
            console.error('Error processing image files:', error);
          }
        }
        
        // 이미지 추가
        if (images.length > 0) {
          requestBody.images = images;
          console.log(`Ollama Service: Sending ${images.length} images to Ollama API`);
        } else {
          console.log('Ollama Service: No images to send, using text-only mode');
        }
      }
      
      // API 요청
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      // 응답 처리
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ollama API Error (${response.status}): ${errorText}`);
        throw new Error(`Ollama API request failed with status ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      // 성공 응답 반환
      console.log('Ollama API 호출 성공');
      return {
        response: result.response,
        // Ollama는 usage 정보를 다른 방식으로 제공
        usage: {
          totalTokens: result.eval_count || result.total_duration || 0
        }
      };
    } catch (error) {
      console.error('Ollama Service Error:', error);
      
      // 에러 처리 및 전파
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Ollama service failed: ${String(error)}`);
    }
  }
}

// Export an instance of the service
export const ollamaService = new OllamaService(); 