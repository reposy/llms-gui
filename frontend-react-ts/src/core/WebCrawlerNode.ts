import { Node } from './Node';
import { crawling } from '../utils/crawling';
import { FlowExecutionContext } from './FlowExecutionContext';

/**
 * Interface for Web Crawler node properties
 */
export interface WebCrawlerNodeProperty {
  url: string;
  waitForSelector?: string;
  extractSelectors?: Record<string, string>;
  timeout?: number;
  outputFormat?: 'full' | 'text' | 'extracted' | 'html';
  nodeFactory?: any;
  [key: string]: any;
}

/**
 * Web Crawler node that fetches a web page and extracts content using CSS selectors
 */
export class WebCrawlerNode extends Node {
  /**
   * Type assertion for property
   */
  declare property: WebCrawlerNodeProperty;

  /**
   * Constructor for WebCrawlerNode
   */
  constructor(
    id: string,
    property: Record<string, any> = {},
    context?: FlowExecutionContext
  ) {
    super(id, 'web-crawler', property, context);
    
    // Initialize with defaults
    this.property = {
      ...property,
      url: property.url || '',
      waitForSelector: property.waitForSelector || 'body',
      extractSelectors: property.extractSelectors || {},
      outputFormat: property.outputFormat || 'full',
      timeout: property.timeout || 3000
    };
  }

  /**
   * Execute the node's specific logic
   * @param input The input data that may contain URL override
   * @returns The extracted web content
   */
  async execute(input: any): Promise<any> {
    // URL 결정 (입력이 URL 문자열이면 우선 사용)
    let url = this.property.url;
    if (typeof input === 'string' && input.trim().startsWith('http')) {
      url = input.trim();
    } else if (input && typeof input === 'object' && input.url && typeof input.url === 'string') {
      url = input.url;
    }
    
    // URL 검증
    if (!url) {
      throw new Error('URL이 지정되지 않았습니다. 노드 설정이나 입력에서 URL을 제공해주세요.');
    }
    
    // 셀렉터 처리
    const result: Record<string, any> = {
      url,
      timestamp: new Date().toISOString()
    };
    
    // 추출 셀렉터가 있을 경우 각각 처리
    const extractSelectors = this.property.extractSelectors || {};
    if (Object.keys(extractSelectors).length > 0) {
      // 각 셀렉터 처리
      for (const [key, selectorInfo] of Object.entries(extractSelectors)) {
        // "selector:attribute" 형식 파싱
        const [selector, attribute] = selectorInfo.split(':');
        
        // 크롤링 수행
        const extractedValue = await crawling({
          url,
          selector,
          attribute,
          waitBeforeLoad: this.property.timeout
        });
        
        result[key] = extractedValue;
      }
    } else {
      // 기본 셀렉터로 크롤링
      const mainSelector = this.property.waitForSelector || 'body';
      result.content = await crawling({
        url,
        selector: mainSelector,
        waitBeforeLoad: this.property.timeout
      });
    }
    
    // 출력 형식에 따라 결과 반환
    const outputFormat = this.property.outputFormat || 'full';
    
    switch (outputFormat) {
      case 'text':
        return result.content || '';
      case 'extracted':
        // 추출된 셀렉터 값만 반환
        const extractedData: Record<string, any> = {};
        for (const key of Object.keys(extractSelectors)) {
          extractedData[key] = result[key];
        }
        return extractedData;
      case 'html':
        return result.content || '';
      default:
        // 'full' - 전체 결과 객체 반환
        return result;
    }
  }
} 