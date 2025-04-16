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

// Interface for OpenAI vision-specific request payload
export interface OpenAIVisionRequestPayload {
  model: string;
  messages: {
    role: string;
    content: (OpenAITextContent | OpenAIImageContent)[];
  }[];
  temperature: number;
  max_tokens: number;
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
  
  // Validate inputs
  validateOpenAIInputs(prompt, apiKey, logger);

  try {
    // Prepare request payload
    const requestPayload = prepareOpenAITextPayload(model, prompt, temperature);
    
    // Make the API call
    const response = await makeOpenAIApiRequest(requestPayload, apiKey, logger);
    
    // Process the response
    return processOpenAITextResponse(response, model, logger);
  } catch (error) {
    logger(`Error calling OpenAI API: ${error}`);
    throw error;
  }
}

/**
 * Validate OpenAI API inputs
 */
function validateOpenAIInputs(
  prompt: string, 
  apiKey?: string, 
  logger: (message: string) => void = console.log
): void {
  if (!prompt || prompt.trim() === '') {
    throw new Error('Cannot call OpenAI API with empty prompt');
  }

  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }
}

/**
 * Prepare request payload for OpenAI text API
 */
function prepareOpenAITextPayload(
  model: string, 
  prompt: string, 
  temperature: number
): OpenAIChatRequest {
  return {
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
}

/**
 * Make OpenAI API request
 */
async function makeOpenAIApiRequest(
  requestPayload: OpenAIChatRequest | OpenAIVisionRequestPayload,
  apiKey?: string,
  logger: (message: string) => void = console.log
): Promise<Response> {
  const url = 'https://api.openai.com/v1/chat/completions';
  
  // Log request details
  logger(`Request payload to ${requestPayload.model}: prompt details being sent`);
  
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
  
  return response;
}

/**
 * Process OpenAI text response
 */
async function processOpenAITextResponse(
  response: Response,
  model: string,
  logger: (message: string) => void
): Promise<string> {
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
}

/**
 * Call OpenAI Vision API with input images
 * This specialized function handles the vision-specific case
 * 
 * @param params Object containing model, prompt, base64 image data or array of images, and configuration
 * @returns Promise with the response text
 */
export async function callOpenAIVision(params: {
  model: string;
  prompt: string;
  inputImage?: Blob | File;
  images?: string[];
  temperature?: number;
  apiKey?: string;
  logger?: (message: string) => void;
}): Promise<string> {
  const {
    model,
    prompt,
    inputImage,
    images,
    temperature = 0.7,
    apiKey,
    logger = console.log
  } = params;

  logger(`Processing images for OpenAI vision model: ${model}`);
  
  // Validate inputs
  validateOpenAIVisionInputs(apiKey, inputImage, images, logger);

  try {
    // Prepare content items
    const contentItems = await prepareOpenAIVisionContent(prompt, inputImage, images, logger);
    
    // Prepare request payload
    const requestPayload = prepareOpenAIVisionPayload(model, contentItems, temperature);
    
    // Make the API call
    const response = await makeOpenAIApiRequest(requestPayload, apiKey, logger);
    
    // Process the response
    return processOpenAIVisionResponse(response, model, logger);
  } catch (error) {
    logger(`Error calling OpenAI Vision API: ${error}`);
    throw error;
  }
}

/**
 * Validate OpenAI vision inputs
 */
function validateOpenAIVisionInputs(
  apiKey?: string,
  inputImage?: Blob | File,
  images?: string[],
  logger: (message: string) => void = console.log
): void {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  // Validate that we have at least one image source
  if (!inputImage && (!images || images.length === 0)) {
    throw new Error('Vision mode requires at least one image. Please provide either inputImage or images array.');
  }
}

/**
 * Prepare content items for OpenAI vision API
 */
async function prepareOpenAIVisionContent(
  prompt: string,
  inputImage?: Blob | File,
  images?: string[],
  logger: (message: string) => void = console.log
): Promise<(OpenAITextContent | OpenAIImageContent)[]> {
  // Prepare the message content with text
  const contentItems: (OpenAITextContent | OpenAIImageContent)[] = [
    {
      type: 'text',
      text: prompt
    }
  ];
  
  // Process single inputImage if provided
  if (inputImage) {
    await addSingleImageToContent(inputImage, contentItems, logger);
  }
  
  // Process images array if provided
  if (images && images.length > 0) {
    addImagesArrayToContent(images, contentItems, logger);
  }
  
  return contentItems;
}

/**
 * Add a single image to content items
 */
async function addSingleImageToContent(
  inputImage: Blob | File,
  contentItems: (OpenAITextContent | OpenAIImageContent)[],
  logger: (message: string) => void
): Promise<void> {
  // Convert image to base64 and data URL
  const base64Data = await imageToBase64(inputImage);
  const dataUrl = `data:${inputImage.type};base64,${base64Data}`;
  logger(`Single image converted to data URL, length: ${dataUrl.length} chars`);
  
  // Add to content items
  contentItems.push({
    type: 'image_url',
    image_url: {
      url: dataUrl
    }
  });
}

/**
 * Add an array of images to content items
 */
function addImagesArrayToContent(
  images: string[],
  contentItems: (OpenAITextContent | OpenAIImageContent)[],
  logger: (message: string) => void
): void {
  logger(`Processing ${images.length} images from array`);
  
  for (const imageData of images) {
    let dataUrl: string;
    
    // Handle both raw base64 and data URLs
    if (imageData.startsWith('data:')) {
      dataUrl = imageData;
    } else {
      // Assume it's just the base64 part and add a generic image prefix
      // This is not ideal for content type but works in most cases
      dataUrl = `data:image/png;base64,${imageData}`;
    }
    
    contentItems.push({
      type: 'image_url',
      image_url: {
        url: dataUrl
      }
    });
  }
}

/**
 * Prepare the full payload for OpenAI vision API request
 */
function prepareOpenAIVisionPayload(
  model: string,
  contentItems: (OpenAITextContent | OpenAIImageContent)[],
  temperature: number = 0.7,
  maxTokens: number = 300
): OpenAIVisionRequestPayload {
  return {
    model,
    messages: [
      {
        role: 'user',
        content: contentItems
      }
    ],
    temperature,
    max_tokens: maxTokens
  };
}

/**
 * Process OpenAI vision response
 */
async function processOpenAIVisionResponse(
  response: Response,
  model: string,
  logger: (message: string) => void
): Promise<string> {
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
}

/**
 * Convert image to base64 string
 */
export async function imageToBase64(imageData: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = reader.result as string;
        const base64Data = result.split(',')[1]; // Remove the data:image/xxx;base64, prefix
        resolve(base64Data);
      } catch (error) {
        reject(new Error(`Error converting image to base64: ${error}`));
      }
    };
    reader.onerror = () => {
      reject(new Error('Failed to read image file'));
    };
    reader.readAsDataURL(imageData);
  });
}