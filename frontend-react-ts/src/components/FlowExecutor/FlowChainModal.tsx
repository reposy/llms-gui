import React from 'react';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import FlowInputForm from "../executor/FlowInputForm";
import ResultDisplay from "../executor/ResultDisplay";
import { executeFlowExecutor } from '../../services/flowExecutionService';
import { Button } from "../ui/button";
import { XIcon, PlayIcon } from "../Icons";

interface FlowChainModalProps {
  chainId: string;
  flowId: string;
  open: boolean;
  onClose: () => void;
}

export const FlowChainModal: React.FC<FlowChainModalProps> = ({
  chainId,
  flowId,
  open,
  onClose
}) => {
  const { getFlow, setFlowInputs, setFlowStatus, setFlowResults } = useExecutorStateStore();
  const flow = getFlow(chainId, flowId);

  if (!open || !flow) {
    return null;
  }

  const handleExecuteSingleFlow = async () => {
    if (!flow) return;

    setFlowStatus(chainId, flowId, 'running');
    try {
      const result = await executeFlowExecutor({
        flowId: flow.id,
        flowChainId: chainId,
        flowJson: flow.flowJson,
        inputs: flow.inputs,
      });

      if (result.status === 'success') {
        setFlowStatus(chainId, flowId, 'success');
        setFlowResults(chainId, flowId, result.outputs);
      } else {
        const errorMessage = result.error || 'Unknown error';
        // LLM 모델 관련 에러인지 확인
        if (errorMessage.includes("model") && errorMessage.includes("not found")) {
          const actualError = `LLM 모델을 찾을 수 없습니다. 해당 모델이 Ollama에 설치되어 있는지 확인하세요. (${errorMessage})`;
          setFlowStatus(chainId, flowId, 'error', actualError);
        } else {
          setFlowStatus(chainId, flowId, 'error', errorMessage);
        }
        setFlowResults(chainId, flowId, []);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // LLM 관련 에러 확인
      if (errorMessage.includes("model") && errorMessage.includes("not found")) {
        const actualError = `LLM 모델을 찾을 수 없습니다. 해당 모델이 Ollama에 설치되어 있는지 확인하세요. (${errorMessage})`;
        setFlowStatus(chainId, flowId, 'error', actualError);
      } else {
        setFlowStatus(chainId, flowId, 'error', errorMessage);
      }
      setFlowResults(chainId, flowId, []);
      console.error('Error executing single flow in modal:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[85vh] max-h-[85vh] flex flex-col overflow-hidden transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalFadeInScaleUp">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 truncate" title={flow.name}>{flow.name} - Configuration</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExecuteSingleFlow}
              disabled={flow.status === 'running'}
              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm font-medium flex items-center transition-colors duration-150 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {flow.status === 'running' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Running...
                </>
              ) : (
                <>
                  <PlayIcon size={18} className="mr-1.5" />
                  Execute Flow
                </>
              )}
            </button>
            <button 
              onClick={onClose} 
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md transition-colors duration-150"
              aria-label="Close modal"
            >
              <XIcon size={24} />
            </button>
          </div>
        </div>

        <div className="flex-grow p-4 space-y-4 overflow-y-auto flex flex-col">
          <div className="flex-shrink-0 border border-gray-200 rounded-lg p-3 bg-gray-50">
            <h3 className="text-md font-semibold text-gray-700 mb-2">Inputs</h3>
            <FlowInputForm
              flowId={flowId}
              inputs={flow.inputs}
              onInputChange={(newInputs) => setFlowInputs(chainId, flowId, newInputs)}
            />
          </div>

          <div className="flex-grow border border-gray-200 rounded-lg p-3 flex flex-col min-h-[200px]">
            <h3 className="text-md font-semibold text-gray-700 mb-2">Last Results</h3>
            <div className="flex-grow overflow-y-auto">
              <ResultDisplay
                flowId={flow.id}
                flowName={flow.name}
                result={{
                  status: flow.status,
                  outputs: flow.lastResults,
                  error: flow.error,
                  flowId: flow.id,
                }}
              />
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes modalFadeInScaleUp {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-modalFadeInScaleUp {
          animation: modalFadeInScaleUp 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}; 