import { LLMProvider, LLMMode } from '../api/llm';

import ollama from 'ollama';

// Simple logger interface that can work with either a function or an object
type LoggerFunction = (message: string) => void;

interface LoggerObject {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

type Logger = LoggerObject | LoggerFunction;

// Helper function to log messages with either type of logger
function logMessage(logger: Logger, level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
  if (typeof logger === 'function') {
    logger(message);
  } else {
    switch (level) {
      case 'debug': logger.debug(message); break;
      case 'info': logger.info(message); break;
      case 'warn': logger.warn(message); break;
      case 'error': logger.error(message); break;
    }
  }
}

/**
 * Guess the MIME type based on file extension
 * @param url String URL or path to guess the MIME type from
 * @returns MIME type string or default 'image/jpeg' if unable to determine
 */
export function guessMimeType(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp'
  };
  
  return extension && mimeTypes[extension] ? mimeTypes[extension] : 'image/jpeg';
}

/**
 * Check if a string is a valid URL
 */
function isValidURL(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert a File object to a base64 string with a data URL prefix
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

/**
 * Remove the data URL prefix from a base64 string
 */
export function removeDataUrlPrefix(dataUrl: string): string {
  const match = dataUrl.match(/^data:[^;]+;base64,(.*)$/);
  return match ? match[1] : dataUrl;
}

/**
 * Extract images from input for vision API
 */
export async function extractImagesFromInput(input: any): Promise<string[]> {
  const images: string[] = [];
  
  // Handle null/undefined
  if (!input) {
    console.log("extractImagesFromInput: Input is null or undefined");
    return images;
  }
  
  console.log(`extractImagesFromInput: Input type: ${typeof input}, isArray: ${Array.isArray(input)}`);
  
  // Handle object with specific properties
  if (typeof input === 'object' && !Array.isArray(input) && !(input instanceof File) && !(input instanceof Blob)) {
    console.log(`extractImagesFromInput: Object keys: ${Object.keys(input)}`);
    
    // Check for common image properties
    if (input.image) {
      console.log("extractImagesFromInput: Found image property");
      return extractImagesFromInput(input.image);
    }
    
    if (input.file) {
      console.log("extractImagesFromInput: Found file property");
      return extractImagesFromInput(input.file);
    }
    
    if (input.content && typeof input.content === 'string') {
      if (input.content.startsWith('data:image/')) {
        console.log("extractImagesFromInput: Found image content in data URL format");
        images.push(removeDataUrlPrefix(input.content));
        return images;
      }
    }
    
    // If the object has a path property that might be an image file path
    if (input.path && typeof input.path === 'string') {
      const extension = input.path.split('.').pop()?.toLowerCase();
      if (extension && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension)) {
        console.log(`extractImagesFromInput: Found image path: ${input.path}`);
        try {
          // Try to fetch the image if it's a URL
          if (isValidURL(input.path)) {
            const response = await fetch(input.path);
            const blob = await response.blob();
            const base64 = await fileToBase64(blob as File);
            images.push(removeDataUrlPrefix(base64));
          }
        } catch (error) {
          console.error(`Failed to fetch image from path: ${error}`);
        }
      }
    }
    
    // Special case for ForEach node output
    if (input.item && (typeof input.item === 'object' || typeof input.item === 'string')) {
      console.log("extractImagesFromInput: Trying to extract from forEach item");
      const itemImages = await extractImagesFromInput(input.item);
      images.push(...itemImages);
      return images;
    }
  }
  
  // Handle arrays
  if (Array.isArray(input)) {
    console.log(`extractImagesFromInput: Processing array with ${input.length} items`);
    // Process each item in the array
    for (const item of input) {
      if (typeof item === 'string') {
        if (item.startsWith('data:image/')) {
          // It's already a data URL
          console.log("extractImagesFromInput: Found data URL in array");
          images.push(removeDataUrlPrefix(item));
        } else if (isValidURL(item)) {
          try {
            // Fetch the image and convert to base64
            console.log(`extractImagesFromInput: Fetching URL: ${item}`);
            const response = await fetch(item);
            const blob = await response.blob();
            const base64 = await fileToBase64(blob as File);
            images.push(removeDataUrlPrefix(base64));
          } catch (error) {
            console.error(`Failed to fetch image from URL: ${error}`);
          }
        } else if (item.match(/^[A-Za-z0-9+/=]+$/)) {
          // Looks like a base64 string without data URL prefix
          console.log("extractImagesFromInput: Found potential base64 string");
          images.push(item);
        }
      } else if (item instanceof File || item instanceof Blob) {
        // Convert File/Blob to base64
        console.log("extractImagesFromInput: Converting File/Blob to base64");
        const base64 = await fileToBase64(item as File);
        images.push(removeDataUrlPrefix(base64));
      } else if (typeof item === 'object') {
        // Recursively process objects within the array
        console.log("extractImagesFromInput: Recursively processing object in array");
        const nestedImages = await extractImagesFromInput(item);
        images.push(...nestedImages);
      }
    }
  } 
  // Handle single string (URL or data URL)
  else if (typeof input === 'string') {
    if (input.startsWith('data:image/')) {
      console.log("extractImagesFromInput: Found data URL string");
      images.push(removeDataUrlPrefix(input));
    } else if (isValidURL(input)) {
      try {
        console.log(`extractImagesFromInput: Fetching URL: ${input}`);
        const response = await fetch(input);
        const blob = await response.blob();
        const base64 = await fileToBase64(blob as File);
        images.push(removeDataUrlPrefix(base64));
      } catch (error) {
        console.error(`Failed to fetch image from URL: ${error}`);
      }
    } else if (input.match(/^[A-Za-z0-9+/=]+$/)) {
      // Looks like a base64 string without data URL prefix
      console.log("extractImagesFromInput: Found potential base64 string");
      images.push(input);
    }
  }
  // Handle single File/Blob
  else if (input instanceof File || input instanceof Blob) {
    console.log("extractImagesFromInput: Converting File/Blob to base64");
    const base64 = await fileToBase64(input as File);
    images.push(removeDataUrlPrefix(base64));
  }
  
  console.log(`extractImagesFromInput: Extracted ${images.length} images`);
  return images;
}

