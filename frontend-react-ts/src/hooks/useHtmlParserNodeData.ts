import { useCallback } from 'react';
import { createNodeDataHook } from './useNodeDataFactory';
import { HTMLParserNodeContent, ExtractionRule } from '../types/nodes';

/**
 * Default values for HTMLParser node content
 */
const HTML_PARSER_DEFAULTS: Partial<HTMLParserNodeContent> = {
  extractionRules: []
};

/**
 * Return type for useHtmlParserNodeData hook
 */
interface HtmlParserNodeDataHook {
  content: HTMLParserNodeContent | undefined;
  extractionRules: ExtractionRule[];
  updateContent: (updates: Partial<HTMLParserNodeContent>) => void;
  addExtractionRule: (rule: ExtractionRule) => void;
  updateExtractionRule: (index: number, rule: ExtractionRule) => void;
  deleteExtractionRule: (index: number) => void;
}

/**
 * Custom hook for managing HTML Parser node data
 */
export const useHtmlParserNodeData = createNodeDataHook<HTMLParserNodeContent, HtmlParserNodeDataHook>(
  'html-parser',
  (params) => {
    const { nodeId, content, updateContent } = params;

    // 추출 규칙 가져오기
    const extractionRules = content?.extractionRules || [];

    // 추출 규칙 추가
    const addExtractionRule = useCallback(
      (rule: ExtractionRule) => {
        const updatedRules = [...extractionRules, rule];
        updateContent({ extractionRules: updatedRules });
      },
      [extractionRules, updateContent]
    );

    // 추출 규칙 업데이트
    const updateExtractionRule = useCallback(
      (index: number, rule: ExtractionRule) => {
        if (index >= 0 && index < extractionRules.length) {
          const updatedRules = [...extractionRules];
          updatedRules[index] = rule;
          updateContent({ extractionRules: updatedRules });
        }
      },
      [extractionRules, updateContent]
    );

    // 추출 규칙 삭제
    const deleteExtractionRule = useCallback(
      (index: number) => {
        if (index >= 0 && index < extractionRules.length) {
          const updatedRules = [...extractionRules];
          updatedRules.splice(index, 1);
          updateContent({ extractionRules: updatedRules });
        }
      },
      [extractionRules, updateContent]
    );

    return {
      content,
      extractionRules,
      updateContent,
      addExtractionRule,
      updateExtractionRule,
      deleteExtractionRule
    };
  },
  HTML_PARSER_DEFAULTS
); 