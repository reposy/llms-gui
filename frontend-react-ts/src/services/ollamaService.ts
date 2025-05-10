import { LLMRequestParams, LLMServiceResponse, LLMProviderService } from './llm/types';
import { isImageFile, imageToBase64 } from '../utils/data/fileUtils';
import { FileMetadata, LocalFileMetadata, getFullFileUrl } from '../types/files';

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
   * Generates text based on the provided parameters.
   */
  async generate(params: LLMRequestParams): Promise<LLMServiceResponse> {
    const {
      model,
      prompt,
      temperature = 0.7,
      maxTokens,
      ollamaUrl = 'http://localhost:11434',
      mode = 'text',
      imageMetadata,
      localImages,
      inputFiles
    } = params;

    try {
      // 이미지 소스 정보 로그
      console.log(`이미지 소스 정보: 서버 이미지=${imageMetadata?.length || 0}, 로컬 이미지=${localImages?.length || 0}, 파일 객체=${inputFiles?.length || 0}`);

      // API 엔드포인트 결정 - vision 모드일 때는 chat API 사용
      const endpoint = mode === 'vision' 
        ? `${ollamaUrl}/api/chat` 
        : `${ollamaUrl}/api/generate`;
      
      // 기본 요청 구성
      let requestBody: any;
      
      // Vision 모드와 일반 텍스트 모드에 따라 요청 형식 분리
      if (mode === 'vision') {
        // 이미지 처리 - 소스 우선순위에 따라 처리
        const base64Images = await this._processImages(imageMetadata, localImages, inputFiles);
        
        // 비전 모드용 chat API 요청 형식
        requestBody = {
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
              images: base64Images.length > 0 ? base64Images : undefined
            }
          ],
          temperature,
          stream: false
        };
        
        // 처리된 이미지가 있으면 요청에 추가
        if (base64Images.length > 0) {
          console.log(`Ollama Service: ${base64Images.length}개 이미지를 API 요청에 포함`);
        } else {
          console.log('Ollama Service: 유효한 이미지 없음, 텍스트 모드로 진행');
        }
      } else {
        // 텍스트 모드용 generate API 요청 형식
        requestBody = {
          model,
          prompt,
          temperature,
          stream: false
        };
      }
      
      // 토큰 제한 설정
      if (maxTokens) {
        requestBody.num_predict = maxTokens;
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
      
      // 성공 응답 반환 - chat API와 generate API의 응답 형식 차이 처리
      console.log('Ollama API 호출 성공');
      
      return {
        response: mode === 'vision' ? result.message?.content : result.response,
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
   * 
   * 각 이미지 처리 실패는 다음 이미지 처리에 영향을 주지 않음
   */
  private async _processImages(
    imageMetadata?: FileMetadata[],
    localImages?: LocalFileMetadata[],
    inputFiles?: File[]
  ): Promise<string[]> {
    const result: string[] = [];
    
    // 1. 서버 이미지 처리 (최우선)
    if (imageMetadata && imageMetadata.length > 0) {
      console.log(`서버 이미지 메타데이터 ${imageMetadata.length}개 처리 중`);
      const serverImages = await this._processServerImages(imageMetadata);
      if (serverImages.length > 0) {
        return serverImages; // 서버 이미지가 있으면 다른 소스는 무시
      }
    }
    
    // 2. 로컬 이미지 처리 (두 번째 우선순위)
    if (localImages && localImages.length > 0) {
      console.log(`로컬 이미지 메타데이터 ${localImages.length}개 처리 중`);
      const localBase64Images = await this._processLocalImages(localImages);
      if (localBase64Images.length > 0) {
        return localBase64Images; // 로컬 이미지가 있으면 다른 소스는 무시
      }
    }
    
    // 3. 파일 객체 처리 (마지막 우선순위)
    if (inputFiles && inputFiles.length > 0) {
      console.log(`File 객체 ${inputFiles.length}개 처리 중`);
      const fileBase64Images = await this._processFileObjects(inputFiles);
      if (fileBase64Images.length > 0) {
        return fileBase64Images;
      }
    }
    
    return result;
  }
  
  /**
   * 서버 이미지 메타데이터 처리
   */
  private async _processServerImages(imageMetadata: FileMetadata[]): Promise<string[]> {
    const result: string[] = [];
    
    for (const metadata of imageMetadata) {
      // 서버 이미지는 contentType으로 이미지 여부 확인
      if (!metadata.contentType?.startsWith('image/')) {
        console.warn(`이미지가 아닌 파일 무시: ${metadata.originalName}`);
        continue;
      }
      
      try {
        const fullUrl = getFullFileUrl(metadata.url);
        const base64DataUrl = await imageToBase64(fullUrl, metadata.originalName);
        
        // base64 데이터 추출 및 검증
        const base64Data = this._extractBase64Data(base64DataUrl);
        if (base64Data) {
          result.push(base64Data);
          console.log(`서버 이미지 로드 성공: ${metadata.originalName}`);
        } else {
          console.warn(`유효하지 않은 Base64 이미지 형식: ${metadata.originalName}`);
        }
      } catch (error) {
        console.error(`서버 이미지 처리 오류 (${metadata.originalName}):`, error);
      }
    }
    
    return result;
  }
  
  /**
   * 로컬 이미지 메타데이터 처리
   */
  private async _processLocalImages(localImages: LocalFileMetadata[]): Promise<string[]> {
    const result: string[] = [];
    
    for (const localImage of localImages) {
      // 유효한 File 객체가 있는지 확인
      if (!localImage || !localImage.file) {
        console.warn(`유효하지 않은 로컬 이미지 메타데이터: ${localImage?.originalName || 'unknown'}`);
        continue;
      }

      // LocalFileMetadata.file을 사용하여 이미지 파일 여부 확인
      if (!isImageFile(localImage.file)) {
        console.warn(`이미지가 아닌 파일 무시: ${localImage.originalName}`);
        continue;
      }
      
      try {
        // imageToBase64 함수는 File 또는 objectUrl을 순차적으로 시도
        const base64DataUrl = await imageToBase64(localImage, localImage.originalName);
        
        // base64 데이터 추출 및 검증
        const base64Data = this._extractBase64Data(base64DataUrl);
        if (base64Data) {
          result.push(base64Data);
          console.log(`로컬 이미지 로드 성공: ${localImage.originalName}`);
        } else {
          console.warn(`유효하지 않은 Base64 이미지 형식: ${localImage.originalName}`);
        }
      } catch (error) {
        console.error(`로컬 이미지 처리 오류 (${localImage.originalName}):`, error);
      }
    }
    
    return result;
  }
  
  /**
   * File 객체 배열 처리
   */
  private async _processFileObjects(files: File[]): Promise<string[]> {
    const result: string[] = [];
    
    // 이미지 파일만 필터링
    const imageFiles = files.filter(file => isImageFile(file));
    
    for (const file of imageFiles) {
      try {
        const base64DataUrl = await imageToBase64(file, file.name);
        
        // base64 데이터 추출 및 검증
        const base64Data = this._extractBase64Data(base64DataUrl);
        if (base64Data) {
          result.push(base64Data);
          console.log(`파일 객체 이미지 로드 성공: ${file.name}`);
        } else {
          console.warn(`유효하지 않은 Base64 이미지 형식: ${file.name}`);
        }
      } catch (error) {
        console.error(`파일 객체 처리 오류 (${file.name}):`, error);
      }
    }
    
    return result;
  }

  /**
   * Ollama API 호출에 사용하기 전에 Base64 이미지 데이터 유효성 검사
   * @param dataUrl 검사할 Base64 데이터 URL
   * @returns 유효 여부
   */
  private _isValidBase64Image(dataUrl: string): boolean {
    // 문자열이고, 데이터 URL 형식이며, 이미지 MIME 타입인지 확인
    if (!dataUrl || typeof dataUrl !== 'string') return false;
    
    // 데이터 URL 형식 확인
    if (!dataUrl.startsWith('data:image/') || !dataUrl.includes(';base64,')) return false;
    
    // 최소 길이 확인 (적어도 헤더 길이보다 길어야 함)
    const minLength = 'data:image/jpeg;base64,'.length + 50;
    if (dataUrl.length < minLength) return false;
    
    // 이미지 데이터 부분 추출
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data || base64Data.length === 0) return false;
    
    // 유효한 Base64 문자만 포함하는지 확인
    const base64Pattern = /^[A-Za-z0-9+/=]+$/;
    return base64Pattern.test(base64Data);
  }

  /**
   * 데이터 URL에서 순수 Base64 데이터 부분만 추출
   * - 'data:image/xxx;base64,' 접두사 제거
   * - 유효성 검증 수행
   * 
   * @param dataUrl data:image/xxx;base64,로 시작하는 데이터 URL
   * @returns 순수 Base64 데이터 문자열 또는 유효하지 않은 경우 null
   */
  private _extractBase64Data(dataUrl: string): string | null {
    // 기본 유효성 검사
    if (!this._isValidBase64Image(dataUrl)) {
      return null;
    }
    
    try {
      // 'data:image/xxx;base64,' 접두사 제거
      const parts = dataUrl.split(',');
      if (parts.length !== 2) {
        console.warn('올바른 데이터 URL 형식이 아닙니다');
        return null;
      }
      
      const base64Data = parts[1];
      
      // 추가 유효성 검사
      if (!base64Data || base64Data.length === 0) {
        console.warn('Base64 데이터가 비어있습니다');
        return null;
      }
      
      // Base64 문자 패턴 검증
      const base64Pattern = /^[A-Za-z0-9+/=]+$/;
      if (!base64Pattern.test(base64Data)) {
        console.warn('유효하지 않은 Base64 문자가 포함되어 있습니다');
        return null;
      }
      
      return base64Data;
    } catch (error) {
      console.error('Base64 데이터 추출 오류:', error);
      return null;
    }
  }
}

// Export an instance of the service
export const ollamaService = new OllamaService();