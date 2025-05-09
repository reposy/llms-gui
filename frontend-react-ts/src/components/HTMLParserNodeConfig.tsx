import React, { useState } from 'react';
import { useNodeContent } from '../store/useNodeContentStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface ExtractionRule {
  name: string;
  selector: string;
  target: 'text' | 'html' | 'attribute';
  attribute_name?: string;
  multiple: boolean;
}

// HTMLParserNodeContent 인터페이스 정의
interface HTMLParserNodeContent {
  extractionRules?: ExtractionRule[];
  label?: string;
  [key: string]: any;
}

interface HTMLParserNodeConfigProps {
  nodeId: string;
}

/**
 * HTML Parser 노드의 설정 패널 컴포넌트
 */
export function HTMLParserNodeConfig({ nodeId }: HTMLParserNodeConfigProps) {
  const { content, setContent } = useNodeContent<HTMLParserNodeContent>(nodeId, 'html-parser');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // 새 규칙 생성을 위한 상태
  const [newRule, setNewRule] = useState<ExtractionRule>({
    name: '',
    selector: '',
    target: 'text',
    attribute_name: '',
    multiple: false
  });

  // 메시지 표시 유틸리티 함수
  const showMessage = (message: string, type: 'error' | 'success' | 'info') => {
    if (type === 'error') {
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 3000);
    } else {
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  // 노드 라벨 변경 핸들러
  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent({ label: e.target.value });
  };

  // 새 규칙 입력값 변경 핸들러
  const handleNewRuleChange = (field: keyof ExtractionRule, value: any) => {
    setNewRule(prev => ({ ...prev, [field]: value }));
  };

  // 규칙 추가 핸들러
  const handleAddRule = () => {
    // 유효성 검사
    if (!newRule.name.trim()) {
      showMessage('규칙 이름은 필수입니다.', 'error');
      return;
    }
    if (!newRule.selector.trim()) {
      showMessage('CSS 선택자는 필수입니다.', 'error');
      return;
    }
    if (newRule.target === 'attribute' && !newRule.attribute_name?.trim()) {
      showMessage('속성 이름은 필수입니다.', 'error');
      return;
    }

    // 중복 이름 검사
    if (content?.extractionRules?.some(rule => rule.name === newRule.name)) {
      showMessage('동일한 이름의 규칙이 이미 존재합니다.', 'error');
      return;
    }

    // 현재 규칙 목록에 새 규칙 추가
    const updatedRules = [...(content?.extractionRules || []), { ...newRule }];
    setContent({ extractionRules: updatedRules });
    
    // 새 규칙 폼 초기화
    setNewRule({
      name: '',
      selector: '',
      target: 'text',
      attribute_name: '',
      multiple: false
    });
    
    showMessage('규칙이 추가되었습니다.', 'success');
  };

  // 규칙 삭제 핸들러
  const handleDeleteRule = (index: number) => {
    if (!content?.extractionRules) return;
    
    const updatedRules = [...content.extractionRules];
    updatedRules.splice(index, 1);
    
    setContent({ extractionRules: updatedRules });
    showMessage('규칙이 삭제되었습니다.', 'info');
  };

  // 기존 규칙 수정 핸들러
  const handleUpdateRule = (index: number, field: keyof ExtractionRule, value: any) => {
    if (!content?.extractionRules) return;
    
    const updatedRules = [...content.extractionRules];
    updatedRules[index] = { ...updatedRules[index], [field]: value };
    
    setContent({ extractionRules: updatedRules });
  };

  const renderRule = (rule: ExtractionRule, index: number) => (
    <div key={`rule-${index}`} className="bg-gray-100 rounded-lg shadow-sm p-3 border border-gray-200 transition-colors hover:bg-gray-50">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-blue-700">{rule.name}</span>
        <div className="flex space-x-1">
          <Button
            onClick={() => handleUpdateRule(index, 'name', rule.name)}
            size="sm"
            className="text-blue-600 hover:text-blue-800"
          >
            <span className="h-4 w-4">✎</span>
          </Button>
          <Button
            onClick={() => handleDeleteRule(index)}
            size="sm"
            className="text-red-600 hover:text-red-800"
          >
            <span className="h-4 w-4">🗑️</span>
          </Button>
        </div>
      </div>

      <div className="text-sm space-y-1 mt-1">
        <div className="flex">
          <span className="text-gray-600 w-20">선택자:</span>
          <span className="text-gray-800 font-mono text-xs break-all">{rule.selector}</span>
        </div>
        <div className="flex">
          <span className="text-gray-600 w-20">타입:</span>
          <span className="text-gray-800">
            {rule.target === 'text' ? '텍스트' : 
             rule.target === 'html' ? 'HTML' : '속성'}
          </span>
        </div>
        {rule.target === 'attribute' && rule.attribute_name && (
          <div className="flex">
            <span className="text-gray-600 w-20">속성:</span>
            <span className="text-gray-800 font-mono text-xs">{rule.attribute_name}</span>
          </div>
        )}
        <div className="flex">
          <span className="text-gray-600 w-20">다중 추출:</span>
          <span className="text-gray-800">{rule.multiple ? '예' : '아니오'}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 p-4 max-w-full overflow-auto bg-white rounded-lg h-full">
      <div>
        <Label htmlFor="nodeName">노드 이름</Label>
        <Input
          id="nodeName"
          value={content?.label || ''}
          onChange={handleLabelChange}
          placeholder="HTML Parser 노드 이름"
          className="mt-1"
        />
      </div>

      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-md font-medium">추출 규칙</h3>
          <Button
            onClick={handleAddRule}
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            규칙 추가
          </Button>
        </div>

        <div className="space-y-3 mt-3 max-w-full">
          {content?.extractionRules?.length === 0 ? (
            <p className="text-gray-500 text-sm">
              추출 규칙을 추가하세요. CSS 선택자를 이용해 HTML에서 원하는 정보를 추출할 수 있습니다.
            </p>
          ) : (
            content?.extractionRules?.map(renderRule)
          )}
        </div>
      </div>

      {/* 새 규칙 추가 폼 */}
      <div className="mt-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
        <h3 className="text-md font-medium mb-3">새 규칙 추가</h3>
        
        <div className="space-y-3">
          <div>
            <Label htmlFor="ruleName" className="block mb-1">추출 대상</Label>
            <Input
              id="ruleName"
              value={newRule.name}
              onChange={(e) => handleNewRuleChange('name', e.target.value)}
              placeholder="추출할 데이터의 이름 (예: title, price)"
              className="w-full"
              fullWidth
            />
          </div>
          
          <div>
            <Label htmlFor="ruleSelector" className="block mb-1">CSS 선택자</Label>
            <div className="w-full max-w-full overflow-hidden">
              <Input
                id="ruleSelector"
                value={newRule.selector}
                onChange={(e) => handleNewRuleChange('selector', e.target.value)}
                placeholder="CSS 선택자 (예: .product-title, #price)"
                className="w-full"
                fullWidth
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="ruleTarget" className="block mb-1">추출 타입</Label>
            <Select
              value={newRule.target}
              onValueChange={(value) => handleNewRuleChange('target', value as 'text' | 'html' | 'attribute')}
            >
              <SelectTrigger id="ruleTarget" className="w-full">
                <SelectValue placeholder="추출 타입 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">텍스트</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="attribute">속성</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {newRule.target === 'attribute' && (
            <div>
              <Label htmlFor="ruleAttribute" className="block mb-1">HTML 속성명</Label>
              <Input
                id="ruleAttribute"
                value={newRule.attribute_name || ''}
                onChange={(e) => handleNewRuleChange('attribute_name', e.target.value)}
                placeholder="속성명 (예: href, src)"
                className="w-full"
                fullWidth
              />
            </div>
          )}
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="ruleMultiple"
              checked={newRule.multiple}
              onChange={(e) => handleNewRuleChange('multiple', e.target.checked)}
              className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <Label htmlFor="ruleMultiple" className="text-sm font-normal">
              여러 요소 추출
            </Label>
          </div>
          
          <div className="mt-2">
            <Button
              onClick={handleAddRule}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
            >
              규칙 추가
            </Button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-green-600 text-sm">
          {successMessage}
        </div>
      )}
      
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
        <h4 className="text-sm font-medium mb-2">HTML Parser 사용 가이드</h4>
        <ul className="text-xs space-y-1 text-gray-600">
          <li>• <strong>추출 대상</strong>: 추출할 데이터의 속성명을 입력하세요 (예: title, price)</li>
          <li>• <strong>CSS 선택자</strong>: 웹페이지에서 요소를 찾기 위한 선택자 (예: .product-title, #price)</li>
          <li>• <strong>속성</strong>: 요소에서 특정 속성값을 추출하려면 입력하세요 (예: href, src). 비워두면 요소의 텍스트 내용을 추출합니다.</li>
          <li>• <strong>복수 요소 추출</strong>: 선택자와 일치하는 모든 요소를 배열로 추출합니다.</li>
        </ul>
      </div>
    </div>
  );
}

export default HTMLParserNodeConfig; 