import { LLMRequestParams, LLMServiceResponse, LLMProviderService } from './llm/types';

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
      images, // Base64 encoded image data (without prefix) expected here
      ollamaUrl = 'http://localhost:11434' // Use default if not provided in params
    } = params;

    // --- Start of integrated fetch logic from callOllamaFunc ---
    const isVisionMode = Array.isArray(images) && images.length > 0;
    const endpoint = isVisionMode ? `${ollamaUrl}/api/chat` : `${ollamaUrl}/api/generate`;
    let body: string;

    console.log(`Ollama Service: Generating response (${isVisionMode ? 'Vision' : 'Text'}) for model ${model}, Endpoint: ${endpoint}`);

    // Ensure temperature has a default value if not provided
    const effectiveTemperature = temperature ?? 0.7;

    if (isVisionMode) {
      body = JSON.stringify({ 
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
            images: images // Pass the array of Base64 data strings
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
    
    try {
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
      // --- End of integrated fetch logic ---

      // Return using the LLMServiceResponse interface
      return {
        response: responseText,
        // raw: result // Optionally keep raw response if needed later
      };
  
    } catch (error) {
      console.error('Ollama API 직접 호출 오류:', error);
      if (error instanceof Error && error.message.startsWith('Ollama API request failed')) {
          throw error;
      }
      throw new Error(`Ollama API 호출 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Export an instance of the service
export const ollamaService = new OllamaService(); 