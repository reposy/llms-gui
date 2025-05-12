import React, { useState, useEffect } from 'react';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';

interface FlowInputFormProps {
  flowId: string;
  onInputDataSubmit?: (inputData: any[]) => void;
}

const FlowInputForm: React.FC<FlowInputFormProps> = ({ flowId, onInputDataSubmit }) => {
  const [inputs, setInputs] = useState<string[]>(['']);
  const [submitted, setSubmitted] = useState<boolean>(false);
  
  const { 
    flowChain, 
    getFlowById,
    setFlowInputData,
    getFlowResultById 
  } = useExecutorStateStore();
  
  const currentFlow = getFlowById(flowId);
  
  // 이전 Flow들의 ID (참조용)
  const previousFlowIds = flowChain
    .filter(flow => flow.id !== flowId)
    .map(flow => ({ id: flow.id, name: flow.name }));

  // 컴포넌트 마운트 시 Flow의 저장된 입력 데이터 로드
  useEffect(() => {
    if (currentFlow && currentFlow.inputData && currentFlow.inputData.length > 0) {
      setInputs(currentFlow.inputData.map(input => 
        typeof input === 'string' ? input : JSON.stringify(input)
      ));
      setSubmitted(true);
    } else {
      setInputs(['']);
      setSubmitted(false);
    }
  }, [currentFlow]);

  // 입력 변경 처리
  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
    setSubmitted(false);
  };

  // 입력 행 추가
  const handleAddInput = () => {
    setInputs([...inputs, '']);
    setSubmitted(false);
  };

  // 입력 행 제거
  const handleRemoveInput = (index: number) => {
    if (inputs.length > 1) {
      const newInputs = inputs.filter((_, i) => i !== index);
      setInputs(newInputs);
      setSubmitted(false);
    }
  };

  // 이전 Flow 결과 참조 삽입
  const handleInsertReference = (index: number, refFlowId: string) => {
    const refFlow = getFlowById(refFlowId);
    if (!refFlow) return;
    
    const refVariable = `\${result-flow-${refFlowId}}`;
    const newInputs = [...inputs];
    
    // 현재 커서 위치에 참조 변수 삽입하는 대신, 값 자체를 참조 변수로 대체
    newInputs[index] = refVariable;
    
    setInputs(newInputs);
    setSubmitted(false);
  };

  // 입력 데이터 제출
  const handleSubmit = () => {
    if (!currentFlow) return;
    
    // 빈 입력은 무시
    const filteredInputs = inputs.filter(input => input.trim() !== '');
    
    // 빈 배열인 경우 적어도 하나의 빈 문자열 포함
    const finalInputs = filteredInputs.length > 0 ? filteredInputs : [''];
    
    // Flow 입력 데이터 설정
    setFlowInputData(flowId, finalInputs);
    setSubmitted(true);
    
    if (onInputDataSubmit) {
      onInputDataSubmit(finalInputs);
    }
  };

  // 결과 참조 상태 확인
  const getInputReferenceStatus = (input: string): { isReference: boolean; flowId: string | null } => {
    const refPattern = /\$\{result-flow-([^}]+)\}/;
    const match = input.match(refPattern);
    
    if (match && match[1]) {
      const refFlowId = match[1];
      // 해당 Flow 존재 여부 확인
      const refFlow = getFlowById(refFlowId);
      
      return { 
        isReference: true, 
        flowId: refFlow ? refFlowId : null 
      };
    }
    
    return { isReference: false, flowId: null };
  };

  // 참조 상태에 따른 입력 필드 스타일 및 내용 설정
  const renderInputField = (input: string, index: number) => {
    const { isReference, flowId: refFlowId } = getInputReferenceStatus(input);
    
    if (isReference && refFlowId) {
      const refFlow = getFlowById(refFlowId);
      const hasResult = getFlowResultById(refFlowId) !== null;
      
      return (
        <div className="flex items-center">
          <div 
            className={`flex-1 p-2 rounded ${hasResult 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-gray-50 border border-gray-200'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${hasResult ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                <span className="text-sm font-medium">{refFlow?.name || 'Unknown Flow'} 결과</span>
              </div>
              <button
                onClick={() => handleRemoveInput(index)}
                className="text-gray-500 hover:text-red-500"
                title="제거"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-2">
        <textarea
          value={input}
          onChange={(e) => handleInputChange(index, e.target.value)}
          className="flex-1 p-2 border border-gray-200 rounded min-h-[80px] resize-y bg-white shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          placeholder="입력 데이터를 여기에 입력하세요..."
        />
        
        <div className="flex flex-col gap-1">
          <button
            onClick={() => handleRemoveInput(index)}
            className="p-1 text-gray-500 hover:text-red-500"
            disabled={inputs.length === 1}
            title="제거"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // 결과 참조 드롭다운 렌더링
  const renderFlowReferenceDropdown = (index: number) => {
    const availableFlows = previousFlowIds.filter(flow => {
      // 참조를 위해 사용 가능한 Flow 필터링
      // 이미 결과가 있거나, 실행 예정이지만 현재 Flow보다 앞에 있는 Flow만 참조 가능
      const flowIndex = flowChain.findIndex(f => f.id === flow.id);
      const currentFlowIndex = flowChain.findIndex(f => f.id === flowId);
      
      // 현재 Flow보다 앞에 있는 Flow만 참조 가능
      return flowIndex < currentFlowIndex;
    });
    
    if (availableFlows.length === 0) return null;
    
    return (
      <div className="mt-1">
        <select
          className="text-sm p-1 border border-gray-200 rounded bg-white shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          onChange={(e) => handleInsertReference(index, e.target.value)}
          value=""
        >
          <option value="" disabled>이전 Flow 결과 사용</option>
          {availableFlows.map(flow => (
            <option key={flow.id} value={flow.id}>
              {flow.name} 결과 사용
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="h-full p-4 border border-gray-300 rounded-lg bg-white overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">
          {currentFlow?.name || 'Flow'} 입력 데이터
        </h2>
        {submitted && (
          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
            입력 완료
          </span>
        )}
      </div>
      
      <div className="space-y-3 mb-4">
        {inputs.map((input, index) => (
          <div key={index} className="space-y-1">
            {renderInputField(input, index)}
            {renderFlowReferenceDropdown(index)}
          </div>
        ))}
      </div>
      
      <div className="flex justify-between">
        <button
          onClick={handleAddInput}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center border border-gray-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          입력 추가
        </button>
        
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          입력 저장
        </button>
      </div>
    </div>
  );
};

export default FlowInputForm; 