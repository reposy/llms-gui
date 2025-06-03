import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button } from "../ui/button";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, ChevronUpIcon } from "../Icons";
import { ExtractionRule } from "../../types/nodes";
import { useHtmlParserNodeData } from "../../hooks/useHtmlParserNodeData";
import { useFlowStructureStore} from "../../store/useFlowStructureStore";
import { useNodeState } from "../../store/useNodeStateStore";
import { safeGetTagName, safeGetChildren, generateSelector } from "../../utils/domUtils";
import DOMTreeNode from './DOMTreeView';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

// Define structure for path steps
interface PathStep {
  level: number;
  tag: string;
  details: string; // For potential future use (ID, classes)
}

interface HTMLParserNodeConfigProps {
  nodeId: string;
}

// Add 'CSS' to the SearchTarget type
type SearchTarget = "TEXT" | "CLASS" | "ID" | "CSS"; // Define search target types

/**
 * HTML 파서 노드 설정 컴포넌트
 * LLM 노드와 유사한 구조로 구현
 */

// Helper function to get ancestor paths from a full path
const getAncestorPaths = (path: string): string[] => {
  if (!path) return [];
  const parts = path.split('/');
  const ancestors: string[] = [];
  let currentAncestorPath = '';
  for (let i = 0; i < parts.length; i++) {
    currentAncestorPath = currentAncestorPath ? `${currentAncestorPath}/${parts[i]}` : parts[i];
    ancestors.push(currentAncestorPath);
  }
  return ancestors;
};

// Restore the generatePathForElement function
function generatePathForElement(element: Element, root: Element | null):
string {
    // Ensure root is always documentElement if parsedDOM exists
    const effectiveRoot = root; 
    if (!effectiveRoot || !element || !effectiveRoot.contains(element)) {
        return '';
    }

    let pathParts: string[] = []; // Store parts in reverse order initially
    let current: Element | null = element;

    while (current && current !== effectiveRoot.parentElement) { 
        const parent: Element | null = current.parentElement;
        // Determine the index among ELEMENT siblings
        const index = parent 
            ? Array.from(parent.children).filter((node: Node) => node.nodeType === Node.ELEMENT_NODE).indexOf(current)
            : 0; // Root element index is 0 relative to document
            
        const tagName = safeGetTagName(current) || 'unknown';
        const pathPart = `${index}-${tagName}`;
        pathParts.push(pathPart);

        if (current === effectiveRoot) break; // Stop after processing the root

        current = parent;
    }
    // Reverse the parts and join
    return pathParts.reverse().join('/');
}

