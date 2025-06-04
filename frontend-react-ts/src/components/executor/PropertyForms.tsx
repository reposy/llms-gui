import React from 'react';

// Property 데이터 타입들
export interface LLMProperty {
  provider: string;
  model: string;
  prompt: string;
  temperature: number;
  mode: string;
  openaiApiKey?: string;
}

export interface APIProperty {
  url: string;
  method: string;
  headers: Record<string, string>;
  contentType: string;
}

export interface WebCrawlerProperty {
  url: string;
  timeout: number;
  waitForSelectorOnPage: string;
  outputFormat: string;
}

// LLM Property Form 컴포넌트
interface LLMPropertyFormProps {
  value: LLMProperty;
  onChange: (value: LLMProperty) => void;
  disabled?: boolean;
}

export const LLMPropertyForm: React.FC<LLMPropertyFormProps> = ({ value, onChange, disabled = false }) => {
  const updateField = (field: keyof LLMProperty, newValue: any) => {
    onChange({ ...value, [field]: newValue });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
      <h4 className="font-medium text-blue-800">LLM 설정</h4>
      
      {/* Provider */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <label className="text-sm font-medium text-gray-700 min-w-[100px]">Provider:</label>
        <select
          className="flex-1 border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={value.provider}
          onChange={e => updateField('provider', e.target.value)}
          disabled={disabled}
        >
          <option value="ollama">Ollama</option>
          <option value="openai">OpenAI</option>
          <option value="claude">Claude</option>
          <option value="gemini">Gemini</option>
        </select>
      </div>

      {/* Model */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <label className="text-sm font-medium text-gray-700 min-w-[100px]">Model:</label>
        <input
          type="text"
          className="flex-1 border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={value.model}
          onChange={e => updateField('model', e.target.value)}
          placeholder="예: gpt-4, llama2, claude-3"
          disabled={disabled}
        />
      </div>

      {/* Temperature */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <label className="text-sm font-medium text-gray-700 min-w-[100px]">Temperature:</label>
        <div className="flex-1 flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider:bg-blue-500"
            value={value.temperature}
            onChange={e => updateField('temperature', parseFloat(e.target.value))}
            disabled={disabled}
          />
          <span className="text-sm font-medium text-gray-700 min-w-[40px] text-center bg-white border border-gray-300 rounded px-2 py-1">
            {value.temperature}
          </span>
        </div>
      </div>

      {/* Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <label className="text-sm font-medium text-gray-700 min-w-[100px]">Mode:</label>
        <select
          className="flex-1 border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={value.mode}
          onChange={e => updateField('mode', e.target.value)}
          disabled={disabled}
        >
          <option value="text">Text</option>
          <option value="vision">Vision</option>
        </select>
      </div>

      {/* OpenAI API Key - OpenAI provider일 때만 표시 */}
      {value.provider === 'openai' && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-sm font-medium text-gray-700 min-w-[100px]">API Key:</label>
          <input
            type="password"
            className="flex-1 border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={value.openaiApiKey || ''}
            onChange={e => updateField('openaiApiKey', e.target.value)}
            placeholder="sk-..."
            disabled={disabled}
          />
        </div>
      )}

      {/* Prompt */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Prompt:</label>
        <textarea
          className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          value={value.prompt}
          onChange={e => updateField('prompt', e.target.value)}
          placeholder="{{input}}을 사용하여 입력 데이터를 참조할 수 있습니다"
          disabled={disabled}
        />
      </div>
    </div>
  );
};

// API Property Form 컴포넌트
interface APIPropertyFormProps {
  value: APIProperty;
  onChange: (value: APIProperty) => void;
  disabled?: boolean;
}

export const APIPropertyForm: React.FC<APIPropertyFormProps> = ({ value, onChange, disabled = false }) => {
  const updateField = (field: keyof APIProperty, newValue: any) => {
    onChange({ ...value, [field]: newValue });
  };

  const updateHeader = (key: string, headerValue: string) => {
    const newHeaders = { ...value.headers };
    if (headerValue) {
      newHeaders[key] = headerValue;
    } else {
      delete newHeaders[key];
    }
    updateField('headers', newHeaders);
  };

  const addHeader = () => {
    const newKey = `header-${Date.now()}`;
    updateHeader(newKey, '');
  };

  const removeHeader = (key: string) => {
    const newHeaders = { ...value.headers };
    delete newHeaders[key];
    updateField('headers', newHeaders);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-green-50">
      <h4 className="font-medium text-green-800">API 설정</h4>

      {/* URL */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <label className="text-sm font-medium text-gray-700 min-w-[100px]">URL:</label>
        <input
          type="url"
          className="flex-1 border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
          value={value.url}
          onChange={e => updateField('url', e.target.value)}
          placeholder="https://api.example.com/endpoint"
          disabled={disabled}
        />
      </div>

      {/* Method and Content-Type in same row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-sm font-medium text-gray-700 min-w-[80px]">Method:</label>
          <select
            className="flex-1 border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            value={value.method}
            onChange={e => updateField('method', e.target.value)}
            disabled={disabled}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-sm font-medium text-gray-700 min-w-[100px]">Content-Type:</label>
          <select
            className="flex-1 border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            value={value.contentType}
            onChange={e => updateField('contentType', e.target.value)}
            disabled={disabled}
          >
            <option value="application/json">application/json</option>
            <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
            <option value="multipart/form-data">multipart/form-data</option>
            <option value="text/plain">text/plain</option>
          </select>
        </div>
      </div>

      {/* Headers */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Headers:</label>
          {!disabled && (
            <button
              type="button"
              onClick={addHeader}
              className="text-sm text-green-600 hover:text-green-800 font-medium"
            >
              + Header 추가
            </button>
          )}
        </div>
        <div className="space-y-2">
          {Object.entries(value.headers).length === 0 ? (
            <div className="text-sm text-gray-500 italic py-2">헤더가 없습니다</div>
          ) : (
            Object.entries(value.headers).map(([key, headerValue]) => (
              <div key={key} className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={key}
                  onChange={e => {
                    const oldKey = key;
                    const newKey = e.target.value;
                    if (newKey !== oldKey) {
                      const newHeaders = { ...value.headers };
                      delete newHeaders[oldKey];
                      if (newKey) newHeaders[newKey] = headerValue;
                      updateField('headers', newHeaders);
                    }
                  }}
                  placeholder="Header 이름"
                  disabled={disabled}
                />
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={headerValue}
                  onChange={e => updateHeader(key, e.target.value)}
                  placeholder="Header 값"
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => removeHeader(key)}
                  disabled={disabled}
                  className="px-3 py-2 text-red-600 hover:bg-red-100 rounded disabled:opacity-50 font-bold"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Web Crawler Property Form 컴포넌트
interface WebCrawlerPropertyFormProps {
  value: WebCrawlerProperty;
  onChange: (value: WebCrawlerProperty) => void;
  disabled?: boolean;
}

export const WebCrawlerPropertyForm: React.FC<WebCrawlerPropertyFormProps> = ({ value, onChange, disabled = false }) => {
  const updateField = (field: keyof WebCrawlerProperty, newValue: any) => {
    onChange({ ...value, [field]: newValue });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-purple-50">
      <h4 className="font-medium text-purple-800">Web Crawler 설정</h4>

      {/* URL */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <label className="text-sm font-medium text-gray-700 min-w-[100px]">URL:</label>
        <input
          type="url"
          className="flex-1 border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={value.url}
          onChange={e => updateField('url', e.target.value)}
          placeholder="https://example.com"
          disabled={disabled}
        />
      </div>

      {/* Timeout and Output Format in same row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-sm font-medium text-gray-700 min-w-[80px]">Timeout:</label>
          <div className="flex-1 flex items-center gap-2">
            <input
              type="number"
              className="flex-1 border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={value.timeout}
              onChange={e => updateField('timeout', parseInt(e.target.value) || 30000)}
              min="1000"
              max="300000"
              step="1000"
              disabled={disabled}
            />
            <span className="text-sm text-gray-600 min-w-[24px]">ms</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-sm font-medium text-gray-700 min-w-[100px]">Output Format:</label>
          <select
            className="flex-1 border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            value={value.outputFormat}
            onChange={e => updateField('outputFormat', e.target.value)}
            disabled={disabled}
          >
            <option value="html">HTML</option>
            <option value="text">Text</option>
          </select>
        </div>
      </div>

      {/* Wait For Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <label className="text-sm font-medium text-gray-700 min-w-[100px]">Wait Selector:</label>
        <input
          type="text"
          className="flex-1 border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={value.waitForSelectorOnPage}
          onChange={e => updateField('waitForSelectorOnPage', e.target.value)}
          placeholder="CSS 선택자 (예: .content, #main)"
          disabled={disabled}
        />
      </div>
    </div>
  );
};

// Property 값을 JSON 문자열로 변환
export const serializeProperty = (nodeType: string, property: any): string => {
  return JSON.stringify({ nodeType, property }, null, 2);
};

// JSON 문자열을 Property 값으로 파싱
export const parseProperty = (jsonString: string): { nodeType: string; property: any } | null => {
  try {
    const parsed = JSON.parse(jsonString || '{}');
    if (parsed && typeof parsed === 'object' && 'nodeType' in parsed && 'property' in parsed) {
      return parsed;
    }
  } catch (error) {
    // 파싱 실패는 무시
  }
  return null;
};

// 기본 Property 값 생성
export const createDefaultProperty = (nodeType: string): any => {
  switch (nodeType) {
    case 'llm':
      return {
        provider: 'ollama',
        model: '',
        prompt: '{{input}}',
        temperature: 0.7,
        mode: 'text',
        openaiApiKey: ''
      };
    case 'api':
      return {
        url: '',
        method: 'GET',
        headers: {},
        contentType: 'application/json'
      };
    case 'web-crawler':
      return {
        url: '',
        timeout: 30000,
        waitForSelectorOnPage: '',
        outputFormat: 'html'
      };
    default:
      return {};
  }
}; 