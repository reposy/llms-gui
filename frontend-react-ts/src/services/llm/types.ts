/**
 * Defines standard types and interfaces for LLM service interactions.
 */

/**
 * Common parameters for requesting LLM generation.
 */
export interface LLMRequestParams {
  model: string;
  prompt: string;
  temperature?: number;
  images?: string[]; // Optional: Base64 encoded image data for vision models
  ollamaUrl?: string; // Specific configuration might be needed here or passed differently
  openaiApiKey?: string; // Specific configuration might be needed here or passed differently
  // Add other common parameters as needed (e.g., max_tokens, stop_sequences)
  [key: string]: any; // Allow provider-specific parameters
}

/**
 * Standard response structure from an LLM service call.
 */
export interface LLMServiceResponse {
  response: string;
  // Optional: Include additional metadata if needed later
  // e.g., tokenUsage: { promptTokens: number; completionTokens: number };
  // e.g., modelUsed: string;
}

/**
 * Interface that all specific LLM provider services (Ollama, OpenAI, etc.) must implement.
 */
export interface LLMProviderService {
  /**
   * Generates text based on the provided parameters.
   * @param params - The request parameters.
   * @returns A promise that resolves with the standardized LLM service response.
   * @throws {Error} If the generation fails.
   */
  generate(params: LLMRequestParams): Promise<LLMServiceResponse>;
}

// You might also define specific error types here later, e.g.:
// export class LLMServiceError extends Error { ... } 