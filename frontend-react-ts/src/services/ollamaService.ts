import { LLMRequestParams, LLMServiceResponse, LLMProviderService } from './llm/types';
import { readFileAsBase64 } from '../utils/data/fileUtils.ts';

/**
 * Ollama API 호출 함수 (fetch 사용)
 * @deprecated Prefer OllamaService class implementation.
 */
// async function callOllamaFunc(...) { ... } // Deprecated 함수 제거

/**
 * Implements the LLMProviderService interface for the Ollama provider.
 */
class OllamaService implements LLMProviderService {
  async generate(params: LLMRequestParams): Promise<LLMServiceResponse> {
    const { 
      model,
      prompt,
      temperature,
      images, // Now expecting File[] | undefined
      ollamaUrl = 'http://localhost:11434'
    } = params;

    const isVisionMode = Array.isArray(images) && images.length > 0;
    const endpoint = isVisionMode ? `${ollamaUrl}/api/chat` : `${ollamaUrl}/api/generate`;
    let body: string;

    console.log(`Ollama Service: Generating response (${isVisionMode ? 'Vision' : 'Text'}) for model ${model}, Endpoint: ${endpoint}`);
    const effectiveTemperature = temperature ?? 0.7;

    try {
      let base64ImageStrings: string[] | undefined = undefined;
      if (isVisionMode) {
        // --- Convert File objects to base64 strings --- 
        console.log(`Ollama Service: Converting ${images.length} files to Base64...`);
        try {
            const base64Promises = images.map(file => readFileAsBase64(file));
            const base64DataUrls = await Promise.all(base64Promises);
            // Extract only the base64 part (after the comma)
            base64ImageStrings = base64DataUrls.map(dataUrl => dataUrl.split(',')[1]);
            console.log(`Ollama Service: Successfully converted images to Base64 strings.`);
        } catch (conversionError) {
            console.error('Ollama Service: Error converting files to Base64:', conversionError);
            throw new Error(`Failed to convert images to Base64: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}`);
        }
        // --- End conversion --- 
      }

      // --- Construct request body --- 
      if (isVisionMode) {
        body = JSON.stringify({ 
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
              images: base64ImageStrings // Pass the array of base64 strings
            }
          ],
          stream: false, 
          options: {
            temperature: effectiveTemperature
          }
        }); 
      } else {
        body = JSON.stringify({ 
          model,
          prompt,
          stream: false, 
          options: {
            temperature: effectiveTemperature
          }
        });
      }
      // --- End body construction --- 
    
      // --- API Call --- 
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: body
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ollama API Error (${response.status}): ${errorText}`);
        throw new Error(`Ollama API request failed with status ${response.status}: ${errorText}`);
      }
  
      const result = await response.json();
  
      let responseText = '';
      if (isVisionMode) {
        // Assuming chat endpoint response structure is { message: { content: "..." } }
        if (result && result.message && typeof result.message.content === 'string') {
          responseText = result.message.content;
        } else {
          console.error('Ollama Chat API 응답 형식이 올바르지 않습니다:', result);
          throw new Error('Invalid response format from Ollama Chat API');
        }
      } else {
        // Original handling for generate endpoint
        if (result && typeof result.response === 'string') {
          responseText = result.response;
        } else {
          console.error('Ollama Generate API 응답 형식이 올바르지 않습니다:', result);
          throw new Error('Invalid response format from Ollama Generate API');
        }
      }
      
      console.log('Ollama API 호출 성공');
      return {
        response: responseText,
      };
  
    } catch (error) {
      // Log the error from conversion or API call
      console.error('Ollama Service Error:', error);
      // Re-throw a consistent error format if possible
      if (error instanceof Error && (error.message.startsWith('Ollama API request failed') || error.message.startsWith('Failed to convert images'))) {
          throw error;
      }
      throw new Error(`Ollama Service failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Export an instance of the service
export const ollamaService = new OllamaService(); 