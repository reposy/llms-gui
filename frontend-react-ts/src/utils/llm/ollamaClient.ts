import ollama from "ollama";

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

// 올라마 채팅 API 메시지 타입
export interface OllamaChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[]; // base64 이미지 배열 (user 메시지에만 사용)
}

// 올라마 채팅 API 요청 타입 (/api/chat 엔드포인트)
export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  options?: OllamaOptions;
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
 * Simplified Ollama API call function
 * 
 * @param params Object containing model, prompt, optional images, and settings
 * @returns Promise with the response text
 */
export async function callOllama(params: {
  model: string;
  prompt: string;
  images?: string[] | unknown;
  temperature?: number;
  baseUrl?: string;
  logger?: (message: string) => void;
}): Promise<string> {
  const { 
    model, 
    prompt, 
    images,
    temperature = 0.7,
    baseUrl = 'http://localhost:11434',
    logger = console.log
  } = params;

  // Basic validation
  if (!prompt || prompt.trim() === '') {
    throw new Error('Cannot call Ollama API with empty prompt');
  }

  try {
    logger(`Calling Ollama API with model: ${model}`);
    
    // Check if we have images - if so, use the chat API with images
    if (images) {
      // Ensure images is an array
      const imageArray = Array.isArray(images) ? images : [images].filter(Boolean);
      
      if (imageArray.length > 0) {
        logger(`Using Ollama chat API with ${imageArray.length} images`);
        
        // Use ollama SDK's chat method for vision models
        const response = await ollama.chat({
          model,
          messages: [{
            role: 'user',
            content: prompt,
            images: imageArray
          }],
          options: {
            temperature
          }
        });
        
        logger(`Received vision response from Ollama`);
        return response.message.content;
      }
    }
    
    // For text-only requests, use the generate API
    logger(`Using Ollama generate API for text-only request`);
    
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data || typeof data.response !== 'string') {
      throw new Error('Invalid response from Ollama API');
    }
    
    logger(`Received text response from Ollama`);
    return data.response;
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
    temperature = 0.7,
    baseUrl = 'http://localhost:11434',
    logger = console.log
  } = params;

  logger(`Processing image for vision model: ${model}`);
  
  try {
    // Convert the image to base64
    const reader = new FileReader();
    const imagePromise = new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix if present
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(inputImage);
    });

    const base64Image = await imagePromise;
    
    // Use ollama chat API for vision
    logger(`Sending prompt with image to model ${model}`);
    const response = await ollama.chat({
      model,
      messages: [{
        role: 'user',
        content: prompt,
        images: [base64Image]
      }],
      options: {
        temperature
      }
    });
    
    logger(`Received vision response from Ollama`);
    return response.message.content;
  } catch (error) {
    logger(`Error in callOllamaVision: ${error}`);
    throw error;
  }
}

/**
 * Call Ollama vision API with image paths
 * 
 * @param params Object containing model, prompt, imagePaths and temperature 
 * @returns Promise with the response text
 */
export async function callOllamaVisionWithPaths(params: {
  model: string;
  prompt: string;
  imagePaths: string[];
  temperature?: number;
  logger?: (message: string) => void;
}): Promise<string> {
  const { 
    model, 
    prompt, 
    imagePaths,
    temperature = 0.7,
    logger = console.log
  } = params;

  logger(`Calling Ollama API with model: ${model}, vision mode, ${imagePaths.length} image paths`);
  
  try {
    // Use ollama SDK's chat method with direct paths
    const response = await ollama.chat({
      model,
      messages: [{
        role: 'user',
        content: prompt,
        images: imagePaths // Send image paths directly to Ollama
      }],
      options: {
        temperature
      }
    });
    
    logger(`Received vision response from Ollama`);
    return response.message.content;
  } catch (error) {
    logger(`Error in callOllamaVisionWithPaths: ${error}`);
    throw error;
  }
}

/**
 * Ollama Chat API를 호출하는 함수 (/api/chat 엔드포인트)
 */
