import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import { NodeResult } from '../../core/outputCollector';
import ReactMarkdown from 'react-markdown';

interface FlowInputFormProps {
  flowId: string;
  inputs?: any[];
  onInputChange?: (inputs: any[]) => void;
  isChainInput?: boolean;
}

type InputItem = {
  type: 'text' | 'file' | 'flow-result';
  value: string | File;
  sourceFlowId?: string; // Flow 결과 참조 시 원본 Flow ID
};

const FlowInputForm: React.FC<FlowInputFormProps> = ({ flowId, inputs: propInputs, onInputChange, isChainInput = false }) => {
  const [inputItems, setInputItems] = useState<InputItem[]>([{ type: 'text', value: '' }]);
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    getFlow, 
    setFlowInputs, 
    getFlowResultById,
    getActiveFlowChain
  } = useFlowExecutorStore();
  
  // 체인 ID와 Flow ID로 Flow 객체 조회
  const activeChain = getActiveFlowChain();
  const chainId = activeChain?.id || '';
  const flow = activeChain ? getFlow(activeChain.id, flowId) : undefined;
  
  // 이전 Flow IDs (참조용) - 현재 플로우 제외한 모든 플로우
  const previousFlows = activeChain ? activeChain.flowIds
    .filter(id => id !== flowId)
    .map(id => {
      const f = getFlow(activeChain.id, id);
      return f ? {
        id: f.id, 
        name: f.name,
        hasResult: f.lastResults !== null && f.lastResults.length > 0
      } : null;
    })
    .filter(f => f !== null) : [];
  
  // 입력 값 초기화
  useEffect(() => {
    if (flow) {
      if (flow.inputs && flow.inputs.length > 0) {
        // 기존 입력 데이터가 있으면 변환해서 사용
        const initialInputs: InputItem[] = flow.inputs.map(input => {
          // Flow 결과 참조 여부 확인 (${result-flow-ID} 형식)
          if (typeof input === 'string' && input.match(/\$\{result-flow-([^}]+)\}/)) {
            const match = input.match(/\$\{result-flow-([^}]+)\}/);
            const refFlowId = match ? match[1] : '';
            return { 
              type: 'flow-result', 
              value: input,
              sourceFlowId: refFlowId
            };
          }
          
          // 그 외에는 텍스트로 간주
          return { type: 'text', value: input };
        });
        
        setInputItems(initialInputs);
        setConfirmed(true); // 이미 있는 데이터는 확정된 것으로 간주
      } else {
        // 기본 입력 데이터 설정 및 자동 확정
        const defaultInput = { type: 'text', value: '' };
        setInputItems([defaultInput]);
        
        // props로 onInputChange가 전달되었다면 호출
        if (onInputChange) {
          onInputChange([defaultInput.value]);
        } else if (chainId) {
          setFlowInputs(chainId, flowId, [defaultInput.value]); // 기본 입력 데이터 저장
        }
        
        setConfirmed(true); // 자동으로 확정 상태로 설정
      }
    }
  }, [flow, flowId, chainId, onInputChange]);
  
  if (!flow && !isChainInput) {
    return <div className="text-gray-500 italic p-2">입력을 설정할 Flow를 선택하세요.</div>;
  }
  
  // 입력 필드 변경 처리
  const handleInputChange = (index: number, value: string) => {
    const newInputItems = [...inputItems];
    newInputItems[index] = { ...newInputItems[index], value };
    setInputItems(newInputItems);
    setConfirmed(false);
  };
  
  // 입력 타입 변경 처리
  const handleInputTypeChange = (index: number, type: 'text' | 'file' | 'flow-result') => {
    const newInputItems = [...inputItems];
    
    // 타입에 따라 초기화
    if (type === 'text') {
      newInputItems[index] = { type, value: '' };
    } 
    else if (type === 'file') {
      fileInputRef.current?.click();
    }
    else if (type === 'flow-result') {
      newInputItems[index] = { type, value: '', sourceFlowId: '' };
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
  const handleAddInput = (type: 'text' | 'file' | 'flow-result' = 'text') => {
    if (type === 'text') {
      setInputItems([...inputItems, { type: 'text', value: '' }]);
    } 
    else if (type === 'file') {
      fileInputRef.current?.click();
    }
    else if (type === 'flow-result') {
      setInputItems([...inputItems, { type: 'flow-result', value: '', sourceFlowId: '' }]);
    }
    setConfirmed(false);
  };

  // 특정 위치 다음에 새 텍스트 입력 추가
  const handleAddTextInputAfter = (index: number) => {
    const newInputItems = [...inputItems];
    // index 다음에 새 텍스트 입력 삽입
    newInputItems.splice(index + 1, 0, { type: 'text', value: '' });
    setInputItems(newInputItems);
    setConfirmed(false);
    
    // 새로 추가된 입력 필드로 포커스 이동 (약간의 지연 추가)
    setTimeout(() => {
      const textareas = document.querySelectorAll('textarea');
      if (textareas.length > index + 1) {
        textareas[index + 1].focus();
      }
    }, 0);
  };

  // 키보드 이벤트 처리 (텍스트 입력)
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    // 확정 상태일 때는 키 이벤트를 처리하지 않음
    if (confirmed) return;
    
    // Shift+Enter: 새 텍스트 입력 추가
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault(); // 기본 동작 방지 (개행 방지)
      handleAddTextInputAfter(index);
    }
    // 일반 Enter는 기본 동작(개행) 허용
  };
  
  // 입력 필드 제거
  const handleRemoveInput = (index: number) => {
    const newInputItems = inputItems.filter((_, i) => i !== index);
    setInputItems(newInputItems);
    setConfirmed(false);
  };
  
  // Flow 결과 참조 추가
  const handleFlowResultSelect = (index: number, refFlowId: string) => {
    if (!refFlowId || !activeChain) return;

    const refFlow = getFlow(activeChain.id, refFlowId);
    if (!refFlow) return;
    
    const refVariable = `\${result-flow-${refFlowId}}`;
    const newInputItems = [...inputItems];
    newInputItems[index] = { 
      type: 'flow-result', 
      value: refVariable,
      sourceFlowId: refFlowId
    };
    
    setInputItems(newInputItems);
    setConfirmed(false);
  };
  
  // 입력 확정
  const handleConfirmInputs = () => {
    // 입력 데이터를 Flow 상태에 저장
    const inputData = inputItems.map(item => {
      if (item.type === 'text' || item.type === 'flow-result') {
        return item.value as string;
      } else {
        return `[File: ${(item.value as File).name}]`;
      }
    });
    
    // props로 onInputChange가 전달되었다면 호출
    if (onInputChange) {
      onInputChange(inputData);
    } else if (chainId) {
      setFlowInputs(chainId, flowId, inputData);
    }
    
    setConfirmed(true);
  };
  
  // Flow 결과 참조 상태 텍스트 생성
  const getFlowReferenceText = (sourceFlowId: string) => {
    if (!activeChain) return '알 수 없는 Flow';
    
    const refFlow = getFlow(activeChain.id, sourceFlowId);
    if (!refFlow) return '알 수 없는 Flow';
    
    const hasResult = refFlow.lastResults !== null && refFlow.lastResults.length > 0;
    return `${refFlow.name} ${hasResult ? '(결과 있음)' : '(결과 없음)'}`;
  };
  
  // 최근 실행 결과 가져오기 - flow가 없는 경우 안전하게 처리
  const lastResult = flow?.lastResults || null;
  
  return (
    <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-300 flex justify-between items-center">
        <div>
          <h2 className="font-medium text-lg">{isChainInput ? "Chain Input" : flow?.name || "Flow Input"}</h2>
          <p className="text-sm text-gray-500">입력 데이터를 입력하고 확정하세요</p>
        </div>
        
        {/* 확정/수정 버튼 */}
        <div>
          {!confirmed ? (
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center"
              onClick={handleConfirmInputs}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              입력 확정
            </button>
          ) : (
            <button
              className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors flex items-center"
              onClick={() => setConfirmed(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              수정하기
            </button>
          )}
        </div>
      </div>
      
      <div className="p-4">
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-700">입력 데이터</h3>
            {confirmed && (
              <span className="text-green-600 bg-green-50 px-3 py-1 rounded-full text-xs font-medium flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                확정됨
              </span>
            )}
          </div>
          
          {inputItems.map((item, index) => (
            <div key={index} className="mb-4 bg-white">
              <div className="flex items-center mb-1">
                <span className="text-sm text-gray-600 mr-2">입력 {index + 1}</span>
                <div className="flex space-x-2">
                  <button
                    className={`px-2 py-1 text-xs rounded ${item.type === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                    onClick={() => handleInputTypeChange(index, 'text')}
                    disabled={confirmed}
                  >
                    텍스트
                  </button>
                  <button
                    className={`px-2 py-1 text-xs rounded ${item.type === 'file' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                    onClick={() => handleInputTypeChange(index, 'file')}
                    disabled={confirmed}
                  >
                    파일
                  </button>
                  <button
                    className={`px-2 py-1 text-xs rounded ${item.type === 'flow-result' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                    onClick={() => handleInputTypeChange(index, 'flow-result')}
                    disabled={confirmed || previousFlows.length === 0}
                    title={previousFlows.length === 0 ? '사용 가능한 이전 Flow가 없습니다' : '이전 Flow의 결과를 사용합니다'}
                  >
                    Flow 결과
                  </button>
                </div>
                {inputItems.length > 1 && !confirmed && (
                  <button 
                    onClick={() => handleRemoveInput(index)}
                    className="ml-auto p-1 text-red-500 hover:text-red-700"
                    title="이 입력 제거"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {item.type === 'text' && (
                <div className="flex">
                  <textarea
                    rows={3}
                    className={`flex-1 p-2 border rounded-l bg-white ${confirmed ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-300 text-gray-900'}`}
                    value={item.value as string}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    placeholder={`예: "오늘 날씨 어때?"`}
                    readOnly={confirmed}
                  />
                  {!confirmed && (
                    <button
                      onClick={() => handleAddTextInputAfter(index)}
                      className="px-3 border border-l-0 rounded-r border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700"
                      title="이 입력 아래에 새 행 추가"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
              {item.type === 'file' && (
                <div className={`w-full p-2 border rounded flex items-center justify-between bg-white ${confirmed ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-300 text-gray-900'}`}>
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>{item.value instanceof File ? item.value.name : '파일 선택됨'}</span>
                  </div>
                  {!confirmed && (
                    <button 
                      className="text-xs text-blue-500 hover:underline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      변경
                    </button>
                  )}
                </div>
              )}
              {item.type === 'flow-result' && (
                <select
                  className={`w-full p-2 border rounded bg-white ${confirmed ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-300 text-gray-900'}`}
                  value={item.sourceFlowId || ''}
                  onChange={(e) => handleFlowResultSelect(index, e.target.value)}
                  disabled={confirmed}
                >
                  <option value="">-- Flow 결과 선택 --</option>
                  {previousFlows.map(prevFlow => (
                    <option key={prevFlow.id} value={prevFlow.id} disabled={!prevFlow.hasResult}>
                      {getFlowReferenceText(prevFlow.id)}
                    </option>
                  ))}
                </select>
              )}
              
              {!confirmed && item.type === 'text' && (
                <div className="mt-1 text-xs text-gray-500 flex justify-end">
                  <span>
                    Shift+Enter를 눌러 새 행 추가
                  </span>
                </div>
              )}
            </div>
          ))}
          
          {/* 입력 필드 추가 버튼들 */}
          {!confirmed && (
            <div className="mt-4 flex space-x-2">
              <button 
                onClick={() => handleAddInput('text')}
                className="px-3 py-1.5 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Row
              </button>
              <button 
                onClick={() => handleAddInput('file')}
                className="px-3 py-1.5 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Add Files
              </button>
              <button 
                onClick={() => handleAddInput('flow-result')}
                className="px-3 py-1.5 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors flex items-center"
                disabled={previousFlows.length === 0}
                title={previousFlows.length === 0 ? '사용 가능한 이전 Flow가 없습니다' : '이전 Flow의 결과를 사용합니다'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                Add Flow Result
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* 파일 입력을 위한 숨겨진 input 요소 */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={(e) => handleFileSelect(inputItems.length - 1, e.target.files)}
        multiple
      />
      
      {/* 최근 실행 결과 표시 - flow가 있고 lastResult가 있을 때만 표시 */}
      {flow && lastResult && (
        <div className="mt-4 p-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">최근 실행 결과</h3>
            <span className={`px-2 py-1 text-xs rounded-full ${
              lastResult.status === 'success' ? 'bg-green-100 text-green-800' :
              lastResult.status === 'error' ? 'bg-red-100 text-red-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {lastResult.status === 'success' ? '성공' :
               lastResult.status === 'error' ? '오류' : '실행 중'}
            </span>
          </div>
          
          <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 max-h-48 overflow-y-auto">
            {lastResult.outputs?.map((output: NodeResult, index: number) => (
              <div key={index} className="mb-2">
                <div className="font-medium text-xs text-gray-500 mb-1">
                  {output.nodeId} - {output.nodeType}
                </div>
                {typeof output.result === 'string' ? (
                  <ReactMarkdown className="prose prose-sm max-w-none">
                    {output.result}
                  </ReactMarkdown>
                ) : (
                  <pre className="text-xs">
                    {JSON.stringify(output.result, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowInputForm; 