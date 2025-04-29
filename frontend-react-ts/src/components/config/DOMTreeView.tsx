import React, { useRef, useEffect } from 'react';
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
  expandedPaths: Set<string>; // Add prop for expanded paths
  toggleExpand: (path: string) => void; // Add prop for toggling expansion
}

const DOMTreeNode: React.FC<DOMTreeViewProps> = ({
  element,
  depth = 0,
  path = "",
  maxDepth = 3,
  selectedElementPath,
  onElementSelect,
  highlightedPath,
  expandedPaths,
  toggleExpand,
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);

  const tagName = safeGetTagName(element);
  const currentPath = element && tagName ? (path ? `${path}/${depth}-${tagName}` : `${depth}-${tagName}`) : '';

  useEffect(() => {
    if (highlightedPath === currentPath && nodeRef.current) {
      nodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightedPath, currentPath]);

  if (!element || !tagName) return null;

  const isHead = tagName === 'head';
  const isSelected = selectedElementPath === currentPath;
  const isHighlighted = highlightedPath === currentPath;
  const isExpanded = expandedPaths.has(currentPath);
  const children = safeGetChildren(element);

  if (isHead && depth > 0) {
    return (
      <div
        className="ml-4 py-1 pl-2 flex items-center text-gray-500 cursor-default rounded-md"
        key={`${currentPath}-head-collapsed`}
        ref={nodeRef}
      >
        <span 
          className="text-xs mr-1 cursor-pointer" 
          onClick={(e) => { e.stopPropagation(); toggleExpand(currentPath); }}
        >
          ▶
        </span>
        <span className="text-xs font-mono">{`<${tagName}> [내용 숨김]`}</span>
      </div>
    );
  }

  let textContent = "";
  try {
    textContent = element.textContent?.trim() || "";
    if (textContent && textContent.length > 30) {
      textContent = `${textContent.substring(0, 30)}...`;
    }
  } catch (e) {
    console.error("텍스트 내용 접근 오류:", e);
  }

  let attributes = "";
  try {
    if (element.id) attributes += ` id="${element.id}"`;
    const classList = safeGetClassList(element);
    if (classList.length > 0) attributes += ` class="${classList.join(' ')}"`;
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

  const handleToggleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleExpand(currentPath);
  }

  return (
    <div key={currentPath} ref={nodeRef}>
      <div
        className={`py-1 pl-2 flex items-center cursor-pointer hover:bg-gray-100 rounded-md 
                    ${isSelected ? 'bg-blue-100 border border-blue-300' : ''} 
                    ${isHighlighted ? 'bg-yellow-100 border border-yellow-300' : ''}`}
        onClickCapture={(e) => {
          e.stopPropagation(); 
          e.preventDefault();
          handleSelect(); 
          if (children.length > 0) {
            toggleExpand(currentPath);
          }
        }}
      >
        <span 
           className="text-xs mr-1 text-gray-500 cursor-pointer w-4 text-center" 
           onClick={handleToggleClick}
        >
          {children.length > 0 ? (isExpanded ? '▼' : '▶') : ''}
        </span>
        <span className="text-xs font-mono text-gray-700">
          {`<${tagName}${attributes}>`}
        </span>
        {textContent && (
          <span className="text-xs ml-2 text-gray-500 truncate max-w-[150px]" title={element.textContent?.trim() || ''}>
            {textContent}
          </span>
        )}
      </div>
      
      {isExpanded && children.length > 0 && (
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
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DOMTreeNode; 