async function makeOllamaChatApiRequest(
  baseUrl: string,
  requestPayload: OllamaChatRequest,
  logger: (message: string) => void
): Promise<Response> {
  const url = `${baseUrl}/api/chat`;
  
  // 로깅을 위해 이미지 데이터 마스킹 처리
  const loggablePayload = JSON.parse(JSON.stringify(requestPayload)) as OllamaChatRequest;
  
  // 각 메시지의 이미지 필드 마스킹 (로그 출력용)
  if (loggablePayload.messages) {
    loggablePayload.messages = loggablePayload.messages.map(msg => {
      if (msg.images && Array.isArray(msg.images)) {
        const images = msg.images;
        // 이미지 길이 정보 추가 (디버깅용)
        if (images.length > 0) {
          const imageSizes = images.map(img => img.length);
          logger(`Chat message contains ${images.length} images with lengths: ${imageSizes.join(', ')} characters`);
          
          // 첫 번째 이미지 시작 부분 확인
          if (images[0]) {
            const firstChars = images[0].substring(0, Math.min(30, images[0].length));
            logger(`First image starts with: ${firstChars}...`);
          }
        }
        
        return {
          ...msg,
          images: images.length > 0 ? [`[${images.length} images]`] : []
        };
      }
      return msg;
    });
  }
  
  logger(`Chat API request payload: ${JSON.stringify(loggablePayload)}`);
  logger(`Chat prompt length: ${requestPayload.messages[requestPayload.messages.length - 1]?.content.length || 0} characters`);
  
  try {
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
      logger(`Chat API error - status: ${response.status}, text: ${errorText}`);
      
      // 이미지 형식 관련 오류 검출
      if (errorText.includes("image: unknown format") || errorText.includes("failed to process inputs")) {
        logger(`ERROR: Ollama 비전 API에서 이미지 형식 오류가 발생했습니다. 이미지가 순수 base64 형식인지 확인하세요.`);
        
        // 이미지 형식 문제 분석
        const images = requestPayload.messages.find(msg => msg.images)?.images;
        if (images && images.length > 0) {
          // 이미지 시작 부분이 base64인지 검사
          const hasPrefixIssue = images.some(img => img && img.startsWith('data:'));
          if (hasPrefixIssue) {
            logger(`CRITICAL: 이미지에 data: 접두사가 포함되어 있습니다. Ollama는 순수 base64만 지원합니다.`);
          }
        }
      }
      
      throw new Error(`Ollama Chat API error: ${response.status}: ${errorText}`);
    }
    
    return response;
  } catch (error) {
    // 네트워크 오류 추가 정보
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      logger(`네트워크 오류: Ollama 서버에 연결할 수 없습니다. Ollama가 실행 중인지 확인하세요.`);
    }
    throw error;
  }
}

/**
 * Process Ollama Chat API response
 */
async function processOllamaChatResponse(
  response: Response,
  logger: (message: string) => void
): Promise<any> {
  // Get raw text response
  const rawResponseText = await response.text();
  logger(`Raw Chat API response length: ${rawResponseText.length} characters`);
  
  // Parse the JSON
  try {
    const data = JSON.parse(rawResponseText);
    logger(`Successfully parsed Chat response JSON`);
    return data;
  } catch (parseError) {
    logger(`Error parsing Chat JSON response: ${parseError}`);
    throw new Error(`Failed to parse Ollama Chat API response: ${parseError}. Raw response: ${rawResponseText.substring(0, 200)}...`);
  }
}

/**
 * Check if a string is likely a base64 encoded image
 * @param str String to check
 * @returns true if string is likely a base64 encoded image
 */
function isLikelyBase64(str: string): boolean {
  if (typeof str !== 'string') {
    return false;
  }
  
  // Empty string is not base64
  if (!str || str.trim() === '') {
    return false;
  }
  
  // Base64 should only contain these characters
  const base64Pattern = /^[A-Za-z0-9+/=]+$/;
  
  // Base64 strings should have a length that's a multiple of 4
  // (or very close to it with possible padding)
  const hasValidLength = str.length % 4 <= 2;
  
  // Should be of reasonable length for an image
  // Too short strings are unlikely to be valid images
  const hasReasonableLength = str.length > 100;
  
  // Check for common base64 padding pattern at the end
  const hasValidPadding = str.length % 4 === 0 || 
                         (str.endsWith('=') && str.length % 4 === 1) ||
                         (str.endsWith('==') && str.length % 4 === 2);
  
  return base64Pattern.test(str) && 
         hasValidLength && 
         hasReasonableLength &&
         hasValidPadding;
}

/**
 * Call Ollama Chat Vision API
 */
