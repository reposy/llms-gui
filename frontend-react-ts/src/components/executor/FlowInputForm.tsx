import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import FlowResultDisplay from './FlowResultDisplay';
import type { InputRow, InputType } from '../../types/flow/InputRow';
import { extractFlowResultText } from '../../utils/flowResultUtils';
import type { ExecutionMode } from '../../services/flowExecutionService';
import { 
  LLMPropertyForm, 
  APIPropertyForm, 
  WebCrawlerPropertyForm,
  parseProperty,
  serializeProperty,
  createDefaultProperty,
  type LLMProperty,
  type APIProperty,
  type WebCrawlerProperty
} from './PropertyForms';

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

  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

    // 기존 실행 설정 불러오기
    if (flow && flow.executionConfig) {
      setExecutionMode(flow.executionConfig.mode);
      setCommonInputs(flow.executionConfig.commonInputs || []);
      setForEachItems(flow.executionConfig.forEachItems || []);
    } else {
      // 기본값으로 초기화
      setExecutionMode('batch');
      setCommonInputs([]);
      setForEachItems([]);
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

  // Property 업데이트 헬퍼
  const updateProperties = (newProperties: InputRow[]) => {
    if (editMode) {
      setDraftProperties(newProperties);
    } else {
      setProperties(newProperties);
      updateStoreWithCombined(newProperties, regularInputs);
    }
  };

  // Regular inputs 업데이트 헬퍼
  const updateRegularInputs = (newRegularInputs: InputRow[]) => {
    if (editMode) {
      setDraftRegularInputs(newRegularInputs);
    } else {
      setRegularInputs(newRegularInputs);
      updateStoreWithCombined(properties, newRegularInputs);
    }
  };

  // Store 업데이트 헬퍼
  const updateStoreWithCombined = (props: InputRow[], regular: InputRow[]) => {
    const combined = getCombinedInputs(props, regular);
    if (onInputChange) onInputChange(combined);
    if (focusedFlowChainId && flowId) {
      store.setFlowInputData(focusedFlowChainId, flowId, combined);
    }
  };

  // Property 추가
  const addProperty = (nodeType: string) => {
    if (!editMode) return;
    
    const defaultProperty = createDefaultProperty(nodeType);
    const newPropertyValue = serializeProperty(nodeType, defaultProperty);
    const newProperty: InputRow = { type: 'property', value: newPropertyValue };
    
    const currentProperties = editMode ? draftProperties : properties;
    updateProperties([...currentProperties, newProperty]);
  };

  // Property 제거
  const removeProperty = (idx: number) => {
    const currentProperties = editMode ? draftProperties : properties;
    updateProperties(currentProperties.filter((_, i) => i !== idx));
  };

  // Regular input 추가
  const addRegularInput = (row?: InputRow) => {
    if (!editMode) return;
    
    const currentRegularInputs = editMode ? draftRegularInputs : regularInputs;
    updateRegularInputs([...currentRegularInputs, row || { type: 'text', value: '' }]);
  };

  // Regular input 제거
  const removeRegularInput = (idx: number) => {
    const currentRegularInputs = editMode ? draftRegularInputs : regularInputs;
    if (currentRegularInputs.length === 1) return;
    updateRegularInputs(currentRegularInputs.filter((_, i) => i !== idx));
  };

  // Regular input 이동
  const moveRegularInput = (idx: number, dir: 'up' | 'down') => {
    const currentRegularInputs = editMode ? draftRegularInputs : regularInputs;
    const newInputs = [...currentRegularInputs];
    if (dir === 'up' && idx > 0) {
      [newInputs[idx - 1], newInputs[idx]] = [newInputs[idx], newInputs[idx - 1]];
    } else if (dir === 'down' && idx < newInputs.length - 1) {
      [newInputs[idx], newInputs[idx + 1]] = [newInputs[idx + 1], newInputs[idx]];
    }
    updateRegularInputs(newInputs);
  };

  // Regular input 타입 변경
  const setRegularInputType = (idx: number, type: InputType) => {
    const currentRegularInputs = editMode ? draftRegularInputs : regularInputs;
    const newInputs = [...currentRegularInputs];
    if (type === 'file') newInputs[idx] = { type, value: null };
    else if (type === 'flow-result') newInputs[idx] = {
      type,
      value: flowId,
      flowChainId: focusedFlowChainId || undefined,
      sourceFlowId: flowId
    };
    else newInputs[idx] = { type, value: '' };
    updateRegularInputs(newInputs);
  };

  // Property 값 변경 (Form UI 용)
  const handlePropertyChange = (idx: number, nodeType: string, propertyValue: any) => {
    const currentProperties = editMode ? draftProperties : properties;
    const newProperties = [...currentProperties];
    const newValue = serializeProperty(nodeType, propertyValue);
    newProperties[idx] = { ...newProperties[idx], value: newValue };
    updateProperties(newProperties);
  };

  // 파일 선택
  const handleFileChange = (idx: number, file: File | null) => {
    const currentRegularInputs = editMode ? draftRegularInputs : regularInputs;
    const newInputs = [...currentRegularInputs];
    newInputs[idx] = { type: 'file', value: file };
    updateRegularInputs(newInputs);
  };

  // 텍스트 입력
  const handleTextChange = (idx: number, value: string) => {
    const currentRegularInputs = editMode ? draftRegularInputs : regularInputs;
    const newInputs = [...currentRegularInputs];
    newInputs[idx] = { ...newInputs[idx], value };
    updateRegularInputs(newInputs);
  };

  // Shift+Enter로 Regular input 추가
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      addRegularInput();
    }
  };

  // 파일 드래그&드롭 지원
  const handleDrop = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const currentRegularInputs = editMode ? draftRegularInputs : regularInputs;
      const newInputs = [...currentRegularInputs];
      files.forEach((file, i) => {
        if (i === 0) newInputs[idx] = { type: 'file', value: file };
        else newInputs.push({ type: 'file', value: file });
      });
      updateRegularInputs(newInputs);
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
        forEachItems
      });
      
      // Flow의 실행 모드 설정 저장
      store.setFlowExecutionConfig(focusedFlowChainId, flowId, {
        mode: executionMode,
        commonInputs: executionMode === 'forEach' ? commonInputs : [],
        forEachItems: executionMode === 'forEach' ? forEachItems : []
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

  // SVG 아이콘
  const TrashIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
  );
  const UpIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
  );
  const DownIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
  );

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

  // ForEach 입력 관련 헬퍼 함수들
  const addCommonInput = (row?: InputRow) => {
    if (!editMode) return;
    setCommonInputs([...commonInputs, row || { type: 'text', value: '' }]);
  };

  const removeCommonInput = (idx: number) => {
    if (!editMode) return;
    setCommonInputs(commonInputs.filter((_, i) => i !== idx));
  };

  const setCommonInputType = (idx: number, type: InputType) => {
    if (!editMode) return;
    const newInputs = [...commonInputs];
    if (type === 'file') newInputs[idx] = { type, value: null };
    else if (type === 'flow-result') newInputs[idx] = {
      type,
      value: flowId,
      flowChainId: focusedFlowChainId || undefined,
      sourceFlowId: flowId
    };
    else newInputs[idx] = { type, value: '' };
    setCommonInputs(newInputs);
  };

  const handleCommonInputTextChange = (idx: number, value: string) => {
    if (!editMode) return;
    const newInputs = [...commonInputs];
    newInputs[idx] = { ...newInputs[idx], value };
    setCommonInputs(newInputs);
  };

  const handleCommonInputFileChange = (idx: number, file: File | null) => {
    if (!editMode) return;
    const newInputs = [...commonInputs];
    newInputs[idx] = { type: 'file', value: file };
    setCommonInputs(newInputs);
  };

  const addForEachItem = (row?: InputRow) => {
    if (!editMode) return;
    setForEachItems([...forEachItems, row || { type: 'text', value: '' }]);
  };

  const removeForEachItem = (idx: number) => {
    if (!editMode) return;
    setForEachItems(forEachItems.filter((_, i) => i !== idx));
  };

  const setForEachItemType = (idx: number, type: InputType) => {
    if (!editMode) return;
    const newItems = [...forEachItems];
    if (type === 'file') newItems[idx] = { type, value: null };
    else if (type === 'flow-result') newItems[idx] = {
      type,
      value: flowId,
      flowChainId: focusedFlowChainId || undefined,
      sourceFlowId: flowId
    };
    else newItems[idx] = { type, value: '' };
    setForEachItems(newItems);
  };

  const handleForEachItemTextChange = (idx: number, value: string) => {
    if (!editMode) return;
    const newItems = [...forEachItems];
    newItems[idx] = { ...newItems[idx], value };
    setForEachItems(newItems);
  };

  const handleForEachItemFileChange = (idx: number, file: File | null) => {
    if (!editMode) return;
    const newItems = [...forEachItems];
    newItems[idx] = { type: 'file', value: file };
    setForEachItems(newItems);
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

      {/* ========== Execution Mode Section ========== */}
      <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-white">
        <div className="mb-4">
          <h3 className="text-md font-medium text-gray-800 mb-3">Execution Mode</h3>
          <div className="flex gap-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="executionMode"
                value="batch"
                checked={executionMode === 'batch'}
                onChange={(e) => editMode && setExecutionMode(e.target.value as ExecutionMode)}
                disabled={!editMode}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">Batch Mode</span>
                <span className="text-xs text-gray-500">모든 입력을 한 번에 처리</span>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="executionMode"
                value="forEach"
                checked={executionMode === 'forEach'}
                onChange={(e) => editMode && setExecutionMode(e.target.value as ExecutionMode)}
                disabled={!editMode}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">ForEach Mode</span>
                <span className="text-xs text-gray-500">각 아이템을 순차적으로 처리</span>
              </div>
            </label>
          </div>
        </div>

        {executionMode === 'forEach' && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-800 mb-4 font-medium">
              ForEach 모드 설정
            </div>
            <div className="text-xs text-blue-600 mb-4">
              ForEach 모드에서는 입력을 CommonInputs와 Items로 분리합니다. 
              각 Item은 CommonInputs와 결합되어 순차적으로 실행됩니다.
            </div>
            
            {/* Common Inputs Section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-blue-800">Common Inputs</h4>
                {editMode && (
                  <div className="flex gap-2">
                    <button 
                      className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                      onClick={() => addCommonInput()}
                    >
                      + Text
                    </button>
                    <button 
                      className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                      onClick={() => addCommonInput({ type: 'file', value: null })}
                    >
                      + File
                    </button>
                    <button 
                      className="px-2 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600 transition-colors"
                      onClick={() => addCommonInput({ 
                        type: 'flow-result', 
                        value: flowId, 
                        flowChainId: focusedFlowChainId || undefined, 
                        sourceFlowId: flowId 
                      })}
                    >
                      + Flow Result
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {commonInputs.length === 0 ? (
                  <div className="text-xs text-blue-500 p-3 border-2 border-dashed border-blue-300 rounded text-center bg-blue-25">
                    공통 입력이 없습니다. 위의 버튼을 클릭하여 추가하세요.
                  </div>
                ) : (
                  commonInputs.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 bg-blue-25 rounded border border-blue-200">
                      {/* 타입 토글 */}
                      <div className="flex gap-1">
                        <button type="button" className={`px-2 py-1 rounded text-xs ${row.type === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} onClick={() => editMode && setCommonInputType(idx, 'text')} disabled={!editMode}>Text</button>
                        <button type="button" className={`px-2 py-1 rounded text-xs ${row.type === 'file' ? 'bg-green-100 text-green-700' : 'bg-white border'}`} onClick={() => editMode && setCommonInputType(idx, 'file')} disabled={!editMode}>File</button>
                        <button type="button" className={`px-2 py-1 rounded text-xs ${row.type === 'flow-result' ? 'bg-purple-100 text-purple-700' : 'bg-white border'}`} onClick={() => editMode && setCommonInputType(idx, 'flow-result')} disabled={!editMode}>Flow Result</button>
                      </div>
                      
                      {/* 입력 UI */}
                      {row.type === 'text' && (
                        <input
                          type="text"
                          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                          value={typeof row.value === 'string' ? row.value : ''}
                          onChange={(e) => handleCommonInputTextChange(idx, e.target.value)}
                          placeholder="공통 입력값"
                          readOnly={!editMode}
                        />
                      )}
                      
                      {row.type === 'file' && (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="file"
                            className="hidden"
                            id={`common-file-input-${idx}`}
                            onChange={e => editMode && handleCommonInputFileChange(idx, e.target.files ? e.target.files[0] : null)}
                            disabled={!editMode}
                          />
                          <button
                            type="button"
                            onClick={() => editMode && document.getElementById(`common-file-input-${idx}`)?.click()}
                            className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm hover:bg-gray-100"
                            disabled={!editMode}
                          >
                            파일 선택
                          </button>
                          {row.value && typeof row.value !== 'string' && (
                            <span className="text-sm text-gray-700">{(row.value as File).name}</span>
                          )}
                          {!row.value && <span className="text-gray-400 text-sm">파일을 선택하세요</span>}
                        </div>
                      )}
                      
                      {row.type === 'flow-result' && (
                        <div className="flex-1 flex gap-2">
                          {/* FlowChain 선택 */}
                          <select
                            className="border border-gray-300 rounded px-2 py-1 bg-gray-50 text-xs"
                            value={typeof row.flowChainId === 'string' ? row.flowChainId : ''}
                            onChange={e => {
                              if (!editMode) return;
                              const flowChainId = e.target.value;
                              const newInputs = [...commonInputs];
                              newInputs[idx] = { ...row, flowChainId, sourceFlowId: '', value: '' };
                              setCommonInputs(newInputs);
                            }}
                            disabled={!editMode || flowChainIds.length === 0}
                          >
                            <option value="">FlowChain 선택</option>
                            {flowChainIds
                              .filter(id => {
                                const currentChainIndex = flowChainIds.indexOf(String(focusedFlowChainId));
                                const targetChainIndex = flowChainIds.indexOf(id);
                                return targetChainIndex <= currentChainIndex;
                              })
                              .map(id => {
                                const isCurrentChain = id === focusedFlowChainId;
                                const name = flowChainMap[String(id)]?.name || id;
                                return (
                                  <option key={id} value={id}>
                                    {isCurrentChain ? `(현재)${name}` : name}
                                  </option>
                                );
                              })}
                          </select>
                          
                          {/* Flow 선택 */}
                          {row.flowChainId && flowChainMap[String(row.flowChainId || '')] && (
                            <select
                              className="border border-gray-300 rounded px-2 py-1 bg-gray-50 text-xs"
                              value={typeof row.sourceFlowId === 'string' ? row.sourceFlowId : ''}
                              onChange={e => {
                                if (!editMode) return;
                                const sourceFlowId = e.target.value;
                                const newInputs = [...commonInputs];
                                newInputs[idx] = { ...row, sourceFlowId, value: sourceFlowId };
                                setCommonInputs(newInputs);
                              }}
                              disabled={!editMode}
                            >
                              <option value="">Flow 선택</option>
                              <option value="__all__">[Flow Chain 전체 결과]</option>
                              <option value="__selected__">[Flow Chain 선택 결과]</option>
                              <option disabled>────────────</option>
                              {(() => {
                                const selectedChain = flowChainMap[String(row.flowChainId || '')];
                                const isCurrentChain = row.flowChainId === focusedFlowChainId;
                                
                                return selectedChain.flowIds
                                  .filter(fid => {
                                    if (isCurrentChain) {
                                      const currentFlowIndex = selectedChain.flowIds.indexOf(flowId);
                                      const targetFlowIndex = selectedChain.flowIds.indexOf(fid);
                                      return targetFlowIndex < currentFlowIndex;
                                    } else {
                                      return true;
                                    }
                                  })
                                  .map(fid => {
                                    const name = selectedChain.flowMap[fid]?.name || fid;
                                    return (
                                      <option key={fid} value={fid}>{name}</option>
                                    );
                                  });
                              })()}
                            </select>
                          )}
                        </div>
                      )}
                      
                      {editMode && (
                        <button 
                          onClick={() => removeCommonInput(idx)}
                          className="text-red-600 hover:bg-red-100 px-2 py-1 rounded text-xs transition-colors"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ForEach Items Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-blue-800">ForEach Items</h4>
                {editMode && (
                  <div className="flex gap-2">
                    <button 
                      className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                      onClick={() => addForEachItem()}
                    >
                      + Text
                    </button>
                    <button 
                      className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                      onClick={() => addForEachItem({ type: 'file', value: null })}
                    >
                      + File
                    </button>
                    <button 
                      className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                      onClick={() => addForEachItem({ 
                        type: 'flow-result', 
                        value: flowId, 
                        flowChainId: focusedFlowChainId || undefined, 
                        sourceFlowId: flowId 
                      })}
                    >
                      + Flow Result
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {forEachItems.length === 0 ? (
                  <div className="text-xs text-green-600 p-3 border-2 border-dashed border-green-300 rounded text-center bg-green-25">
                    ForEach 아이템이 없습니다. 위의 버튼을 클릭하여 추가하세요.
                  </div>
                ) : (
                  forEachItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 bg-green-25 rounded border border-green-200">
                      {/* 타입 토글 */}
                      <div className="flex gap-1">
                        <button type="button" className={`px-2 py-1 rounded text-xs ${item.type === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} onClick={() => editMode && setForEachItemType(idx, 'text')} disabled={!editMode}>Text</button>
                        <button type="button" className={`px-2 py-1 rounded text-xs ${item.type === 'file' ? 'bg-green-100 text-green-700' : 'bg-white border'}`} onClick={() => editMode && setForEachItemType(idx, 'file')} disabled={!editMode}>File</button>
                        <button type="button" className={`px-2 py-1 rounded text-xs ${item.type === 'flow-result' ? 'bg-purple-100 text-purple-700' : 'bg-white border'}`} onClick={() => editMode && setForEachItemType(idx, 'flow-result')} disabled={!editMode}>Flow Result</button>
                      </div>
                      
                      {/* 입력 UI */}
                      {item.type === 'text' && (
                        <input
                          type="text"
                          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-gray-50"
                          value={typeof item.value === 'string' ? item.value : ''}
                          onChange={(e) => handleForEachItemTextChange(idx, e.target.value)}
                          placeholder="ForEach 아이템"
                          readOnly={!editMode}
                        />
                      )}
                      
                      {item.type === 'file' && (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="file"
                            className="hidden"
                            id={`foreach-file-input-${idx}`}
                            onChange={e => editMode && handleForEachItemFileChange(idx, e.target.files ? e.target.files[0] : null)}
                            disabled={!editMode}
                          />
                          <button
                            type="button"
                            onClick={() => editMode && document.getElementById(`foreach-file-input-${idx}`)?.click()}
                            className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm hover:bg-gray-100"
                            disabled={!editMode}
                          >
                            파일 선택
                          </button>
                          {item.value && typeof item.value !== 'string' && (
                            <span className="text-sm text-gray-700">{(item.value as File).name}</span>
                          )}
                          {!item.value && <span className="text-gray-400 text-sm">파일을 선택하세요</span>}
                        </div>
                      )}
                      
                      {item.type === 'flow-result' && (
                        <div className="flex-1 flex gap-2">
                          {/* FlowChain 선택 */}
                          <select
                            className="border border-gray-300 rounded px-2 py-1 bg-gray-50 text-xs"
                            value={typeof item.flowChainId === 'string' ? item.flowChainId : ''}
                            onChange={e => {
                              if (!editMode) return;
                              const flowChainId = e.target.value;
                              const newItems = [...forEachItems];
                              newItems[idx] = { ...item, flowChainId, sourceFlowId: '', value: '' };
                              setForEachItems(newItems);
                            }}
                            disabled={!editMode || flowChainIds.length === 0}
                          >
                            <option value="">FlowChain 선택</option>
                            {flowChainIds
                              .filter(id => {
                                const currentChainIndex = flowChainIds.indexOf(String(focusedFlowChainId));
                                const targetChainIndex = flowChainIds.indexOf(id);
                                return targetChainIndex <= currentChainIndex;
                              })
                              .map(id => {
                                const isCurrentChain = id === focusedFlowChainId;
                                const name = flowChainMap[String(id)]?.name || id;
                                return (
                                  <option key={id} value={id}>
                                    {isCurrentChain ? `(현재)${name}` : name}
                                  </option>
                                );
                              })}
                          </select>
                          
                          {/* Flow 선택 */}
                          {item.flowChainId && flowChainMap[String(item.flowChainId || '')] && (
                            <select
                              className="border border-gray-300 rounded px-2 py-1 bg-gray-50 text-xs"
                              value={typeof item.sourceFlowId === 'string' ? item.sourceFlowId : ''}
                              onChange={e => {
                                if (!editMode) return;
                                const sourceFlowId = e.target.value;
                                const newItems = [...forEachItems];
                                newItems[idx] = { ...item, sourceFlowId, value: sourceFlowId };
                                setForEachItems(newItems);
                              }}
                              disabled={!editMode}
                            >
                              <option value="">Flow 선택</option>
                              <option value="__all__">[Flow Chain 전체 결과]</option>
                              <option value="__selected__">[Flow Chain 선택 결과]</option>
                              <option disabled>────────────</option>
                              {(() => {
                                const selectedChain = flowChainMap[String(item.flowChainId || '')];
                                const isCurrentChain = item.flowChainId === focusedFlowChainId;
                                
                                return selectedChain.flowIds
                                  .filter(fid => {
                                    if (isCurrentChain) {
                                      const currentFlowIndex = selectedChain.flowIds.indexOf(flowId);
                                      const targetFlowIndex = selectedChain.flowIds.indexOf(fid);
                                      return targetFlowIndex < currentFlowIndex;
                                    } else {
                                      return true;
                                    }
                                  })
                                  .map(fid => {
                                    const name = selectedChain.flowMap[fid]?.name || fid;
                                    return (
                                      <option key={fid} value={fid}>{name}</option>
                                    );
                                  });
                              })()}
                            </select>
                          )}
                        </div>
                      )}
                      
                      {editMode && (
                        <button 
                          onClick={() => removeForEachItem(idx)}
                          className="text-red-600 hover:bg-red-100 px-2 py-1 rounded text-xs transition-colors"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* ========== Property Section ========== */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-md font-medium text-gray-800">Node Properties</h3>
          {editMode && (
            <div className="flex gap-2">
              <button 
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm"
                onClick={() => addProperty('llm')}
              >
                + LLM
              </button>
              <button 
                className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm"
                onClick={() => addProperty('api')}
              >
                + API
              </button>
              <button 
                className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm"
                onClick={() => addProperty('web-crawler')}
              >
                + Web Crawler
              </button>
            </div>
          )}
        </div>
        
        {(editMode ? draftProperties : properties).length === 0 ? (
          <div className="text-gray-400 text-sm p-4 border-2 border-dashed border-gray-200 rounded text-center">
            노드 속성이 없습니다. 위의 버튼을 클릭하여 추가하세요.
          </div>
        ) : (
          <div className="space-y-4">
            {(editMode ? draftProperties : properties).map((property, idx) => {
              const parsed = parseProperty(property.value as string);
              if (!parsed) {
                return (
                  <div key={idx} className="p-4 border border-red-200 rounded bg-red-50">
                    <div className="flex justify-between items-center">
                      <span className="text-red-600 text-sm">잘못된 Property 형식</span>
                      {editMode && (
                        <button 
                          onClick={() => removeProperty(idx)}
                          className="text-red-600 hover:bg-red-100 p-1 rounded"
                        >
                          {TrashIcon}
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              const { nodeType, property: propertyValue } = parsed;
              
              return (
                <div key={idx} className="relative">
                  {editMode && (
                    <button 
                      onClick={() => removeProperty(idx)}
                      className="absolute top-2 right-2 z-10 text-red-600 hover:bg-red-100 p-1 rounded"
                    >
                      {TrashIcon}
                    </button>
                  )}
                  {nodeType === 'llm' && (
                    <LLMPropertyForm
                      value={propertyValue as LLMProperty}
                      onChange={(newValue) => handlePropertyChange(idx, 'llm', newValue)}
                      disabled={!editMode}
                    />
                  )}
                  {nodeType === 'api' && (
                    <APIPropertyForm
                      value={propertyValue as APIProperty}
                      onChange={(newValue) => handlePropertyChange(idx, 'api', newValue)}
                      disabled={!editMode}
                    />
                  )}
                  {nodeType === 'web-crawler' && (
                    <WebCrawlerPropertyForm
                      value={propertyValue as WebCrawlerProperty}
                      onChange={(newValue) => handlePropertyChange(idx, 'web-crawler', newValue)}
                      disabled={!editMode}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========== Input Data Section ========== */}
      {executionMode === 'batch' ? (
        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-medium text-gray-800">Input Data</h3>
            {editMode && (
              <div className="flex gap-2">
                <button type="button" onClick={() => addRegularInput()} className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors">+ Text</button>
                <button type="button" onClick={() => addRegularInput({ type: 'file', value: null })} className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors">+ File</button>
                <button type="button" onClick={() => addRegularInput({ 
                  type: 'flow-result', 
                  value: flowId, 
                  flowChainId: focusedFlowChainId || undefined, 
                  sourceFlowId: flowId 
                })} className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 transition-colors">+ Flow Result</button>
              </div>
            )}
          </div>
          <div className="text-gray-500 text-sm mb-4">배치 모드에서는 모든 입력을 한 번에 처리합니다.</div>
          
          <div className="space-y-3">
            {(editMode ? draftRegularInputs : regularInputs).map((row, idx) => (
              <div key={idx} className="flex items-center gap-2 p-3 bg-gray-25 rounded border border-gray-200" onDrop={e => handleDrop(idx, e)} onDragOver={e => e.preventDefault()}>
                {/* 타입 토글 */}
                <div className="flex gap-1">
                  <button type="button" className={`px-2 py-1 rounded text-sm ${row.type === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} onClick={() => editMode && setRegularInputType(idx, 'text')} disabled={!editMode}>Text</button>
                  <button type="button" className={`px-2 py-1 rounded text-sm ${row.type === 'file' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} onClick={() => {
                    if (!editMode) return;
                    setRegularInputType(idx, 'file');
                    setTimeout(() => fileInputRefs.current[idx]?.click(), 0);
                  }} disabled={!editMode}>File</button>
                  <button type="button" className={`px-2 py-1 rounded text-sm ${row.type === 'flow-result' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} onClick={() => editMode && setRegularInputType(idx, 'flow-result')} disabled={!editMode}>Flow Result</button>
                </div>
                
                {/* 입력 UI */}
                {row.type === 'text' && (
                  <textarea
                    className="flex-1 border border-gray-300 rounded px-3 py-2 bg-gray-50 resize-none"
                    rows={2}
                    maxLength={500}
                    value={typeof row.value === 'string' ? row.value : ''}
                    onChange={e => editMode && handleTextChange(idx, e.target.value)}
                    onKeyDown={e => editMode && handleKeyDown(e)}
                    placeholder="입력값을 입력하세요"
                    readOnly={!editMode}
                    style={{ minHeight: '2.5rem', maxHeight: '4.5rem', overflow: 'auto' }}
                  />
                )}
                
                {row.type === 'file' && (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="file"
                      className="hidden"
                      id={`file-input-${idx}`}
                      ref={el => fileInputRefs.current[idx] = el}
                      onChange={e => editMode && handleFileChange(idx, e.target.files ? e.target.files[0] : null)}
                      disabled={!editMode}
                    />
                    <button
                      type="button"
                      onClick={() => editMode && fileInputRefs.current[idx]?.click()}
                      className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm hover:bg-gray-100"
                      disabled={!editMode}
                    >
                      파일 선택
                    </button>
                    {row.value && typeof row.value !== 'string' && (
                      <span className="text-sm text-gray-700">{(row.value as File).name}</span>
                    )}
                    {!row.value && <span className="text-gray-400 text-sm">파일을 선택하세요</span>}
                  </div>
                )}
                
                {row.type === 'flow-result' && (
                  <div className="flex-1 flex gap-2">
                    {/* FlowChain 선택 */}
                    <select
                      className="border border-gray-300 rounded px-2 py-1 bg-gray-50"
                      value={typeof row.flowChainId === 'string' ? row.flowChainId : ''}
                      onChange={e => {
                        if (!editMode) return;
                        const flowChainId = e.target.value;
                        const currentRegularInputs = editMode ? draftRegularInputs : regularInputs;
                        const newInputs = [...currentRegularInputs];
                        newInputs[idx] = { ...row, flowChainId, sourceFlowId: '', value: '' };
                        updateRegularInputs(newInputs);
                      }}
                      disabled={!editMode || flowChainIds.length === 0}
                    >
                      <option value="">FlowChain 선택</option>
                      {flowChainIds
                        .filter(id => {
                          const currentChainIndex = flowChainIds.indexOf(String(focusedFlowChainId));
                          const targetChainIndex = flowChainIds.indexOf(id);
                          return targetChainIndex <= currentChainIndex;
                        })
                        .map(id => {
                          const isCurrentChain = id === focusedFlowChainId;
                          const name = flowChainMap[String(id)]?.name || id;
                          return (
                            <option key={id} value={id}>
                              {isCurrentChain ? `(현재)${name}` : name}
                            </option>
                          );
                        })}
                    </select>
                    
                    {/* Flow 선택 */}
                    {row.flowChainId && flowChainMap[String(row.flowChainId || '')] && (
                      <select
                        className="border border-gray-300 rounded px-2 py-1 bg-gray-50"
                        value={typeof row.sourceFlowId === 'string' ? row.sourceFlowId : ''}
                        onChange={e => {
                          if (!editMode) return;
                          const sourceFlowId = e.target.value;
                          const currentRegularInputs = editMode ? draftRegularInputs : regularInputs;
                          const newInputs = [...currentRegularInputs];
                          newInputs[idx] = { ...row, sourceFlowId, value: sourceFlowId };
                          updateRegularInputs(newInputs);
                        }}
                        disabled={!editMode}
                      >
                        <option value="">Flow 선택</option>
                        <option value="__all__">[Flow Chain 전체 결과]</option>
                        <option value="__selected__">[Flow Chain 선택 결과]</option>
                        <option disabled>────────────</option>
                        {(() => {
                          const selectedChain = flowChainMap[String(row.flowChainId || '')];
                          const isCurrentChain = row.flowChainId === focusedFlowChainId;
                          
                          return selectedChain.flowIds
                            .filter(fid => {
                              if (isCurrentChain) {
                                const currentFlowIndex = selectedChain.flowIds.indexOf(flowId);
                                const targetFlowIndex = selectedChain.flowIds.indexOf(fid);
                                return targetFlowIndex < currentFlowIndex;
                              } else {
                                return true;
                              }
                            })
                            .map(fid => {
                              const name = selectedChain.flowMap[fid]?.name || fid;
                              return (
                                <option key={fid} value={fid}>{name}</option>
                              );
                            });
                        })()}
                      </select>
                    )}
                  </div>
                )}
                
                {/* 위/아래/삭제 */}
                <div className="flex gap-1 ml-2">
                  <button type="button" onClick={() => moveRegularInput(idx, 'up')} disabled={!editMode || idx === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-50">{UpIcon}</button>
                  <button type="button" onClick={() => moveRegularInput(idx, 'down')} disabled={!editMode || idx === regularInputs.length - 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-50">{DownIcon}</button>
                  <button type="button" onClick={() => removeRegularInput(idx)} disabled={!editMode || regularInputs.length === 1} className="p-1 rounded hover:bg-red-100 disabled:opacity-50">{TrashIcon}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
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