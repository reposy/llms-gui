import React, { useState, useEffect, KeyboardEvent, useRef } from 'react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (filename: string, includeData: boolean) => void;
  defaultFilename: string;
}

const ExportModal: React.FC<ExportModalProps> = ({ 
  isOpen, 
  onClose, 
  onExport,
  defaultFilename 
}) => {
  const [filename, setFilename] = useState(defaultFilename);
  const [includeData, setIncludeData] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // 모달이 열릴 때마다 파일명 초기화 및 포커스
  useEffect(() => {
    if (isOpen) {
      setFilename(defaultFilename);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isOpen, defaultFilename]);
  
  // 키보드 이벤트 처리
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      handleExport();
    }
  };
  
  // 파일명 유효성 검사 및 내보내기 처리
  const handleExport = () => {
    if (!filename.trim()) {
      alert('파일명을 입력해주세요.');
      return;
    }
    
    // 파일명에 .json 확장자가 없으면 추가
    let finalFilename = filename.trim();
    if (!finalFilename.toLowerCase().endsWith('.json')) {
      finalFilename += '.json';
    }
    
    onExport(finalFilename, includeData);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4">Flow 체인 내보내기</h2>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2">
            파일명
          </label>
          <input
            ref={inputRef}
            type="text"
            value={filename}
            onChange={e => setFilename(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="flow-chain-export.json"
          />
        </div>
        
        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={includeData}
              onChange={e => setIncludeData(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-gray-700">실행 결과 데이터 포함</span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            체크하면 Flow 실행 결과가 함께 내보내집니다.
          </p>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            내보내기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal; 