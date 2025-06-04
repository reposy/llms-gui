import React from 'react';
import type { InputRow, InputType } from '../../../types/flow/InputRow';
import { 
  LLMPropertyForm, 
  APIPropertyForm, 
  WebCrawlerPropertyForm,
  parseProperty,
  createDefaultProperty,
  serializeProperty,
  type LLMProperty,
  type APIProperty,
  type WebCrawlerProperty
} from '../PropertyForms';

interface ForEachConfigSectionProps {
  commonInputs: InputRow[];
  forEachItems: InputRow[];
  onCommonInputsChange: (inputs: InputRow[]) => void;
  onForEachItemsChange: (items: InputRow[]) => void;
  editMode: boolean;
  flowId: string;
  focusedFlowChainId?: string;
  flowChainIds: string[];
  flowChainMap: Record<string, any>;
}

const ForEachConfigSection: React.FC<ForEachConfigSectionProps> = ({
  commonInputs,
  forEachItems,
  onCommonInputsChange,
  onForEachItemsChange,
  editMode,
  flowId,
  focusedFlowChainId,
  flowChainIds,
  flowChainMap
}) => {
  // Common Inputs 헬퍼 함수들
  const addCommonInput = (row?: InputRow) => {
    if (!editMode) return;
    onCommonInputsChange([...commonInputs, row || { type: 'text', value: '' }]);
  };

  const removeCommonInput = (idx: number) => {
    if (!editMode) return;
    onCommonInputsChange(commonInputs.filter((_, i) => i !== idx));
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
    else if (type === 'property') newInputs[idx] = { type, value: '' };
    else newInputs[idx] = { type, value: '' };
    onCommonInputsChange(newInputs);
  };

  const handleCommonInputTextChange = (idx: number, value: string) => {
    if (!editMode) return;
    const newInputs = [...commonInputs];
    newInputs[idx] = { ...newInputs[idx], value };
    onCommonInputsChange(newInputs);
  };

  const handleCommonInputFileChange = (idx: number, files: FileList | null) => {
    if (!editMode || !files) return;
    
    const newInputs = [...commonInputs];
    const fileArray = Array.from(files);
    
    if (fileArray.length === 0) {
      // 파일이 선택되지 않은 경우
      newInputs[idx] = { type: 'file', value: null };
    } else if (fileArray.length === 1) {
      // 단일 파일 선택
      newInputs[idx] = { type: 'file', value: fileArray[0] };
    } else {
      // 다중 파일 선택: 첫 번째 파일로 현재 row 업데이트, 나머지는 새 row 추가
      newInputs[idx] = { type: 'file', value: fileArray[0] };
      
      const additionalRows = fileArray.slice(1).map(file => ({
        type: 'file' as const,
        value: file
      }));
      
      newInputs.splice(idx + 1, 0, ...additionalRows);
    }
    
    onCommonInputsChange(newInputs);
  };

  const handleCommonInputPropertyChange = (idx: number, nodeType: string, propertyValue: any) => {
    if (!editMode) return;
    const newInputs = [...commonInputs];
    const newValue = serializeProperty(nodeType, propertyValue);
    newInputs[idx] = { ...newInputs[idx], value: newValue };
    onCommonInputsChange(newInputs);
  };

  // ForEach Items 헬퍼 함수들
  const addForEachItem = (row?: InputRow) => {
    if (!editMode) return;
    onForEachItemsChange([...forEachItems, row || { type: 'text', value: '' }]);
  };

  const removeForEachItem = (idx: number) => {
    if (!editMode) return;
    onForEachItemsChange(forEachItems.filter((_, i) => i !== idx));
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
    else if (type === 'property') newItems[idx] = { type, value: '' };
    else newItems[idx] = { type, value: '' };
    onForEachItemsChange(newItems);
  };

  const handleForEachItemTextChange = (idx: number, value: string) => {
    if (!editMode) return;
    const newItems = [...forEachItems];
    newItems[idx] = { ...newItems[idx], value };
    onForEachItemsChange(newItems);
  };

  const handleForEachItemFileChange = (idx: number, files: FileList | null) => {
    if (!editMode || !files) return;
    
    const newItems = [...forEachItems];
    const fileArray = Array.from(files);
    
    if (fileArray.length === 0) {
      // 파일이 선택되지 않은 경우
      newItems[idx] = { type: 'file', value: null };
    } else if (fileArray.length === 1) {
      // 단일 파일 선택
      newItems[idx] = { type: 'file', value: fileArray[0] };
    } else {
      // 다중 파일 선택: 첫 번째 파일로 현재 row 업데이트, 나머지는 새 row 추가
      newItems[idx] = { type: 'file', value: fileArray[0] };
      
      const additionalRows = fileArray.slice(1).map(file => ({
        type: 'file' as const,
        value: file
      }));
      
      newItems.splice(idx + 1, 0, ...additionalRows);
    }
    
    onForEachItemsChange(newItems);
  };

  const handleForEachItemPropertyChange = (idx: number, nodeType: string, propertyValue: any) => {
    if (!editMode) return;
    const newItems = [...forEachItems];
    const newValue = serializeProperty(nodeType, propertyValue);
    newItems[idx] = { ...newItems[idx], value: newValue };
    onForEachItemsChange(newItems);
  };

  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div className="text-sm text-blue-800 mb-4 font-medium">
        ForEach 모드 설정
      </div>
      <div className="text-xs text-blue-600 mb-4">
        ForEach 모드에서는 입력을 CommonInputs와 Items로 분리합니다. 
        각 Item은 CommonInputs와 결합되어 순차적으로 실행됩니다.<br/>
        <span className="text-blue-700">💡 파일 선택 시 여러 파일을 선택하면 각 파일마다 별도의 Input Row가 생성됩니다.</span>
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
              <div className="border-l border-gray-300 mx-2"></div>
              <button 
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
                onClick={() => addCommonInput({ type: 'property', value: serializeProperty('llm', createDefaultProperty('llm')) })}
              >
                + LLM
              </button>
              <button 
                className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors"
                onClick={() => addCommonInput({ type: 'property', value: serializeProperty('api', createDefaultProperty('api')) })}
              >
                + API
              </button>
              <button 
                className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200 transition-colors"
                onClick={() => addCommonInput({ type: 'property', value: serializeProperty('web-crawler', createDefaultProperty('web-crawler')) })}
              >
                + Web Crawler
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
                  <button type="button" className={`px-2 py-1 rounded text-xs ${row.type === 'property' ? 'bg-orange-100 text-orange-700' : 'bg-white border'}`} onClick={() => editMode && setCommonInputType(idx, 'property')} disabled={!editMode}>Property</button>
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
                      onChange={e => editMode && handleCommonInputFileChange(idx, e.target.files)}
                      disabled={!editMode}
                      multiple
                    />
                    <button
                      type="button"
                      onClick={() => editMode && document.getElementById(`common-file-input-${idx}`)?.click()}
                      className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm hover:bg-gray-100"
                      disabled={!editMode}
                    >
                      파일 선택 (다중 가능)
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
                        onCommonInputsChange(newInputs);
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
                          onCommonInputsChange(newInputs);
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
                            .filter((fid: string) => {
                              if (isCurrentChain) {
                                const currentFlowIndex = selectedChain.flowIds.indexOf(flowId);
                                const targetFlowIndex = selectedChain.flowIds.indexOf(fid);
                                return targetFlowIndex < currentFlowIndex;
                              } else {
                                return true;
                              }
                            })
                            .map((fid: string) => {
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
                
                {row.type === 'property' && (
                  <div className="flex-1">
                    {(() => {
                      const parsed = parseProperty(row.value as string);
                      if (!parsed) {
                        return (
                          <div className="text-red-600 text-sm p-2 border border-red-200 rounded bg-red-50">
                            잘못된 Property 형식
                          </div>
                        );
                      }
                      
                      const { nodeType, property: propertyValue } = parsed;
                      
                      return (
                        <div className="p-2 border border-gray-200 rounded bg-gray-50">
                          {nodeType === 'llm' && (
                            <LLMPropertyForm
                              value={propertyValue as LLMProperty}
                              onChange={(newValue) => handleCommonInputPropertyChange(idx, 'llm', newValue)}
                              disabled={!editMode}
                            />
                          )}
                          {nodeType === 'api' && (
                            <APIPropertyForm
                              value={propertyValue as APIProperty}
                              onChange={(newValue) => handleCommonInputPropertyChange(idx, 'api', newValue)}
                              disabled={!editMode}
                            />
                          )}
                          {nodeType === 'web-crawler' && (
                            <WebCrawlerPropertyForm
                              value={propertyValue as WebCrawlerProperty}
                              onChange={(newValue) => handleCommonInputPropertyChange(idx, 'web-crawler', newValue)}
                              disabled={!editMode}
                            />
                          )}
                        </div>
                      );
                    })()}
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
              <div className="border-l border-gray-300 mx-2"></div>
              <button 
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
                onClick={() => addForEachItem({ type: 'property', value: serializeProperty('llm', createDefaultProperty('llm')) })}
              >
                + LLM
              </button>
              <button 
                className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors"
                onClick={() => addForEachItem({ type: 'property', value: serializeProperty('api', createDefaultProperty('api')) })}
              >
                + API
              </button>
              <button 
                className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200 transition-colors"
                onClick={() => addForEachItem({ type: 'property', value: serializeProperty('web-crawler', createDefaultProperty('web-crawler')) })}
              >
                + Web Crawler
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
                  <button type="button" className={`px-2 py-1 rounded text-xs ${item.type === 'property' ? 'bg-orange-100 text-orange-700' : 'bg-white border'}`} onClick={() => editMode && setForEachItemType(idx, 'property')} disabled={!editMode}>Property</button>
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
                      onChange={e => editMode && handleForEachItemFileChange(idx, e.target.files)}
                      disabled={!editMode}
                      multiple
                    />
                    <button
                      type="button"
                      onClick={() => editMode && document.getElementById(`foreach-file-input-${idx}`)?.click()}
                      className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm hover:bg-gray-100"
                      disabled={!editMode}
                    >
                      파일 선택 (다중 가능)
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
                        onForEachItemsChange(newItems);
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
                          onForEachItemsChange(newItems);
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
                            .filter((fid: string) => {
                              if (isCurrentChain) {
                                const currentFlowIndex = selectedChain.flowIds.indexOf(flowId);
                                const targetFlowIndex = selectedChain.flowIds.indexOf(fid);
                                return targetFlowIndex < currentFlowIndex;
                              } else {
                                return true;
                              }
                            })
                            .map((fid: string) => {
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
                
                {item.type === 'property' && (
                  <div className="flex-1">
                    {(() => {
                      const parsed = parseProperty(item.value as string);
                      if (!parsed) {
                        return (
                          <div className="text-red-600 text-sm p-2 border border-red-200 rounded bg-red-50">
                            잘못된 Property 형식
                          </div>
                        );
                      }
                      
                      const { nodeType, property: propertyValue } = parsed;
                      
                      return (
                        <div className="p-2 border border-gray-200 rounded bg-gray-50">
                          {nodeType === 'llm' && (
                            <LLMPropertyForm
                              value={propertyValue as LLMProperty}
                              onChange={(newValue) => handleForEachItemPropertyChange(idx, 'llm', newValue)}
                              disabled={!editMode}
                            />
                          )}
                          {nodeType === 'api' && (
                            <APIPropertyForm
                              value={propertyValue as APIProperty}
                              onChange={(newValue) => handleForEachItemPropertyChange(idx, 'api', newValue)}
                              disabled={!editMode}
                            />
                          )}
                          {nodeType === 'web-crawler' && (
                            <WebCrawlerPropertyForm
                              value={propertyValue as WebCrawlerProperty}
                              onChange={(newValue) => handleForEachItemPropertyChange(idx, 'web-crawler', newValue)}
                              disabled={!editMode}
                            />
                          )}
                        </div>
                      );
                    })()}
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
  );
};

export default ForEachConfigSection; 