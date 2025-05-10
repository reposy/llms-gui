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
      inputFiles,
      imageMetadata,
      localImages,
      ollamaUrl = 'http://localhost:11434'
    } = params;

    console.log(`Ollama Service: Generating response for model ${model}`);
    
    try {
      // API 엔드포인트 결정
      const endpoint = `${ollamaUrl}/api/generate`;
      
      // 요청 본문 구성
      const requestBody: any = {
        model,
        prompt,
        temperature,
        stream: false,
      };
      
      // 토큰 제한 설정
      if (maxTokens) {
        requestBody.num_predict = maxTokens;
      }
      
      // 비전 모드 처리 (이미지 포함)
      if (mode === 'vision') {
        // 이미지 소스 정보 로깅
        console.log(`이미지 소스 정보: 서버 이미지=${imageMetadata?.length ?? 0}, 로컬 이미지=${localImages?.length ?? 0}, 파일 객체=${inputFiles?.length ?? 0}`);
        
        // 이미지 데이터 변환 - 우선순위에 따라 단일 소스만 처리
        const base64Images = await this._getImageSourceByPriority(imageMetadata, localImages, inputFiles);
        
        // 처리된 이미지가 있으면 요청에 추가
        if (base64Images.length > 0) {
          requestBody.images = base64Images;
          console.log(`Ollama Service: ${base64Images.length}개 이미지를 API 요청에 포함`);
        } else {
          console.log('Ollama Service: 유효한 이미지 없음, 텍스트 모드로 처리');
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
        usage: {
          totalTokens: result.eval_count || result.total_duration || 0
        }
      };
    } catch (error) {
      console.error('Ollama Service Error:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Ollama service failed: ${String(error)}`);
    }
  }
  
  /**
   * 우선순위에 따라 이미지 소스를 처리하여 Base64 형식으로 변환
   * 1. 서버 이미지 (imageMetadata)
   * 2. 로컬 이미지 (localImages)
   * 3. 파일 객체 (inputFiles)
   */
  private async _getImageSourceByPriority(
    imageMetadata?: FileMetadata[],
    localImages?: LocalFileMetadata[],
    inputFiles?: File[]
  ): Promise<string[]> {
    const result: string[] = [];
    
    // 1. 서버 이미지 처리 (최우선)
    if (imageMetadata && imageMetadata.length > 0) {
      console.log(`서버 이미지 메타데이터 ${imageMetadata.length}개 처리 중`);
      
      try {
        for (const metadata of imageMetadata) {
          const fullUrl = getFullFileUrl(metadata.url);
          const base64Image = await this._loadImageAsBase64(fullUrl);
          if (this._isValidBase64DataUrl(base64Image)) {
            result.push(base64Image);
            console.log(`서버 이미지 로드 성공: ${metadata.originalName}`);
          } else {
            console.warn(`유효하지 않은 Base64 이미지 무시: ${metadata.originalName}`);
          }
        }
        // 서버 이미지가 처리되었으면 다른 소스는 무시
        if (result.length > 0) return result;
      } catch (error) {
        console.error('서버 이미지 처리 중 오류:', error);
      }
    }
    
    // 2. 로컬 이미지 처리 (두 번째 우선순위)
    if (localImages && localImages.length > 0) {
      console.log(`로컬 이미지 메타데이터 ${localImages.length}개 처리 중`);
      
      try {
        for (const localImage of localImages) {
          const base64Image = await readFileAsBase64(localImage.file);
          if (this._isValidBase64DataUrl(base64Image)) {
            result.push(base64Image);
            console.log(`로컬 이미지 로드 성공: ${localImage.originalName}`);
          } else {
            console.warn(`유효하지 않은 Base64 이미지 무시: ${localImage.originalName}`);
          }
        }
        // 로컬 이미지가 처리되었으면 다른 소스는 무시
        if (result.length > 0) return result;
      } catch (error) {
        console.error('로컬 이미지 처리 중 오류:', error);
      }
    }
    
    // 3. 파일 객체 처리 (마지막 우선순위)
    if (inputFiles && inputFiles.length > 0) {
      console.log(`File 객체 ${inputFiles.length}개 처리 중`);
      
      // 이미지 파일만 필터링
      const imageFiles = inputFiles.filter(file => isImageFile(file));
      
      try {
        for (const file of imageFiles) {
          const base64Image = await readFileAsBase64(file);
          if (this._isValidBase64DataUrl(base64Image)) {
            result.push(base64Image);
            console.log(`파일 객체 이미지 로드 성공: ${file.name}`);
          } else {
            console.warn(`유효하지 않은 Base64 이미지 무시: ${file.name}`);
          }
        }
      } catch (error) {
        console.error('파일 객체 처리 중 오류:', error);
      }
    }
    
    return result;
  }
  
  /**
   * Base64 데이터 URL이 유효한지 검사
   */
  private _isValidBase64DataUrl(dataUrl: string): boolean {
    return Boolean(
      dataUrl &&
      typeof dataUrl === 'string' &&
      dataUrl.startsWith('data:image/') &&
      dataUrl.includes(';base64,')
    );
  }
}

// Export an instance of the service
export const ollamaService = new OllamaService(); 