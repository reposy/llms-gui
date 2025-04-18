import { LLMRequestParams, LLMServiceResponse, LLMProviderService } from './llm/types';

/**
 * OpenAI API 호출 함수
 * @deprecated Prefer OpenAIService class implementation.
 */
async function callOpenAIFunc({
  model,
  prompt,
  temperature,
  apiKey // Renamed from openaiApiKey to match internal logic
}: {
  model: string;
  prompt: string;
  temperature?: number; // Made temperature optional
  apiKey: string;
}): Promise<LLMServiceResponse> {
  console.log(`OpenAI API 호출: ${model}`);
  
  if (!apiKey) {
    throw new Error('OpenAI API key is required.');
  }

  // Ensure temperature has a default value if not provided
  const effectiveTemperature = temperature ?? 0.7;

  try {
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
        temperature: effectiveTemperature, // Use effective temperature
        // stream: false // Consider adding if needed, default is non-streaming
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

/**
 * Implements the LLMProviderService interface for the OpenAI provider.
 */
class OpenAIService implements LLMProviderService {
  async generate(params: LLMRequestParams): Promise<LLMServiceResponse> {
    const { 
      model,
      prompt,
      temperature,
      openaiApiKey // Get openaiApiKey from params
      // ignore images for now, OpenAI vision might need different handling
    } = params;

    if (!openaiApiKey) {
      throw new Error('OpenAI API key is required but was not provided in request params.');
    }

    // Call the existing fetch logic
    const result = await callOpenAIFunc({
      model,
      prompt,
      temperature,
      apiKey: openaiApiKey
    });

    return result; // Already conforms to LLMServiceResponse
  }
}

// Export an instance of the service
export const openaiService = new OpenAIService(); 