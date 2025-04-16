/**
 * OpenAI API client for text and vision models
 * 
 * This module provides utilities to call OpenAI's API for both text-only
 * and multimodal (vision) models, with proper error handling and logging.
 */

// Types for the OpenAI API requests and responses
export interface OpenAITextContent {
  type: 'text';
  text: string;
}

export interface OpenAIImageContent {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

export type OpenAIMessageContent = OpenAITextContent | OpenAIImageContent | (OpenAITextContent | OpenAIImageContent)[];

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAIMessageContent;
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface OpenAIChatChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

export interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChatChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call OpenAI API with support for both text and vision models
 * 
 * @param params Object containing model, prompt, and optional configuration
 * @returns Promise with the response text
 */
export async function callOpenAI(params: {
  model: string;
  prompt: string;
  temperature?: number;
  apiKey?: string;
  logger?: (message: string) => void;
}): Promise<string> {
  const { 
    model, 
    prompt, 
    temperature = 0.7,
    apiKey,
    logger = console.log
  } = params;

  // Log the API call
  logger(`Calling OpenAI API with model: ${model}`);
  
  // Validate input
  if (!prompt || prompt.trim() === '') {
    throw new Error('Cannot call OpenAI API with empty prompt');
  }

  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  try {
    const url = 'https://api.openai.com/v1/chat/completions';
    
    // Prepare the request payload
    const requestPayload: OpenAIChatRequest = {
      model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature,
      stream: false
    };
    
    // Log request details
    logger(`Request payload to ${model}: prompt length=${prompt.length} characters`);
    
    // Make the API call
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    // Handle HTTP errors
    if (!response.ok) {
      const errorText = await response.text();
      logger(`API error - status: ${response.status}, text: ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status}: ${errorText}`);
    }

    // Parse the JSON response
    const data: OpenAIChatResponse = await response.json();
    logger(`Received response from OpenAI API - choices: ${data.choices?.length || 0}`);
    
    // Handle the response
    if (!data.choices || data.choices.length === 0) {
      logger(`Warning: No choices in API response`);
      return '[No response received from OpenAI]';
    }
    
    const result = data.choices[0].message.content;
    
    // Final check to ensure we never return empty string
    if (!result || result.trim() === '') {
      logger(`Empty result after processing, falling back to placeholder`);
      return `[Empty response from OpenAI model: ${model}]`;
    }
    
    return result;
  } catch (error) {
    logger(`Error calling OpenAI API: ${error}`);
    throw error;
  }
}

/**
 * Call OpenAI Vision API with an input image
 * This specialized function handles the vision-specific case
 * 
 * @param params Object containing model, prompt, base64 image data, and configuration
 * @returns Promise with the response text
 */
export async function callOpenAIVision(params: {
  model: string;
  prompt: string;
  inputImage: Blob | File;
  temperature?: number;
  apiKey?: string;
  logger?: (message: string) => void;
}): Promise<string> {
  const {
    model,
    prompt,
    inputImage,
    temperature = 0.7,
    apiKey,
    logger = console.log
  } = params;

  logger(`Processing image for OpenAI vision model: ${model}`);
  
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  try {
    // Convert image to base64 and data URL
    const base64Data = await imageToBase64(inputImage);
    const dataUrl = `data:${inputImage.type};base64,${base64Data}`;
    logger(`Image converted to data URL, length: ${dataUrl.length} chars`);
    
    // Replace {{input}} in prompt with filename if present
    let processedPrompt = prompt;
    if (prompt.includes('{{input}}') && inputImage instanceof File) {
      processedPrompt = prompt.replace(/\{\{\s*input\s*\}\}/g, inputImage.name);
      logger(`Replaced {{input}} with filename: ${inputImage.name}`);
    }
    
    const url = 'https://api.openai.com/v1/chat/completions';
    
    // Prepare the message content including the image
    const content: OpenAIMessageContent = [
      {
        type: 'text',
        text: processedPrompt
      },
      {
        type: 'image_url',
        image_url: {
          url: dataUrl
        }
      }
    ];
    
    // Prepare the request payload
    const requestPayload: OpenAIChatRequest = {
      model,
      messages: [
        {
          role: 'user',
          content
        }
      ],
      temperature,
      stream: false
    };
    
    // Make the API call
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    // Handle HTTP errors
    if (!response.ok) {
      const errorText = await response.text();
      logger(`API error - status: ${response.status}, text: ${errorText}`);
      throw new Error(`OpenAI Vision API error: ${response.status}: ${errorText}`);
    }

    // Parse the JSON response
    const data: OpenAIChatResponse = await response.json();
    logger(`Received response from OpenAI Vision API - choices: ${data.choices?.length || 0}`);
    
    // Handle the response
    if (!data.choices || data.choices.length === 0) {
      logger(`Warning: No choices in API response`);
      return '[No response received from OpenAI Vision]';
    }
    
    const result = data.choices[0].message.content;
    
    // Final check to ensure we never return empty string
    if (!result || result.trim() === '') {
      logger(`Empty result after processing, falling back to placeholder`);
      return `[Empty response from OpenAI Vision model: ${model}]`;
    }
    
    return result;
  } catch (error) {
    logger(`Error in callOpenAIVision: ${error}`);
    throw error;
  }
}

/**
 * Convert an image to a base64 string for use with vision models
 * 
 * @param imageData The image data (blob or file)
 * @returns Promise with the base64-encoded image string
 */
export async function imageToBase64(imageData: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Convert the data URL to base64 by removing the prefix
        const base64String = reader.result as string;
        const base64Content = base64String.split(',')[1];
        resolve(base64Content);
      };
      reader.onerror = reject;
      reader.readAsDataURL(imageData);
    } catch (error) {
      reject(new Error(`Failed to convert image to base64: ${error}`));
    }
  });
} 