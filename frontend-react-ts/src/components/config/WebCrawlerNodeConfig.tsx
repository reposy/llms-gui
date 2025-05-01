// src/components/config/WebCrawlerNodeConfig.tsx
import React, { useState, useCallback } from 'react';
// Remove unused type if needed
// import { WebCrawlerNodeData } from '../../types/nodes';
import { useNodeContent, WebCrawlerNodeContent } from '../../store/useNodeContentStore';

interface WebCrawlerNodeConfigProps {
  nodeId: string;
}

export const WebCrawlerNodeConfig: React.FC<WebCrawlerNodeConfigProps> = ({ nodeId }) => {
  const { 
    content, 
    updateContent
  } = useNodeContent<WebCrawlerNodeContent>(nodeId, 'web-crawler'); 
  
  // Local state for form fields
  const [url, setUrl] = useState(content.url || '');
  const [waitForSelectorOnPage, setWaitForSelectorOnPage] = useState(content.waitForSelectorOnPage || '');
  const [iframeSelector, setIframeSelector] = useState(content.iframeSelector || '');
  const [waitForSelectorInIframe, setWaitForSelectorInIframe] = useState(content.waitForSelectorInIframe || '');
  const [timeout, setTimeout] = useState(content.timeout || 30000);
  // Headers state
  const [headers, setHeaders] = useState<Record<string, string>>(content.headers || {});
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');

  // Sync local state if content from store changes
  React.useEffect(() => {
    setUrl(content.url || '');
    setWaitForSelectorOnPage(content.waitForSelectorOnPage || '');
    setIframeSelector(content.iframeSelector || '');
    setWaitForSelectorInIframe(content.waitForSelectorInIframe || '');
    setTimeout(content.timeout || 30000);
    setHeaders(content.headers || {});
  }, [content]);
  
  const handleUpdateField = useCallback((field: keyof WebCrawlerNodeContent, value: any) => {
    updateContent({ [field]: value });
  }, [updateContent]);
  
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    handleUpdateField('url', newUrl);
  }, [handleUpdateField]);
  
  const handleWaitSelectorOnPageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newWaitSelector = e.target.value;
    setWaitForSelectorOnPage(newWaitSelector);
    handleUpdateField('waitForSelectorOnPage', newWaitSelector);
  }, [handleUpdateField]);
  
  const handleIframeSelectorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newIframeSelector = e.target.value;
    setIframeSelector(newIframeSelector);
    handleUpdateField('iframeSelector', newIframeSelector);
  }, [handleUpdateField]);
  
  const handleWaitForSelectorInIframeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newSelector = e.target.value;
    setWaitForSelectorInIframe(newSelector);
    handleUpdateField('waitForSelectorInIframe', newSelector);
  }, [handleUpdateField]);
  
  const handleTimeoutChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTimeout = parseInt(e.target.value, 10) || 30000;
    setTimeout(newTimeout);
    handleUpdateField('timeout', newTimeout);
  }, [handleUpdateField]);

  // --- Header Management --- 
  const handleAddHeader = useCallback(() => {
    if (newHeaderKey && newHeaderValue) {
      const updatedHeaders = {
        ...headers,
        [newHeaderKey]: newHeaderValue
      };
      setHeaders(updatedHeaders);
      handleUpdateField('headers', updatedHeaders);
      setNewHeaderKey('');
      setNewHeaderValue('');
    }
  }, [newHeaderKey, newHeaderValue, headers, handleUpdateField]);

  const handleRemoveHeader = useCallback((key: string) => {
    const updatedHeaders = { ...headers };
    delete updatedHeaders[key];
    setHeaders(updatedHeaders);
    handleUpdateField('headers', updatedHeaders);
  }, [headers, handleUpdateField]);
  // --- End Header Management ---
  
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
            onChange={handleUrlChange}
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
            onChange={handleWaitSelectorOnPageChange}
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
            onChange={handleIframeSelectorChange}
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
            onChange={handleWaitForSelectorInIframeChange}
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
            onChange={handleTimeoutChange}
            min="1000"
            max="120000"
            step="1000"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm text-black bg-white"
            onKeyDown={handleKeyDown}
          />
          <p className="mt-1 text-xs text-gray-500">Maximum total time to wait in milliseconds</p>
        </div>

        {/* REMOVED: Output Format Selector */}
        {/* REMOVED: Include HTML Toggle */}
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
                  className="text-red-500 hover:text-red-700 text-xs ml-2"
                  onKeyDown={handleKeyDown}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500">No custom headers defined. Add one above (e.g., User-Agent).</p>
        )}
      </div>
      {/* --- End Headers Section --- */}

      {/* REMOVED: CSS Selectors Section */}
    </div>
  );
}; 