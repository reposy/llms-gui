# LLM Utilities

This directory contains client utilities for working with Large Language Models (LLMs) in the application.

## Available Providers

The application supports two LLM providers:

1. **Ollama** - For local AI execution (free, open-source)
2. **OpenAI** - For cloud-based AI (requires API key)

## API Modes

Both providers support two modes of operation:

1. **Text Mode** - Standard text prompts and responses
2. **Vision Mode** - Image + text inputs, with text responses

## Files

- `ollamaClient.ts` - Client for Ollama's API with both text and vision support
- `openaiClient.ts` - Client for OpenAI's API with both text and vision support

## Usage

These utilities are meant to be used through the abstraction layer in `src/api/llm.ts`, which provides a unified interface for all LLM operations.

### Basic Example

```typescript
import { runLLM } from '../api/llm';

// Text mode
const result = await runLLM({
  provider: 'ollama',
  model: 'llama3',
  prompt: 'Explain quantum computing in simple terms',
  temperature: 0.7
});

console.log(result.response);
```

### Vision Mode Example

```typescript
import { runLLM } from '../api/llm';

// Vision mode with image
const imageFile = new File(...); // Get from input element
const result = await runLLM({
  provider: 'ollama',
  model: 'llava',
  mode: 'vision',
  prompt: 'What is in this image?',
  inputImage: imageFile,
  temperature: 0.7
});

console.log(result.response);
```

## Template Support

When using templates with `{{input}}` placeholders:

1. In **text mode**, the placeholder is replaced with the input text
2. In **vision mode**, if the input is an image file, the placeholder is replaced with the filename while the image is sent in the API request body

## Implementation Notes

- For Ollama vision models, images are encoded as base64 and sent in the `images` array of the request
- For OpenAI vision models, images are encoded as base64 data URLs and sent as part of the message content
- Both clients handle response streaming, error handling, and retries 