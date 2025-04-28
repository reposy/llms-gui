import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button } from "../ui/button";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "../Icons";
import { ExtractionRule } from "../../types/nodes";
import { useNodeContent, useNodeContentStore } from "../../store/useNodeContentStore";
import { NodeHeader } from "../nodes/shared/NodeHeader";
import { useFlowStructureStore } from "../../store/useFlowStructureStore";
import { useNodeState } from "../../store/useNodeStateStore";
import { safeGetTagName, safeGetClassList, safeGetChildren, generateSelector } from "../../utils/domUtils";
import DOMTreeNode from './DOMTreeView';

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
  
  // State for DOM text search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<string[]>([]); // Stores paths of matching elements
  const [currentSearchResultIndex, setCurrentSearchResultIndex] = useState<number>(-1);
  const domTreeContainerRef = useRef<HTMLDivElement>(null); // Ref for scrolling
  
  // Find the source node ID connected to the target handle of this node
  const sourceNodeId = useMemo(() => {
    const incomingEdge = edges.find(edge => edge.target === nodeId);
    return incomingEdge?.source;
  }, [nodeId, edges]);

  // Get the state of the source node to access its result
  const sourceNodeState = useNodeState(sourceNodeId || '');
  
  // Effect to parse HTML content when source node result changes
  useEffect(() => {
    // HTML 내용 추출 로직 (소스 노드 상태에서 result 가져오기)
    let html = "";
    if (sourceNodeState && sourceNodeState.result) {
      const result = sourceNodeState.result;
      if (typeof result === 'string') {
        html = result;
      } else if (typeof result === 'object' && result !== null && result.html) {
        html = result.html;
      } else if (typeof result === 'object' && result !== null && result.text && typeof result.text === 'string' && result.text.includes("<")) {
        html = result.text;
      }
    }

    if (html && html !== htmlContent) { // Update only if HTML actually changed
      console.log("[HTMLParserNodeConfig] Received new HTML content from source node:", sourceNodeId);
      setHtmlContent(html);
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        // Check for parser error (often indicated by a specific tag)
        if (doc.getElementsByTagName('parsererror').length > 0) {
            throw new Error("Browser parser error encountered.");
        }
        setParsedDOM(doc);
        setDomError("");
      } catch (error: any) {
        const errorMessage = `HTML 파싱 중 오류: ${error.message || '알 수 없는 오류'}`;
        setDomError(errorMessage);
        setParsedDOM(null); // Clear previous valid DOM if parsing fails
        console.error("HTML 파싱 오류:", error);
      }
    } else if (!html && htmlContent) {
      // Clear content if source node provides no HTML
      console.log("[HTMLParserNodeConfig] Source node provided no HTML content, clearing parser.");
      setHtmlContent("");
      setParsedDOM(null);
      setDomError("");
    }
  }, [sourceNodeId, sourceNodeState, htmlContent]);
  
  // Callback function for when an element is selected in the DOM tree view
  const handleElementSelect = useCallback((path: string, selector: string, preview: string) => {
    setSelectedElementPath(path);
    setGeneratedSelector(selector);
    setSelectedElementPreview(preview);
  }, []);
  
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

  // Function to perform text search within the parsed DOM
  const performSearch = useCallback(() => {
    if (!parsedDOM || !searchQuery) {
      setSearchResults([]);
      setCurrentSearchResultIndex(-1);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: string[] = [];

    function traverseDOM(element: Element | null, path = "") {
      if (!element) return;

      const tagName = safeGetTagName(element);
      if (!tagName) return;

      const currentPath = path ? `${path}/${results.length}-${tagName}` : `${results.length}-${tagName}`; // Use results.length for unique path component during search

      try {
        if (element.textContent?.toLowerCase().includes(query)) {
          // To get the *actual* path used by renderDOMTree, we need a slightly different approach.
          // Let's recalculate path based on depth here (less efficient but simpler for now)
          function calculatePath(el: Element | null, currentDepth = 0): string | null {
              if (!el) return null;
              const elTagName = safeGetTagName(el);
              if (!elTagName) return null;
              if (el === element) return `${currentDepth}-${elTagName}`;

              let parentPath: string | null = null;
              if (el.parentElement) {
                  parentPath = calculatePath(el.parentElement, currentDepth -1); // This depth logic is flawed, needs fixing
              }
               // FIXME: Path calculation needs rework to match renderDOMTree exactly.
               // For now, using a placeholder or skipping path storage.
              // results.push(currentPath); // Temporarily use the flawed path or skip
               results.push(generateSelector(element)); // Store selector as placeholder for path

          }
          // calculatePath(element);
        }
      } catch (e) {
        console.error("Error accessing textContent during search:", e);
      }

      const children = safeGetChildren(element);
      children.forEach(child => traverseDOM(child, currentPath));
    }

    // FIXME: The path generation within traverseDOM needs to exactly match renderDOMTree's path generation.
    // This is complex. A better approach might be to modify renderDOMTree/DOMTreeView to report paths
    // or attach paths as data attributes during render, then query those.

    // Temporary workaround: Query all elements and filter by text content.
    const allElements = parsedDOM.querySelectorAll('*');
    const matchingPaths: string[] = [];
    const tempPathMap = new Map<Element, string>();

    // Need to reconstruct the path generation from renderDOMTree accurately
    function buildPathMap(element: Element | null, depth = 0, path = "") {
        if (!element) return;
        const tagName = safeGetTagName(element);
        if (!tagName) return;
        const currentPath = path ? `${path}/${depth}-${tagName}` : `${depth}-${tagName}`;
        tempPathMap.set(element, currentPath);
        const children = safeGetChildren(element);
        children.forEach((child, index) => buildPathMap(child, depth + 1, currentPath));
    }

    if (parsedDOM.documentElement) {
        buildPathMap(parsedDOM.documentElement);
        allElements.forEach(el => {
            try {
                if (el.textContent?.toLowerCase().includes(query)) {
                    const path = tempPathMap.get(el);
                    if (path) {
                        matchingPaths.push(path);
                    }
                }
            } catch (e) { /* ignore */ }
        });
    }

    setSearchResults(matchingPaths);
    setCurrentSearchResultIndex(matchingPaths.length > 0 ? 0 : -1);
    console.log("Search results (paths):", matchingPaths);
     // Scroll to the first result if found
    if (matchingPaths.length > 0) {
      // highlightAndScrollToResult(0, matchingPaths); // Call scroll function
    }
  }, [parsedDOM, searchQuery]);

  // Function to handle search input changes (debounced)
  // TODO: Implement debouncing for performance
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    // Trigger search immediately for now, add debounce later
    // Clear previous results immediately
    setSearchResults([]);
    setCurrentSearchResultIndex(-1);
    // Basic immediate search call:
    // if (e.target.value.length > 1) { // Only search if query is long enough
    //  performSearch(e.target.value); // Pass query directly
    // }
  };

  // Handle search execution (e.g., on button click or debounced input)
  const handleSearch = () => {
    performSearch();
  };

  // Function to navigate search results
  const navigateResults = (direction: 'prev' | 'next') => {
    if (searchResults.length === 0) return;

    let nextIndex = currentSearchResultIndex;
    if (direction === 'next') {
      nextIndex = (currentSearchResultIndex + 1) % searchResults.length;
    } else {
      nextIndex = (currentSearchResultIndex - 1 + searchResults.length) % searchResults.length;
    }
    setCurrentSearchResultIndex(nextIndex);
    // highlightAndScrollToResult(nextIndex, searchResults); // Call scroll function
  };

  // TODO: Implement highlightAndScrollToResult function
  // This function needs to:
  // 1. Get the path from searchResults[index]
  // 2. Find the corresponding element in the DOM Tree view (might need refs in DOMTreeView)
  // 3. Call element.scrollIntoView()
  // 4. Update a state variable passed to DOMTreeView to highlight the element

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
              {/* Search UI */}
              <div className="flex items-center space-x-2 p-2 border rounded-md bg-gray-50">
                <input
                  type="text"
                  placeholder="텍스트로 DOM 검색..."
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()} // Search on Enter
                  className={`${inputClass} text-sm flex-grow`}
                />
                <Button size="sm" variant="ghost" onClick={() => navigateResults('prev')} disabled={searchResults.length <= 1} title="이전 결과">
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                <span className="text-xs text-gray-600 min-w-[40px] text-center">
                  {searchResults.length > 0 ? `${currentSearchResultIndex + 1} / ${searchResults.length}` : '0 / 0'}
                </span>
                <Button size="sm" variant="ghost" onClick={() => navigateResults('next')} disabled={searchResults.length <= 1} title="다음 결과">
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={handleSearch} disabled={!searchQuery} title="검색">
                  <SearchIcon className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">DOM 구조</h4>
                {generatedSelector && (
                  <Button size="sm" variant="outline" onClick={useSelectedElement}>
                    <span className="mr-1">✓</span>
                    이 요소 사용하기
                  </Button>
                )}
              </div>
              
              {/* DOM 트리 표시 - Use the new component */}
              <div ref={domTreeContainerRef} className="border rounded-md p-2 bg-white h-64 overflow-y-auto scroll-smooth">
                <div className="text-xs text-gray-500 mb-2">요소를 클릭하여 선택하세요.</div>
                {parsedDOM && parsedDOM.documentElement && (
                  <DOMTreeNode 
                    element={parsedDOM.documentElement} 
                    selectedElementPath={selectedElementPath} 
                    onElementSelect={handleElementSelect} 
                    highlightedPath={searchResults[currentSearchResultIndex]}
                  />
                )}
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