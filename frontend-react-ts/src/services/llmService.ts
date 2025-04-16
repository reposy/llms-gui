/**
 * LLM 서비스 인터페이스 및 함수
 */

/**
 * LLM 호출 파라미터 인터페이스
 */
export interface RunLLMParams {
  provider: string;
  model: string;
  prompt: string;
  temperature: number;
  ollamaUrl?: string;
  openaiApiKey?: string;
}

/**
 * LLM 응답 인터페이스
 */
export interface LLMResponse {
  response: string;
  raw?: any;
}

/**
 * LLM 호출 함수
 * 현재는 Ollama와 OpenAI provider를 지원
 */
export async function runLLM({
  provider,
  model,
  prompt,
  temperature,
  ollamaUrl = 'http://localhost:11434',
  openaiApiKey
}: RunLLMParams): Promise<LLMResponse> {
  console.log(`LLM 호출: ${provider}, ${model}`);
  
  if (provider === 'ollama') {
    return await callOllama({
      model,
      prompt,
      temperature,
      ollamaUrl
    });
  } else if (provider === 'openai') {
    if (!openaiApiKey) {
      throw new Error('OpenAI API 키가 필요합니다');
    }
    return await callOpenAI({
      model,
      prompt,
      temperature,
      apiKey: openaiApiKey
    });
  }
  
  throw new Error(`지원하지 않는 LLM provider: ${provider}`);
}

/**
 * Ollama API 호출 함수
 */
async function callOllama({
  model,
  prompt,
  temperature,
  ollamaUrl
}: {
  model: string;
  prompt: string;
  temperature: number;
  ollamaUrl: string;
}): Promise<LLMResponse> {
  try {
    console.log(`Ollama API 호출: ${model}, ${ollamaUrl}`);
    
    // Ollama API 호출
    // const response = await fetch(`${ollamaUrl}/api/generate`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     model,
    //     prompt,
    //     options: {
    //       temperature
    //     }
    //   })
    // });
    
    // const result = await response.json();
    
    // 테스트용 임시 응답
    console.log('테스트 응답 반환 (실제 API 호출 구현 필요)');
    return {
      response: `LLM 응답: 모델 ${model}, 텍스트 처리 완료`,
      raw: { model, prompt }
    };
  } catch (error) {
    console.error('Ollama API 호출 오류:', error);
    throw new Error(`Ollama API 호출 실패: ${error}`);
  }
}

/**
 * OpenAI API 호출 함수
 */
async function callOpenAI({
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
  try {
    console.log(`OpenAI API 호출: ${model}`);
    
    // OpenAI API 호출
    // const response = await fetch('https://api.openai.com/v1/chat/completions', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${apiKey}`
    //   },
    //   body: JSON.stringify({
    //     model,
    //     messages: [
    //       { role: 'user', content: prompt }
    //     ],
    //     temperature
    //   })
    // });
    
    // const result = await response.json();
    
    // 테스트용 임시 응답
    console.log('테스트 응답 반환 (실제 API 호출 구현 필요)');
    return {
      response: `OpenAI 응답: 모델 ${model}, 텍스트 처리 완료`,
      raw: { model, messages: [{ role: 'user', content: prompt }] }
    };
  } catch (error) {
    console.error('OpenAI API 호출 오류:', error);
    throw new Error(`OpenAI API 호출 실패: ${error}`);
  }
} 