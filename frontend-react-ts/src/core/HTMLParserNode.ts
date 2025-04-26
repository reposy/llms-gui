import { Node } from './Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { HTMLParserNodeContent, useNodeContentStore } from '../store/useNodeContentStore';

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
function extractContent(elements: Element[], type: 'text' | 'attribute', attribute?: string): string[] {
  if (!elements || elements.length === 0) return [];
  
  return elements.map(el => {
    if (type === 'text') {
      return el.textContent || '';
    } else if (type === 'attribute' && attribute) {
      return el.getAttribute(attribute) || '';
    }
    return '';
  }).filter(content => content !== '');
}

/**
 * HTML Parser 노드 클래스
 * WebCrawler 등에서 전달받은 HTML을 파싱하여 구조화된 데이터로 변환
 */
export class HTMLParserNode extends Node {
  declare property: HTMLParserNodeContent;

  constructor(id: string, property: Record<string, any> = {}, context?: FlowExecutionContext) {
    super(id, 'html-parser', property, context);
  }

  /**
   * HTMLParserNode의 핵심 실행 메서드
   * @param input HTML 문자열, Document 객체 또는 HTML 필드를 포함한 객체
   * @returns 파싱된 결과 객체 또는 오류 시 null
   */
  async execute(input: any): Promise<any> {
    try {
      this.context?.log(`${this.type}(${this.id}): 실행 시작`);
      this.context?.markNodeRunning(this.id);

      // 입력 검증 및 HTML 문자열 추출
      let htmlContent = '';
      let originalInput = input;
      
      // Document 객체 처리
      if (input instanceof Document) {
        htmlContent = new XMLSerializer().serializeToString(input);
        this.context?.log(`${this.type}(${this.id}): Document 객체 입력 감지됨`);
      } else if (typeof input === 'string') {
        // 직접 HTML 문자열이 입력된 경우
        htmlContent = input;
        this.context?.log(`${this.type}(${this.id}): 문자열 입력 감지됨 (${htmlContent.length} 바이트)`);
      } else if (input && typeof input === 'object') {
        // 객체가 입력된 경우 (이전 노드의 출력)
        if (input.html) {
          // 웹 크롤러 노드의 출력인 경우
          htmlContent = input.html;
          this.context?.log(`${this.type}(${this.id}): 객체 입력에서 html 필드 감지됨 (${htmlContent.length} 바이트)`);
        } else if (input.text) {
          // 텍스트 필드가 있는 경우
          htmlContent = input.text;
          this.context?.log(`${this.type}(${this.id}): 객체 입력에서 text 필드 감지됨 (${htmlContent.length} 바이트)`);
        } else if (input.document) {
          // document 필드가 있는 경우
          if (input.document instanceof Document) {
            htmlContent = new XMLSerializer().serializeToString(input.document);
            this.context?.log(`${this.type}(${this.id}): 객체 입력에서 document 필드 감지됨`);
          }
        } else {
          // 다른 필드가 있는지 시도
          const firstHtmlField = Object.entries(input).find(([_, value]) => 
            typeof value === 'string' && value.trim().startsWith('<') && value.trim().endsWith('>')
          );
          
          if (firstHtmlField) {
            htmlContent = firstHtmlField[1] as string;
            this.context?.log(`${this.type}(${this.id}): 객체 입력에서 HTML로 보이는 ${firstHtmlField[0]} 필드 감지됨 (${htmlContent.length} 바이트)`);
          } else {
            // HTML 관련 필드를 찾을 수 없으면 원래 입력을 그대로 반환
            this.context?.log(`${this.type}(${this.id}): HTML 콘텐츠를 찾을 수 없어 원본 입력을 그대로 반환합니다`);
            this.context?.storeOutput(this.id, originalInput);
            this.context?.markNodeSuccess(this.id, originalInput);
            return originalInput;
          }
        }
      } else {
        // 처리할 수 없는 입력은 그대로 반환
        this.context?.log(`${this.type}(${this.id}): 처리할 수 없는 입력, 그대로 반환합니다`);
        this.context?.storeOutput(this.id, originalInput);
        this.context?.markNodeSuccess(this.id, originalInput);
        return originalInput;
      }

      if (!htmlContent || htmlContent.trim().length === 0) {
        this.context?.log(`${this.type}(${this.id}): 비어있는 HTML 콘텐츠, 원본 입력을 그대로 반환합니다`);
        this.context?.storeOutput(this.id, originalInput);
        this.context?.markNodeSuccess(this.id, originalInput);
        return originalInput;
      }

      // 최신 노드 설정 가져오기
      const nodeContent = useNodeContentStore.getState().getNodeContent<HTMLParserNodeContent>(this.id, this.type);
      const extractionRules = nodeContent.extractionRules || [];

      if (extractionRules.length === 0) {
        this.context?.log(`${this.type}(${this.id}): 경고 - 추출 규칙이 정의되지 않았습니다, 원본 입력을 그대로 반환합니다`);
        this.context?.storeOutput(this.id, originalInput);
        this.context?.markNodeSuccess(this.id, originalInput);
        return originalInput;
      }

      // 클라이언트 사이드에서 직접 파싱
      this.context?.log(`${this.type}(${this.id}): HTML 파싱 시작 - ${extractionRules.length}개 규칙 적용`);
      
      const result: Record<string, string | string[]> = {};
      
      // 각 규칙에 대해 결과 추출
      for (const rule of extractionRules) {
        if (!rule.cssSelector) continue;
        
        const elements = extractFromHTML(htmlContent, rule.cssSelector);
        if (!elements || elements.length === 0) {
          result[rule.name] = '';
          continue;
        }
        
        const extractedValues = extractContent(
          elements, 
          rule.type, 
          rule.type === 'attribute' ? rule.attribute : undefined
        );
        
        // 단일 결과 또는 배열로 저장
        result[rule.name] = extractedValues.length === 1 ? extractedValues[0] : extractedValues;
      }

      // 결과 저장 및 반환
      this.context?.log(`${this.type}(${this.id}): 실행 성공, 데이터 추출됨`);
      this.context?.storeOutput(this.id, result);
      this.context?.markNodeSuccess(this.id, result);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.log(`${this.type}(${this.id}): 오류 - ${errorMessage}`);
      this.context?.markNodeError(this.id, errorMessage);
      return input; // 오류 발생해도 체이닝 가능하도록 원본 입력 반환
    }
  }
} 