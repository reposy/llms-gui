import { Node } from './Node';
import { crawling } from '../utils/crawling';
import { FlowExecutionContext } from './FlowExecutionContext';
import { getNodeContent, WebCrawlerNodeContent } from '../store/nodeContentStore';
import { syncNodeProperties, webCrawlerNodeSyncConfig } from '../utils/nodePropertySync';

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
   * Synchronize property from Zustand store before execution
   */
  syncPropertyFromStore(): void {
    // 공통 유틸리티 사용하여 속성 동기화
    syncNodeProperties(this, webCrawlerNodeSyncConfig, 'web-crawler');
  }

  /**
   * Execute the node's specific logic
   * @param input The input data that may contain URL override
   * @returns The extracted web content
   */
  async execute(input: any): Promise<any> {
    try {
      // 실행 시작 표시
      this.context?.markNodeRunning(this.id);
      
      // URL 결정 (입력이 URL 문자열이면 우선 사용)
      let url = this.property.url;
      if (typeof input === 'string' && input.trim().startsWith('http')) {
        url = input.trim();
      } else if (input && typeof input === 'object' && input.url && typeof input.url === 'string') {
        url = input.url;
      }
      
      // URL 검증
      if (!url) {
        const errorMsg = 'URL이 지정되지 않았습니다. 노드 설정이나 입력에서 URL을 제공해주세요.';
        this.context?.log(`WebCrawlerNode(${this.id}): ${errorMsg}`);
        this.context?.markNodeError(this.id, errorMsg);
        throw new Error(errorMsg);
      }
      
      // 셀렉터 처리
      const result: Record<string, any> = {
        url,
        timestamp: new Date().toISOString()
      };
      
      // 크롤링 시작 로그
      this.context?.log(`WebCrawlerNode(${this.id}): 크롤링 시작: ${url}`);
      
      // 추출 셀렉터가 있을 경우 각각 처리
      const extractSelectors = this.property.extractSelectors || {};
      if (Object.keys(extractSelectors).length > 0) {
        // 각 셀렉터 처리
        for (const [key, selectorInfo] of Object.entries(extractSelectors)) {
          // "selector:attribute" 형식 파싱
          const [selector, attribute] = selectorInfo.split(':');
          
          this.context?.log(`WebCrawlerNode(${this.id}): 셀렉터 ${key} => ${selector} ${attribute ? `(${attribute})` : ''}`);
          
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
        this.context?.log(`WebCrawlerNode(${this.id}): 기본 셀렉터로 크롤링: ${mainSelector}`);
        
        result.content = await crawling({
          url,
          selector: mainSelector,
          waitBeforeLoad: this.property.timeout
        });
      }
      
      // 출력 형식에 따라 결과 반환
      const outputFormat = this.property.outputFormat || 'full';
      let finalResult;
      
      switch (outputFormat) {
        case 'text':
          finalResult = result.content || '';
          break;
        case 'extracted':
          // 추출된 셀렉터 값만 반환
          const extractedData: Record<string, any> = {};
          for (const key of Object.keys(extractSelectors)) {
            extractedData[key] = result[key];
          }
          finalResult = extractedData;
          break;
        case 'html':
          finalResult = result.content || '';
          break;
        default:
          // 'full' - 전체 결과 객체 반환
          finalResult = result;
      }
      
      // 출력 저장
      this.context?.storeOutput(this.id, finalResult);
      
      // 디버깅 정보 저장
      this.context?.storeNodeData(this.id, {
        url,
        selectorCount: Object.keys(extractSelectors).length,
        outputFormat,
        timestamp: new Date().toISOString()
      });
      
      this.context?.log(`WebCrawlerNode(${this.id}): 크롤링 완료, 출력 형식: ${outputFormat}`);
      return finalResult;
    } catch (error) {
      // 오류 발생 시 로그 및 노드 상태 업데이트
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.log(`WebCrawlerNode(${this.id}): 실행 중 오류 발생: ${errorMessage}`);
      this.context?.markNodeError(this.id, errorMessage);
      
      // null 반환하여 실행 중단
      return null;
    }
  }
} 