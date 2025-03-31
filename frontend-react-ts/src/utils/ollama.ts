interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
}

export async function generateOllamaResponse(
  model: string,
  prompt: string,
  temperature?: number,
  baseUrl: string = 'http://localhost:11434'
): Promise<string> {
  const request: OllamaGenerateRequest = {
    model,
    prompt,
    stream: false,
    ...(temperature !== undefined && {
      options: {
        temperature,
      },
    }),
  };

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: OllamaGenerateResponse = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error calling Ollama API:', error);
    throw error;
  }
} 