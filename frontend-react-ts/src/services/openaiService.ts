import { LLMRequestParams, LLMServiceResponse, LLMProviderService } from './llm/types';

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
      openaiApiKey: apiKey // Renamed for clarity within this scope
      // ignore images for now, OpenAI vision might need different handling
    } = params;

    console.log(`OpenAI Service: Generating response for model ${model}`);

    if (!apiKey) {
      throw new Error('OpenAI API key is required but was not provided in request params.');
    }

    // Ensure temperature has a default value if not provided
    const effectiveTemperature = temperature ?? 0.7;

    try {
      // --- Start of integrated fetch logic from callOpenAIFunc ---
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: effectiveTemperature, 
          // stream: false 
        })
      });
      
      if (!response.ok) {
          const errorText = await response.text();
          console.error(`OpenAI API Error (${response.status}): ${errorText}`);
          throw new Error(`OpenAI API request failed with status ${response.status}: ${errorText}`);
      }
  
      const result = await response.json();
  
      if (!result || !Array.isArray(result.choices) || result.choices.length === 0 || !result.choices[0].message || typeof result.choices[0].message.content !== 'string') {
          console.error('OpenAI API 응답 형식이 올바르지 않습니다:', result);
          throw new Error('Invalid response format from OpenAI API');
      }
  
      console.log('OpenAI API 호출 성공');
      // --- End of integrated fetch logic ---

      return {
        response: result.choices[0].message.content,
        // raw: result // Optionally keep raw response if needed later
      };

    } catch (error) {
      console.error('OpenAI API 호출 오류:', error);
      // Avoid re-throwing generic error if specific error was already thrown
      if (error instanceof Error && error.message.startsWith('OpenAI API request failed')) {
          throw error;
      }
      throw new Error(`OpenAI API 호출 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Export an instance of the service
export const openaiService = new OpenAIService(); 