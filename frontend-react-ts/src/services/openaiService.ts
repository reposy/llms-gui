import { LLMRequestParams, LLMServiceResponse, LLMProviderService } from './llm/types';
import { readFileAsBase64 } from '../utils/data/fileUtils.ts';

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
      images // Now expecting File[] | undefined
    } = params;

    console.log(`OpenAI Service: Generating response for model ${model}. Files provided: ${images?.length ?? 0}`);

    if (!apiKey) {
      throw new Error('OpenAI API key is required but was not provided.');
    }
    const effectiveTemperature = temperature ?? 0.7;

    try {
      // --- Prepare message content (convert files if needed) --- 
      let messagesContent: any; // Can be string or array
      const isVisionMode = Array.isArray(images) && images.length > 0;

      if (isVisionMode) {
        console.log(`OpenAI Service: Converting ${images.length} files for Vision API...`);
        let imageDataForApi: Array<{ type: string; image_url: { url: string } }> = [];
        try {
          const imagePromises = images.map(async (file) => {
            const base64DataUrl = await readFileAsBase64(file);
            // OpenAI expects data URL format: data:[mimeType];base64,[data]
            return {
              type: "image_url" as const,
              image_url: { url: base64DataUrl }
            };
          });
          imageDataForApi = await Promise.all(imagePromises);
          console.log(`OpenAI Service: Successfully prepared ${imageDataForApi.length} image(s) for API.`);
        } catch (conversionError) {
            console.error('OpenAI Service: Error converting files:', conversionError);
            throw new Error(`Failed to convert images for OpenAI: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}`);
        }
        
        // Construct Vision API message content
        messagesContent = [
          { type: "text", text: prompt }, // Text part first
          ...imageDataForApi // Spread the image objects
        ];
        console.log(`OpenAI Service: Constructed vision message content.`);

      } else {
        // Text-only API structure
        messagesContent = prompt;
        console.log(`OpenAI Service: Using text-only message content.`);
      }
      // --- End content preparation --- 

      // --- API Call --- 
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
          // max_tokens: 300 // Consider adding max_tokens for vision
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
      return {
        response: messageContent,
      };

    } catch (error) {
      console.error('OpenAI Service Error:', error);
      if (error instanceof Error && (error.message.startsWith('OpenAI API request failed') || error.message.startsWith('Failed to convert images'))) {
          throw error;
      }
      throw new Error(`OpenAI Service failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Export an instance of the service
export const openaiService = new OpenAIService(); 