export async function callOllamaChatVision(params: {
  model: string;
  prompt: string;
  images: string[] | unknown;
  temperature?: number;
  baseUrl?: string;
  logger?: (message: string) => void;
}): Promise<string> {
  const {
    model,
    prompt,
    images,
    temperature = 0.7,
    baseUrl = 'http://localhost:11434',
    logger = console.log
  } = params;
  
  // Ensure images is an array
  let imageArray: unknown[] = [];
  if (!Array.isArray(images)) {
    logger(`Warning: images is not an array but ${typeof images}. Converting to array.`);
    imageArray = images ? [images] : [];
  } else {
    imageArray = images;
  }
  
  logger(`Calling Ollama Chat Vision API with model: ${model}, images: ${imageArray.length}`);
  
  // 이미지 데이터 유효성 검사
  if (imageArray.length === 0) {
    throw new Error('Vision API requires at least one image.');
  }
  
  // 이미지 데이터를 순수 base64로 변환
  const processedImagesPromises = imageArray.map(async (img) => {
    if (!img) return null;
    
    // data:image/ 접두사가 있는 경우 제거
    if (typeof img === 'string' && img.startsWith('data:image/')) {
      logger('Removing data: prefix from image');
      const match = img.match(/^data:image\/[a-zA-Z]+;base64,(.+)$/);
      if (match && match[1]) {
        return match[1]; // 순수 base64 데이터만 반환
      }
      logger('Invalid data URL format');
      return null;
    }
    
    // 이미 base64 데이터인 경우 검증
    if (typeof img === 'string' && isLikelyBase64(img)) {
      return img;
    }
    
    // Check if it's an image file path
    if (typeof img === 'string') {
      const extension = img.split('.').pop()?.toLowerCase();
      if (extension && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension)) {
        try {
          logger(`Attempting to load image from path: ${img}`);
          
          // Check if it's a URL
          try {
            const url = new URL(img);
            // It's a valid URL
            const response = await fetch(img);
            if (!response.ok) {
              throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            }
            
            const blob = await response.blob();
            // Rather than converting to base64, just return the path directly
            return img;
          } catch (urlError) {
            // Not a valid URL, it might be a local file path
            logger(`Not a valid URL, might be a local file path: ${img}`);
            logger(`Warning: Browser environment cannot access local files directly`);
            return null;
          }
        } catch (error) {
          logger(`Error processing image path: ${error}`);
          return null;
        }
      }
    }
    
    logger(`Invalid image data format: ${typeof img}`);
    return null;
  });
  
  // Wait for all promises to resolve
  const processedImages = (await Promise.all(processedImagesPromises)).filter(Boolean) as string[];
  
  // 유효한 이미지가 없는 경우 오류
  if (processedImages.length === 0) {
    throw new Error('No valid image data found. Please check your image format.');
  }
  
  logger(`Calling Chat API with ${processedImages.length} valid images (out of ${imageArray.length})`);
  
  try {
    // Chat API 요청 준비
    const chatRequest: OllamaChatRequest = {
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
          images: processedImages
        }
      ],
      stream: false,
      ...(temperature !== undefined && {
        options: {
          temperature
        },
      }),
    };
    
    // 디버깅을 위해 첫 번째 이미지 시작 부분 로깅
    if (processedImages.length > 0) {
      const firstImg = processedImages[0];
      logger(`First image starts with: ${firstImg.substring(0, 30)}...`);
      
      // 데이터 URL 접두사가 남아있지 않은지 확인
      if (firstImg.startsWith('data:')) {
        logger('Warning: Image still contains data: prefix!');
      }
    }
    
    // API 호출 실행
    const response = await makeOllamaChatApiRequest(baseUrl, chatRequest, logger);
    
    // 응답 처리
    const data = await processOllamaChatResponse(response, logger);
    
    // 결과 추출
    if (data.message && typeof data.message.content === 'string') {
      return data.message.content;
    }
    
    // 응답 구조 로깅
    logger(`Chat response data contains keys: ${Object.keys(data).join(', ')}`);
    
    // 응답이 예상 형식이 아닌 경우 전체 응답 반환
    return JSON.stringify(data);
  } catch (error) {
    logger(`Error calling Ollama Chat Vision API: ${error}`);
    throw error;
  }
}

/**
 * 비전 모델에 최적화된 Ollama API 호출 함수
 * (우선 Chat API를 시도하고 실패 시 Generate API로 폴백)
 */
