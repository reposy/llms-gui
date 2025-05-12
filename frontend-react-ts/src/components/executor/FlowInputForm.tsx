import React, { useState, useEffect, useRef } from 'react';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import { useExecutorGraphStore } from '../../store/useExecutorGraphStore';

interface FlowInputFormProps {
  flowId: string;
}

type InputItem = {
  type: 'text' | 'file';
  value: string | File;
};

const FlowInputForm: React.FC<FlowInputFormProps> = ({ flowId }) => {
  const [inputItems, setInputItems] = useState<InputItem[]>([{ type: 'text', value: '' }]);
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    flowChain,
    getFlowById, 
    setFlowInputData, 
    getFlowResultById
  } = useExecutorStateStore();
  
  const flow = getFlowById(flowId);
  
  // 이전 Flow IDs (참조용)
  const previousFlows = flowChain
    .filter(f => f.id !== flowId)
    .map(f => ({
      id: f.id, 
      name: f.name,
      hasResult: getFlowResultById(f.id) !== null
    }));
  
  // 입력 값 초기화
  useEffect(() => {
    if (flow) {
      if (flow.inputData && flow.inputData.length > 0) {
        // 기존 입력 데이터가 있으면 변환해서 사용
        const initialInputs: InputItem[] = flow.inputData.map(input => {
          // 현재는 모든 입력을 텍스트로 간주
          return { type: 'text', value: input };
        });
        
        setInputItems(initialInputs);
        setConfirmed(true); // 이미 있는 데이터는 확정된 것으로 간주
      } else {
        // 없으면 빈 텍스트 입력 하나 생성
        setInputItems([{ type: 'text', value: '' }]);
        setConfirmed(false);
      }
    }
  }, [flow, flowId]);
  
  if (!flow) {
    return <div className="text-red-500">Flow를 찾을 수 없습니다.</div>;
  }
  
  // 입력 필드 변경 처리
  const handleInputChange = (index: number, value: string) => {
    const newInputItems = [...inputItems];
    newInputItems[index] = { ...newInputItems[index], value };
    setInputItems(newInputItems);
    setConfirmed(false);
  };
  
  // 입력 타입 변경 처리
  const handleInputTypeChange = (index: number, type: 'text' | 'file') => {
    const newInputItems = [...inputItems];
    
    // 파일 -> 텍스트 변경 시 빈 문자열로 초기화
    if (type === 'text') {
      newInputItems[index] = { type, value: '' };
    } 
    // 텍스트 -> 파일 변경 시 파일 선택기 표시
    else if (type === 'file') {
      fileInputRef.current?.click();
    }
    
    setInputItems(newInputItems);
    setConfirmed(false);
  };
  
  // 파일 선택 처리
  const handleFileSelect = (index: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    // 선택한 첫 번째 파일을 현재 입력 항목에 설정
    const file = files[0];
    let newInputItems = [...inputItems];
    newInputItems[index] = { type: 'file', value: file };
    
    // 추가 파일이 있다면 새 입력 항목으로 추가
    if (files.length > 1) {
      for (let i = 1; i < files.length; i++) {
        newInputItems.push({ type: 'file', value: files[i] });
      }
    }
    
    setInputItems(newInputItems);
    setConfirmed(false);
  };
  
  // 입력 필드 추가
  const handleAddInput = (type: 'text' | 'file' = 'text') => {
    if (type === 'text') {
      setInputItems([...inputItems, { type: 'text', value: '' }]);
    } else {
      fileInputRef.current?.click();
    }
    setConfirmed(false);
  };
  
  // 입력 필드 제거
  const handleRemoveInput = (index: number) => {
    const newInputItems = inputItems.filter((_, i) => i !== index);
    setInputItems(newInputItems);
    setConfirmed(false);
  };
  
  // 다른 Flow 결과 참조 추가
  const handleAddFlowReference = (index: number, refFlowId: string) => {
    const refFlow = getFlowById(refFlowId);
    if (!refFlow) return;
    
    const refVariable = `\${result-flow-${refFlowId}}`;
    const newInputItems = [...inputItems];
    newInputItems[index] = { type: 'text', value: refVariable };
    
    setInputItems(newInputItems);
    setConfirmed(false);
  };
  
  // 입력 확정
  const handleConfirmInputs = () => {
    // 입력 데이터를 Flow 상태에 저장
    const inputData = inputItems.map(item => {
      if (item.type === 'text') {
        return item.value as string;
      } else {
        // 파일은 아직 처리하지 않음 (서버 API 필요)
        return `[File: ${(item.value as File).name}]`;
      }
    });
    
    setFlowInputData(flowId, inputData);
    setConfirmed(true);
  };
  
  return (
    <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-300 flex justify-between items-center">
        <div>
          <h2 className="font-medium text-lg">{flow.name}</h2>
          <p className="text-sm text-gray-500">입력 데이터를 입력하고 확정하세요</p>
        </div>
        
        {/* 확정 버튼 */}
        <div>
          {!confirmed ? (
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              onClick={handleConfirmInputs}
            >
              입력 확정
            </button>
          ) : (
            <div className="flex items-center">
              <span className="text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm font-medium flex items-center mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                확정됨
              </span>
              <button
                className="text-blue-500 hover:text-blue-700 text-sm"
                onClick={() => setConfirmed(false)}
              >
                수정
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">입력 데이터</h3>
          
          {inputItems.map((item, index) => (
            <div key={index} className="mb-4 bg-white">
              <div className="flex items-center mb-1">
                <span className="text-sm text-gray-600 mr-2">입력 {index + 1}</span>
                <div className="flex space-x-2">
                  <button
                    className={`px-2 py-1 text-xs rounded ${item.type === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                    onClick={() => handleInputTypeChange(index, 'text')}
                  >
                    텍스트
                  </button>
                  <button
                    className={`px-2 py-1 text-xs rounded ${item.type === 'file' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                    onClick={() => handleInputTypeChange(index, 'file')}
                  >
                    파일
                  </button>
                </div>
              </div>
              
              <div className="flex mb-2 gap-2">
                {item.type === 'text' ? (
                  <input
                    type="text"
                    value={item.value as string}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    placeholder={`입력 ${index + 1}`}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={confirmed}
                  />
                ) : (
                  <div className="flex-1 flex items-center border border-gray-300 rounded-md px-3 py-2 bg-white">
                    <span className="truncate">{(item.value as File).name}</span>
                  </div>
                )}
                
                {/* 삭제 버튼 */}
                {!confirmed && (
                  <button
                    onClick={() => handleRemoveInput(index)}
                    className="text-red-500 hover:text-red-700 px-2 py-1 rounded"
                    title="제거"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* 다른 Flow 결과 참조 선택기 */}
              {item.type === 'text' && !confirmed && previousFlows.length > 0 && (
                <div className="mt-1 mb-2">
                  <div className="flex items-center">
                    <select
                      className="text-sm p-2 border border-gray-300 rounded-md bg-white shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                      onChange={(e) => e.target.value && handleAddFlowReference(index, e.target.value)}
                      value=""
                    >
                      <option value="" disabled>이전 Flow 결과 참조하기</option>
                      {previousFlows.map(flow => (
                        <option 
                          key={flow.id} 
                          value={flow.id}
                          disabled={!flow.hasResult}
                        >
                          {flow.name} {flow.hasResult ? '✓' : '(결과 없음)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* 미리보기 섹션 (텍스트 참조 변수가 있는 경우) */}
              {item.type === 'text' && typeof item.value === 'string' && item.value.includes('${result-flow-') && (
                <div className="mt-1 bg-blue-50 p-2 rounded text-sm text-blue-700 border border-blue-200">
                  <p className="font-medium">다른 Flow 결과를 참조합니다</p>
                  <p>실행 시 이 참조는 해당 Flow의 실제 결과로 대체됩니다.</p>
                </div>
              )}
            </div>
          ))}
          
          {/* 입력 추가 버튼 */}
          {!confirmed && (
            <div className="text-sm text-gray-600 mt-4 mb-2">
              입력 추가:
            </div>
          )}
          <div className="flex space-x-2">
            <button
              onClick={() => handleAddInput('text')}
              className="px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center text-sm"
              disabled={confirmed}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              텍스트 입력
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center text-sm"
              disabled={confirmed}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              파일 추가 (다중선택 가능)
            </button>
          </div>
          
          {/* 숨겨진 파일 입력 */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            onChange={(e) => {
              // 파일 입력 참조 위치 구하기
              const index = inputItems.findIndex(item => item.type === 'text' && item.value === '');
              if (index !== -1) {
                handleFileSelect(index, e.target.files);
              } else {
                // 빈 입력 필드가 없으면 마지막에 추가
                handleFileSelect(inputItems.length, e.target.files);
              }
            }}
          />
        </div>
        
        <div className="text-sm text-gray-500">
          <p>참고:</p>
          <ul className="list-disc list-inside ml-2">
            <li>다른 Flow의 결과를 참조하려면 <code className="bg-gray-100 px-1 rounded">{'${result-flow-ID}'}</code> 형식을 사용하세요.</li>
            <li>예: <code className="bg-gray-100 px-1 rounded">{'${result-flow-abc123}'}</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FlowInputForm; 