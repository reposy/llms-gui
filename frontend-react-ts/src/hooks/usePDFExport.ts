import { useCallback, useState } from 'react';
import { PDFExportService } from '../services/pdfExportService';
import { PDFExportOptions, PDFExportResult, PDFExportCallbacks } from '../types/pdf';

/**
 * PDF 내보내기를 위한 중앙화된 훅
 * 프로젝트 원칙: 단일 진입점, 일관성 (useImportService와 동일한 패턴)
 */
export const usePDFExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  /**
   * HTML 요소를 PDF로 내보내기
   * @param elementId 캡처할 HTML 요소의 ID
   * @param options PDF 내보내기 옵션
   * @param callbacks 콜백 함수들
   */
  const exportElementToPDF = useCallback(async (
    elementId: string,
    options: PDFExportOptions,
    callbacks?: PDFExportCallbacks
  ): Promise<PDFExportResult> => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      callbacks?.onStart?.();
      
      // 진행률 시뮬레이션 (실제 구현에서는 단계별로 업데이트)
      setExportProgress(20);
      
      const pdfService = PDFExportService.getInstance();
      
      setExportProgress(50);
      
      const result = await pdfService.exportElementToPDF(elementId, options);
      
      setExportProgress(100);
      callbacks?.onComplete?.(result);
      
      return result;

    } catch (error) {
      const pdfError = error instanceof Error ? error : new Error(String(error));
      callbacks?.onError?.(pdfError);
      
      return {
        success: false,
        error: pdfError.message
      };
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, []);

  /**
   * 텍스트 내용을 PDF로 내보내기
   * @param content 텍스트 내용
   * @param options PDF 내보내기 옵션
   * @param callbacks 콜백 함수들
   */
  const exportTextToPDF = useCallback(async (
    content: string,
    options: PDFExportOptions,
    callbacks?: PDFExportCallbacks
  ): Promise<PDFExportResult> => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      callbacks?.onStart?.();
      setExportProgress(30);

      const pdfService = PDFExportService.getInstance();
      const result = await pdfService.exportTextToPDF(content, options);

      setExportProgress(100);
      callbacks?.onComplete?.(result);

      return result;

    } catch (error) {
      const pdfError = error instanceof Error ? error : new Error(String(error));
      callbacks?.onError?.(pdfError);

      return {
        success: false,
        error: pdfError.message
      };
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, []);

  /**
   * Flow 결과를 모드별로 PDF 내보내기 (FlowResultDisplay 전용 헬퍼)
   * @param mode 내보낼 모드
   * @param flowName Flow 이름
   * @param markdownMode 마크다운 렌더링 모드 (join 모드에서만 사용)
   * @param callbacks 콜백 함수들
   */
  const exportFlowResultToPDF = useCallback(async (
    mode: 'outputs' | 'join' | 'raw',
    flowName: string,
    markdownMode: 'text' | 'markdown' = 'text',
    callbacks?: PDFExportCallbacks
  ): Promise<PDFExportResult> => {
    // FlowResultDisplay에서 사용할 요소 ID 생성
    const elementId = mode === 'join' && markdownMode === 'markdown' 
      ? 'flow-result-join-markdown' 
      : `flow-result-${mode}`;

    const options: PDFExportOptions = {
      filename: `${flowName}-${mode}`,
      mode,
      markdownMode
    };

    // 마크다운 모드는 시각적 PDF, 나머지는 가능하면 텍스트 PDF
    if (mode === 'join' && markdownMode === 'markdown') {
      return await exportElementToPDF(elementId, options, callbacks);
    } else {
      // 텍스트 기반 PDF 시도, 실패시 시각적 PDF로 폴백
      try {
        const element = document.getElementById(elementId);
        if (element) {
          const textContent = element.textContent || '';
          return await exportTextToPDF(textContent, options, callbacks);
        } else {
          throw new Error('Element not found, using visual PDF');
        }
      } catch {
        // 폴백: 시각적 PDF
        return await exportElementToPDF(elementId, options, callbacks);
      }
    }
  }, [exportElementToPDF, exportTextToPDF]);

  return {
    // 상태
    isExporting,
    exportProgress,
    
    // 기본 메서드
    exportElementToPDF,
    exportTextToPDF,
    
    // 편의 메서드
    exportFlowResultToPDF
  };
}; 