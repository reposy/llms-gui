import React from 'react';
import {
  safeGetTagName,
  safeGetChildren,
  safeGetClassList,
  generateSelector,
} from '../../utils/domUtils';

interface DOMTreeViewProps {
  element: Element | null;
  depth?: number;
  path?: string;
  maxDepth?: number;
  selectedElementPath: string;
  onElementSelect: (path: string, selector: string, preview: string) => void;
  highlightedPath?: string; // Optional: Path to highlight based on search
}

const DOMTreeNode: React.FC<DOMTreeViewProps> = ({
  element,
  depth = 0,
  path = "",
  maxDepth = 3,
  selectedElementPath,
  onElementSelect,
  highlightedPath,
}) => {
  if (!element || depth > maxDepth) return null;

  const tagName = safeGetTagName(element);
  if (!tagName) return null;

  const isHead = tagName === 'head';
  const currentPath = path ? `${path}/${depth}-${tagName}` : `${depth}-${tagName}`;
  const isSelected = selectedElementPath === currentPath;
  const isHighlighted = highlightedPath === currentPath;

  // HEAD 태그 내부는 접기 (단, 루트 HTML의 HEAD는 표시)
  if (isHead && depth > 0) {
    return (
      <div
        className="ml-4 py-1 pl-2 flex items-center text-gray-500 cursor-default rounded-md"
        key={`${currentPath}-head-collapsed`}
      >
        <span className="text-xs mr-1">▶</span>
        <span className="text-xs font-mono">{`<${tagName}> [내용 숨김]`}</span>
      </div>
    );
  }

  const children = safeGetChildren(element);
  let childrenElements = null;

  if (children.length > 0) {
    childrenElements = (
      <div className="ml-4">
        {children.map((child, index) => (
          <DOMTreeNode
            key={`${currentPath}-child-${index}`}
            element={child}
            depth={depth + 1}
            path={currentPath}
            maxDepth={maxDepth}
            selectedElementPath={selectedElementPath}
            onElementSelect={onElementSelect}
            highlightedPath={highlightedPath}
          />
        ))}
      </div>
    );
  }

  // 텍스트 내용 축약
  let textContent = "";
  try {
    textContent = element.textContent?.trim() || "";
    if (textContent && textContent.length > 30) {
      textContent = `${textContent.substring(0, 30)}...`;
    }
  } catch (e) {
    console.error("텍스트 내용 접근 오류:", e);
  }

  // 태그 속성 표시
  let attributes = "";
  try {
    if (element.id) attributes += ` id="${element.id}"`;
    const classList = safeGetClassList(element);
    if (classList.length > 0) attributes += ` class="${classList.join(' ')}"`;
    // 필요한 경우 다른 속성 추가
  } catch (e) {
    console.error("속성 접근 오류:", e);
  }

  const handleSelect = () => {
      const selector = generateSelector(element);
      let preview = '';
      try {
          preview = element.outerHTML || `<${tagName}${attributes}>${element.innerHTML || ""}</${tagName}>`;
      } catch (e) {
          console.error("HTML 접근 오류:", e);
          preview = `<${tagName}${attributes}></${tagName}>`;
      }
      onElementSelect(currentPath, selector, preview);
  };

  return (
    <div key={currentPath}>
      <div
        className={`py-1 pl-2 flex items-center cursor-pointer hover:bg-gray-100 rounded-md 
                    ${isSelected ? 'bg-blue-100 border border-blue-300' : ''} 
                    ${isHighlighted ? 'bg-yellow-100 border border-yellow-300' : ''}`}
        onClick={handleSelect}
      >
        {children.length > 0 ? (
          <span className="text-xs mr-1 text-gray-500">▼</span>
        ) : (
          <div className="w-4"></div> // Placeholder for alignment
        )}
        <span className="text-xs font-mono text-gray-700">
          {`<${tagName}${attributes}>`}
        </span>
        {textContent && (
          <span className="text-xs ml-2 text-gray-500 truncate max-w-[150px]" title={element.textContent?.trim() || ''}>
            {textContent}
          </span>
        )}
      </div>
      {childrenElements}
    </div>
  );
};

export default DOMTreeNode; 