import React, { useState, useEffect, KeyboardEvent, useRef } from 'react';

interface InputDataFormProps {
  onInputDataSubmit: (inputData: any[]) => void;
}

// 확인 대화상자 컴포넌트
interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ message, onConfirm, onCancel, isOpen }) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  
  // 모달이 열릴 때 확인 버튼에 포커스
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [isOpen]);

  // 키보드 이벤트 처리 - 엔터키는 확인, ESC는 취소
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div 
        className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium mb-4">확인</h3>
        <p className="mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
          >
            아니오
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            예
          </button>
        </div>
      </div>
    </div>
  );
};

const InputDataForm: React.FC<InputDataFormProps> = ({ onInputDataSubmit }) => {
  const [inputs, setInputs] = useState<(string | File)[]>(['']);
  const [error, setError] = useState<string>('');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    index: number;
  }>({
    isOpen: false,
    message: '',
    index: -1
  });

  // 텍스트 입력 변경 처리
  const handleTextInputChange = (index: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
  };

  // 텍스트 행 추가
  const addTextInput = () => {
    setInputs([...inputs, '']);
  };

  // 행 제거 (텍스트 또는 파일)
  const removeInput = (index: number) => {
    const newInputs = inputs.filter((_, i) => i !== index);
    setInputs(newInputs.length > 0 ? newInputs : ['']);
  };

  // 확인 후 행 제거
  const handleDeleteConfirm = () => {
    if (confirmModal.index >= 0) {
      removeInput(confirmModal.index);
    }
    // 모달 닫기
    setConfirmModal({
      isOpen: false,
      message: '',
      index: -1
    });
  };

  // 삭제 취소
  const handleDeleteCancel = () => {
    setConfirmModal({
      isOpen: false,
      message: '',
      index: -1
    });
  };

  // 파일 업로드 처리
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const newFiles = Array.from(fileList);
    setInputs([...inputs, ...newFiles]);
  };

  // 키보드 이벤트 처리
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    // Delete 키 처리
    if (e.key === 'Delete') {
      e.preventDefault();
      setConfirmModal({
        isOpen: true,
        message: '이 입력을 삭제하시겠습니까?',
        index: index
      });
      return;
    }
    
    // 엔터키 처리 - 새 행 추가
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addTextInput();
      
      // 포커스를 새로 추가된 텍스트 영역으로 옮기기 위해 약간의 지연 추가
      setTimeout(() => {
        const textareas = document.querySelectorAll('textarea');
        if (textareas.length > index + 1) {
          textareas[index + 1].focus();
        }
      }, 0);
    }
  };

  // Submit 처리 - 빈 입력도 허용
  const handleSubmit = () => {
    onInputDataSubmit(inputs);
    setError('');
  };

  return (
    <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-medium">Input Data</h2>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={addTextInput}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors text-sm flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Row
          </button>
          
          <div className="relative">
            <input
              type="file"
              id="file-upload"
              multiple
              onChange={handleFileChange}
              className="opacity-0 absolute inset-0 w-full cursor-pointer"
            />
            <label
              htmlFor="file-upload"
              className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition-colors text-sm flex items-center cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Choose Files
            </label>
          </div>
        </div>
      </div>
      
      <div className="space-y-2 mb-4">
        {/* 텍스트 입력 및 파일 섹션 */}
        {inputs.map((input, index) => (
          <div key={index} className="flex items-center">
            {typeof input === 'string' ? (
              // 텍스트 입력인 경우
              <textarea
                value={input}
                onChange={(e) => handleTextInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="flex-1 p-2 border border-gray-300 rounded resize-none bg-white"
                rows={2}
                placeholder={`Input row ${index + 1}`}
              />
            ) : (
              // 파일인 경우
              <div className="flex-1 p-2 border border-gray-300 rounded bg-gray-50">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-gray-800">{input.name}</span>
                </div>
              </div>
            )}
            <button
              onClick={() => setConfirmModal({
                isOpen: true,
                message: '이 입력을 삭제하시겠습니까?',
                index: index
              })}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          Submit Input Data
        </button>
      </div>

      {/* 확인 대화상자 */}
      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};

export default InputDataForm; 