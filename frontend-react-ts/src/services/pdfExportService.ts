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
   * HTML 요소를 PDF로 내보내기
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
      
      // HTML을 캔버스로 변환
      const canvas = await this.captureElement(element, compression);
      
      // PDF 생성 및 다운로드
      const result = await this.generatePDF(canvas, options, compression);
      
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
      
      // 한글 지원을 위한 폰트 설정
      doc.setFont('helvetica');
      doc.setFontSize(12);
      
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
   * HTML 요소를 캔버스로 캡처
   */
  private async captureElement(
    element: HTMLElement,
    compression: PDFCompressionOptions
  ): Promise<HTMLCanvasElement> {
    // CORS 문제 해결을 위해 이미지를 미리 로드
    await this.preloadImages(element);
    
    return await html2canvas(element, {
      scale: compression.scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      height: element.scrollHeight,
      width: element.scrollWidth,
      // 이미지 로딩을 위한 추가 옵션
      foreignObjectRendering: false
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
            // 원본 이미지를 캔버스로 변환하여 CORS 문제 해결
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              canvas.width = newImg.naturalWidth;
              canvas.height = newImg.naturalHeight;
              ctx.drawImage(newImg, 0, 0);
              
              // 원본 img 요소의 src를 canvas의 dataURL로 교체
              const dataURL = canvas.toDataURL('image/jpeg', 0.9);
              img.src = dataURL;
            }
            
            resolve();
          };
          
          newImg.onerror = () => {
            console.warn('[PDFExportService] Failed to load image:', img.src);
            resolve(); // 이미지 로드 실패해도 계속 진행
          };
          
          newImg.src = img.src;
        });
        
        loadPromises.push(promise);
      }
    });

    // 모든 이미지 로드 완료까지 대기
    await Promise.all(loadPromises);
  }

  /**
   * 캔버스에서 PDF 생성
   */
  private async generatePDF(
    canvas: HTMLCanvasElement,
    options: PDFExportOptions,
    compression: PDFCompressionOptions
  ): Promise<{ filename: string; estimatedSizeMB: number }> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // A4 크기 설정
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // 이미지 비율 계산
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    // 이미지 데이터 생성 (압축 적용)
    const imgData = canvas.toDataURL('image/jpeg', compression.imageQuality);

    // 다중 페이지 처리
    if (imgHeight <= pdfHeight) {
      // 한 페이지에 들어가는 경우
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    } else {
      // 여러 페이지로 분할
      let remainingHeight = imgHeight;
      let position = 0;

      while (remainingHeight > 0) {
        const pageHeight = Math.min(remainingHeight, pdfHeight);
        
        if (position > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, 'JPEG', 0, -position, imgWidth, imgHeight);
        
        remainingHeight -= pdfHeight;
        position += pdfHeight;
      }
    }

    // 파일명 생성 및 다운로드
    const filename = this.generateFilename(options.filename);
    pdf.save(filename);

    // 파일 크기 추정
    const estimatedSizeMB = this.estimateImagePDFSize(canvas, compression);

    return { filename, estimatedSizeMB };
  }

  /**
   * 기본 압축 옵션 반환
   */
  private getDefaultCompressionOptions(
    userOptions?: Partial<PDFCompressionOptions>
  ): PDFCompressionOptions {
    return {
      imageQuality: 0.9,
      scale: 1,
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

  /**
   * 이미지 기반 PDF 크기 추정
   */
  private estimateImagePDFSize(
    canvas: HTMLCanvasElement,
    compression: PDFCompressionOptions
  ): number {
    // 캔버스 크기 기반 대략적 추정
    const pixelCount = canvas.width * canvas.height;
    const bytesPerPixel = 3; // RGB
    const compressionRatio = compression.imageQuality;
    
    const estimatedBytes = pixelCount * bytesPerPixel * compressionRatio;
    return Math.round((estimatedBytes / (1024 * 1024)) * 100) / 100; // MB
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
} 