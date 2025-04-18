import { LLMResponse } from './llmService'; // Assuming LLMResponse stays in llmService for now

/**
 * Ollama API 호출 함수 (fetch 사용)
 */
export async function callOllama({
  model,
  prompt,
  temperature,
  ollamaUrl = 'http://localhost:11434', // Use default if not provided
  images // Base64 encoded image data (without prefix) expected here
}: {
  model: string;
  prompt: string;
  temperature: number;
  ollamaUrl?: string; 
  images?: string[]; // Expecting array of Base64 strings (data only)
}): Promise<LLMResponse> {
  const isVisionMode = Array.isArray(images) && images.length > 0;
  const endpoint = isVisionMode ? `${ollamaUrl}/api/chat` : `${ollamaUrl}/api/generate`;
  let body: string;

  console.log(`Ollama API 호출 (${isVisionMode ? 'Vision' : 'Text'}): ${model}, Endpoint: ${endpoint}`);

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
        temperature
      }
    }); 
  } else {
    body = JSON.stringify({ 
      model,
      prompt,
      stream: false, 
      options: {
        temperature
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
    return {
      response: responseText,
      raw: result // Store the full response object
    };

  } catch (error) {
    console.error('Ollama API 직접 호출 오류:', error);
    if (error instanceof Error && error.message.startsWith('Ollama API request failed')) {
        throw error;
    }
    throw new Error(`Ollama API 호출 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
} 