import { useCallback } from 'react';
import { createNodeDataHook } from './useNodeDataFactory';
import { WebCrawlerNodeContent } from '../types/nodes';

/**
 * Default values for WebCrawler node content
 */
const WEBCRAWLER_DEFAULTS: Partial<WebCrawlerNodeContent> = {
  url: '',
  waitForSelectorOnPage: '',
  iframeSelector: '',
  waitForSelectorInIframe: '',
  timeout: 30000,
  headers: {},
  extractElementSelector: '',
};

/**
 * Return type for useWebCrawlerNodeData hook
 * Explicitly defining return type helps TypeScript understand the guarantees we're making
 */
interface WebCrawlerNodeDataHook {
  content: WebCrawlerNodeContent | undefined;
  url: string;
  waitForSelectorOnPage: string;
  iframeSelector: string;
  waitForSelectorInIframe: string;
  timeout: number;
  headers: Record<string, string>;
  extractElementSelector: string;
  updateContent: (updates: Partial<WebCrawlerNodeContent>) => void;
  updateUrl: (url: string) => void;
  updateWaitForSelectorOnPage: (selector: string) => void;
  updateIframeSelector: (selector: string) => void;
  updateWaitForSelectorInIframe: (selector: string) => void;
  updateTimeout: (timeout: number) => void;
  updateHeaders: (headers: Record<string, string>) => void;
  addHeader: (key: string, value: string) => void;
  removeHeader: (key: string) => void;
  updateExtractElementSelector: (selector: string) => void;
}

/**
 * Custom hook to manage WebCrawler node state and operations.
 * Uses the standardized hook factory pattern.
 */
export const useWebCrawlerNodeData = ({ nodeId }: { nodeId: string }): WebCrawlerNodeDataHook => {
  // Use the factory to create the base hook functionality
  const { 
    content, 
    updateContent: updateWebCrawlerContent 
  } = createNodeDataHook<WebCrawlerNodeContent>('web-crawler', WEBCRAWLER_DEFAULTS)({ nodeId });

  // Extract properties with defaults for easier access
  const url = content?.url || WEBCRAWLER_DEFAULTS.url || '';
  const waitForSelectorOnPage = content?.waitForSelectorOnPage || WEBCRAWLER_DEFAULTS.waitForSelectorOnPage || '';
  const iframeSelector = content?.iframeSelector || WEBCRAWLER_DEFAULTS.iframeSelector || '';
  const waitForSelectorInIframe = content?.waitForSelectorInIframe || WEBCRAWLER_DEFAULTS.waitForSelectorInIframe || '';
  const timeout = content?.timeout || WEBCRAWLER_DEFAULTS.timeout || 30000;
  const headers = content?.headers || WEBCRAWLER_DEFAULTS.headers || {};
  const extractElementSelector = content?.extractElementSelector || WEBCRAWLER_DEFAULTS.extractElementSelector || '';

  // Convenience update methods
  const updateUrl = useCallback((newUrl: string) => {
    updateWebCrawlerContent({ url: newUrl });
  }, [updateWebCrawlerContent]);

  const updateWaitForSelectorOnPage = useCallback((selector: string) => {
    updateWebCrawlerContent({ waitForSelectorOnPage: selector });
  }, [updateWebCrawlerContent]);

  const updateIframeSelector = useCallback((selector: string) => {
    updateWebCrawlerContent({ iframeSelector: selector });
  }, [updateWebCrawlerContent]);

  const updateWaitForSelectorInIframe = useCallback((selector: string) => {
    updateWebCrawlerContent({ waitForSelectorInIframe: selector });
  }, [updateWebCrawlerContent]);

  const updateTimeout = useCallback((newTimeout: number) => {
    updateWebCrawlerContent({ timeout: newTimeout });
  }, [updateWebCrawlerContent]);

  const updateHeaders = useCallback((newHeaders: Record<string, string>) => {
    updateWebCrawlerContent({ headers: newHeaders });
  }, [updateWebCrawlerContent]);

  const addHeader = useCallback((key: string, value: string) => {
    updateWebCrawlerContent({ 
      headers: { 
        ...headers, 
        [key]: value 
      } 
    });
  }, [headers, updateWebCrawlerContent]);

  const removeHeader = useCallback((key: string) => {
    const updatedHeaders = { ...headers };
    delete updatedHeaders[key];
    updateWebCrawlerContent({ headers: updatedHeaders });
  }, [headers, updateWebCrawlerContent]);

  const updateExtractElementSelector = useCallback((selector: string) => {
    updateWebCrawlerContent({ extractElementSelector: selector });
  }, [updateWebCrawlerContent]);

  return {
    // Data
    content,
    url,
    waitForSelectorOnPage,
    iframeSelector,
    waitForSelectorInIframe,
    timeout,
    headers,
    extractElementSelector,
    
    // Update methods
    updateContent: updateWebCrawlerContent,
    updateUrl,
    updateWaitForSelectorOnPage,
    updateIframeSelector,
    updateWaitForSelectorInIframe,
    updateTimeout,
    updateHeaders,
    addHeader,
    removeHeader,
    updateExtractElementSelector
  };
}; 