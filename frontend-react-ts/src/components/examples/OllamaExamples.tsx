import React, { useState } from 'react';
import OllamaTextExample from './OllamaTextExample';
import OllamaVisionExample from './OllamaVisionExample';

const OllamaExamples: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'text' | 'vision'>('text');

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-6">Ollama Examples</h1>
      
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('text')}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${
                activeTab === 'text'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Text Model
            </button>
            <button
              onClick={() => setActiveTab('vision')}
              className={`ml-8 py-2 px-4 border-b-2 font-medium text-sm ${
                activeTab === 'vision'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Vision Model
            </button>
          </nav>
        </div>
      </div>

      <div className="mt-4">
        {activeTab === 'text' ? <OllamaTextExample /> : <OllamaVisionExample />}
      </div>
    </div>
  );
};

export default OllamaExamples; 