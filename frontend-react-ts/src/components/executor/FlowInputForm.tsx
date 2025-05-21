import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
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
  sourceFlowId?: string;
};

const FlowInputForm: React.FC<FlowInputFormProps> = ({ flowId, inputs: propInputs, onInputChange, isChainInput = false }) => {
  const store = useFlowExecutorStore();
  // chainId는 상위에서 prop으로 받을 수도 있음. 여기서는 focusedChain 기준으로 처리
  const focusedFlowChainId = store.focusedFlowChainId;
  const chain = focusedFlowChainId ? store.chains[focusedFlowChainId] : undefined;
  const flow = chain && flowId ? chain.flowMap[flowId] : undefined;

  // 입력 데이터 상태
  const [inputs, setInputs] = useState<any[]>(propInputs || (flow ? flow.inputs : []));

  useEffect(() => {
    if (propInputs) setInputs(propInputs);
    else if (flow && flow.inputs) setInputs(flow.inputs);
  }, [propInputs, flow]);

  // 입력 변경 핸들러
  const handleInputChange = (newInputs: any[]) => {
    setInputs(newInputs);
    if (onInputChange) onInputChange(newInputs);
    if (focusedFlowChainId && flowId) {
      store.setFlowInputData(focusedFlowChainId, flowId, newInputs);
    }
  };

  // 렌더링 예시 (간단한 텍스트 입력)
  return (
    <div className="mb-6 p-3 border border-gray-300 rounded-lg bg-white">
      <h2 className="text-lg font-medium mb-2">Input Data</h2>
      <textarea
        className="w-full border border-gray-300 rounded p-2 mb-2"
        rows={3}
        value={inputs && inputs.length > 0 ? inputs[0] : ''}
        onChange={e => handleInputChange([e.target.value])}
        placeholder="입력값을 입력하세요"
      />
    </div>
  );
};

export default FlowInputForm; 