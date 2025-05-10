import { LLMRequestParams, LLMServiceResponse, LLMProviderService } from './llm/types';
import { readFileAsBase64 } from '../utils/data/fileUtils';
import { getFullFileUrl, isImageFile } from '../types/files';

/**
 * OpenAI API 호출 함수
 * @deprecated Prefer OpenAIService class implementation.
 */
// async function callOpenAIFunc(...) { ... } // Deprecated 함수 제거

/**
 * Implements the LLMProviderService interface for the OpenAI provider.
 */
class OpenAIService implements LLMProviderService {
  async generate(params: LLMRequestParams): Promise<LLMServiceResponse> {
    const {
      model,
      prompt,
      temperature,
      openaiApiKey: apiKey,
      inputFiles, // 기존 File[] | undefined
      imageMetadata // 새로운 FileMetadata[] | undefined
    } = params;

    console.log(`OpenAI Service: Generating response for model ${model}`);
    console.log(`File objects: ${inputFiles?.length ?? 0}, Image metadata: ${imageMetadata?.length ?? 0}`);

    if (!apiKey) {
      throw new Error('OpenAI API key is required but was not provided.');
    }
    const effectiveTemperature = temperature ?? 0.7;

    try {
      // --- 콘텐츠 준비 (파일 변환 및 이미지 메타데이터 처리) --- 
      let messagesContent: any; // 문자열 또는 배열
      
      // 비전 모드 감지 (이미지 있음)
      const hasImageFiles = Array.isArray(inputFiles) && inputFiles.length > 0;
      const hasImageMetadata = Array.isArray(imageMetadata) && imageMetadata.length > 0;
      const isVisionMode = hasImageFiles || hasImageMetadata;

      if (isVisionMode) {
        console.log(`OpenAI Service: Preparing images for Vision API...`);
        let imageContentItems: Array<{ type: string; image_url: { url: string } }> = [];
        
        // 1. 이미지 메타데이터 처리 (서버에 저장된 이미지)
        if (hasImageMetadata) {
          try {
            const metadataImageItems = imageMetadata!.map(meta => ({
              type: "image_url" as const,
              image_url: { url: getFullFileUrl(meta.url) }
            }));
            imageContentItems = [...imageContentItems, ...metadataImageItems];
            console.log(`OpenAI Service: Added ${metadataImageItems.length} images from metadata`);
          } catch (error) {
            console.error('Error processing image metadata:', error);
          }
        }
        
        // 2. 기존 File 객체 처리 (호환성 유지)
        if (hasImageFiles) {
          try {
            const imagePromises = inputFiles!
              .filter(file => isImageFile(file))
              .map(async (file) => {
                const base64DataUrl = await readFileAsBase64(file);
                return {
                  type: "image_url" as const,
                  image_url: { url: base64DataUrl }
                };
              });
            const fileImageItems = await Promise.all(imagePromises);
            imageContentItems = [...imageContentItems, ...fileImageItems];
            console.log(`OpenAI Service: Added ${fileImageItems.length} images from File objects`);
          } catch (conversionError) {
            console.error('OpenAI Service: Error converting files:', conversionError);
          }
        }
        
        // 비전 API 메시지 콘텐츠 구성
        messagesContent = [
          { type: "text", text: prompt }, // 텍스트 부분 먼저
          ...imageContentItems // 이미지 객체 펼치기
        ];
        console.log(`OpenAI Service: Constructed vision message with ${imageContentItems.length} images`);
      } else {
        // 텍스트 전용 API 구조
        messagesContent = prompt;
        console.log(`OpenAI Service: Using text-only message`);
      }
      // --- 콘텐츠 준비 끝 --- 

      // --- API 호출 --- 
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'user', content: messagesContent }
          ],
          temperature: effectiveTemperature,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API Error (${response.status}): ${errorText}`);
        // 오류 세부 정보 파싱 시도
        let errorDetails = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson.error?.message || errorText;
        } catch (e) { /* 파싱 오류 무시 */ }
        throw new Error(`OpenAI API request failed with status ${response.status}: ${errorDetails}`);
      }

      const result = await response.json();

      // 응답 확인 및 콘텐츠 추출
      const messageContent = result?.choices?.[0]?.message?.content;
      if (typeof messageContent !== 'string') {
        console.error('OpenAI API 응답 형식이 올바르지 않거나 content가 없습니다:', result);
        throw new Error('Invalid response format or missing content from OpenAI API');
      }

      console.log('OpenAI API 호출 성공');
      return {
        response: messageContent,
        usage: result.usage,
        raw: result
      };

    } catch (error) {
      console.error('OpenAI Service Error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`OpenAI Service failed: ${String(error)}`);
    }
  }
}

// Export an instance of the service
export const openaiService = new OpenAIService(); 