/**
 * Call Ollama with text mode
 */
export async function callOllamaText(
  model: string,
  prompt: string,
  temperature: number = 0.7,
  baseUrl: string = 'http://localhost:11434',
  logger: Logger = console.log
): Promise<string> {
  try {
    if (typeof logger === 'function') {
      logger(`Calling Ollama API in text mode with model: ${model}`);
    } else {
      logMessage(logger, 'info', `Calling Ollama API in text mode with model: ${model}`);
    }
    
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        options: { temperature },
        stream: false
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    return data.response || JSON.stringify(data);
    
  } catch (error) {
    if (typeof logger === 'function') {
      logger(`Error calling Ollama text API: ${error}`);
    } else {
      logMessage(logger, 'error', `Error calling Ollama text API: ${error}`);
    }
    throw error;
  }
}

/**
 * Call Ollama API in vision mode using ollama package
 */
export async function callOllamaVisionApi(
  model: string,
  prompt: string,
  images: string[] | unknown,
  temperature: number = 0.7,
  baseUrl: string = 'http://localhost:11434',  // Note: baseUrl is kept for backwards compatibility but not used with ollama package
  logger: Logger = console.log
): Promise<string> {
  try {
    // Validate and process images
    const validatedImages = await validateAndProcessImages(images, logger);
    
    // Throw error if no valid images remain
    if (validatedImages.length === 0) {
      throw new Error('No valid images found. Please check your image format.');
    }
    
    if (typeof logger === 'function') {
      logger(`Calling Ollama API in vision mode with model: ${model}, images: ${validatedImages.length}`);
      if (baseUrl !== 'http://localhost:11434') {
        logger(`Note: Using ollama package with default configuration. Custom baseUrl (${baseUrl}) is ignored.`);
      }
    } else {
      logMessage(logger, 'info', `Calling Ollama API in vision mode with model: ${model}, images: ${validatedImages.length}`);
      if (baseUrl !== 'http://localhost:11434') {
        logMessage(logger, 'warn', `Note: Using ollama package with default configuration. Custom baseUrl (${baseUrl}) is ignored.`);
      }
    }
    
    // Call Ollama chat API using the ollama package
    const response = await ollama.chat({
      model,
      messages: [{
        role: 'user',
        content: prompt,
        images: validatedImages
      }],
      options: {
        temperature
      }
    });
    
    if (typeof logger === 'function') {
      logger(`Received response from Ollama API`);
    } else {
      logMessage(logger, 'info', `Received response from Ollama API`);
    }
    
    // Return the message content
    return response.message.content;
    
  } catch (error) {
    if (typeof logger === 'function') {
      logger(`Error calling Ollama vision API: ${error}`);
    } else {
      logMessage(logger, 'error', `Error calling Ollama vision API: ${error}`);
    }
    throw error;
  }
}

