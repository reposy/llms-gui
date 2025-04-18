import React, { useState, useRef } from 'react';
import ollama from 'ollama';
import { fileToBase64 } from '../../utils/llm/vision';

const OllamaVisionExample: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('What is in this image?');
  const [model, setModel] = useState<string>('llama3.2-vision');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setError('');
      setResult('');
      
      const files = e.target.files;
      if (!files || files.length === 0) {
        return setError('Please select at least one image');
      }

      setLoading(true);
      
      // Convert image to base64
      const file = files[0];
      const imageBase64 = await fileToBase64(file);
      const base64WithoutPrefix = imageBase64.split(',')[1]; // Remove data URL prefix

      console.log(`Processing image: ${file.name} (${Math.round(file.size / 1024)} KB)`);
      
      // Call Ollama API
      const response = await ollama.chat({
        model,
        messages: [{
          role: 'user',
          content: prompt,
          images: [base64WithoutPrefix]
        }],
        options: {
          temperature: 0.7
        }
      });

      setResult(response.message.content);
    } catch (err) {
      console.error('Error processing image:', err);
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-xl shadow-md">
      <h1 className="text-2xl font-bold mb-4">Ollama Vision API Example</h1>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Model</label>
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-md"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Model name (e.g. llama3.2-vision)"
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Prompt</label>
        <textarea
          className="w-full px-3 py-2 border rounded-md"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Enter your prompt here"
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Upload Image</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="block w-full text-sm border rounded-md"
          onChange={handleImageUpload}
          disabled={loading}
        />
      </div>
      
      {loading && <div className="my-4 text-blue-500">Processing image, please wait...</div>}
      
      {error && (
        <div className="my-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {result && (
        <div className="my-4">
          <h2 className="text-lg font-semibold mb-2">Result:</h2>
          <div className="p-3 bg-gray-100 rounded whitespace-pre-wrap">
            {result}
          </div>
        </div>
      )}
    </div>
  );
};

export default OllamaVisionExample; 