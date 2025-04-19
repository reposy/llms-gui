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
      openaiApiKey: apiKey, // Renamed for clarity
      images // Expecting Array<{ base64: string; mimeType: string }> | undefined
    } = params;

    console.log(`OpenAI Service: Generating response for model ${model}. Images provided: ${!!images?.length}`);

    if (!apiKey) {
      throw new Error('OpenAI API key is required but was not provided in request params.');
    }

    // Ensure temperature has a default value if not provided
    const effectiveTemperature = temperature ?? 0.7;

    // --- Construct message content based on presence of images ---
    let messagesContent: any; // Can be string or array

    if (images && images.length > 0) {
      // Vision API structure
      messagesContent = [
        { type: "text", text: prompt } // Text part
      ];
      images.forEach(image => {
        messagesContent.push({
          type: "image_url",
          image_url: {
             // Construct data URL using MIME type and base64 data
            url: `data:${image.mimeType};base64,${image.base64}`
          }
        });
      });
      console.log(`OpenAI Service: Constructed vision message content with ${images.length} image(s).`);
    } else {
      // Text-only API structure
      messagesContent = prompt;
      console.log(`OpenAI Service: Using text-only message content.`);
    }
    // --- ---

    try {
      // --- Start of integrated fetch logic ---
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            // Use the dynamically constructed content
            { role: 'user', content: messagesContent }
          ],
          temperature: effectiveTemperature,
          // stream: false // Keep streaming off for now
          // max_tokens might be needed for vision models
        })
      });

      if (!response.ok) {
          const errorText = await response.text();
          console.error(`OpenAI API Error (${response.status}): ${errorText}`);
          // Try parsing the errorText as JSON for more detail
          let errorDetails = errorText;
          try {
            const errorJson = JSON.parse(errorText);
            errorDetails = errorJson.error?.message || errorText;
          } catch (e) { /* Ignore parsing error */ }
          throw new Error(`OpenAI API request failed with status ${response.status}: ${errorDetails}`);
      }

      const result = await response.json();

      // Adjusted response check for potential variations
      const messageContent = result?.choices?.[0]?.message?.content;
      if (typeof messageContent !== 'string') {
          console.error('OpenAI API 응답 형식이 올바르지 않거나 content가 없습니다:', result);
          throw new Error('Invalid response format or missing content from OpenAI API');
      }

      console.log('OpenAI API 호출 성공');
      // --- End of integrated fetch logic ---

      return {
        response: messageContent,
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