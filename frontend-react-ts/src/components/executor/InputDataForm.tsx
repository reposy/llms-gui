import React, { useState, useEffect, KeyboardEvent, useRef } from 'react';

// 데이터 형식 타입 정의
type DataFormat = 'array' | 'json';

// 키-값 쌍 타입 정의 (JSON 형식용)
interface KeyValuePair {
  key: string;
  value: string;
}

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
  // 데이터 형식 상태
  const [dataFormat, setDataFormat] = useState<DataFormat>('array');
  
  // 배열 형식 입력 상태
  const [arrayInputs, setArrayInputs] = useState<(string | File)[]>(['']);
  
  // JSON 형식 입력 상태
  const [jsonInputs, setJsonInputs] = useState<KeyValuePair[]>([{ key: '', value: '' }]);
  
  const [error, setError] = useState<string>('');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    index: number;
    format: DataFormat;
  }>({
    isOpen: false,
    message: '',
    index: -1,
    format: 'array'
  });

  // 데이터 형식 변경 처리
  const handleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDataFormat(e.target.value as DataFormat);
  };

  // ---------- 배열 형식 처리 함수들 ----------
  // 텍스트 입력 변경 처리
  const handleArrayTextInputChange = (index: number, value: string) => {
    const newInputs = [...arrayInputs];
    newInputs[index] = value;
    setArrayInputs(newInputs);
  };

  // 텍스트 행 추가
  const addArrayTextInput = () => {
    setArrayInputs([...arrayInputs, '']);
  };

  // 행 제거 (텍스트 또는 파일)
  const removeArrayInput = (index: number) => {
    const newInputs = arrayInputs.filter((_, i) => i !== index);
    setArrayInputs(newInputs.length > 0 ? newInputs : ['']);
  };

  // 파일 업로드 처리
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const newFiles = Array.from(fileList);
    setArrayInputs([...arrayInputs, ...newFiles]);
  };

  // 키보드 이벤트 처리 (배열 형식)
  const handleArrayKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    // Delete 키 처리
    if (e.key === 'Delete') {
      e.preventDefault();
      setConfirmModal({
        isOpen: true,
        message: '이 입력을 삭제하시겠습니까?',
        index: index,
        format: 'array'
      });
      return;
    }
    
    // 엔터키 처리 - 새 행 추가
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addArrayTextInput();
      
      // 포커스를 새로 추가된 텍스트 영역으로 옮기기 위해 약간의 지연 추가
      setTimeout(() => {
        const textareas = document.querySelectorAll('textarea');
        if (textareas.length > index + 1) {
          textareas[index + 1].focus();
        }
      }, 0);
    }
  };

  // ---------- JSON 형식 처리 함수들 ----------
  // JSON 키-값 쌍 변경 처리
  const handleJsonInputChange = (index: number, field: 'key' | 'value', value: string) => {
    const newInputs = [...jsonInputs];
    newInputs[index][field] = value;
    setJsonInputs(newInputs);
  };

  // JSON 행 추가
  const addJsonInput = () => {
    setJsonInputs([...jsonInputs, { key: '', value: '' }]);
  };

  // JSON 행 제거
  const removeJsonInput = (index: number) => {
    const newInputs = jsonInputs.filter((_, i) => i !== index);
    setJsonInputs(newInputs.length > 0 ? newInputs : [{ key: '', value: '' }]);
  };

  // 키보드 이벤트 처리 (JSON 형식)
  const handleJsonKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number, field: 'key' | 'value') => {
    // Delete 키 처리
    if (e.key === 'Delete' && e.currentTarget.value === '') {
      e.preventDefault();
      setConfirmModal({
        isOpen: true,
        message: '이 키-값 쌍을 삭제하시겠습니까?',
        index: index,
        format: 'json'
      });
      return;
    }
    
    // 엔터키 처리 - 새 행 추가 또는 다음 필드로 이동
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'key') {
        // key 필드에서 엔터 -> 같은 행의 value 필드로 이동
        const valueInputs = document.querySelectorAll('input[name^="json-value-"]');
        if (valueInputs.length > index) {
          (valueInputs[index] as HTMLInputElement).focus();
        }
      } else {
        // value 필드에서 엔터 -> 새 행 추가
        addJsonInput();
        // 포커스를 새로 추가된 key 필드로 옮기기 위해 약간의 지연 추가
        setTimeout(() => {
          const keyInputs = document.querySelectorAll('input[name^="json-key-"]');
          if (keyInputs.length > index + 1) {
            (keyInputs[index + 1] as HTMLInputElement).focus();
          }
        }, 0);
      }
    }
  };

  // 확인 후 행 제거
  const handleDeleteConfirm = () => {
    if (confirmModal.index >= 0) {
      if (confirmModal.format === 'array') {
        removeArrayInput(confirmModal.index);
      } else if (confirmModal.format === 'json') {
        removeJsonInput(confirmModal.index);
      }
    }
    // 모달 닫기
    setConfirmModal({
      isOpen: false,
      message: '',
      index: -1,
      format: 'array'
    });
  };

  // 삭제 취소
  const handleDeleteCancel = () => {
    setConfirmModal({
      isOpen: false,
      message: '',
      index: -1,
      format: 'array'
    });
  };

  // Submit 처리
  const handleSubmit = () => {
    try {
      let submitData: any[];
      
      if (dataFormat === 'array') {
        // 배열 형식 데이터 그대로 전달
        submitData = arrayInputs;
      } else if (dataFormat === 'json') {
        // JSON 객체 생성
        const jsonObject: Record<string, any> = {};
        jsonInputs.forEach(({ key, value }) => {
          if (key.trim()) {
            try {
              // value가 숫자, 불리언, 객체 등으로 파싱 가능한지 시도
              jsonObject[key] = JSON.parse(value);
            } catch (e) {
              // 파싱 실패 시 문자열 그대로 사용
              jsonObject[key] = value;
            }
          }
        });
        // 단일 객체를 배열로 감싸서 전달
        submitData = [jsonObject];
      } else {
        throw new Error(`Unsupported data format: ${dataFormat}`);
      }
      
      onInputDataSubmit(submitData);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // 렌더링 메서드 - 데이터 형식에 따른 입력 폼
  const renderInputForm = () => {
    switch (dataFormat) {
      case 'array':
        return (
          <div className="space-y-2 mb-4">
            {/* 배열 형식 입력 */}
            {arrayInputs.map((input, index) => (
              <div key={index} className="flex items-center">
                {typeof input === 'string' ? (
                  // 텍스트 입력인 경우
                  <textarea
                    value={input}
                    onChange={(e) => handleArrayTextInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleArrayKeyDown(e, index)}
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
                    index: index,
                    format: 'array'
                  })}
                  className="ml-2 text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        );
        
      case 'json':
        return (
          <div className="space-y-2 mb-4">
            {/* JSON 형식 입력 */}
            {jsonInputs.map((input, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  name={`json-key-${index}`}
                  value={input.key}
                  onChange={(e) => handleJsonInputChange(index, 'key', e.target.value)}
                  onKeyDown={(e) => handleJsonKeyDown(e, index, 'key')}
                  className="flex-1 p-2 border border-gray-300 rounded bg-white"
                  placeholder="Key"
                />
                <span className="text-gray-500">:</span>
                <input
                  type="text"
                  name={`json-value-${index}`}
                  value={input.value}
                  onChange={(e) => handleJsonInputChange(index, 'value', e.target.value)}
                  onKeyDown={(e) => handleJsonKeyDown(e, index, 'value')}
                  className="flex-1 p-2 border border-gray-300 rounded bg-white"
                  placeholder="Value (e.g. 123, true, &quot;text&quot;)"
                />
                <button
                  onClick={() => setConfirmModal({
                    isOpen: true,
                    message: '이 키-값 쌍을 삭제하시겠습니까?',
                    index: index,
                    format: 'json'
                  })}
                  className="text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        );
        
      default:
        return <div>Unsupported data format: {dataFormat}</div>;
    }
  };

  // 데이터 형식에 따른 "Add" 버튼 텍스트
  const getAddButtonText = () => {
    switch (dataFormat) {
      case 'array': return 'Add Row';
      case 'json': return 'Add Key-Value Pair';
      default: return 'Add Item';
    }
  };

  // 데이터 형식에 따른 "Add" 버튼 핸들러
  const handleAddClick = () => {
    switch (dataFormat) {
      case 'array':
        addArrayTextInput();
        break;
      case 'json':
        addJsonInput();
        break;
    }
  };

  // Choose Files 버튼은 array 형식에서만 표시
  const renderFileUploadButton = () => {
    if (dataFormat === 'array') {
      return (
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
      );
    }
    return null;
  };

  return (
    <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-medium">Input Data</h2>
          <select
            value={dataFormat}
            onChange={handleFormatChange}
            className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
          >
            <option value="array">Array</option>
            <option value="json">JSON</option>
          </select>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleAddClick}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors text-sm flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {getAddButtonText()}
          </button>
        </div>
      </div>
      
      {renderInputForm()}

      {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}

      <div className="flex justify-between items-center">
        {renderFileUploadButton()}
        
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