import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import FlowResultDisplay from './FlowResultDisplay';
import type { InputRow, InputType } from '../../types/flow/InputRow';
import { extractFlowResultText } from '../../utils/flowResultUtils';
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
    
    if (focusedFlowChainId && flowId) {
      console.log('[FlowInputForm] 저장 시점:', { chainId: focusedFlowChainId, flowId, properties: draftProperties, regularInputs: draftRegularInputs });
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

  useImperativeHandle(ref, () => ({
    getFinalInputData,
    getExecutableInputs,
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
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-md font-medium text-gray-800">Input Data</h3>
        </div>
        <div className="text-gray-400 text-sm mb-4">입력값을 추가하세요</div>
        
        <div className="space-y-2 mb-4">
          {(editMode ? draftRegularInputs : regularInputs).map((row, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded" onDrop={e => handleDrop(idx, e)} onDragOver={e => e.preventDefault()}>
              {/* 타입 토글 */}
              <div className="flex gap-1">
                <button type="button" className={`px-2 py-1 rounded ${row.type === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} onClick={() => editMode && setRegularInputType(idx, 'text')} disabled={!editMode}>Text</button>
                <button type="button" className={`px-2 py-1 rounded ${row.type === 'file' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} onClick={() => {
                  if (!editMode) return;
                  setRegularInputType(idx, 'file');
                  setTimeout(() => fileInputRefs.current[idx]?.click(), 0);
                }} disabled={!editMode}>File</button>
                <button type="button" className={`px-2 py-1 rounded ${row.type === 'flow-result' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} onClick={() => editMode && setRegularInputType(idx, 'flow-result')} disabled={!editMode}>Flow Result</button>
              </div>
              
              {/* 입력 UI */}
              {row.type === 'text' && (
                <textarea
                  className="flex-1 border border-gray-300 rounded px-2 py-1 bg-white resize-none"
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
                    className="border border-gray-300 rounded px-2 py-1 bg-white"
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
                      className="border border-gray-300 rounded px-2 py-1 bg-white"
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
        
        {/* 입력 추가 버튼 */}
        {editMode && (
          <div className="flex justify-end mb-2">
            <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded" onClick={() => addRegularInput()}>+ 입력 추가</button>
          </div>
        )}
      </div>

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