export async function callOptimizedOllamaVision(params: {
  model: string;
  prompt: string;
  images: string[] | unknown;
  temperature?: number;
  baseUrl?: string;
  logger?: (message: string) => void;
  useChatApiPreferred?: boolean;
}): Promise<string> {
  const {
    model,
    prompt,
    images,
    temperature = 0.7,
    baseUrl = 'http://localhost:11434',
    logger = console.log,
    useChatApiPreferred = true // 기본적으로 Chat API 우선 사용
  } = params;
  
  logger(`Calling optimized Ollama Vision API with model: ${model}`);
  
  // Ensure images is an array and validate it
  let validatedImages: string[] = [];
  
  if (!Array.isArray(images)) {
    logger(`Warning: images is not an array but ${typeof images}. Converting to array.`);
    // If it's a single image or other value, put it in an array (if not null/undefined)
    validatedImages = images ? [images as string] : [];
  } else {
    validatedImages = images;
  }
  
  // Process each item, handling both base64 strings and image file paths
  const processedImagesPromises = validatedImages.map(async (img: unknown) => {
    if (!img) {
      logger('Skipping null or undefined image');
      return null;
    }
    
    if (typeof img !== 'string') {
      logger(`Skipping non-string image of type ${typeof img}`);
      return null;
    }
    
    // Handle data URLs by removing the prefix
    if (img.startsWith('data:')) {
      const match = img.match(/^data:[^;]+;base64,(.*)$/);
      if (match && match[1]) {
        return match[1]; // Return just the base64 part
      } else {
        logger('Invalid data URL format');
        return null;
      }
    }
    
    // Handle base64 strings directly
    if (/^[A-Za-z0-9+/=]+$/.test(img)) {
      return img;
    }
    
    // Handle image file paths
    const extension = img.split('.').pop()?.toLowerCase();
    if (extension && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension)) {
      try {
        logger(`Attempting to load image from path: ${img}`);
        
        // Check if it's a URL
        try {
          const url = new URL(img);
          // It's a valid URL
          const response = await fetch(img);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
          }
          
          const blob = await response.blob();
          // Rather than converting to base64, just return the path directly
          return img;
        } catch (urlError) {
          // Not a valid URL, it might be a local file path
          logger(`Not a valid URL, might be a local file path: ${img}`);
          logger(`Warning: Browser environment cannot access local files directly`);
          return null;
        }
      } catch (error) {
        logger(`Error processing image path: ${error}`);
        return null;
      }
    }
    
    logger(`Unrecognized image format: ${img.substring(0, 20)}...`);
    return null;
  });
  
  // Resolve all promises
  validatedImages = (await Promise.all(processedImagesPromises)).filter(Boolean) as string[];
  
  // 이미지 데이터가 없으면 오류
  if (validatedImages.length === 0) {
    throw new Error('Vision model requires at least one valid image. Please check the image format.');
  }
  
  // Chat API 먼저 시도
  if (useChatApiPreferred) {
    try {
      logger(`Attempting to use Chat API first for vision model: ${model} with ${validatedImages.length} images`);
      return await callOllamaChatVision({
        model,
        prompt,
        images: validatedImages,
        temperature,
        baseUrl,
        logger
      });
    } catch (error) {
      // Chat API가 실패하면 Generate API로 폴백 시도
      logger(`Chat API failed: ${error}. Falling back to Generate API...`);
      
      // 특정 오류만 폴백 처리
      if (error instanceof Error && 
         (error.message.includes('404') || 
          error.message.includes('Not Found') ||
          error.message.includes('Method not allowed'))) {
        // 오래된 Ollama 버전으로 판단하고 Generate API 사용
        return await callOllama({
          model,
          prompt,
          images: validatedImages,
          temperature,
          baseUrl,
          logger,
        });
      } else {
        // 다른 오류는 그대로 전파
        throw error;
      }
    }
  } else {
    // Generate API 먼저 시도
    try {
      logger(`Using Generate API for vision model: ${model} with ${validatedImages.length} images`);
      return await callOllama({
        model,
        prompt,
        images: validatedImages,
        temperature,
        baseUrl,
        logger,
      });
    } catch (error) {
      // Generate API 실패 시 특정 오류에만 Chat API 시도
      if (error instanceof Error && 
         (error.message.includes('unknown format') || 
          error.message.includes('failed to process inputs'))) {
        logger(`Generate API failed: ${error}. Trying Chat API...`);
        return await callOllamaChatVision({
          model,
          prompt,
          images: validatedImages,
          temperature,
          baseUrl,
          logger
        });
      } else {
        throw error;
      }
    }
  }
} 