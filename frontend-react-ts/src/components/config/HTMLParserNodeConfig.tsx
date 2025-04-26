import React, { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Icons } from "../Icons";
import { ExtractionRule } from "../../types/nodes";
import { useNodeContent, useNodeContentStore } from "../../store/useNodeContentStore";
import { NodeHeader } from "../nodes/shared/NodeHeader";
import { useFlowStructureStore } from "../../store/useFlowStructureStore";
import { getNodeState } from "../../store/useNodeStateStore";

interface HTMLParserNodeConfigProps {
  nodeId: string;
}

/**
 * HTML 파서 노드 설정 컴포넌트
 * LLM 노드와 유사한 구조로 구현
 */
export const HTMLParserNodeConfig: React.FC<HTMLParserNodeConfigProps> = ({ nodeId }) => {
  // 노드 컨텐츠 가져오기
  const { content } = useNodeContent(nodeId);
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);
  const { nodes, setStructureNodes, edges } = useFlowStructureStore();
  
  // 파싱된 HTML 및 DOM 관련 상태
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [parsedDOM, setParsedDOM] = useState<Document | null>(null);
  const [selectedElementPath, setSelectedElementPath] = useState<string>("");
  const [generatedSelector, setGeneratedSelector] = useState<string>("");
  const [selectedElementPreview, setSelectedElementPreview] = useState<string>("");
  const [domError, setDomError] = useState<string>("");
  
  // 임시 상태 관리
  const [temporaryRule, setTemporaryRule] = useState<ExtractionRule | null>(null);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"rules" | "dom">("rules");
  
  // 입력 노드 찾기
  useEffect(() => {
    const findHtmlInput = () => {
      // 현재 노드로 들어오는 엣지 찾기
      const incomingEdges = edges.filter(edge => edge.target === nodeId);
      if (incomingEdges.length === 0) return null;
      
      // 소스 노드 ID 가져오기
      const sourceNodeId = incomingEdges[0].source;
      
      // 노드 상태 가져오기
      const nodeState = getNodeState(sourceNodeId);
      if (!nodeState || !nodeState.result) return null;
      
      // HTML 내용 추출
      let html = "";
      const result = nodeState.result;
      
      if (typeof result === 'string') {
        html = result;
      } else if (result.html) {
        html = result.html;
      } else if (result.text && result.text.includes("<")) {
        html = result.text;
      }
      
      return html;
    };
    
    const html = findHtmlInput();
    if (html) {
      setHtmlContent(html);
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        setParsedDOM(doc);
        setDomError("");
      } catch (error) {
        setDomError("HTML 파싱 중 오류가 발생했습니다.");
        console.error("HTML 파싱 오류:", error);
      }
    }
  }, [nodeId, edges]);
  
  // 안전하게 태그 이름 가져오기
  const safeGetTagName = (element: Element | null): string => {
    if (!element) return "";
    
    try {
      if (element.tagName) {
        return element.tagName.toLowerCase();
      }
    } catch (e) {
      console.error("태그 이름 접근 오류:", e);
    }
    
    return "";
  };
  
  // 안전하게 클래스 목록 가져오기
  const safeGetClassList = (element: Element | null): string[] => {
    if (!element) return [];
    
    try {
      if (element.classList) {
        return Array.from(element.classList);
      }
    } catch (e) {
      console.error("클래스 목록 접근 오류:", e);
    }
    
    return [];
  };
  
  // 안전하게 자식 요소 배열 가져오기
  const safeGetChildren = (element: Element | null): Element[] => {
    if (!element) return [];
    
    try {
      if (element.children) {
        return Array.from(element.children);
      }
    } catch (e) {
      console.error("자식 요소 접근 오류:", e);
    }
    
    return [];
  };
  
  // 요소에서 CSS 선택자 생성
  const generateSelector = (element: Element): string => {
    if (!element) return "";
    
    const tagName = safeGetTagName(element);
    if (!tagName) return "";
    
    let selector = tagName;
    
    // ID 추가
    try {
      if (element.id) {
        selector = `${selector}#${element.id}`;
        return selector; // ID가 있으면 충분히 고유함
      }
    } catch (e) {
      console.error("ID 접근 오류:", e);
    }
    
    // 클래스 추가
    const classList = safeGetClassList(element);
    if (classList.length > 0) {
      const classes = classList.join('.');
      selector = `${selector}.${classes}`;
    }
    
    return selector;
  };
  
  // DOM 트리 렌더링 함수
  const renderDOMTree = (element: Element | null, depth = 0, path = "", maxDepth = 3) => {
    if (!element || depth > maxDepth) return null;
    
    const tagName = safeGetTagName(element);
    if (!tagName) return null;
    
    const isHead = tagName === 'head';
    const currentPath = path ? `${path}/${depth}-${tagName}` : `${depth}-${tagName}`;
    
    // HEAD 태그 내부는 접기
    if (isHead && depth > 0) {
      return (
        <div 
          className="ml-4 py-1 pl-2 flex items-center text-gray-500 cursor-pointer hover:bg-gray-100 rounded-md" 
          key={`${tagName}-${depth}-head`}
        >
          <span className="text-xs mr-1">▶</span>
          <span className="text-xs font-mono">{`<${tagName}> [접힘]`}</span>
        </div>
      );
    }
    
    // 자식 요소 렌더링
    const children = safeGetChildren(element);
    let childrenElements = null;
    
    if (children.length > 0) {
      childrenElements = (
        <div className="ml-4">
          {children.map((child, index) => 
            renderDOMTree(child, depth + 1, currentPath, maxDepth)
          )}
        </div>
      );
    }
    
    // 텍스트 내용 축약 (너무 길면 잘라냄)
    let textContent = "";
    try {
      textContent = element.textContent?.trim() || "";
      if (textContent && textContent.length > 30) {
        textContent = `${textContent.substring(0, 30)}...`;
      }
    } catch (e) {
      console.error("텍스트 내용 접근 오류:", e);
    }
    
    // 태그 특성 표시 (ID, 클래스 등)
    let attributes = "";
    try {
      if (element.id) {
        attributes += ` id="${element.id}"`;
      }
      
      const classList = safeGetClassList(element);
      if (classList.length > 0) {
        attributes += ` class="${classList.join(' ')}"`;
      }
    } catch (e) {
      console.error("속성 접근 오류:", e);
    }
    
    return (
      <div key={`${tagName}-${depth}-${Math.random()}`}>
        <div 
          className={`py-1 pl-2 flex items-center cursor-pointer hover:bg-gray-100 rounded-md ${selectedElementPath === currentPath ? 'bg-blue-100' : ''}`} 
          onClick={() => {
            setSelectedElementPath(currentPath);
            const selector = generateSelector(element);
            setGeneratedSelector(selector);
            
            try {
              setSelectedElementPreview(element.outerHTML || `<${tagName}${attributes}>${element.innerHTML || ""}</${tagName}>`);
            } catch (e) {
              console.error("HTML 접근 오류:", e);
              setSelectedElementPreview(`<${tagName}${attributes}></${tagName}>`);
            }
          }}
        >
          {children.length > 0 ? (
            <span className="text-xs mr-1 text-gray-500">▼</span>
          ) : (
            <div className="w-4"></div>
          )}
          <span className="text-xs font-mono text-gray-700">
            {`<${tagName}${attributes}>`}
          </span>
          {textContent && (
            <span className="text-xs ml-2 text-gray-500 truncate max-w-[150px]">
              {textContent}
            </span>
          )}
        </div>
        {childrenElements}
      </div>
    );
  };
  
  // 선택기로 요소 사용하기
  const useSelectedElement = () => {
    if (!generatedSelector) return;
    
    // 기존 규칙 가져오기
    const rule: ExtractionRule = {
      name: `element_${Date.now().toString().slice(-4)}`,
      selector: generatedSelector,
      target: "text",
      multiple: false
    };
    
    // 새 규칙으로 설정
    setTemporaryRule(rule);
    setViewMode("rules");
  };
  
  // 업데이트 핸들러
  const handleLabelChange = (newLabel: string) => {
    // 노드 콘텐츠 업데이트
    setNodeContent(nodeId, { label: newLabel });
    
    // Flow Structure에서 노드 라벨도 업데이트
    const updatedNodes = nodes.map(node => 
      node.id === nodeId
        ? { ...node, data: { ...node.data, label: newLabel } }
        : node
    );
    setStructureNodes(updatedNodes);
  };

  const handleAddRule = () => {
    setTemporaryRule({
      name: "",
      selector: "",
      target: "text",
      attribute_name: "",
      multiple: false
    });
    setEditingRuleIndex(null);
  };

  const handleEditRule = (index: number) => {
    const rules = content?.extractionRules || [];
    if (rules && rules[index]) {
      setTemporaryRule({ ...rules[index] });
      setEditingRuleIndex(index);
    }
  };

  const handleDeleteRule = (index: number) => {
    const rules = [...(content?.extractionRules || [])];
    if (!rules.length) return;
    
    rules.splice(index, 1);
    setNodeContent(nodeId, { extractionRules: rules });
  };

  const handleRuleChange = (rule: ExtractionRule) => {
    setTemporaryRule(rule);
  };

  const handleSaveRule = () => {
    if (!temporaryRule) return;
    
    const rules = [...(content?.extractionRules || [])];
    if (editingRuleIndex !== null && editingRuleIndex >= 0 && editingRuleIndex < rules.length) {
      rules[editingRuleIndex] = temporaryRule;
    } else {
      rules.push(temporaryRule);
    }
    
    setNodeContent(nodeId, { extractionRules: rules });
    setTemporaryRule(null);
    setEditingRuleIndex(null);
  };

  const handleCancelRule = () => {
    setTemporaryRule(null);
    setEditingRuleIndex(null);
  };

  // 입력 필드 스타일 - LLM 노드와 일관된 스타일
  const inputClass = "w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900";

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-bold">HTML Parser Configuration</h3>
        <p className="text-sm text-gray-500">CSS 선택자로 HTML에서 데이터를 추출합니다.</p>
      </div>
      
      <div className="space-y-1">
        <label htmlFor="nodeName" className="block text-sm font-medium text-gray-700">
          노드 이름
        </label>
        <input
          id="nodeName"
          className={inputClass}
          type="text"
          value={content?.label || ''}
          onChange={(e) => handleLabelChange(e.target.value)}
        />
      </div>
      
      {/* 탭 네비게이션 */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 text-sm font-medium ${viewMode === "rules" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"}`}
          onClick={() => setViewMode("rules")}
        >
          추출 규칙
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${viewMode === "dom" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"}`}
          onClick={() => setViewMode("dom")}
        >
          HTML 구조 탐색
        </button>
      </div>
      
      {/* 추출 규칙 뷰 */}
      {viewMode === "rules" && (
        <>
          {!temporaryRule && (
            <>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    추출 규칙
                  </label>
                  <Button size="sm" variant="outline" onClick={handleAddRule}>
                    <span className="mr-1">+</span>
                    규칙 추가
                  </Button>
                </div>

                {!content?.extractionRules || content.extractionRules.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4 border border-dashed border-gray-300 rounded-md bg-gray-50">
                    추출 규칙이 없습니다. 규칙을 추가해 주세요.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {content.extractionRules.map((rule, index) => (
                      <div 
                        key={index} 
                        className="flex justify-between items-center p-2 bg-gray-50 rounded-md hover:bg-gray-100 border border-gray-200"
                      >
                        <div>
                          <div className="font-medium text-gray-900">{rule.name || "이름 없음"}</div>
                          <div className="text-xs text-gray-500">
                            {rule.target === 'text' ? '텍스트' : rule.target === 'html' ? 'HTML' : '속성'} | {rule.selector}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleEditRule(index)}
                          >
                            <span>✎</span>
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleDeleteRule(index)}
                          >
                            <span>✕</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {temporaryRule && (
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <h4 className="text-md font-medium mb-2 text-gray-900">
                {editingRuleIndex !== null ? "규칙 수정" : "규칙 추가"}
              </h4>
              
              <div className="mb-2">
                <label htmlFor="ruleName" className="block text-sm font-medium text-gray-700 mb-1">
                  규칙 이름
                </label>
                <input
                  id="ruleName"
                  className={inputClass}
                  type="text"
                  value={temporaryRule.name}
                  onChange={(e) => handleRuleChange({ ...temporaryRule, name: e.target.value })}
                />
              </div>
              
              <div className="mb-2">
                <label htmlFor="extractionType" className="block text-sm font-medium text-gray-700 mb-1">
                  추출 유형
                </label>
                <select
                  id="extractionType"
                  className={inputClass}
                  value={temporaryRule.target}
                  onChange={(e) => handleRuleChange({ ...temporaryRule, target: e.target.value as "text" | "html" | "attribute" })}
                >
                  <option value="text">텍스트</option>
                  <option value="html">HTML</option>
                  <option value="attribute">속성</option>
                </select>
              </div>
              
              <div className="mb-2">
                <label htmlFor="cssSelector" className="block text-sm font-medium text-gray-700 mb-1">
                  CSS 선택자
                </label>
                <div className="relative">
                  <input
                    id="cssSelector"
                    className={inputClass}
                    type="text"
                    value={temporaryRule.selector}
                    onChange={(e) => handleRuleChange({ ...temporaryRule, selector: e.target.value })}
                    placeholder="예: article .content, ul li, .post h1"
                  />
                </div>
              </div>
              
              {temporaryRule.target === "attribute" && (
                <div className="mb-2">
                  <label htmlFor="attribute" className="block text-sm font-medium text-gray-700 mb-1">
                    속성
                  </label>
                  <input
                    id="attribute"
                    className={inputClass}
                    type="text"
                    value={temporaryRule.attribute_name || ""}
                    onChange={(e) => handleRuleChange({ ...temporaryRule, attribute_name: e.target.value })}
                    placeholder="예: href, src, alt, title"
                  />
                </div>
              )}
              
              <div className="mb-2">
                <div className="flex items-center">
                  <input
                    id="multiple"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={temporaryRule.multiple}
                    onChange={(e) => handleRuleChange({ ...temporaryRule, multiple: e.target.checked })}
                  />
                  <label htmlFor="multiple" className="ml-2 block text-sm text-gray-700">
                    다중 요소 선택 (배열로 결과 반환)
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <Button variant="outline" size="sm" onClick={handleCancelRule}>
                  취소
                </Button>
                <Button size="sm" onClick={handleSaveRule}>
                  저장
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* DOM 구조 탐색 뷰 */}
      {viewMode === "dom" && (
        <div className="space-y-4">
          {!htmlContent ? (
            <div className="text-sm text-gray-500 text-center py-4 border border-dashed border-gray-300 rounded-md bg-gray-50">
              웹 크롤러 노드에 연결하여 HTML을 가져오세요.
            </div>
          ) : domError ? (
            <div className="text-sm text-red-500 text-center py-4 border border-dashed border-red-300 rounded-md bg-red-50">
              {domError}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">DOM 구조</h4>
                {generatedSelector && (
                  <Button size="sm" variant="outline" onClick={useSelectedElement}>
                    <span className="mr-1">✓</span>
                    이 요소 사용하기
                  </Button>
                )}
              </div>
              
              {/* DOM 트리 표시 */}
              <div className="border rounded-md p-2 bg-white h-64 overflow-y-auto">
                <div className="text-xs text-gray-500 mb-2">요소를 클릭하여 선택하세요.</div>
                {parsedDOM && parsedDOM.documentElement && renderDOMTree(parsedDOM.documentElement)}
              </div>
              
              {/* 선택된 요소 정보 */}
              {generatedSelector && (
                <div className="border rounded-md p-3 bg-gray-50">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">선택된 요소</h4>
                  
                  <div className="mb-2">
                    <div className="text-xs font-medium text-gray-600">CSS 선택자:</div>
                    <div className="text-sm font-mono bg-white p-1 border rounded">
                      {generatedSelector}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-medium text-gray-600">미리보기:</div>
                    <div className="text-xs font-mono bg-white p-1 border rounded max-h-24 overflow-y-auto">
                      <pre className="whitespace-pre-wrap">{selectedElementPreview}</pre>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {viewMode === "rules" && !temporaryRule && (
        <div className="bg-gray-50 p-3 rounded-md text-sm border border-gray-200">
          <h4 className="font-medium mb-2">사용 가이드</h4>
          <p className="mb-2">1. <strong>CSS 선택자</strong>를 사용하여 HTML에서 추출할 요소를 지정합니다.</p>
          <p className="mb-2">2. <strong>추출 유형</strong>으로 텍스트 또는 속성을 선택할 수 있습니다.</p>
          <p className="mb-2">3. 속성을 선택한 경우 추출할 <strong>속성 이름</strong>을 입력하세요(예: href).</p>
          <p className="mb-2">4. <strong>HTML 구조 탐색</strong> 탭에서 크롤링된 HTML을 직접 확인하고 요소를 선택할 수 있습니다.</p>
          <p>5. 여러 규칙을 추가하여 복잡한 데이터 추출 로직을 구성할 수 있습니다.</p>
        </div>
      )}
    </div>
  );
}; 