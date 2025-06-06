import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import FlowResultDisplay from './FlowResultDisplay';
import type { InputRow } from '../../types/flow/InputRow';
import { extractFlowResultText } from '../../utils/flowResultUtils';
import type { ExecutionMode } from '../../services/flowExecutionService';

// 새로 분리한 섹션 컴포넌트들
import ExecutionModeSection from './flow-input-sections/ExecutionModeSection';
import NodePropertiesSection from './flow-input-sections/NodePropertiesSection';
import InputDataSection from './flow-input-sections/InputDataSection';
import ForEachConfigSection from './flow-input-sections/ForEachConfigSection';

interface FlowInputFormProps {
  flowId: string;
  inputs?: any[];
  onInputChange?: (inputs: any[]) => void;
}

// FlowInputForm에서 외부로 노출할 인터페이스
export interface FlowInputFormRef {
  getFinalInputData: () => any[];
  getExecutableInputs: () => any[];
  getExecutionMode: () => ExecutionMode;
  getCommonInputs: () => any[];
  getForEachItems: () => any[];
}

const FlowInputForm = forwardRef<FlowInputFormRef, FlowInputFormProps>(({ flowId, inputs: propInputs, onInputChange }, ref) => {
  const store = useFlowExecutorStore();
  const focusedFlowChainId = store.focusedFlowChainId;
  const flowChainMap = store.flowChainMap;
  const flowChainIds = store.flowChainIds;
  const chain = focusedFlowChainId ? flowChainMap[focusedFlowChainId] : undefined;
  const flow = chain && flowId ? chain.flowMap[flowId] : undefined;

  // 초기 데이터 분리
  const separateInputs = (inputs: InputRow[]) => {
    const properties: InputRow[] = [];
    const regularInputs: InputRow[] = [];
    
    inputs.forEach(input => {
      if (input.type === 'property') {
        properties.push(input);
      } else {
        regularInputs.push(input);
      }
    });
    
    return { properties, regularInputs };
  };

  const initialInputs = propInputs && propInputs.length > 0 ? propInputs : (flow?.inputs && flow.inputs.length > 0 ? flow.inputs : [{ type: 'text', value: '' }]);
  const { properties: initialProperties, regularInputs: initialRegularInputs } = separateInputs(initialInputs);
  
  const [properties, setProperties] = useState<InputRow[]>(initialProperties);
  const [regularInputs, setRegularInputs] = useState<InputRow[]>(initialRegularInputs.length > 0 ? initialRegularInputs : [{ type: 'text', value: '' }]);
  const [editMode, setEditMode] = useState(true);
  const [draftProperties, setDraftProperties] = useState<InputRow[]>(properties);
  const [draftRegularInputs, setDraftRegularInputs] = useState<InputRow[]>(regularInputs);
  
  // 실행 모드 관련 상태
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('batch');
  const [commonInputs, setCommonInputs] = useState<InputRow[]>([]);
  const [forEachItems, setForEachItems] = useState<InputRow[]>([]);
  const [repeatCount, setRepeatCount] = useState<number>(1);

  // 전체 inputs 배열 생성 (properties + regularInputs)
  const getCombinedInputs = (props: InputRow[], regular: InputRow[]) => [...props, ...regular];

  useEffect(() => {
    if (propInputs) {
      const { properties: newProperties, regularInputs: newRegularInputs } = separateInputs(propInputs);
      setProperties(newProperties);
      setRegularInputs(newRegularInputs.length > 0 ? newRegularInputs : [{ type: 'text', value: '' }]);
    } else if (flow && flow.inputs) {
      const { properties: newProperties, regularInputs: newRegularInputs } = separateInputs(flow.inputs);
      setProperties(newProperties);
      setRegularInputs(newRegularInputs.length > 0 ? newRegularInputs : [{ type: 'text', value: '' }]);
    }

    // Flow 변경 시 기존 설정 로드
    if (flow) {
      console.log('[FlowInputForm] Flow 변경 감지, 기존 설정 로드:', flow.executionConfig);
      if (flow.executionConfig) {
        setExecutionMode(flow.executionConfig.mode);
        setCommonInputs(flow.executionConfig.commonInputs || []);
        setForEachItems(flow.executionConfig.forEachItems || []);
        setRepeatCount(flow.executionConfig.repeatCount || 1);
      } else {
        // 기본값으로 초기화
        setExecutionMode('batch');
        setCommonInputs([]);
        setForEachItems([]);
        setRepeatCount(1);
      }
    }
  }, [propInputs, flow]);

  useEffect(() => {
    setDraftProperties(properties);
    setDraftRegularInputs(regularInputs);
  }, [properties, regularInputs]);

  // ✅ flowId가 변경될 때만 editMode를 true로 리셋
  useEffect(() => {
    setEditMode(true);
  }, [flowId]);

  // Store 업데이트 헬퍼
  const updateStoreWithCombined = (props: InputRow[], regular: InputRow[]) => {
    const combined = getCombinedInputs(props, regular);
    if (onInputChange) onInputChange(combined);
    if (focusedFlowChainId && flowId) {
      store.setFlowInputData(focusedFlowChainId, flowId, combined);
    }
  };

  // 저장 버튼 클릭 시 store에 반영
  const handleSave = () => {
    setEditMode(false);
    
    // Draft 데이터를 실제 상태와 store에 반영
    setProperties(draftProperties);
    setRegularInputs(draftRegularInputs);
    updateStoreWithCombined(draftProperties, draftRegularInputs);
    
    // 실행 모드 설정을 Flow에 저장
    if (focusedFlowChainId && flowId) {
      console.log('[FlowInputForm] 저장 시점:', { 
        chainId: focusedFlowChainId, 
        flowId, 
        properties: draftProperties, 
        regularInputs: draftRegularInputs,
        executionMode,
        commonInputs,
        forEachItems,
        repeatCount
      });
      
      // Flow의 실행 모드 설정 저장
      store.setFlowExecutionConfig(focusedFlowChainId, flowId, {
        mode: executionMode,
        commonInputs: executionMode === 'forEach' ? commonInputs : [],
        forEachItems: executionMode === 'forEach' ? forEachItems : [],
        repeatCount
      });
      
      setTimeout(() => {
        const updated = store.flowChainMap[focusedFlowChainId]?.flowMap[flowId]?.inputs;
        console.log('[FlowInputForm] 저장 후 store 상태:', updated);
      }, 100);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    // Draft를 원래 상태로 되돌림
    setDraftProperties(properties);
    setDraftRegularInputs(regularInputs);
  };

  // Flow 결과 가져오기
  const flowResult = flow && Array.isArray(flow.lastResults)
    ? { status: flow.status, outputs: flow.lastResults, error: flow.error, flowId: flow.id }
    : null;

  // 실행을 위한 입력 데이터 변환 함수
  const getExecutableInputs = (): any[] => {
    const currentProperties = editMode ? draftProperties : properties;
    const currentRegularInputs = editMode ? draftRegularInputs : regularInputs;
    const combined = getCombinedInputs(currentProperties, currentRegularInputs);
    
    return combined.map((row) => {
      if (row.type === 'flow-result') {
        return extractFlowResultText(row, flowChainMap);
      } else if (row.type === 'property') {
        try {
          const parsed = JSON.parse(row.value as string || '{}');
          if (parsed && typeof parsed === 'object' && 'nodeType' in parsed && 'property' in parsed) {
            return parsed;
          } else {
            console.warn('[FlowInputForm] Invalid property JSON structure:', parsed);
            return row.value;
          }
        } catch (error) {
          console.warn('[FlowInputForm] Failed to parse property JSON:', error);
          return row.value;
        }
      } else if (row.type === 'file') {
        return row.value;
      } else {
        return row.value;
      }
    });
  };

  const getFinalInputData = () => {
    const executableInputs = getExecutableInputs();
    console.log('[FlowInputForm] 실행용 입력 데이터:', executableInputs);
    return executableInputs;
  };

  // 실행 모드 관련 메서드들
  const getExecutionMode = (): ExecutionMode => executionMode;
  
  const getCommonInputs = (): any[] => {
    if (executionMode !== 'forEach') return [];
    return commonInputs.map((row) => {
      if (row.type === 'flow-result') {
        return extractFlowResultText(row, flowChainMap);
      } else if (row.type === 'property') {
        try {
          const parsed = JSON.parse(row.value as string || '{}');
          return parsed && typeof parsed === 'object' && 'nodeType' in parsed && 'property' in parsed ? parsed : row.value;
        } catch (error) {
          return row.value;
        }
      } else if (row.type === 'file') {
        return row.value;
      } else {
        return row.value;
      }
    });
  };

  const getForEachItems = (): any[] => {
    if (executionMode !== 'forEach') return [];
    return forEachItems.map((row) => {
      if (row.type === 'flow-result') {
        return extractFlowResultText(row, flowChainMap);
      } else if (row.type === 'property') {
        try {
          const parsed = JSON.parse(row.value as string || '{}');
          return parsed && typeof parsed === 'object' && 'nodeType' in parsed && 'property' in parsed ? parsed : row.value;
        } catch (error) {
          return row.value;
        }
      } else if (row.type === 'file') {
        return row.value;
      } else {
        return row.value;
      }
    });
  };

  useImperativeHandle(ref, () => ({
    getFinalInputData,
    getExecutableInputs,
    getExecutionMode,
    getCommonInputs,
    getForEachItems,
  }));

  return (
    <div className="mb-6 p-3 border border-gray-200 rounded-lg bg-white relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Flow Configuration</h2>
        <div className="flex gap-2 items-center">
          {editMode ? (
            <>
              <button className="px-3 py-1 bg-green-500 text-white rounded" onClick={handleSave}>저장</button>
              <button className="px-3 py-1 bg-gray-300 text-gray-700 rounded" onClick={handleCancel}>취소</button>
            </>
          ) : (
            <button className="px-3 py-1 bg-blue-500 text-white rounded" onClick={() => setEditMode(true)}>수정</button>
          )}
        </div>
      </div>

      {/* Execution Mode Section */}
      <ExecutionModeSection
        executionMode={executionMode}
        onExecutionModeChange={setExecutionMode}
        editMode={editMode}
        repeatCount={repeatCount}
        onRepeatCountChange={setRepeatCount}
      />

      {/* ForEach Configuration */}
      {executionMode === 'forEach' && (
        <ForEachConfigSection
          commonInputs={commonInputs}
          forEachItems={forEachItems}
          onCommonInputsChange={setCommonInputs}
          onForEachItemsChange={setForEachItems}
          editMode={editMode}
          flowId={flowId}
          focusedFlowChainId={focusedFlowChainId || undefined}
          flowChainIds={flowChainIds}
          flowChainMap={flowChainMap}
        />
      )}
      
      {/* Node Properties Section - Only in batch mode */}
      {executionMode === 'batch' && (
        <NodePropertiesSection
          properties={editMode ? draftProperties : properties}
          onPropertiesChange={editMode ? setDraftProperties : setProperties}
          editMode={editMode}
        />
      )}

      {/* Input Data Section - Only in batch mode */}
      {executionMode === 'batch' ? (
        <InputDataSection
          inputs={editMode ? draftRegularInputs : regularInputs}
          onInputsChange={editMode ? setDraftRegularInputs : setRegularInputs}
          editMode={editMode}
          flowId={flowId}
          focusedFlowChainId={focusedFlowChainId || undefined}
          flowChainIds={flowChainIds}
          flowChainMap={flowChainMap}
        />
      ) : (
        <div className="mb-6 p-4 border border-yellow-200 rounded-lg bg-yellow-50">
          <h3 className="text-md font-medium text-yellow-800 mb-2">Input Data (ForEach Mode)</h3>
          <p className="text-sm text-yellow-700">
            ForEach 모드에서는 위의 Execution Mode 섹션에서 Common Inputs와 ForEach Items를 설정하세요.
            각 Item은 Common Inputs와 결합되어 순차적으로 실행됩니다.
          </p>
        </div>
      )}

      {/* FlowResultDisplay */}
      <div className="mt-6">
        <FlowResultDisplay
          result={flowResult}
          flowId={typeof flowId === 'string' ? flowId : ''}
          flowName={typeof flow?.name === 'string' ? flow.name : ''}
          compact={true}
          defaultExpand={true}
        />
      </div>
    </div>
  );
});

export default FlowInputForm; 