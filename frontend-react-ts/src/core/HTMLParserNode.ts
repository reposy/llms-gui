import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { HTMLParserNodeContent } from '../types/nodes';

/**
 * HTML 문자열에서 CSS 선택자를 사용하여 요소를 추출하는 함수
 */
function extractFromHTML(html: string, cssSelector: string): Element[] | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return Array.from(doc.querySelectorAll(cssSelector));
  } catch (error) {
    console.error('CSS 선택자 추출 오류:', error);
    return null;
  }
}

/**
 * 요소에서 속성 또는 텍스트를 추출하는 함수
 */
function extractContent(elements: Element[], type: 'text' | 'html' | 'attribute', attribute?: string): string[] {
  if (!elements || elements.length === 0) return [];
  
  return elements.map(el => {
    if (type === 'text') {
      return el.textContent || '';
    } else if (type === 'html') {
      return el.outerHTML || '';
    } else if (type === 'attribute' && attribute) {
      return el.getAttribute(attribute) || '';
    }
    return '';
  }).filter(content => content !== null && content !== undefined);
}

/**
 * Helper function to extract HTML content from various input types.
 */
function getHtmlContentFromInput(input: any, log: (message: string) => void): string | null {
  if (input instanceof Document) {
    log('Document 객체 입력 감지됨');
    return new XMLSerializer().serializeToString(input);
  }

  if (typeof input === 'string') {
    // Assume it's HTML if it's a string and looks like HTML
    if (input.trim().startsWith('<') && input.trim().endsWith('>')) {
      log(`문자열 입력 감지됨 (${input.length} 바이트)`);
      return input;
    } else {
      log('문자열 입력이 HTML 형식이 아님');
      return null;
    }
  }

  if (input && typeof input === 'object') {
    if (input.html && typeof input.html === 'string') {
      log(`객체 입력에서 html 필드 감지됨 (${input.html.length} 바이트)`);
      return input.html;
    }
    if (input.text && typeof input.text === 'string') {
      // Only treat as HTML if it looks like HTML
      if (input.text.trim().startsWith('<') && input.text.trim().endsWith('>')) {
        log(`객체 입력에서 text 필드 감지됨 (${input.text.length} 바이트) - HTML로 처리`);
        return input.text; 
      } else {
         log('객체 입력의 text 필드가 HTML 형식이 아님');
         // Continue checking other fields
      }
    }
    if (input.document && input.document instanceof Document) {
       log('객체 입력에서 document 필드 감지됨');
      return new XMLSerializer().serializeToString(input.document);
    }

    // Try finding the first string field that looks like HTML
    const firstHtmlField = Object.entries(input).find(([_, value]) =>
      typeof value === 'string' && value.trim().startsWith('<') && value.trim().endsWith('>')
    );
    if (firstHtmlField) {
      log(`객체 입력에서 HTML로 보이는 ${firstHtmlField[0]} 필드 감지됨 (${(firstHtmlField[1] as string).length} 바이트)`);
      return firstHtmlField[1] as string;
    }

    log('객체 입력에서 HTML 관련 필드를 찾을 수 없음');
    return null; // Indicate HTML content couldn't be extracted from object
  }

  log('처리할 수 없는 입력 타입');
  return null; // Indicate input couldn't be processed
}

/**
 * HTML Parser 노드 클래스
 * WebCrawler 등에서 전달받은 HTML을 파싱하여 구조화된 데이터로 변환
 */
export class HTMLParserNode extends Node {
  declare property: HTMLParserNodeContent;

  constructor(id: string, property: Record<string, any> = {}, context?: FlowExecutionContext) {
    super(id, 'html-parser', property);
    
    // 생성자에서 context를 명시적으로 설정
    if (context) {
      this.context = context;
    }
  }


  /**
   * HTMLParserNode의 핵심 실행 메서드
   * @param input HTML 문자열, Document 객체 또는 HTML 필드를 포함한 객체
   * @returns 파싱된 결과 객체 또는 오류 시 null
   */
  async execute(input: any): Promise<any> {
    this._log('실행 시작');

    // Extract HTML content using the helper function
    const htmlContent = getHtmlContentFromInput(input, (message) => this._log(message));

    // If no valid HTML content, stop processing this branch
    if (!htmlContent || htmlContent.trim().length === 0) {
      this._log('유효한 HTML 콘텐츠를 찾을 수 없습니다. 브랜치 실행을 중단합니다.');
      return null;
    }

    // 최신 노드 설정 가져오기
    let nodeContent: HTMLParserNodeContent | undefined = undefined;
    if (this.context && typeof this.context.getNodeContentFunc === 'function') {
      nodeContent = this.context.getNodeContentFunc(this.id, this.type) as HTMLParserNodeContent;
    } else {
      nodeContent = this.property as HTMLParserNodeContent;
    }
    const extractionRules = nodeContent.extractionRules || [];

    // If no rules, maybe return the HTML itself or null?
    // Returning the HTML makes it act like a pass-through if no rules defined.
    if (extractionRules.length === 0) {
      this._log('경고 - 추출 규칙이 정의되지 않았습니다. 추출된 HTML 콘텐츠를 반환합니다.');
      return htmlContent; // Return HTML content directly
    }

    // 클라이언트 사이드에서 직접 파싱
    this._log(`HTML 파싱 시작 - ${extractionRules.length}개 규칙 적용`);
    
    const result: Record<string, string | string[]> = {};
    
    // 각 규칙에 대해 결과 추출
    for (const rule of extractionRules) {
      if (!rule.selector) continue;
      
      const elements = extractFromHTML(htmlContent, rule.selector);
      // If querySelectorAll throws (invalid selector), extractFromHTML returns null
      if (elements === null) {
         throw new Error(`Invalid CSS selector in rule '${rule.name}': ${rule.selector}`);
      }
      
      if (elements.length === 0) {
        result[rule.name] = rule.multiple ? [] : '';
        continue;
      }
      
      const extractedValues = extractContent(
        elements, 
        rule.target,
        rule.target === 'attribute' ? rule.attribute_name : undefined
      );
      
      if (rule.multiple) {
        result[rule.name] = extractedValues;
      } else {
        result[rule.name] = extractedValues.length > 0 ? extractedValues[0] : '';
      }
    }

    // 결과 반환
    this._log('실행 성공, 데이터 추출됨');
    return result; // Return the result object
  }
} 