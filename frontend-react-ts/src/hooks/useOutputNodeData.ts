import { OutputNodeContent, useNodeContent } from '../store/useNodeContentStore';
import { OutputFormat } from '../types';
import { useCallback } from 'react';

/**
 * OutputNode 데이터를 관리하는 단순화된 훅
 * @param nodeId 노드 ID
 */
export const useOutputNodeData = (nodeId: string) => {
  const { content, updateContent } = useNodeContent(nodeId);

  // 출력 포맷 변경 핸들러
  const handleFormatChange = useCallback(
    (newFormat: OutputFormat) => {
      updateContent({ format: newFormat });
    },
    [updateContent]
  );

  // 모드 설정 함수
  const setMode = useCallback(
    (mode: 'write' | 'read') => {
      updateContent({ mode });
    },
    [updateContent]
  );

  // 출력 컨텐츠 초기화 함수
  const clearOutput = useCallback(() => {
    updateContent({ content: null });
  }, [updateContent]);

  // 컨텐츠 변경 핸들러
  const handleContentChange = useCallback(
    (newContent: any) => {
      updateContent({ content: newContent });
    },
    [updateContent]
  );

  /**
   * 선택된 포맷에 따라 결과를 형식화하는 함수
   * @param data 형식화할 데이터
   * @returns 형식화된 문자열
   */
  const formatResultBasedOnFormat = useCallback(
    (data: any): string => {
      if (!data) return '';

      try {
        // 포맷에 따라 다르게 처리
        switch (content.format || 'text') {
          case 'json':
            // 데이터 타입에 따라 처리
            if (typeof data === 'string') {
              try {
                // 문자열이 JSON인 경우 파싱 후 문자열화
                const parsed = JSON.parse(data);
                return JSON.stringify(parsed, null, 2);
              } catch {
                // JSON이 아닌 경우 객체로 변환 후 문자열화
                return JSON.stringify({ content: data }, null, 2);
              }
            } else {
              // 객체인 경우 바로 문자열화
              return JSON.stringify(data, null, 2);
            }

          case 'yaml':
            // YAML 변환 로직 (간소화됨)
            if (typeof data === 'string') {
              return data;
            } else {
              return JSON.stringify(data, null, 2); // 간소화를 위해 JSON 형식으로 반환
            }

          case 'html':
            // HTML로 반환 (안전 처리 필요)
            if (typeof data === 'string') {
              return data;
            } else {
              return JSON.stringify(data, null, 2);
            }

          case 'text':
          default:
            // 기본 텍스트 형식으로 변환
            if (typeof data === 'string') {
              return data;
            } else {
              return JSON.stringify(data, null, 2);
            }
        }
      } catch (error) {
        console.error('Error formatting output:', error);
        return String(data);
      }
    },
    [content.format]
  );

  return {
    format: (content.format as OutputFormat) || 'text',
    content: content.content,
    mode: content.mode || 'read',
    handleFormatChange,
    setMode,
    clearOutput,
    handleContentChange,
    formatResultBasedOnFormat,
  };
}; 