/**
 * Validate and process images for vision API
 * @param images Array of image strings to validate
 * @param logger Logger function or object
 * @returns Array of validated images
 */
export async function validateAndProcessImages(
  images: string[] | unknown,
  logger: Logger = console.log
): Promise<string[]> {
  // Ensure images is an array
  if (!Array.isArray(images)) {
    if (typeof logger === 'function') {
      logger(`Images is not an array but ${typeof images}. Converting to array.`);
    } else {
      logMessage(logger, 'warn', `Images is not an array but ${typeof images}. Converting to array.`);
    }
    
    // If it's a single image, put it in an array
    images = images ? [images] : [];
  }
  
  // At this point, we know images is an array
  const imagesArray = images as unknown[];
  
  // Process each image - we use Promise.all to handle async operations
  const processedImagesPromises = imagesArray.map(async (img: unknown): Promise<string | null> => {
    if (!img) {
      if (typeof logger === 'function') {
        logger('Invalid image: null or undefined');
      } else {
        logMessage(logger, 'warn', 'Invalid image: null or undefined');
      }
      return null;
    }
    
    // Special case for objects that might contain image data
    if (typeof img === 'object' && img !== null) {
      if (typeof logger === 'function') {
        logger(`Found object in images array. Keys: ${Object.keys(img)}`);
      } else {
        logMessage(logger, 'debug', `Found object in images array. Keys: ${Object.keys(img)}`);
      }
      return null; // We handle special objects separately
    }
    
    // Check if it's a data URL
    if (typeof img === 'string' && img.startsWith('data:')) {
      // It's a valid data URL format, so remove the prefix
      return removeDataUrlPrefix(img);
    }
    
    // Check if it's already a base64 string
    if (typeof img === 'string' && /^[A-Za-z0-9+/=]+$/.test(img)) {
      return img;
    }
    
    // Check if it's a path to an image file
    if (typeof img === 'string') {
      const extension = img.split('.').pop()?.toLowerCase();
      if (extension && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension)) {
        try {
          if (typeof logger === 'function') {
            logger(`Attempting to fetch image from path: ${img}`);
          } else {
            logMessage(logger, 'info', `Attempting to fetch image from path: ${img}`);
          }
          
          // Check if it's a URL
          if (isValidURL(img)) {
            // Fetch the image
            const response = await fetch(img);
            if (!response.ok) {
              throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            }
            
            const blob = await response.blob();
            // Convert to base64
            const base64 = await fileToBase64(blob as File);
            // Remove data URL prefix
            return removeDataUrlPrefix(base64);
          } else {
            // It might be a local file path
            // Note: Browser environments can't access local files directly
            // This would need fs module in Node.js environments
            if (typeof logger === 'function') {
              logger(`Local file paths are not supported in browser environment: ${img}`);
            } else {
              logMessage(logger, 'warn', `Local file paths are not supported in browser environment: ${img}`);
            }
            return null;
          }
        } catch (error) {
          if (typeof logger === 'function') {
            logger(`Error processing image path: ${error}`);
          } else {
            logMessage(logger, 'error', `Error processing image path: ${error}`);
          }
          return null;
        }
      }
    }
    
    if (typeof logger === 'function') {
      logger(`Invalid image format: ${typeof img}`);
    } else {
      logMessage(logger, 'warn', `Invalid image format: ${typeof img}`);
    }
    return null;
  });
  
  // Resolve all promises and filter out nulls
  const processedImages = (await Promise.all(processedImagesPromises)).filter(Boolean) as string[];
  
  // Log the results
  if (typeof logger === 'function') {
    logger(`Validated ${processedImages.length} images out of ${imagesArray.length}`);
  } else {
    logMessage(logger, 'info', `Validated ${processedImages.length} images out of ${imagesArray.length}`);
  }
  
  return processedImages;
}

