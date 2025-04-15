import React, { useState, useCallback } from 'react';
import { WebCrawlerNodeData } from '../../types/nodes';
import { useNodeContent } from '../../store/useNodeContentStore';

interface WebCrawlerNodeConfigProps {
  nodeId: string;
  data: WebCrawlerNodeData;
}

export const WebCrawlerNodeConfig: React.FC<WebCrawlerNodeConfigProps> = ({ nodeId, data }) => {
  // Local state for form fields
  const [url, setUrl] = useState(data.url || '');
  const [waitForSelector, setWaitForSelector] = useState(data.waitForSelector || '');
  const [timeout, setTimeout] = useState(data.timeout || 30000);
  const [outputFormat, setOutputFormat] = useState(data.outputFormat || 'text');
  const [includeHtml, setIncludeHtml] = useState(data.includeHtml || false);
  
  // Extract selectors management
  const [extractSelectors, setExtractSelectors] = useState<Record<string, string>>(data.extractSelectors || {});
  const [newExtractorName, setNewExtractorName] = useState('');
  const [newExtractorSelector, setNewExtractorSelector] = useState('');
  
  // Get the update function from the node content store using the useNodeContent hook
  const { setContent } = useNodeContent(nodeId);
  
  // Handle form field updates
  const handleUpdateField = useCallback((field: string, value: any) => {
    setContent({ [field]: value });
  }, [setContent]);
  
  // Handle URL update
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    handleUpdateField('url', newUrl);
  }, [handleUpdateField]);
  
  // Handle wait selector update
  const handleWaitSelectorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newWaitSelector = e.target.value;
    setWaitForSelector(newWaitSelector);
    handleUpdateField('waitForSelector', newWaitSelector);
  }, [handleUpdateField]);
  
  // Handle timeout update
  const handleTimeoutChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTimeout = parseInt(e.target.value, 10);
    setTimeout(newTimeout);
    handleUpdateField('timeout', newTimeout);
  }, [handleUpdateField]);
  
  // Handle output format update
  const handleOutputFormatChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOutputFormat = e.target.value as 'full' | 'text' | 'extracted' | 'html';
    setOutputFormat(newOutputFormat);
    handleUpdateField('outputFormat', newOutputFormat);
  }, [handleUpdateField]);
  
  // Handle include HTML toggle
  const handleIncludeHtmlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newIncludeHtml = e.target.checked;
    setIncludeHtml(newIncludeHtml);
    handleUpdateField('includeHtml', newIncludeHtml);
  }, [handleUpdateField]);
  
  // Add a new extractor
  const handleAddExtractor = useCallback(() => {
    if (newExtractorName && newExtractorSelector) {
      const updatedExtractors = {
        ...extractSelectors,
        [newExtractorName]: newExtractorSelector
      };
      setExtractSelectors(updatedExtractors);
      handleUpdateField('extractSelectors', updatedExtractors);
      setNewExtractorName('');
      setNewExtractorSelector('');
    }
  }, [newExtractorName, newExtractorSelector, extractSelectors, handleUpdateField]);
  
  // Remove an extractor
  const handleRemoveExtractor = useCallback((key: string) => {
    const updatedExtractors = { ...extractSelectors };
    delete updatedExtractors[key];
    setExtractSelectors(updatedExtractors);
    handleUpdateField('extractSelectors', updatedExtractors);
  }, [extractSelectors, handleUpdateField]);
  
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
          />
          <p className="mt-1 text-xs text-gray-500">URL of the web page to crawl</p>
        </div>
        
        {/* Wait Selector Input */}
        <div>
          <label htmlFor="wait-selector" className="block text-xs font-medium text-gray-700">Wait for Selector</label>
          <input
            id="wait-selector"
            type="text"
            value={waitForSelector}
            onChange={handleWaitSelectorChange}
            placeholder=".main-content"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm text-black bg-white"
          />
          <p className="mt-1 text-xs text-gray-500">CSS selector to wait for before extracting content</p>
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
            max="60000"
            step="1000"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm text-black bg-white"
          />
          <p className="mt-1 text-xs text-gray-500">Maximum time to wait in milliseconds</p>
        </div>
        
        {/* Output Format Selector */}
        <div>
          <label htmlFor="output-format" className="block text-xs font-medium text-gray-700">Output Format</label>
          <select
            id="output-format"
            value={outputFormat}
            onChange={handleOutputFormatChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm text-black bg-white"
          >
            <option value="full">Full (All metadata)</option>
            <option value="text">Text only</option>
            <option value="extracted">Extracted values only</option>
            <option value="html">HTML</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">Format of the crawler output</p>
        </div>
        
        {/* Include HTML Toggle */}
        <div className="flex items-center">
          <input
            id="include-html"
            type="checkbox"
            checked={includeHtml}
            onChange={handleIncludeHtmlChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded bg-white"
          />
          <label htmlFor="include-html" className="ml-2 block text-xs font-medium text-gray-700">Include HTML</label>
        </div>
      </div>
      
      {/* CSS Selectors Section */}
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Extraction Selectors</h3>
        
        {/* Add new extractor */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <input
              type="text"
              value={newExtractorName}
              onChange={(e) => setNewExtractorName(e.target.value)}
              placeholder="Name (e.g., title)"
              className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm text-black bg-white"
            />
          </div>
          <div className="flex">
            <input
              type="text"
              value={newExtractorSelector}
              onChange={(e) => setNewExtractorSelector(e.target.value)}
              placeholder="Selector (e.g., h1)"
              className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm text-black bg-white"
            />
            <button
              onClick={handleAddExtractor}
              disabled={!newExtractorName || !newExtractorSelector}
              className="ml-2 px-3 py-2 bg-blue-600 text-white text-xs rounded-md disabled:bg-gray-300"
            >
              Add
            </button>
          </div>
        </div>
        
        {/* List of existing extractors */}
        {Object.keys(extractSelectors).length > 0 ? (
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md overflow-hidden">
            {Object.entries(extractSelectors).map(([key, selector]) => (
              <li key={key} className="px-3 py-2 bg-white flex justify-between items-center">
                <div>
                  <span className="text-sm font-medium text-gray-700">{key}</span>
                  <span className="text-xs text-gray-500 ml-2">{selector}</span>
                </div>
                <button
                  onClick={() => handleRemoveExtractor(key)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500">No extraction selectors defined. Add one above.</p>
        )}
      </div>
      
      {/* Help information */}
      <div className="bg-blue-50 p-3 rounded-md">
        <h4 className="text-xs font-medium text-blue-700">How to use CSS selectors</h4>
        <p className="text-xs text-blue-600 mt-1">
          Use CSS selectors to extract content from the web page. For example:
        </p>
        <ul className="text-xs text-blue-600 list-disc list-inside mt-1">
          <li>h1 - Selects the first h1 element</li>
          <li>.title - Selects elements with class "title"</li>
          <li>#header - Selects the element with id "header"</li>
          <li>.item:first-child - Selects the first element with class "item"</li>
        </ul>
      </div>
    </div>
  );
}; 