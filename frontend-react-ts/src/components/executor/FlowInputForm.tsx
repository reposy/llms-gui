import React, { useState, useEffect } from 'react';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import ResultDisplay from './ResultDisplay';

interface FlowInputFormProps {
  flowId: string;
  onInputDataSubmit?: (inputData: any[]) => void;
}

type InputFormat = 'array' | 'json';

const FlowInputForm: React.FC<FlowInputFormProps> = ({ flowId, onInputDataSubmit }) => {
  const [inputs, setInputs] = useState<string[]>(['']);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [inputFormat, setInputFormat] = useState<InputFormat>('array');
  const [jsonInput, setJsonInput] = useState<string>('{}');
  const [jsonError, setJsonError] = useState<string>('');
  const [showResults, setShowResults] = useState<boolean>(false);
  
  const { 
    flowChain, 
    getFlowById,
    setFlowInputData,
    getFlowResultById 
  } = useExecutorStateStore();
  
  const currentFlow = getFlowById(flowId);
  const flowResult = getFlowResultById(flowId);
  
  // 이전 Flow들의 ID (참조용)
  const previousFlowIds = flowChain
    .filter(flow => flow.id !== flowId)
    .map(flow => ({ id: flow.id, name: flow.name }));

  // 컴포넌트 마운트 시 Flow의 저장된 입력 데이터 로드
  useEffect(() => {
    if (currentFlow && currentFlow.inputData && currentFlow.inputData.length > 0) {
      // 입력 데이터 형식 확인
      const firstInput = currentFlow.inputData[0];
      
      if (typeof firstInput === 'string' && firstInput.startsWith('{') && firstInput.endsWith('}')) {
        try {
          // JSON 형식으로 보이는 경우
          const parsedJson = JSON.parse(firstInput);
          setInputFormat('json');
          setJsonInput(JSON.stringify(parsedJson, null, 2));
          setInputs([firstInput]); // 기존 호환성 유지
        } catch (e) {
          // JSON 파싱 실패, 배열 형식으로 처리
          setInputFormat('array');
          setInputs(currentFlow.inputData.map(input => 
            typeof input === 'string' ? input : JSON.stringify(input)
          ));
        }
      } else {
        // 일반 배열 형식 처리
        setInputFormat('array');
        setInputs(currentFlow.inputData.map(input => 
          typeof input === 'string' ? input : JSON.stringify(input)
        ));
      }
      
      setSubmitted(true);
    } else {
      setInputs(['']);
      setJsonInput('{}');
      setSubmitted(false);
    }
  }, [currentFlow]);

  // 결과 토글 처리
  const toggleResults = () => {
    setShowResults(!showResults);
  };

  // 결과 섹션 렌더링
  const renderResultSection = () => {
    if (!flowResult) return null;
    
    return (
      <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium text-lg flex items-center text-blue-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            실행 결과
          </h3>
          <button
            onClick={toggleResults}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
          >
            {showResults ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                접기
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                펼치기
              </>
            )}
          </button>
        </div>
        
        {showResults && (
          <div className="mt-2">
            <ResultDisplay 
              result={flowResult} 
              isLoading={false} 
              error={null} 
            />
          </div>
        )}
      </div>
    );
  };

  // 입력 변경 처리
  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
    setSubmitted(false);
  };

  // JSON 입력 변경 처리
  const handleJsonInputChange = (value: string) => {
    setJsonInput(value);
    setSubmitted(false);
    
    // JSON 유효성 검사
    try {
      if (value.trim()) {
        JSON.parse(value);
        setJsonError('');
      }
    } catch (e) {
      setJsonError('유효하지 않은 JSON 형식입니다.');
    }
  };

  // 입력 형식 변경 처리
  const handleFormatChange = (format: InputFormat) => {
    if (format === inputFormat) return;
    
    if (format === 'json') {
      // Array에서 JSON으로 변경
      try {
        // 입력 데이터가 있으면 첫 번째 항목을 JSON으로 변환 시도
        if (inputs.length > 0 && inputs[0].trim()) {
          try {
            // 첫 번째 항목이 JSON 형식인지 확인
            const parsedJson = JSON.parse(inputs[0]);
            setJsonInput(JSON.stringify(parsedJson, null, 2));
          } catch (e) {
            // 아닌 경우 모든 입력을 JSON 배열로 변환
            const arrayData = inputs.filter(input => input.trim());
            setJsonInput(JSON.stringify({ inputs: arrayData }, null, 2));
          }
        } else {
          // 기본 JSON 템플릿
          setJsonInput('{\n  "inputs": []\n}');
        }
        setJsonError('');
      } catch (e) {
        setJsonInput('{}');
        setJsonError('입력 데이터를 JSON으로 변환할 수 없습니다.');
      }
    } else {
      // JSON에서 Array로 변경
      try {
        if (jsonInput.trim()) {
          const parsedJson = JSON.parse(jsonInput);
          
          if (Array.isArray(parsedJson)) {
            // JSON이 배열인 경우
            setInputs(parsedJson.map(item => 
              typeof item === 'string' ? item : JSON.stringify(item)
            ));
          } else if (parsedJson.inputs && Array.isArray(parsedJson.inputs)) {
            // JSON 객체에 inputs 배열이 있는 경우
            setInputs(parsedJson.inputs.map((item: any) => 
              typeof item === 'string' ? item : JSON.stringify(item)
            ));
          } else {
            // 그 외의 경우 각 객체의 키-값을 배열로 변환
            const entries = Object.entries(parsedJson);
            setInputs(entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`));
          }
        } else {
          setInputs(['']);
        }
      } catch (e) {
        setInputs(['']);
      }
    }
    
    setInputFormat(format);
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
    
    if (inputFormat === 'array') {
      const newInputs = [...inputs];
      // 현재 커서 위치에 참조 변수 삽입하는 대신, 값 자체를 참조 변수로 대체
      newInputs[index] = refVariable;
      setInputs(newInputs);
    } else {
      // JSON 형식의 경우, 커서 위치에 참조 변수 삽입
      const refFlowName = refFlow.name || refFlowId;
      setJsonInput(jsonInput + `\n  "${refFlowName}Result": "${refVariable}"`);
    }
    
    setSubmitted(false);
  };

  // 입력 데이터 제출
  const handleSubmit = () => {
    if (!currentFlow) return;
    
    let finalInputs: string[] = [];
    
    if (inputFormat === 'array') {
      // 배열 형식 처리
      // 빈 입력은 무시
      const filteredInputs = inputs.filter(input => input.trim() !== '');
      // 빈 배열인 경우 적어도 하나의 빈 문자열 포함
      finalInputs = filteredInputs.length > 0 ? filteredInputs : [''];
    } else {
      // JSON 형식 처리
      try {
        if (jsonInput.trim()) {
          JSON.parse(jsonInput); // 유효성 검사
          finalInputs = [jsonInput]; // 단일 JSON 문자열로 저장
        } else {
          finalInputs = ['{}'];
        }
        setJsonError('');
      } catch (e) {
        setJsonError('유효하지 않은 JSON 형식입니다. 입력을 저장할 수 없습니다.');
        return;
      }
    }
    
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

  // 입력 형식 선택기 렌더링
  const renderFormatSelector = () => (
    <div className="mb-4">
      <label className="text-sm font-medium text-gray-700 block mb-2">입력 데이터 형식</label>
      <div className="inline-flex rounded-md shadow-sm">
        <button
          type="button"
          onClick={() => handleFormatChange('array')}
          className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
            inputFormat === 'array'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
          }`}
        >
          배열 (Array)
        </button>
        <button
          type="button"
          onClick={() => handleFormatChange('json')}
          className={`px-4 py-2 text-sm font-medium rounded-r-md border ${
            inputFormat === 'json'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 border-l-0'
          }`}
        >
          JSON 객체
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {inputFormat === 'array' 
          ? '각 입력 항목을 별도의 필드로 추가합니다.' 
          : 'JSON 형식으로 구조화된, 객체 형태의 입력 데이터를 제공합니다.'}
      </p>
    </div>
  );

  // JSON 입력 폼 렌더링
  const renderJsonInputForm = () => (
    <div className="space-y-3 mb-4">
      <div className="relative">
        <textarea
          value={jsonInput}
          onChange={(e) => handleJsonInputChange(e.target.value)}
          className={`w-full p-3 border rounded min-h-[250px] resize-y bg-white shadow-sm font-mono text-sm ${
            jsonError ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-blue-300'
          } focus:ring focus:ring-opacity-50 ${jsonError ? 'focus:ring-red-200' : 'focus:ring-blue-200'}`}
          placeholder="JSON 형식으로 입력 데이터를 입력하세요..."
        />
        {jsonError && (
          <div className="mt-1 text-sm text-red-600">
            {jsonError}
          </div>
        )}
      </div>
      
      {previousFlowIds.length > 0 && (
        <div className="mt-2">
          <label className="text-sm font-medium text-gray-700 block mb-1">이전 Flow 결과 참조:</label>
          <select
            className="w-full p-2 border border-gray-200 rounded bg-white shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            onChange={(e) => e.target.value && handleInsertReference(0, e.target.value)}
            value=""
          >
            <option value="" disabled>이전 Flow 결과 사용</option>
            {previousFlowIds.filter(flow => {
              const flowIndex = flowChain.findIndex(f => f.id === flow.id);
              const currentFlowIndex = flowChain.findIndex(f => f.id === flowId);
              return flowIndex < currentFlowIndex;
            }).map(flow => (
              <option key={flow.id} value={flow.id}>
                {flow.name} 결과 사용
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
  
  // 배열 입력 폼 렌더링
  const renderArrayInputForm = () => (
    <div className="space-y-3 mb-4">
      {inputs.map((input, index) => (
        <div key={index} className="space-y-1">
          {renderInputField(input, index)}
          {renderFlowReferenceDropdown(index)}
        </div>
      ))}
      
      <button
        onClick={handleAddInput}
        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center border border-gray-200"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        입력 추가
      </button>
    </div>
  );

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
      
      {flowResult && renderResultSection()}
      
      {renderFormatSelector()}
      
      {inputFormat === 'array' ? renderArrayInputForm() : renderJsonInputForm()}
      
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          입력 저장
        </button>
      </div>
    </div>
  );
};

export default FlowInputForm; 