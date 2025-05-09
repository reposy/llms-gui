// src/components/config/WebCrawlerNodeConfig.tsx
import React, { useState, useCallback } from 'react';
// Remove unused imports
// import { useNodeContent } from '../../store/useNodeContentStore';
// import { WebCrawlerNodeContent } from '../../types/nodes';
import { useWebCrawlerNodeData } from '../../hooks/useWebCrawlerNodeData';

interface WebCrawlerNodeConfigProps {
  nodeId: string;
}

export const WebCrawlerNodeConfig: React.FC<WebCrawlerNodeConfigProps> = ({ nodeId }) => {
  // Use the new custom hook instead of useNodeContent
  const {
    url,
    waitForSelectorOnPage,
    iframeSelector,
    waitForSelectorInIframe,
    timeout,
    headers,
    extractElementSelector,
    updateUrl,
    updateWaitForSelectorOnPage,
    updateIframeSelector,
    updateWaitForSelectorInIframe,
    updateTimeout,
    updateContent,
    addHeader,
    removeHeader
  } = useWebCrawlerNodeData({ nodeId });
  
  // Local state for new header input fields
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');
  
  // Handle new header addition
  const handleAddHeader = useCallback(() => {
    if (newHeaderKey && newHeaderValue) {
      addHeader(newHeaderKey, newHeaderValue);
      setNewHeaderKey('');
      setNewHeaderValue('');
    }
  }, [newHeaderKey, newHeaderValue, addHeader]);

  // Handle header removal
  const handleRemoveHeader = useCallback((key: string) => {
    removeHeader(key);
  }, [removeHeader]);
  
  // Prevent event propagation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);
  
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">Crawler Settings</h3>
        
        {/* URL Input */}
        <div>
          <label htmlFor="crawler-url" className="block text-xs font-medium text-gray-700">URL</label>
          <input
            id="crawler-url"
            type="text"
            value={url}
            onChange={(e) => updateUrl(e.target.value)}
            placeholder="https://example.com"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm text-black bg-white"
            onKeyDown={handleKeyDown}
          />
          <p className="mt-1 text-xs text-gray-500">URL of the web page to crawl</p>
        </div>
        
        {/* Wait Selector on Page Input */}
        <div>
          <label htmlFor="wait-selector-page" className="block text-xs font-medium text-gray-700">Wait for Selector on Page (Optional)</label>
          <input
            id="wait-selector-page"
            type="text"
            value={waitForSelectorOnPage}
            onChange={(e) => updateWaitForSelectorOnPage(e.target.value)}
            placeholder=".main-content, body"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm text-black bg-white"
            onKeyDown={handleKeyDown}
          />
          <p className="mt-1 text-xs text-gray-500">Optional CSS selector to wait for on the main page before checking iframe</p>
        </div>
        
        {/* IFrame Selector Input */}
        <div>
          <label htmlFor="iframe-selector" className="block text-xs font-medium text-gray-700">IFrame Selector (Optional)</label>
          <input
            id="iframe-selector"
            type="text"
            value={iframeSelector}
            onChange={(e) => updateIframeSelector(e.target.value)}
            placeholder="#entryIframe, iframe[name='content']"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm text-black bg-white"
            onKeyDown={handleKeyDown}
          />
          <p className="mt-1 text-xs text-gray-500">Optional CSS selector for the iframe to target</p>
        </div>

        {/* Added: Wait for Selector in IFrame Input */}
        <div>
          <label htmlFor="wait-selector-iframe" className="block text-xs font-medium text-gray-700">Wait for Selector in IFrame (Optional)</label>
          <input
            id="wait-selector-iframe"
            type="text"
            value={waitForSelectorInIframe}
            onChange={(e) => updateWaitForSelectorInIframe(e.target.value)}
            placeholder="#_title, .article-body"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm text-black bg-white"
            onKeyDown={handleKeyDown}
            disabled={!iframeSelector}
          />
          <p className={`mt-1 text-xs ${iframeSelector ? 'text-gray-500' : 'text-gray-400'}`}>
            Optional CSS selector to wait for inside the specified iframe
          </p>
        </div>

        {/* Timeout Input */}
        <div>
          <label htmlFor="timeout" className="block text-xs font-medium text-gray-700">Timeout (ms)</label>
          <input
            id="timeout"
            type="number"
            value={timeout}
            onChange={(e) => updateTimeout(parseInt(e.target.value, 10) || 30000)}
            min="1000"
            max="120000"
            step="1000"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm text-black bg-white"
            onKeyDown={handleKeyDown}
          />
          <p className="mt-1 text-xs text-gray-500">Maximum total time to wait in milliseconds</p>
        </div>

        {/* Extract Element Selector Input */}
        <div>
          <label htmlFor="extract-selector" className="block text-xs font-medium text-gray-700">Extract Element Selector (Optional)</label>
          <input
            id="extract-selector"
            type="text"
            value={extractElementSelector}
            onChange={(e) => updateContent({ extractElementSelector: e.target.value })}
            placeholder=".content-area, #main-article"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm text-black bg-white"
            onKeyDown={handleKeyDown}
          />
          <p className="mt-1 text-xs text-gray-500">If provided, only the inner HTML of the first matching element will be returned.</p>
        </div>
      </div>
      
      {/* --- Headers Section --- */}
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">HTTP Headers</h3>
        
        {/* Add new header */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <input
              type="text"
              value={newHeaderKey}
              onChange={(e) => setNewHeaderKey(e.target.value)}
              placeholder="Header Name (e.g., User-Agent)"
              className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-xs text-black bg-white"
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="flex">
            <input
              type="text"
              value={newHeaderValue}
              onChange={(e) => setNewHeaderValue(e.target.value)}
              placeholder="Header Value (e.g., Mozilla/5.0...)"
              className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-xs text-black bg-white"
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={handleAddHeader}
              disabled={!newHeaderKey || !newHeaderValue}
              className="ml-2 px-3 py-2 bg-blue-600 text-white text-xs rounded-md disabled:bg-gray-300"
              onKeyDown={handleKeyDown}
            >
              Add
            </button>
          </div>
        </div>
        
        {/* List of existing headers */}
        {Object.keys(headers).length > 0 ? (
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md overflow-hidden">
            {Object.entries(headers).map(([key, value]) => (
              <li key={key} className="px-3 py-2 bg-white flex justify-between items-center">
                <div>
                  <span className="text-sm font-medium text-gray-700 break-all">{key}</span>
                  <span className="text-xs text-gray-500 ml-2 break-all">{value}</span>
                </div>
                <button
                  onClick={() => handleRemoveHeader(key)}
                  className="ml-2 bg-red-50 text-red-500 rounded-md p-1"
                  onKeyDown={handleKeyDown}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 italic">No headers defined. Custom headers are optional.</p>
        )}
      </div>
    </div>
  );
}; 