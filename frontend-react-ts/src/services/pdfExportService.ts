import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { PDFExportOptions, PDFExportResult, PDFCompressionOptions } from '../types/pdf';

/**
 * PDF 내보내기를 담당하는 중앙화된 서비스
 * 프로젝트 원칙: 단일 진입점, 확장성, 일관성
 */
export class PDFExportService {
  private static instance: PDFExportService;

  /**
   * 싱글톤 인스턴스 반환 (단일 진입점 원칙)
   */
  public static getInstance(): PDFExportService {
    if (!PDFExportService.instance) {
      PDFExportService.instance = new PDFExportService();
    }
    return PDFExportService.instance;
  }

  /**
   * HTML 요소를 PDF로 내보내기 (한글 지원 하이브리드 방식)
   * @param elementId 캡처할 HTML 요소의 ID
   * @param options PDF 내보내기 옵션
   * @returns PDF 내보내기 결과
   */
  public async exportElementToPDF(
    elementId: string,
    options: PDFExportOptions
  ): Promise<PDFExportResult> {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`Element with ID '${elementId}' not found`);
      }

      // 기본 압축 옵션 설정
      const compression = this.getDefaultCompressionOptions(options.compression);
      
      // 한글 포함 여부 확인
      const hasKorean = this.hasKoreanText(element);
      
      let result;
      if (hasKorean) {
        // 한글이 있으면 html2canvas 사용 (이미지 크기만 50%로 조정)
        result = await this.generateImageBasedPDF(element, options, compression);
      } else {
        // 영어만 있으면 텍스트 기반 PDF 생성
        result = await this.generateHybridPDF(element, options, compression);
      }
      
      return {
        success: true,
        filename: result.filename,
        estimatedSizeMB: result.estimatedSizeMB
      };

    } catch (error) {
      console.error('[PDFExportService] Export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 한글 텍스트 포함 여부 확인
   */
  private hasKoreanText(element: HTMLElement): boolean {
    const text = element.textContent || '';
    // 한글 유니코드 범위: ㄱ-ㅎㅏ-ㅣ가-힣
    const koreanRegex = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;
    return koreanRegex.test(text);
  }

  /**
   * html2canvas를 사용한 이미지 기반 PDF 생성 (한글 지원)
   */
  private async generateImageBasedPDF(
    element: HTMLElement,
    options: PDFExportOptions,
    compression: PDFCompressionOptions
  ): Promise<{ filename: string; estimatedSizeMB: number }> {
    // PDF 생성을 위한 스타일 임시 적용
    const originalStyles = await this.applyPDFStyles(element);
    
    try {
      // PDF 객체 생성
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = pdfHeight - (margin * 2);
      
      // 페이지별로 콘텐츠 분할하여 처리
      await this.captureAndAddPages(element, pdf, margin, contentWidth, contentHeight, compression);
      
      const filename = this.generateFilename(options.filename);
      pdf.save(filename);

      return { 
        filename, 
        estimatedSizeMB: 2.0 // 다중 페이지 추정값
      };
    } finally {
      // 원본 스타일 복원
      this.restoreOriginalStyles(element, originalStyles);
    }
  }

  /**
   * 콘텐츠를 페이지별로 캡처하여 PDF에 추가
   */
  private async captureAndAddPages(
    element: HTMLElement,
    pdf: jsPDF,
    margin: number,
    contentWidth: number,
    contentHeight: number,
    compression: PDFCompressionOptions
  ): Promise<void> {
    // 전체 높이 계산
    const totalHeight = element.scrollHeight;
    const pageHeightPx = (contentHeight * 96) / 25.4; // mm를 px로 변환 (96 DPI 기준)
    
    let currentY = 0;
    let pageNumber = 0;
    let hasAddedFirstPage = false;

    while (currentY < totalHeight) {
      // 첫 페이지가 아니면 새 페이지 추가
      if (hasAddedFirstPage) {
        pdf.addPage();
      }
      hasAddedFirstPage = true;

      // 현재 페이지의 끝 Y 좌표 계산
      const pageEndY = Math.min(currentY + pageHeightPx, totalHeight);
      const actualPageHeight = pageEndY - currentY;

      try {
        // 현재 페이지 영역만 캡처
        const canvas = await this.capturePageSection(
          element, 
          currentY, 
          actualPageHeight, 
          compression
        );

        if (canvas && canvas.width > 0 && canvas.height > 0) {
          // PDF에 맞는 크기로 계산
          const imgWidth = contentWidth;
          const imgHeight = (canvas.height * contentWidth) / canvas.width;
          
          // 실제 PDF 높이를 넘지 않도록 제한
          const finalHeight = Math.min(imgHeight, contentHeight);
          
          const imgData = canvas.toDataURL('image/jpeg', compression.imageQuality);
          pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, finalHeight);
        }
      } catch (error) {
        console.warn(`[PDFExportService] Failed to capture page ${pageNumber + 1}:`, error);
      }

      currentY = pageEndY;
      pageNumber++;
      
      // 무한 루프 방지
      if (pageNumber > 50) {
        console.warn('[PDFExportService] Too many pages, stopping at 50');
        break;
      }
    }
  }

  /**
   * 페이지의 특정 섹션만 캡처
   */
  private async capturePageSection(
    element: HTMLElement,
    startY: number,
    height: number,
    compression: PDFCompressionOptions
  ): Promise<HTMLCanvasElement> {
    // 임시 컨테이너 생성
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0px';
    tempContainer.style.width = `${element.offsetWidth}px`;
    tempContainer.style.height = `${height}px`;
    tempContainer.style.overflow = 'hidden';
    
    // 원본 요소 복제
    const clonedElement = element.cloneNode(true) as HTMLElement;
    clonedElement.style.position = 'relative';
    clonedElement.style.top = `-${startY}px`;
    clonedElement.style.left = '0px';
    
    tempContainer.appendChild(clonedElement);
    document.body.appendChild(tempContainer);

    try {
      // CORS 문제 해결을 위해 이미지를 미리 로드
      await this.preloadImages(clonedElement);
      
      // 캡처 실행
      const canvas = await html2canvas(tempContainer, {
        scale: 1.5,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        width: tempContainer.offsetWidth,
        height: tempContainer.offsetHeight,
        foreignObjectRendering: false,
        ignoreElements: (element) => {
          return element.classList.contains('scrollbar') || 
                 element.tagName === 'SCRIPT' ||
                 element.tagName === 'STYLE';
        },
        imageTimeout: 15000,
        removeContainer: true
      });

      return canvas;
    } finally {
      // 임시 컨테이너 제거
      document.body.removeChild(tempContainer);
    }
  }

  /**
   * PDF 생성을 위한 임시 스타일 적용
   */
  private async applyPDFStyles(element: HTMLElement): Promise<Map<HTMLElement, string>> {
    const originalStyles = new Map<HTMLElement, string>();
    
    // 메인 컨테이너 스타일 조정
    originalStyles.set(element, element.style.cssText);
    element.style.width = 'auto';
    element.style.maxWidth = '800px'; // PDF에 맞는 최대 폭 설정
    element.style.wordWrap = 'break-word';
    element.style.wordBreak = 'break-word';
    element.style.whiteSpace = 'pre-wrap';
    element.style.overflow = 'visible';
    
    // 모든 텍스트 요소 개행 처리
    const textElements = element.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6');
    textElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      originalStyles.set(htmlEl, htmlEl.style.cssText);
      htmlEl.style.wordWrap = 'break-word';
      htmlEl.style.wordBreak = 'break-word';
      htmlEl.style.whiteSpace = 'pre-wrap';
      htmlEl.style.maxWidth = '100%';
      htmlEl.style.overflow = 'visible';
    });
    
    // 이미지 요소 크기 조정
    const images = element.querySelectorAll('img');
    images.forEach((img) => {
      const htmlImg = img as HTMLElement;
      originalStyles.set(htmlImg, htmlImg.style.cssText);
      
      // 원본 크기 계산
      const naturalWidth = (img as HTMLImageElement).naturalWidth || 400;
      const naturalHeight = (img as HTMLImageElement).naturalHeight || 300;
      
      // PDF에 맞는 크기로 조정 (최대 400px 폭)
      const maxWidth = 400;
      let newWidth = Math.min(naturalWidth, maxWidth);
      let newHeight = (naturalHeight * newWidth) / naturalWidth;
      
      htmlImg.style.width = `${newWidth}px`;
      htmlImg.style.height = `${newHeight}px`;
      htmlImg.style.maxWidth = '100%';
      htmlImg.style.height = 'auto';
      htmlImg.style.display = 'block';
      htmlImg.style.margin = '10px auto';
      htmlImg.style.objectFit = 'contain';
    });
    
    // 브라우저가 리플로우하도록 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return originalStyles;
  }

  /**
   * 원본 스타일 복원
   */
  private restoreOriginalStyles(element: HTMLElement, originalStyles: Map<HTMLElement, string>): void {
    originalStyles.forEach((cssText, el) => {
      el.style.cssText = cssText;
    });
  }

  /**
   * 요소 내의 모든 이미지를 미리 로드하여 CORS 문제 해결
   */
  private async preloadImages(element: HTMLElement): Promise<void> {
    const images = element.querySelectorAll('img');
    const loadPromises: Promise<void>[] = [];

    images.forEach((img) => {
      if (img.src && img.src.startsWith('http://localhost:8000')) {
        const promise = new Promise<void>((resolve, reject) => {
          const newImg = new Image();
          newImg.crossOrigin = 'anonymous';
          
          newImg.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              canvas.width = newImg.naturalWidth;
              canvas.height = newImg.naturalHeight;
              ctx.drawImage(newImg, 0, 0);
              
              const dataURL = canvas.toDataURL('image/jpeg', 0.9);
              img.src = dataURL;
            }
            
            resolve();
          };
          
          newImg.onerror = () => {
            console.warn('[PDFExportService] Failed to load image:', img.src);
            resolve();
          };
          
          newImg.src = img.src;
        });
        
        loadPromises.push(promise);
      }
    });

    await Promise.all(loadPromises);
  }

  /**
   * 이미지 기반 PDF 크기 추정
   */
  private estimateImagePDFSize(
    canvas: HTMLCanvasElement,
    compression: PDFCompressionOptions
  ): number {
    const pixelCount = canvas.width * canvas.height;
    const bytesPerPixel = 3;
    const compressionRatio = compression.imageQuality;
    
    const estimatedBytes = pixelCount * bytesPerPixel * compressionRatio;
    return Math.round((estimatedBytes / (1024 * 1024)) * 100) / 100;
  }

  /**
   * 텍스트 내용을 PDF로 내보내기 (이미지 없는 경우)
   * @param content 텍스트 내용
   * @param options PDF 내보내기 옵션
   */
  public async exportTextToPDF(
    content: string,
    options: PDFExportOptions
  ): Promise<PDFExportResult> {
    try {
      const doc = new jsPDF();
      
      // 한글 폰트 설정
      this.setupKoreanFont(doc);
      
      // 텍스트를 페이지에 맞게 분할
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxLineWidth = pageWidth - (margin * 2);
      
      const lines = doc.splitTextToSize(content, maxLineWidth);
      
      // 페이지 높이 계산
      const pageHeight = doc.internal.pageSize.getHeight();
      const lineHeight = 7;
      const maxLinesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);
      
      // 다중 페이지 처리
      for (let i = 0; i < lines.length; i += maxLinesPerPage) {
        if (i > 0) {
          doc.addPage();
          this.setupKoreanFont(doc);
        }
        
        const pageLines = lines.slice(i, i + maxLinesPerPage);
        doc.text(pageLines, margin, margin);
      }
      
      // 파일명 생성 및 다운로드
      const filename = this.generateFilename(options.filename);
      doc.save(filename);
      
      return {
        success: true,
        filename,
        estimatedSizeMB: this.estimateTextPDFSize(content)
      };

    } catch (error) {
      console.error('[PDFExportService] Text export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 텍스트 기반 PDF 크기 추정
   */
  private estimateTextPDFSize(content: string): number {
    // 텍스트 길이 기반 대략적 추정
    const bytesPerChar = 1.5; // 평균적인 PDF 압축 고려
    const estimatedBytes = content.length * bytesPerChar;
    return Math.round((estimatedBytes / (1024 * 1024)) * 100) / 100; // MB
  }

  /**
   * 텍스트와 이미지를 분리하여 하이브리드 PDF 생성
   */
  private async generateHybridPDF(
    element: HTMLElement,
    options: PDFExportOptions,
    compression: PDFCompressionOptions
  ): Promise<{ filename: string; estimatedSizeMB: number }> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 한글 폰트 설정 (시스템 폰트 활용)
    this.setupKoreanFont(pdf);

    // A4 크기 설정
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pdfWidth - (margin * 2);
    
    let currentY = margin;
    const lineHeight = 7;
    const maxContentHeight = pdfHeight - (margin * 2);

    // HTML 요소에서 콘텐츠 추출 및 렌더링
    const content = await this.extractHybridContent(element);
    
    for (const item of content) {
      // 페이지 넘김 체크
      if (currentY > pdfHeight - margin * 2) {
        pdf.addPage();
        this.setupKoreanFont(pdf); // 새 페이지에도 폰트 설정
        currentY = margin;
      }

      if (item.type === 'text') {
        // 텍스트 처리 - 실제 텍스트로 렌더링
        const textHeight = await this.addTextToPDF(pdf, item.content || '', margin, currentY, contentWidth, lineHeight);
        currentY += textHeight + 5;
        
      } else if (item.type === 'image' && item.element) {
        // 이미지 처리 - 50% 크기로 중앙 정렬
        const imgHeight = await this.addImageToPDF(pdf, item.element, margin, currentY, contentWidth, maxContentHeight, compression);
        if (imgHeight > 0) {
          currentY += imgHeight + 10;
        }
      }

      // 페이지 높이 초과 체크
      if (currentY > pdfHeight - margin) {
        pdf.addPage();
        this.setupKoreanFont(pdf);
        currentY = margin;
      }
    }

    // 파일명 생성 및 다운로드
    const filename = this.generateFilename(options.filename);
    pdf.save(filename);

    // 파일 크기 추정
    const imageCount = content.filter(item => item.type === 'image').length;
    const estimatedSizeMB = imageCount * 0.3 + 0.1; // 대략적 추정

    return { filename, estimatedSizeMB };
  }

  /**
   * 한글 폰트 설정 (시스템 폰트 활용)
   */
  private setupKoreanFont(pdf: jsPDF): void {
    // 한글 지원 폰트로 설정 (fallback 체인)
    pdf.setFont('helvetica'); // 기본 폰트
    pdf.setFontSize(12);
    
    // CSS에서 사용하는 한글 폰트 스택과 유사하게 설정
    // 실제로는 jsPDF가 시스템 폰트를 직접 사용하지 못하므로
    // unicode 문자열 처리를 개선하는 방향으로 접근
  }

  /**
   * HTML에서 텍스트와 이미지 하이브리드 콘텐츠 추출
   */
  private async extractHybridContent(element: HTMLElement): Promise<Array<{
    type: 'text' | 'image';
    content?: string;
    element?: HTMLImageElement;
  }>> {
    const content: Array<{ type: 'text' | 'image'; content?: string; element?: HTMLImageElement }> = [];
    
    // DOM을 순회하면서 텍스트와 이미지를 순서대로 추출
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            return text && text.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
          if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'IMG') {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text && text.length > 0) {
          content.push({
            type: 'text',
            content: text
          });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        if (element.tagName === 'IMG') {
          content.push({
            type: 'image',
            element: element as HTMLImageElement
          });
        }
      }
    }

    return content;
  }

  /**
   * PDF에 텍스트 추가
   */
  private async addTextToPDF(
    pdf: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): Promise<number> {
    const lines = pdf.splitTextToSize(text, maxWidth);
    const totalHeight = lines.length * lineHeight;
    
    pdf.text(lines, x, y);
    return totalHeight;
  }

  /**
   * PDF에 이미지 추가 (50% 크기, 중앙 정렬)
   */
  private async addImageToPDF(
    pdf: jsPDF,
    imgElement: HTMLImageElement,
    marginX: number,
    y: number,
    contentWidth: number,
    maxHeight: number,
    compression: PDFCompressionOptions
  ): Promise<number> {
    try {
      return await new Promise<number>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          // 50% 크기 계산
          const originalWidth = img.naturalWidth;
          const originalHeight = img.naturalHeight;
          
          const maxImgWidth = contentWidth * 0.5; // 50% 제한
          let imgWidth = Math.min(maxImgWidth, originalWidth * 0.5);
          let imgHeight = (originalHeight * imgWidth) / originalWidth;
          
          // 높이 제한
          if (imgHeight > maxHeight * 0.4) {
            imgHeight = maxHeight * 0.4;
            imgWidth = (originalWidth * imgHeight) / originalHeight;
          }
          
          // 중앙 정렬
          const imgX = marginX + (contentWidth - imgWidth) / 2;
          
          // 캔버스로 변환
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            canvas.width = originalWidth;
            canvas.height = originalHeight;
            ctx.drawImage(img, 0, 0);
            
            const imgData = canvas.toDataURL('image/jpeg', compression.imageQuality);
            pdf.addImage(imgData, 'JPEG', imgX, y, imgWidth, imgHeight);
          }
          
          resolve(imgHeight);
        };
        
        img.onerror = () => {
          console.warn('[PDFExportService] Failed to load image:', imgElement.src);
          resolve(0);
        };
        
        img.src = imgElement.src;
      });
    } catch (error) {
      console.warn('[PDFExportService] Error processing image:', error);
      return 0;
    }
  }

  /**
   * 기본 압축 옵션 반환
   */
  private getDefaultCompressionOptions(
    userOptions?: Partial<PDFCompressionOptions>
  ): PDFCompressionOptions {
    return {
      imageQuality: 0.9, // 높은 품질 유지
      scale: 1.5, // 선명도 향상을 위해 스케일 증가
      maxSizeMB: 50,
      ...userOptions
    };
  }

  /**
   * 파일명 생성
   */
  private generateFilename(baseName: string): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    return `${baseName}-${timestamp}.pdf`;
  }
} 