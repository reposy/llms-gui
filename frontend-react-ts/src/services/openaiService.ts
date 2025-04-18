import { LLMResponse } from './llmService'; // Assuming LLMResponse stays in llmService for now

/**
 * OpenAI API 호출 함수
 */
export async function callOpenAI({
  model,
  prompt,
  temperature,
  apiKey
}: {
  model: string;
  prompt: string;
  temperature: number;
  apiKey: string;
}): Promise<LLMResponse> {
  console.log(`OpenAI API 호출: ${model}`);
  
  if (!apiKey) {
    throw new Error('OpenAI API key is required.');
  }

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
        temperature,
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
      raw: result
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