export const HTMLParserNodeConfig: React.FC<HTMLParserNodeConfigProps> = ({ nodeId }) => {
  // 커스텀 훅 사용
  const { 
    content, 
    extractionRules, 
    updateContent, 
    addExtractionRule, 
    updateExtractionRule, 
    deleteExtractionRule 
  } = useHtmlParserNodeData({ nodeId });
  
  const { nodes, edges } = useFlowStructureStore();
  
  // 파싱된 HTML 및 DOM 관련 상태
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [parsedDOM, setParsedDOM] = useState<Document | null>(null);
  const [selectedElementPath, setSelectedElementPath] = useState<string>("");
  const [generatedSelector, setGeneratedSelector] = useState<string>("");
  const [selectedElementPreview, setSelectedElementPreview] = useState<string>("");
  const [selectedElementTextPreview, setSelectedElementTextPreview] = useState<string>("");
  const [domError, setDomError] = useState<string>("");
  const [selectedElementPathSteps, setSelectedElementPathSteps] = useState<PathStep[]>([]); // New state for path steps
  
  // 임시 상태 관리
  const [temporaryRule, setTemporaryRule] = useState<ExtractionRule | null>(null);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"rules" | "dom">("rules");
  const [isHtmlExplorerOpen, setIsHtmlExplorerOpen] = useState<boolean>(false);
  
  // State for DOM text search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [currentSearchResultIndex, setCurrentSearchResultIndex] = useState<number>(-1);
  const domTreeContainerRef = useRef<HTMLDivElement>(null);
  const [searchTarget, setSearchTarget] = useState<SearchTarget>("TEXT");
  
  // State for expanded DOM nodes
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    // Initially expand the root (html) and maybe the body
    const initialPaths = new Set<string>();
    if (parsedDOM?.documentElement) {
      const htmlPath = `0-${safeGetTagName(parsedDOM.documentElement)}`;
      initialPaths.add(htmlPath);
      const body = parsedDOM.body;
      if (body) {
        initialPaths.add(`${htmlPath}/1-${safeGetTagName(body)}`);
      }
    }
    return initialPaths;
  });
  
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
      // console.log("[HTMLParserNodeConfig] Received new HTML content from source node:", sourceNodeId); // Keep commented out
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
        console.error("HTML 파싱 오류:", error); // Keep error log
      }
    } else if (!html && htmlContent) {
      // console.log("[HTMLParserNodeConfig] Source node provided no HTML content, clearing parser."); // Keep commented out
      setHtmlContent("");
      setParsedDOM(null);
      setDomError("");
    }
  }, [sourceNodeId, sourceNodeState, htmlContent]);
  
  // Add helper function to find element by path (needed for auto-selection)
  const findElementByPath = (rootElement: Element | null, targetPath: string): Element | null => {
      if (!rootElement || !targetPath) return null;
  
      const pathParts = targetPath.split('/');
      let currentElement: Element | null = rootElement; // Start from the provided root
  
      // Validate that the rootElement itself matches the first part of the path
      const firstPart = pathParts[0];
      const firstMatch = firstPart.match(/^(\d+)-(.+)$/);
      if (!firstMatch) {
        // console.warn("Invalid first path part format:", firstPart);
        return null;
      }
      const firstIndex = parseInt(firstMatch[1], 10);
      const firstTag = firstMatch[2];
  
      // Basic check: Does the root element's tag match the first part's tag?
      if (safeGetTagName(currentElement)?.toLowerCase() !== firstTag?.toLowerCase()) {
         // console.warn(`Root element tag mismatch. Path starts with ${firstTag}, root is ${safeGetTagName(currentElement)}`);
         // If root doesn't match the very first tag, the path is invalid for this root.
         return null;
      }
      // More robust check: Does the root element's index among its siblings match?
      if (currentElement.parentElement) {
          const siblings: Element[] = Array.from(currentElement.parentElement.children).filter((node: Node) => node.nodeType === Node.ELEMENT_NODE) as Element[];
          if (siblings.indexOf(currentElement) !== firstIndex) {
              // console.warn(`Root element index mismatch. Path expects index ${firstIndex}, root is at index ${siblings.indexOf(currentElement)}`);
              return null;
          }
      } else if (firstIndex !== 0) {
          // Root element without a parent must have index 0
           // console.warn(`Root element has no parent, but path expects index ${firstIndex}`);
           return null;
      }
  
      // Iterate through the *rest* of the path parts (starting from index 1)
      // since the 0th part corresponds to the rootElement itself.
      for (let i = 1; i < pathParts.length; i++) {
          if (!currentElement) return null; // Should not happen if logic is correct
  
          const part = pathParts[i];
          const match = part.match(/^(\d+)-(.+)$/);
          if (!match) {
              // console.warn("Invalid path part format:", part);
              return null; // Invalid path part format
          }
  
          const childIndex = parseInt(match[1], 10);
          const childTagName = match[2]; // Expected tag name
  
          // Get only element children of the current element
          const children: Element[] = Array.from(safeGetChildren(currentElement)).filter((node: Node) => node.nodeType === Node.ELEMENT_NODE) as Element[];
  
          if (childIndex >= children.length) {
              // console.warn(`Child index out of bounds for part ${part}. Index: ${childIndex}, Children count: ${children.length}, Parent:`, currentElement);
              return null; // Index out of bounds
          }
  
          const nextElement: Element = children[childIndex];
  
          // Optional but recommended: Verify the tag name matches
          if (safeGetTagName(nextElement)?.toLowerCase() !== childTagName?.toLowerCase()) {
             // console.warn(`Tag mismatch at step ${i}. Expected ${childTagName}, found ${safeGetTagName(nextElement)}`);
             // Decide if this should be a fatal error or just a warning
             // return null; // Make it fatal for now
          }
  
          currentElement = nextElement; // Move to the next element in the path
      }
  
      // If the loop completes, currentElement is the target
      return currentElement;
  };

  // Callback function for element selection (Updated Level Calculation)
  const handleElementSelect = useCallback((path: string, selector: string, preview: string) => {
    setSelectedElementPath(path);
    setGeneratedSelector(selector);
    setSelectedElementPreview(preview);

    // 텍스트 미리보기 추출
    if (parsedDOM?.documentElement && path) {
      const targetElement = findElementByPath(parsedDOM.documentElement, path);
      if (targetElement) {
        // 요소에서 텍스트 추출 (인라인으로 구현)
        const textParts: string[] = [];
        
        // 직접 텍스트 노드들을 먼저 수집
        const directTextNodes = Array.from(targetElement.childNodes).filter(node => 
          node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
        );
        
        if (directTextNodes.length > 0) {
          const directText = directTextNodes.map(node => node.textContent?.trim()).filter(Boolean).join(' ');
          if (directText) {
            textParts.push(directText);
          }
        }
        
        // 자식 요소들의 텍스트를 수집
        const childElements = Array.from(targetElement.children);
        childElements.forEach(child => {
          const childText = child.textContent?.trim();
          if (childText && childText !== directTextNodes.map(n => n.textContent?.trim()).join(' ').trim()) {
            textParts.push(childText);
          }
        });
        
        // 중복 제거 및 정리
        const uniqueTextParts = [...new Set(textParts)].filter(text => text && text.length > 0);
        const textPreview = uniqueTextParts.join('\n\n');
        
        setSelectedElementTextPreview(textPreview);
      } else {
        setSelectedElementTextPreview('');
      }
    } else {
      setSelectedElementTextPreview('');
    }

    // Calculate path steps with correct level based on path depth
    const steps: PathStep[] = [];
    if (path) {
      const parts = path.split('/');
      parts.forEach((part, index) => { // Use index to determine level
        const match = part.match(/^(\d+)-(.+)$/);
        if (match) {
          const level = index + 1; // Level is index + 1
          const tag = match[2];
          const siblingIndex = parseInt(match[1], 10);
          // Add sibling index to details for clarity
          steps.push({ level, tag, details: `(index: ${siblingIndex})` }); 
        }
      });
    }
    setSelectedElementPathSteps(steps);
    
    // Expand ancestors (existing logic)
    if (path) {
        const ancestors = getAncestorPaths(path);
        setExpandedPaths(prev => new Set([...prev, ...ancestors, path]));
        
        // --- Add Scrolling Logic ---
        if (parsedDOM?.documentElement) {
            const targetElement = findElementByPath(parsedDOM.documentElement, path);
            if (targetElement) {
                // Find the corresponding element in the rendered DOM tree (might need a ref or data attribute)
                const renderedElement = domTreeContainerRef.current?.querySelector(`[data-path="${path}"]`);
                if (renderedElement) {
                    renderedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    // Highlighting is handled by passing selectedElementPath to DOMTreeNode
                } else {
                    // console.warn("Could not find rendered element for path:", path);
                }
            } else {
                 // console.warn("Could not find target DOM element for path:", path);
            }
        }
        // --- End Scrolling Logic ---
    }

  }, [setExpandedPaths, parsedDOM, findElementByPath]); // Add dependencies parsedDOM, findElementByPath
  
  // 선택기로 요소 사용하기
  const useSelectedElement = () => {
    if (!generatedSelector) return;
    
    // 선택된 요소로부터 규칙 생성
    const rule: ExtractionRule = {
      name: `element_${Date.now().toString().slice(-4)}`,
      selector: generatedSelector,
      target: "text",
      multiple: false,
      pathSteps: selectedElementPathSteps
    };
    
    // 새 규칙으로 설정하여 편집 가능하게 함
    setTemporaryRule(rule);
    setEditingRuleIndex(null);
  };
  
  // 업데이트 핸들러
  const handleCreateNewRule = () => {
    // 새로운 빈 규칙 생성
    const newRule: ExtractionRule = {
      name: `rule_${Date.now().toString().slice(-4)}`,
      selector: "",
      target: "text",
      multiple: false,
    };
    
    setTemporaryRule(newRule);
    setEditingRuleIndex(null);
  };

  const handleSaveRule = () => {
    if (!temporaryRule) return;
    
    // 임시 룰 저장
    if (editingRuleIndex !== null) {
      // 기존 룰 업데이트
      updateExtractionRule(editingRuleIndex, temporaryRule);
    } else {
      // 새 룰 추가
      addExtractionRule(temporaryRule);
    }
    
    // 임시 상태 정리
    setTemporaryRule(null);
    setEditingRuleIndex(null);
  };

  const handleEditRule = (index: number) => {
    if (content?.extractionRules && index < content.extractionRules.length) {
      setTemporaryRule({ ...content.extractionRules[index] });
      setEditingRuleIndex(index);
    }
  };

  const handleDeleteRule = (index: number) => {
    deleteExtractionRule(index);
  };

  const handleRuleChange = (rule: ExtractionRule) => {
    setTemporaryRule(rule);
  };

  const handleCancelRule = () => {
    setTemporaryRule(null);
    setEditingRuleIndex(null);
  };

  // Function to perform search (Optimized scrolling/highlighting)
  const performSearch = useCallback(() => {
    if (!parsedDOM || !searchQuery) {
      setSearchResults([]);
      setCurrentSearchResultIndex(-1);
      return;
    }

    const query = searchTarget === 'TEXT' || searchTarget === 'CLASS' || searchTarget === 'ID' 
                  ? searchQuery.toLowerCase() 
                  : searchQuery; // Keep original case for CSS selectors
    let foundElements: Element[] = [];

    // Use querySelectorAll for CSS search directly
    if (searchTarget === 'CSS') {
      try {
        // Use parsedDOM.body or parsedDOM.documentElement as the base for querySelectorAll
        const baseElement = parsedDOM.body || parsedDOM.documentElement;
        if (baseElement) {
          foundElements = Array.from(baseElement.querySelectorAll(query));
        }
      } catch (e) {
        console.error("Invalid CSS selector:", query, e);
        setDomError(`Invalid CSS selector: ${query}`); // Show error to user
        setSearchResults([]);
        setCurrentSearchResultIndex(-1);
        return; // Stop search if selector is invalid
      }
      setDomError(""); // Clear previous errors if selector is valid
    } else {
      // Existing logic for TEXT, CLASS, ID search (iterating through all elements)
      const allElements: NodeListOf<Element> = parsedDOM.querySelectorAll('*'); 
      foundElements = Array.from(allElements).filter((element: Element) => {
        let isMatch = false;
        switch (searchTarget) {
          case "TEXT":
            let directMatch = false;
            for (const childNode of Array.from(element.childNodes)) {
              if (childNode.nodeType === Node.TEXT_NODE && childNode.textContent?.toLowerCase().includes(query)) {
                directMatch = true;
                break; 
              }
            }
            if (directMatch) isMatch = true;
            break;
          case "CLASS":
            if (element.className && typeof element.className === 'string' && element.className.toLowerCase().includes(query)) {
              isMatch = true;
            }
            break;
          case "ID":
            if (element.id && element.id.toLowerCase().includes(query)) {
              isMatch = true;
            }
            break;
        }
        return isMatch;
      });
    }

    // Generate paths for found elements
    const rootElement: Element | null = parsedDOM.documentElement;
    const results: string[] = foundElements
                      .map((el: Element) => generatePathForElement(el, rootElement))
                      .filter((path): path is string => !!path && path !== ''); // Filter out empty/null paths
    
    const uniqueResults: string[] = Array.from(new Set(results)); // Ensure unique paths

    setSearchResults(uniqueResults);
    const newIndex = uniqueResults.length > 0 ? 0 : -1;
    setCurrentSearchResultIndex(newIndex);
    // console.log(`[Search Results: ${searchTarget}]`, uniqueResults); 

    // Auto-select the first result if found
    if (newIndex !== -1 && uniqueResults.length > 0) {
      const firstResultPath = uniqueResults[newIndex];
      const targetElement = findElementByPath(rootElement, firstResultPath);
      if (targetElement) {
          const selector = generateSelector(targetElement); // Use utility function
          const preview = targetElement.outerHTML || '';
          handleElementSelect(firstResultPath, selector, preview); 
      } else {
         // console.warn("Could not find element for path:", firstResultPath); 
         handleElementSelect("", "", ""); 
      }
    } else {
        handleElementSelect("", "", ""); 
    }

  }, [parsedDOM, searchQuery, searchTarget, setExpandedPaths, handleElementSelect, findElementByPath]); // Keep findElementByPath dependency

  // Function to handle search input changes (debounced)
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    // Clear previous results when query changes
    setSearchResults([]);
    setCurrentSearchResultIndex(-1);
  };

  // ADD BACK: Handle search execution (on button click or Enter)
  const handleSearch = () => {
    if (!parsedDOM || !searchQuery) {
      setSearchResults([]);
      setCurrentSearchResultIndex(-1);
      return;
    }
    
    let foundElements: Element[] = [];
    const rootElement: Element | null = parsedDOM.documentElement;
    if (!rootElement) return;
    
    console.log(`[Search] Starting search for "${searchQuery}" (type: ${searchTarget})`);
    
    try {
      switch (searchTarget) {
        case "TEXT":
          // Find elements containing the text (case-insensitive)
          foundElements = Array.from(rootElement.querySelectorAll('*')).filter((el: Element) => {
            const text = el.textContent?.toLowerCase();
            return text && text.includes(searchQuery.toLowerCase());
          });
          break;
        case "CLASS":
          // Find elements with the class name (partial match)
          foundElements = Array.from(rootElement.querySelectorAll('*')).filter((el: Element) => {
            const className = el.className;
            return className && typeof className === 'string' && 
                   className.toLowerCase().includes(searchQuery.toLowerCase());
          });
          break;
        case "ID":
          // Find elements with the ID (partial match)
          foundElements = Array.from(rootElement.querySelectorAll('*')).filter((el: Element) => {
            const id = el.id;
            return id && id.toLowerCase().includes(searchQuery.toLowerCase());
          });
          break;
        case "CSS":
           // Use querySelectorAll for CSS selectors
           foundElements = Array.from(rootElement.querySelectorAll(searchQuery));
           break;
      }
    } catch (error) {
        console.error("Error during element search:", error);
        setSearchResults([]);
        setCurrentSearchResultIndex(-1);
        return;
    }
    
    console.log(`[Search] Found ${foundElements.length} elements`);
    
    const results: string[] = foundElements
        // Ensure generatePathForElement uses documentElement as root
        .map((el: Element) => generatePathForElement(el, rootElement)) 
        .filter((path): path is string => !!path); // Filter out empty paths
        
    console.log(`[Search] Generated ${results.length} valid paths`);
    setSearchResults(results);
    
    if (results.length > 0) {
      setCurrentSearchResultIndex(0);
      // Auto-select the first result
      const firstResultPath: string = results[0];
      const element: Element | null = findElementByPath(rootElement, firstResultPath);
      if (element) {
        const selector: string = generateSelector(element);
        const preview: string = element.outerHTML.substring(0, 100); // Simple preview
        handleElementSelect(firstResultPath, selector, preview);
      } else {
          console.warn("Could not find element for first search result path:", firstResultPath);
      }
    } else {
      setCurrentSearchResultIndex(-1);
      // Clear selection if no results
      handleElementSelect("", "", ""); 
    }
  };

  // Function to navigate search results (Optimized scrolling/highlighting)
  const navigateResults = useCallback((direction: 'prev' | 'next') => {
    if (searchResults.length === 0) {
      console.log("[Navigate] No search results available");
      return;
    }

    console.log(`[Navigate] Current: ${currentSearchResultIndex}, Total: ${searchResults.length}, Direction: ${direction}`);

    let nextIndex: number = currentSearchResultIndex;
    if (direction === 'next') {
      nextIndex = Math.min(currentSearchResultIndex + 1, searchResults.length - 1);
    } else {
      nextIndex = Math.max(currentSearchResultIndex - 1, 0);
    }
    
    // 이미 경계에 있다면 순환하지 않음
    if (nextIndex === currentSearchResultIndex) {
      console.log(`[Navigate] Already at ${direction === 'next' ? 'last' : 'first'} result`);
      return;
    }
    
    console.log(`[Navigate] Moving to index: ${nextIndex}`);
    setCurrentSearchResultIndex(nextIndex);
    
    // Auto-select the element at the new index
    const nextPath: string = searchResults[nextIndex];
    if (nextPath && parsedDOM?.documentElement) {
        const targetElement: Element | null = findElementByPath(parsedDOM.documentElement, nextPath);
        if (targetElement) {
            const selector: string = generateSelector(targetElement);
            const preview: string = targetElement.outerHTML || '';
            // Call handleElementSelect to update selection and trigger expansion
            handleElementSelect(nextPath, selector, preview); 
        } else {
            console.warn("Could not find element for path during navigation:", nextPath);
            handleElementSelect("", "", ""); // Clear selection if element not found
        }
    } else {
        console.warn("Invalid path or no DOM during navigation:", nextPath);
        handleElementSelect("", "", ""); // Clear selection if path is invalid
    }
  }, [searchResults, currentSearchResultIndex, parsedDOM, findElementByPath, handleElementSelect, generateSelector]);

  // Function to toggle node expansion
  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        // Collapse: remove the path and all its descendants
        newSet.forEach(p => {
          if (p.startsWith(path)) {
            newSet.delete(p);
          }
        });
      } else {
        // Expand: add the path
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  // Update initial expanded paths when DOM changes
  useEffect(() => {
    if (parsedDOM?.documentElement) {
      const htmlPath = `0-${safeGetTagName(parsedDOM.documentElement)}`;
      const body = parsedDOM.body;
      let bodyPath = "";
      if (body) {
         bodyPath = `${htmlPath}/1-${safeGetTagName(body)}`;
      }
      setExpandedPaths(prev => {
          const newSet = new Set(prev); // Keep existing expanded states if possible
          if (!newSet.has(htmlPath)) newSet.add(htmlPath);
          if (bodyPath && !newSet.has(bodyPath)) newSet.add(bodyPath);
          return newSet;
      });
    }
  }, [parsedDOM]);

  // 입력 필드 스타일 - LLM 노드와 일관된 스타일
  const inputClass = "w-full p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900";

  // Handler for search target change
  const handleSearchTargetChange = (value: string) => {
      setSearchTarget(value as SearchTarget);
      // Trigger search immediately when target changes for better UX
      if(searchQuery) { // Only trigger if there's an existing query
          performSearch(); 
      }
  };

  // --- NEW: Handler to select parent element ---
  const handleSelectParent = () => {
      if (!selectedElementPath || !parsedDOM?.documentElement) return;

      // Check if it's already the root
      const rootPath: string = `0-${safeGetTagName(parsedDOM.documentElement ?? null)}`;
      if (selectedElementPath === rootPath) return; // Cannot go above root

      const lastSlashIndex: number = selectedElementPath.lastIndexOf('/');
      if (lastSlashIndex === -1) return; // Should not happen if not root

      const parentPath: string = selectedElementPath.substring(0, lastSlashIndex);
      if (!parentPath) return; // Safety check

      const parentElement: Element | null = findElementByPath(parsedDOM.documentElement, parentPath);

      if (parentElement) {
          const selector: string = generateSelector(parentElement);
          const preview: string = parentElement.outerHTML || '';
          handleElementSelect(parentPath, selector, preview);
      } else {
          // console.warn("Could not find parent element for path:", parentPath);
      }
  };
  // --- END NEW Handler ---

  return (
    <div className="p-4 space-y-4">
      {/* Header with HTML Explorer button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">HTML Parser 설정</h3>
        {htmlContent && (
          <Button 
            onClick={() => setIsHtmlExplorerOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <SearchIcon className="h-4 w-4 mr-2" />
          HTML 구조 탐색
          </Button>
        )}
      </div>
      
      {/* HTML Explorer Modal */}
      {isHtmlExplorerOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsHtmlExplorerOpen(false);
            }
            if (e.key === 'ArrowDown' && searchResults.length > 0) {
              e.preventDefault();
              navigateResults('next');
            }
            if (e.key === 'ArrowUp' && searchResults.length > 0) {
              e.preventDefault();
              navigateResults('prev');
            }
          }}
          tabIndex={-1}
        >
          <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">HTML 구조 탐색</h2>
              <div className="flex items-center space-x-2">
                {searchResults.length > 0 && (
                  <span className="text-sm text-gray-600">
                    💡 ↑↓ 키로 검색 결과 탐색 가능
                  </span>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsHtmlExplorerOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-4 overflow-hidden">
              {!htmlContent ? (
                <div className="text-sm text-gray-500 text-center py-8 border border-dashed border-gray-300 rounded-md bg-gray-50">
                  웹 크롤러 노드에 연결하여 HTML을 가져오세요.
                </div>
              ) : domError ? (
                <div className="text-sm text-red-500 text-center py-8 border border-dashed border-red-300 rounded-md bg-red-50">
                  {domError}
                </div>
              ) : (
                <div className="h-full flex flex-col space-y-4">
                  {/* Search UI - Compact design for modal */}
                  <div className="space-y-3 p-3 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                    {/* Search Header with Results Counter */}
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-800 flex items-center">
                        <SearchIcon className="h-4 w-4 mr-2 text-blue-600" />
                        요소 검색
                      </h4>
                      {searchResults.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                            {currentSearchResultIndex + 1} / {searchResults.length}
                          </span>
                          {/* Navigation buttons - moved here for better visibility */}
                          <div className="flex items-center space-x-1">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => navigateResults('prev')} 
                              disabled={searchResults.length <= 1 || currentSearchResultIndex <= 0}
                              className="h-7 w-7 p-0 border-blue-300 hover:bg-blue-100 text-blue-600 font-medium"
                              title="이전 결과 (↑)"
                            >
                              &lt;
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => navigateResults('next')} 
                              disabled={searchResults.length <= 1 || currentSearchResultIndex >= searchResults.length - 1}
                              className="h-7 w-7 p-0 border-blue-300 hover:bg-blue-100 text-blue-600 font-medium"
                              title="다음 결과 (↓)"
                            >
                              &gt;
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Unified Search Input with Type Selection */}
                    <div className="flex space-x-2">
                      <Select value={searchTarget} onValueChange={handleSearchTargetChange}>
                        <SelectTrigger className="h-9 w-[100px] bg-white border-gray-300"> 
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="w-auto">
                          <SelectItem value="TEXT">텍스트</SelectItem>
                          <SelectItem value="CLASS">클래스</SelectItem>
                          <SelectItem value="ID">ID</SelectItem>
                          <SelectItem value="CSS">CSS</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder={
                            searchTarget === 'TEXT' ? '텍스트 검색...' :
                            searchTarget === 'CLASS' ? '클래스명 검색...' :
                            searchTarget === 'ID' ? 'ID 검색...' :
                            'CSS 선택자 입력...'
                          }
                          value={searchQuery}
                          onChange={handleSearchInputChange}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSearch();
                            if (e.key === 'ArrowDown' && searchResults.length > 0) {
                              e.preventDefault();
                              navigateResults('next');
                            }
                            if (e.key === 'ArrowUp' && searchResults.length > 0) {
                              e.preventDefault();
                              navigateResults('prev');
                            }
                            if (e.key === 'Escape') setIsHtmlExplorerOpen(false);
                          }}
                          className="w-full h-9 px-3 pr-12 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        
                        {/* Search button */}
                        <div className="absolute right-1 top-1">
                          <Button 
                            size="sm" 
                            onClick={handleSearch} 
                            disabled={!searchQuery}
                            className="h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                            title="검색 (Enter)"
                          >
                            <SearchIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Search tips and navigation hint */}
                    <div className="flex items-center justify-between text-xs">
                      {searchTarget === 'CSS' ? (
                        <div className="text-gray-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 flex-1 mr-2">
                          💡 예시: .class-name, #element-id, div &gt; p, [data-attr="value"]
                        </div>
                      ) : (
                        <div className="text-gray-600 flex-1">
                          💡 Enter로 검색, ↑↓ 키로 결과 탐색
                        </div>
                      )}
                      {searchResults.length > 1 && (
                        <div className="text-blue-600 font-medium">
                          총 {searchResults.length}개 요소 발견
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content Area - Two column layout */}
                  <div className="flex-1 flex space-x-4 min-h-0">
                    {/* DOM Tree - Left Column */}
                    <div className="flex-1 flex flex-col min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-800 flex items-center">
                          <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                          DOM 구조
                        </h4>
                        {searchResults.length > 0 && (
                          <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                            {currentSearchResultIndex >= 0 && currentSearchResultIndex < searchResults.length ? 
                              `현재: ${currentSearchResultIndex + 1}/${searchResults.length}` : 
                              `${searchResults.length}개 발견`
                            }
                          </div>
                        )}
                      </div>
                      <div ref={domTreeContainerRef} className="flex-1 border rounded-lg bg-white shadow-sm overflow-hidden">
                        <div className="p-3 bg-gray-50 border-b text-xs text-gray-600 font-medium">
                          {searchResults.length > 0 ? (
                            <div className="space-y-1">
                              <div>💡 <strong>노란색</strong>: 검색된 요소, <strong>파란색</strong>: 선택된 요소</div>
                              <div>🔍 검색 결과: 위 화살표 버튼 또는 ↑↓ 키로 이동</div>
                            </div>
                          ) : (
                            "💡 요소를 클릭하여 선택하세요. 화살표로 접기/펼치기할 수 있습니다."
                          )}
                        </div>
                        <div className="p-2 h-full overflow-y-auto scroll-smooth">
                          {parsedDOM && parsedDOM.documentElement && (
                            <DOMTreeNode 
                              element={parsedDOM.documentElement} 
                              parentPath="" 
                              indexInParent={0}
                              selectedElementPath={selectedElementPath} 
                              onElementSelect={handleElementSelect} 
                              highlightedPath={searchResults[currentSearchResultIndex]}
                              expandedPaths={expandedPaths}
                              toggleExpand={toggleExpand}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Selected Element Info - Right Column */}
                    {generatedSelector && (
                      <div className="w-80 flex-shrink-0">
                        <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center">
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                          선택된 요소
                        </h4>
                        <div className="border rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 space-y-4 h-fit">
                          {/* Actions */}
                          <div className="flex items-center justify-between">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={handleSelectParent} 
                              disabled={!selectedElementPath || selectedElementPath === `0-${safeGetTagName(parsedDOM?.documentElement ?? null)}`}
                              title="부모 요소 선택 (상위로 이동)"
                              className="h-8 px-2 text-gray-600 hover:text-gray-800 hover:bg-white/50"
                            >
                              <ChevronUpIcon className="h-4 w-4 mr-1" />
                              상위
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => {
                                useSelectedElement();
                                setIsHtmlExplorerOpen(false);
                              }}
                              className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white text-xs font-medium"
                              title="선택된 요소를 규칙으로 추가하고 편집합니다"
                            >
                              <span className="mr-1">✓</span>
                              규칙으로 추가
                            </Button>
                          </div>
                          
                          {/* Path */}
                          <div>
                            <span className="text-xs font-medium text-gray-600 block mb-2">경로:</span>
                            <div className="flex flex-wrap items-center gap-1 p-2 bg-white rounded border max-h-24 overflow-y-auto">
                              {selectedElementPathSteps.length > 0 ? (
                                selectedElementPathSteps.map((step, index) => (
                                  <React.Fragment key={`${step.level}-${step.tag}-${step.details}`}>
                                    <span className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded border">
                                      <span className="font-mono font-medium">{step.tag}</span>
                                      <span className="ml-1 text-gray-500">{step.details}</span>
                                    </span>
                                    {index < selectedElementPathSteps.length - 1 && (
                                      <ChevronRightIcon className="h-3 w-3 text-gray-400" />
                                    )}
                                  </React.Fragment>
                                ))
                              ) : (
                                <span className="text-gray-400 italic text-xs">경로 정보 없음</span>
                              )}
                            </div>
                          </div>

                          {/* CSS Selector */}
                          <div>
                            <span className="text-xs font-medium text-gray-600 block mb-2">CSS 선택자:</span>
                            <div className="relative">
                              <code className="block w-full p-3 text-sm font-mono bg-white border rounded text-gray-800 break-all">
                                {generatedSelector}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(generatedSelector)}
                                className="absolute top-1 right-1 h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                                title="선택자 복사"
                              >
                                📋
                              </Button>
                            </div>
                          </div>

                          {/* Element Preview */}
                          <details className="group">
                            <summary className="text-xs font-medium text-gray-600 cursor-pointer hover:text-gray-800 flex items-center">
                              <span className="mr-1">HTML 미리보기</span>
                              <ChevronRightIcon className="h-3 w-3 transition-transform group-open:rotate-90" />
                            </summary>
                            <div className="mt-2 space-y-2">
                              {/* 전체 HTML 표시 */}
                              <div className="p-3 text-xs font-mono bg-white border rounded max-h-64 overflow-y-auto text-gray-600 whitespace-pre-wrap break-all">
                                {selectedElementPreview || '선택된 요소가 없습니다.'}
                              </div>
                              
                              {/* HTML 복사 및 다운로드 버튼 */}
                              {selectedElementPreview && (
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigator.clipboard.writeText(selectedElementPreview)}
                                    className="h-7 px-2 text-xs"
                                    title="HTML 복사"
                                  >
                                    📋 복사
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const blob = new Blob([selectedElementPreview], { type: 'text/html' });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = 'selected-element.html';
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                      URL.revokeObjectURL(url);
                                    }}
                                    className="h-7 px-2 text-xs"
                                    title="HTML 다운로드"
                                  >
                                    💾 다운로드
                                  </Button>
                                  <span className="text-xs text-gray-500">
                                    크기: {selectedElementPreview.length.toLocaleString()}자
                                  </span>
                                </div>
                              )}
                            </div>
                          </details>

                          {/* Text Preview */}
                          <details className="group" open>
                            <summary className="text-xs font-medium text-gray-600 cursor-pointer hover:text-gray-800 flex items-center">
                              <span className="mr-1">텍스트 미리보기</span>
                              <ChevronRightIcon className="h-3 w-3 transition-transform group-open:rotate-90" />
                            </summary>
                            <div className="mt-2 space-y-2">
                              {/* 텍스트 내용 표시 */}
                              <div className="p-3 text-xs bg-white border rounded max-h-64 overflow-y-auto text-gray-800 whitespace-pre-wrap break-words">
                                {selectedElementTextPreview || '추출된 텍스트가 없습니다.'}
                              </div>
                              
                              {/* 텍스트 복사 및 다운로드 버튼 */}
                              {selectedElementTextPreview && (
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigator.clipboard.writeText(selectedElementTextPreview)}
                                    className="h-7 px-2 text-xs"
                                    title="텍스트 복사"
                                  >
                                    📋 복사
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const blob = new Blob([selectedElementTextPreview], { type: 'text/plain' });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = 'selected-element.txt';
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                      URL.revokeObjectURL(url);
                                    }}
                                    className="h-7 px-2 text-xs"
                                    title="텍스트 다운로드"
                                  >
                                    💾 다운로드
                                  </Button>
                                  <span className="text-xs text-gray-500">
                                    크기: {selectedElementTextPreview.length.toLocaleString()}자
                                  </span>
                                </div>
                              )}
                            </div>
                          </details>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
              <div className="text-xs text-gray-500">
                💡 ESC 키를 눌러 닫을 수 있습니다
              </div>
              <Button 
                onClick={() => setIsHtmlExplorerOpen(false)}
                variant="outline"
              >
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Rules Management - Simplified */}
      <div className="space-y-4">
          {/* Section Header and Add Button */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    추출 규칙
                  </label>
              {/* Show Add button only when not adding/editing */}
              {!temporaryRule && (
                  <Button size="sm" variant="outline" onClick={handleCreateNewRule}>
                    <span className="mr-1">+</span>
                    규칙 추가
                  </Button>
              )}
                        </div>
                      </div>

          {/* Add/Edit Rule Form (Conditionally Visible) */}
          {temporaryRule && (
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200 mb-4"> {/* Added mb-4 */}
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
                {temporaryRule.pathSteps && temporaryRule.pathSteps.length > 0 ? (
                  // Display path steps if available (read-only)
                  <div className="text-sm font-mono bg-gray-100 p-2 border border-gray-300 rounded text-gray-700 space-y-0.5 text-[11px] leading-tight">
                    {temporaryRule.pathSteps.map((step) => (
                      <div key={step.level}>Lv{step.level}: {step.tag} {step.details}</div>
                    ))}
                    {/* Show the generated selector below for reference */}
                    <div className="mt-1 pt-1 border-t border-gray-200 text-gray-500">
                      {temporaryRule.selector}
                    </div> 
                  </div>
                ) : (
                  // Fallback to input field if no path steps
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
                )}
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

        {/* Usage Guide */}
        {!temporaryRule && (
          <div className="bg-gray-50 p-3 rounded-md text-sm border border-gray-200">
            <h4 className="font-medium mb-2">📋 사용 가이드</h4>
            
            <div className="mb-3">
              <h5 className="font-medium text-blue-700 mb-1">🎯 규칙 추가 방법 (2가지)</h5>
              <div className="ml-3 space-y-1 text-xs">
                <p>• <strong>방법 1:</strong> "+ 규칙 추가" 버튼으로 CSS 선택자를 직접 입력</p>
                <p>• <strong>방법 2:</strong> "HTML 구조 탐색" 버튼으로 시각적으로 요소 선택</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <p><strong>🔍 CSS 선택자:</strong> HTML에서 추출할 요소를 지정합니다.</p>
              <p><strong>📝 추출 유형:</strong> 텍스트, HTML, 또는 특정 속성을 선택할 수 있습니다.</p>
              <p><strong>🔗 속성 추출:</strong> href, src, alt 등의 속성명을 입력하세요.</p>
              <p><strong>📊 다중 선택:</strong> 체크하면 매칭된 모든 요소를 배열로 반환합니다.</p>
              <p><strong>🎨 HTML 탐색:</strong> 실제 DOM 구조를 보면서 정확한 요소를 선택할 수 있습니다.</p>
            </div>
          </div>
        )}

          {/* Rule List (Always Visible) */}
          {!content?.extractionRules || content.extractionRules.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4 border border-dashed border-gray-300 rounded-md bg-gray-50">
              추출 규칙이 없습니다. 규칙을 추가해 주세요.
            </div>
          ) : (
            <div className="space-y-2">
              {content.extractionRules.map((rule: ExtractionRule, index: number) => (
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
                      // Disable edit/delete when form is active for another rule
                      disabled={temporaryRule !== null && editingRuleIndex !== index}
                    >
                      <span>✎</span>
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleDeleteRule(index)}
                      // Disable edit/delete when form is active
                      disabled={temporaryRule !== null} 
                    >
                      <span>✕</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
            </div>
    </div>
  );
}; 