import { convertFileToBase64 } from '../files';

/**
 * Ollama API client for text and vision models
 * 
 * This module provides utilities to call Ollama's API for both text-only
 * and multimodal (vision) models, with proper error handling and logging.
 */

// Types for the Ollama API requests and responses
export interface OllamaOptions {
  temperature?: number;
  top_k?: number;
  top_p?: number;
  num_predict?: number;
  repeat_penalty?: number;
  seed?: number;
}

// Base request interface shared by all Ollama API calls
export interface OllamaRequestBase {
  model: string;
  stream?: boolean;
  options?: OllamaOptions;
}

// Standard text-only request
export interface OllamaTextRequest extends OllamaRequestBase {
  prompt: string;
}

// Vision request with images
export interface OllamaVisionRequest extends OllamaRequestBase {
  prompt: string;
  images?: string[]; // Base64-encoded images
}

// Union type for all request types
export type OllamaRequest = OllamaTextRequest | OllamaVisionRequest;

// Response from Ollama API
export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
  eval_count?: number;
  done_reason?: string;
}

/**
 * Call Ollama API with support for both text and vision models
 * 
 * @param params Object containing model, prompt, optional images, and inputImage
 * @returns Promise with the response text
 */
export async function callOllama(params: {
  model: string;
  prompt: string;
  images?: string[];
  inputImage?: File | Blob;
  temperature?: number;
  baseUrl?: string;
  logger?: (message: string) => void;
  retryCount?: number;
  maxRetries?: number;
  mode?: 'text' | 'vision';
}): Promise<string> {
  const { 
    model, 
    prompt, 
    images,
    inputImage,
    temperature,
    baseUrl = 'http://localhost:11434',
    logger = console.log,
    retryCount = 0,
    maxRetries = 3,
    mode = 'text'
  } = params;

  // Log the API call
  logger(`Calling Ollama API with model: ${model}, mode: ${mode}, retry: ${retryCount}/${maxRetries}`);
  
  // Validate input
  if (!prompt || prompt.trim() === '') {
    throw new Error('Cannot call Ollama API with empty prompt');
  }
  
  // Check if we have image input when vision mode is specified
  if (mode === 'vision' && !inputImage && (!images || images.length === 0)) {
    const errorMsg = 'Vision mode requires an image input. Please connect an image input node or switch to text mode.';
    logger(`ERROR: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    const url = `${baseUrl}/api/generate`;
    
    // Prepare the request payload
    const requestPayload: OllamaRequest = {
      model,
      prompt,
      stream: false,
      ...(temperature !== undefined && {
        options: {
          temperature,
        },
      }),
    };
    
    // Process images for vision models
    let hasImages = false;
    
    // If direct images array is provided
    if (images && images.length > 0) {
      (requestPayload as OllamaVisionRequest).images = images;
      logger(`Including ${images.length} pre-encoded image(s) in request`);
      hasImages = true;
    }
    
    // If raw image file/blob is provided, convert it to base64
    if (inputImage) {
      try {
        const base64Image = await convertFileToBase64(inputImage);
        
        // Create images array if it doesn't exist
        if (!requestPayload.hasOwnProperty('images')) {
          (requestPayload as OllamaVisionRequest).images = [];
        }
        
        // Add the base64 image to the request
        (requestPayload as OllamaVisionRequest).images?.push(base64Image);
        
        logger(`Converted input image to base64 (${base64Image.length} chars) and added to request`);
        hasImages = true;
        
        // Replace {{input}} template with filename if available
        if (prompt.includes('{{input}}') && inputImage instanceof File) {
          requestPayload.prompt = prompt.replace(/\{\{\s*input\s*\}\}/g, inputImage.name);
          logger(`Replaced {{input}} template with filename: ${inputImage.name}`);
        }
      } catch (error) {
        logger(`Failed to convert image to base64: ${error}`);
        throw new Error(`Failed to process image for vision model: ${error}`);
      }
    }
    
    // Final check for vision mode
    if (mode === 'vision' && !hasImages) {
      const errorMsg = 'Failed to include any images in vision request';
      logger(`ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    // Log request details (excluding full images for brevity)
    const logPayload = { ...requestPayload };
    if ((logPayload as OllamaVisionRequest).images) {
      (logPayload as any).images = `[${(logPayload as OllamaVisionRequest).images?.length} images]`;
    }
    logger(`Request payload: ${JSON.stringify(logPayload)}`);
    logger(`Prompt length: ${prompt.length} characters`);
    
    // Make the API call
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Charset': 'utf-8'
      },
      body: JSON.stringify(requestPayload)
    });

    // Handle HTTP errors
    if (!response.ok) {
      const errorText = await response.text();
      logger(`API error - status: ${response.status}, text: ${errorText}`);
      throw new Error(`Ollama API error: ${response.status}: ${errorText}`);
    }

    // Get raw text response
    const rawResponseText = await response.text();
    logger(`Raw API response length: ${rawResponseText.length} characters`);
    
    // Parse the JSON
    let data: OllamaResponse;
    try {
      data = JSON.parse(rawResponseText);
      logger(`Successfully parsed response JSON`);
    } catch (parseError) {
      logger(`Error parsing JSON response: ${parseError}`);
      throw new Error(`Failed to parse Ollama API response: ${parseError}. Raw response: ${rawResponseText.substring(0, 200)}...`);
    }
    
    // Handle model loading case with retry
    if (data.done_reason === 'load') {
      logger(`Model is still loading (done_reason = "load")`);
      
      if (retryCount < maxRetries) {
        logger(`Retrying in 1 second (attempt ${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return callOllama({
          ...params,
          retryCount: retryCount + 1
        });
      } else {
        logger(`Max retries (${maxRetries}) reached for model loading`);
      }
    }
    
    // Log response structure
    logger(`Response data contains keys: ${Object.keys(data).join(', ')}`);
    if (data.response !== undefined) {
      logger(`Response field type: ${typeof data.response}, length: ${typeof data.response === 'string' ? data.response.length : 'N/A'}`);
    } else {
      logger(`Response field missing from API response`);
    }
    
    // Handle the response
    let result = '';
    if (data.response !== undefined && data.response !== null) {
      if (typeof data.response === 'string' && data.response.trim() === '') {
        if (data.done_reason === 'load') {
          logger(`Warning: Empty response with "load" done_reason after max retries`);
          result = `[Model ${model} is still loading. Please try again in a moment.]`;
        } else {
          logger(`Warning: Empty response string from API, using full data object`);
          result = JSON.stringify(data);
        }
      } else {
        result = typeof data.response === 'string' ? data.response : JSON.stringify(data.response);
      }
    } else {
      logger(`No 'response' field in API response, using full data object`);
      result = JSON.stringify(data);
    }
    
    // Final check to ensure we never return empty string
    if (!result || result.trim() === '') {
      logger(`Empty result after processing, falling back to placeholder`);
      result = `[No content returned from Ollama model: ${model}]`;
    }
    
    return result;
  } catch (error) {
    logger(`Error calling Ollama API: ${error}`);
    throw error;
  }
}

/**
 * Call Ollama Vision API with an input image
 * This specialized function handles the vision-specific case
 * 
 * @param params Object containing model, prompt, input image, and configuration
 * @returns Promise with the response text
 */
export async function callOllamaVision(params: {
  model: string;
  prompt: string;
  inputImage: Blob | File;
  temperature?: number;
  baseUrl?: string;
  logger?: (message: string) => void;
}): Promise<string> {
  const {
    model,
    prompt,
    inputImage,
    temperature,
    baseUrl = 'http://localhost:11434',
    logger = console.log
  } = params;

  logger(`Processing image for vision model: ${model}`);
  
  try {
    // Replace {{input}} in prompt with filename if present
    let processedPrompt = prompt;
    if (prompt.includes('{{input}}') && inputImage instanceof File) {
      processedPrompt = prompt.replace(/\{\{\s*input\s*\}\}/g, inputImage.name);
      logger(`Replaced {{input}} with filename: ${inputImage.name}`);
    }
    
    // Call the API with the image
    return callOllama({
      model,
      prompt: processedPrompt,
      inputImage,
      temperature,
      baseUrl,
      logger,
      mode: 'vision'
    });
  } catch (error) {
    logger(`Error in callOllamaVision: ${error}`);
    throw error;
  }
} 