/**
 * Handle request for different modes
 */
export async function handleRequest(params: {
  provider: LLMProvider;
  model: string;
  prompt: string;
  input: any;
  mode: LLMMode;
  temperature?: number;
  baseUrl?: string;
  logger?: Logger;
}): Promise<string> {
  const {
    provider,
    model,
    prompt,
    input,
    mode,
    temperature = 0.7,
    baseUrl = 'http://localhost:11434',
    logger = console.log
  } = params;
  
  // Only support Ollama provider for now
  if (provider !== 'ollama') {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  
  try {
    // Handle based on mode
    if (mode === 'text') {
      // For text mode, replace {{input}} with the text input
      let processedPrompt = prompt;
      
      if (input !== null && input !== undefined) {
        const inputStr = Array.isArray(input) ? input.join(', ') : String(input);
        processedPrompt = prompt.replace(/\{\{\s*input\s*\}\}/g, inputStr);
      }
      
      return await callOllamaText(model, processedPrompt, temperature, baseUrl, logger);
    } 
    else if (mode === 'vision') {
      // For vision mode, extract images from input
      const images = await extractImagesFromInput(input);
      
      // Validate the extracted images
      const validatedImages = await validateAndProcessImages(images, logger);
      
      if (validatedImages.length === 0) {
        throw new Error('No valid images found for vision mode');
      }
      
      return await callOllamaVisionApi(model, prompt, validatedImages, temperature, baseUrl, logger);
    }
    
    throw new Error(`Unsupported mode: ${mode}`);
  } 
  catch (error) {
    if (typeof logger === 'function') {
      logger(`Error in handleRequest: ${error}`);
    } else {
      logMessage(logger, 'error', `Error in handleRequest: ${error}`);
    }
    throw error;
  }
}

/**
 * Process ForEach node output for image extraction
 * This helper function can be used to handle specific data structures from ForEach nodes
 * @param input The ForEach node output data
 * @returns Processed image data
 */
export function processForEachOutput(input: any): any {
  console.log(`processForEachOutput: Processing input type ${typeof input}`);
  
  // If input is null or undefined, return as is
  if (input === null || input === undefined) {
    return input;
  }
  
  // If it's already an array, return as is
  if (Array.isArray(input)) {
    return input;
  }
  
  // Check for ForEach node specific output structure
  if (typeof input === 'object') {
    console.log(`processForEachOutput: Object keys - ${Object.keys(input)}`);
    
    // Look for ForEach 'item' property
    if ('item' in input) {
      console.log(`processForEachOutput: Found 'item' property, type: ${typeof input.item}`);
      return input.item;
    }
    
    // Look for current/accumulated values in ForEach structures
    if ('current' in input) {
      console.log(`processForEachOutput: Found 'current' property`);
      return input.current;
    }
    
    // Some ForEach nodes might use 'value' property
    if ('value' in input) {
      console.log(`processForEachOutput: Found 'value' property`);
      return input.value;
    }
    
    // Look for 'data' or 'content' properties
    if ('data' in input) {
      return input.data;
    }
    
    if ('content' in input) {
      return input.content;
    }
  }
  
  // If no specific structure found, return input as is
  return input;
} 