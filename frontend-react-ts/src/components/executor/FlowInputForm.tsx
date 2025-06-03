import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import FlowResultDisplay from './FlowResultDisplay';
import type { InputRow, InputType } from '../../types/flow/InputRow';
import { extractFlowResultText } from '../../utils/flowResultUtils';

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

// Property 템플릿 정의
const getPropertyTemplate = (nodeType: string): Record<string, any> => {
  switch (nodeType) {
    case 'llm':
      return {
        provider: 'ollama',
        model: '',
        prompt: '{{input}}',
        temperature: 0.7,
        mode: 'text'
      };
    case 'api':
      return {
        url: '',
        method: 'GET',
        headers: {},
        contentType: 'application/json'
      };
    case 'web-crawler':
      return {
        url: '',
        timeout: 30000,
        waitForSelectorOnPage: '',
        outputFormat: 'html'
      };
    default:
      return {};
  }
};

// Property 객체 파싱 및 생성 헬퍼
const parsePropertyValue = (value: string): { nodeType: string; property: Record<string, any> } | null => {
  try {
    const parsed = JSON.parse(value || '{}');
    if (parsed && typeof parsed === 'object' && 'nodeType' in parsed && 'property' in parsed) {
      return parsed;
    }
  } catch (error) {
    // 파싱 실패는 무시
  }
  return null;
};

const createPropertyValue = (nodeType: string, property: Record<string, any>): string => {
  return JSON.stringify({ nodeType, property }, null, 2);
};

const FlowInputForm = forwardRef<FlowInputFormRef, FlowInputFormProps>(({ flowId, inputs: propInputs, onInputChange }, ref) => {
  const store = useFlowExecutorStore();
  const focusedFlowChainId = store.focusedFlowChainId;
  const flowChainMap = store.flowChainMap;
  const flowChainIds = store.flowChainIds;
  const chain = focusedFlowChainId ? flowChainMap[focusedFlowChainId] : undefined;
  const flow = chain && flowId ? chain.flowMap[flowId] : undefined;

  // store의 값을 직접 구독 (propInputs가 없으면)
  const initialRows = propInputs && propInputs.length > 0 ? propInputs : (flow?.inputs && flow.inputs.length > 0 ? flow.inputs : [{ type: 'text', value: '' }]);
  const [rows, setRows] = useState<InputRow[]>(initialRows);
  const [editMode, setEditMode] = useState(true);
  const [draftInputs, setDraftInputs] = useState<InputRow[]>(rows);

  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (propInputs) setRows(propInputs);
    else if (flow && flow.inputs) setRows(flow.inputs);
  }, [propInputs, flow]);

  useEffect(() => {
    setDraftInputs(rows);
  }, [rows]);

  // 모달이 열릴 때마다(즉, flowId, propInputs 등 주요 prop이 바뀔 때마다) editMode를 true로 리셋
  useEffect(() => {
    setEditMode(true);
  }, [flowId, propInputs]);

  // 입력 변경 핸들러
  const updateRows = (newRows: InputRow[]) => {
    setRows(newRows);
    if (onInputChange) onInputChange(newRows);
    if (focusedFlowChainId && flowId) {
      store.setFlowInputData(focusedFlowChainId, flowId, newRows);
    }
  };

  // Row 추가
  const addRow = (row?: InputRow) => {
    updateRows([...rows, row || { type: 'text', value: '' }]);
  };

  // Row 삭제
  const removeRow = (idx: number) => {
    if (rows.length === 1) return;
    updateRows(rows.filter((_, i) => i !== idx));
  };

  // Row 이동
  const moveRow = (idx: number, dir: 'up' | 'down') => {
    const newRows = [...rows];
    if (dir === 'up' && idx > 0) {
      [newRows[idx - 1], newRows[idx]] = [newRows[idx], newRows[idx - 1]];
    } else if (dir === 'down' && idx < newRows.length - 1) {
      [newRows[idx], newRows[idx + 1]] = [newRows[idx + 1], newRows[idx]];
    }
    updateRows(newRows);
  };

  // 타입 전환
  const setType = (idx: number, type: InputType) => {
    const newRows = [...rows];
    if (type === 'file') newRows[idx] = { type, value: null };
    else if (type === 'flow-result') newRows[idx] = {
      type,
      value: flowId,
      flowChainId: focusedFlowChainId || undefined,
      sourceFlowId: flowId
    };
    else if (type === 'property') newRows[idx] = { 
      type, 
      value: JSON.stringify({
        nodeType: '',
        property: {}
      }, null, 2)
    };
    else newRows[idx] = { type, value: '' };
    updateRows(newRows);
  };

  // 파일 선택
  const handleFileChange = (idx: number, file: File | null) => {
    const newRows = [...rows];
    newRows[idx] = { type: 'file', value: file };
    updateRows(newRows);
  };

  // 텍스트 입력
  const handleTextChange = (idx: number, value: string) => {
    const newRows = [...rows];
    newRows[idx] = { type: 'text', value };
    updateRows(newRows);
  };

  // Property 타입의 nodeType 변경 핸들러
  const handlePropertyNodeTypeChange = (idx: number, nodeType: string) => {
    const newRows = [...rows];
    const template = getPropertyTemplate(nodeType);
    const newValue = createPropertyValue(nodeType, template);
    newRows[idx] = { ...newRows[idx], value: newValue };
    updateRows(newRows);
  };

  // Shift+Enter로 Row 추가
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      addRow();
    }
  };

  // 파일 드래그&드롭 지원
  const handleDrop = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const newRows = [...rows];
      files.forEach((file, i) => {
        if (i === 0) newRows[idx] = { type: 'file', value: file };
        else newRows.push({ type: 'file', value: file });
      });
      updateRows(newRows);
    }
  };

  // 저장 버튼 클릭 시 store에 반영
  const handleSave = () => {
    setEditMode(false);
    if (focusedFlowChainId && flowId) {
      console.log('[FlowInputForm] 저장 시점:', { chainId: focusedFlowChainId, flowId, draftInputs });
      store.setFlowInputData(focusedFlowChainId, flowId, draftInputs);
      // 저장 직후 상태 확인
      setTimeout(() => {
        const updated = store.flowChainMap[focusedFlowChainId]?.flowMap[flowId]?.inputs;
        console.log('[FlowInputForm] 저장 후 store 상태:', updated);
      }, 100);
    }
    if (onInputChange) onInputChange(draftInputs);
  };

  const handleCancel = () => {
    setEditMode(false);
    setDraftInputs(rows);
  };

  // SVG 아이콘 (프로젝트 내 선언된 것 사용 예시)
  const TrashIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
  );
  const UpIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
  );
  const DownIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
  );

  // Flow 결과 가져오기 (store에서)
  const flowResult = flow && Array.isArray(flow.lastResults)
    ? { status: flow.status, outputs: flow.lastResults, error: flow.error, flowId: flow.id }
    : null;

  // 실행을 위한 입력 데이터 변환 함수 (flow-result를 실제 데이터로 변환)
  const getExecutableInputs = (): any[] => {
    return rows.map((row) => {
      if (row.type === 'flow-result') {
        return extractFlowResultText(row, flowChainMap);
      } else if (row.type === 'property') {
        // JSON 문자열을 동적 속성 객체로 파싱
        try {
          const parsed = JSON.parse(row.value as string || '{}');
          // DynamicPropertyInput 형태인지 검증
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
        // File 객체 그대로 반환
        return row.value;
      } else {
        // 텍스트 값 그대로 반환
        return row.value;
      }
    });
  };

  // Flow 실행을 위한 최종 입력 데이터 생성
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
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-medium">Input Data</h2>
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
      <div className="flex items-center gap-2 mb-4">
        <div className="text-gray-400 text-sm flex-1">입력값을 추가하세요</div>
      </div>
      <div className="space-y-2 mb-4">
      {rows.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded" onDrop={e => handleDrop(idx, e)} onDragOver={e => e.preventDefault()}>
          {/* 타입 토글 */}
          <div className="flex gap-1">
            <button type="button" className={`px-2 py-1 rounded ${row.type === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} onClick={() => editMode && setType(idx, 'text')} disabled={!editMode}>Text</button>
              <button type="button" className={`px-2 py-1 rounded ${row.type === 'file' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} onClick={() => {
                if (!editMode) return;
                setType(idx, 'file');
                setTimeout(() => fileInputRefs.current[idx]?.click(), 0);
              }} disabled={!editMode}>File</button>
            <button type="button" className={`px-2 py-1 rounded ${row.type === 'flow-result' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} onClick={() => editMode && setType(idx, 'flow-result')} disabled={!editMode}>Flow Result</button>
            <button type="button" className={`px-2 py-1 rounded ${row.type === 'property' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} onClick={() => editMode && setType(idx, 'property')} disabled={!editMode}>Property</button>
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
          {row.type === 'property' && (
            <div className="flex-1 flex flex-col gap-2">
              {/* nodeType 선택 */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 min-w-0 flex-shrink-0">Node Type:</label>
                <select
                  className="border border-gray-300 rounded px-2 py-1 bg-white text-sm"
                  value={(() => {
                    const parsed = parsePropertyValue(row.value as string);
                    return parsed?.nodeType || '';
                  })()}
                  onChange={e => editMode && handlePropertyNodeTypeChange(idx, e.target.value)}
                  disabled={!editMode}
                >
                  <option value="">선택하세요</option>
                  <option value="llm">LLM</option>
                  <option value="api">API</option>
                  <option value="web-crawler">Web Crawler</option>
                </select>
              </div>
              {/* JSON 입력 */}
              <textarea
                className="flex-1 border border-gray-300 rounded px-2 py-1 bg-white font-mono text-sm"
                rows={6}
                value={typeof row.value === 'string' ? row.value : ''}
                onChange={e => editMode && handleTextChange(idx, e.target.value)}
                placeholder="위에서 Node Type을 선택하면 템플릿이 자동으로 생성됩니다.&#10;&#10;수동 입력 예시:&#10;{&#10;  &quot;nodeType&quot;: &quot;llm&quot;,&#10;  &quot;property&quot;: {&#10;    &quot;model&quot;: &quot;gpt-4&quot;,&#10;    &quot;prompt&quot;: &quot;{{input}}&quot;&#10;  }&#10;}"
                readOnly={!editMode}
                style={{ minHeight: '8rem', maxHeight: '12rem', overflow: 'auto' }}
              />
              {/* JSON 검증 상태 표시 */}
              {(() => {
                const parsed = parsePropertyValue(row.value as string);
                if (!row.value || (row.value as string).trim() === '') {
                  return null;
                } else if (parsed) {
                  return (
                    <div className="text-xs text-green-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      유효한 동적 속성 JSON입니다
                    </div>
                  );
                } else {
                  return (
                    <div className="text-xs text-red-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      JSON 형식이 올바르지 않거나 구조가 맞지 않습니다
                    </div>
                  );
                }
              })()}
            </div>
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
                {/* 1단계: FlowChain 선택 */}
                <select
                  className="border border-gray-300 rounded px-2 py-1 bg-white"
                  value={typeof row.flowChainId === 'string' ? row.flowChainId : ''}
                  onChange={e => {
                    if (!editMode) return;
                    const flowChainId = e.target.value;
                    const newRows = [...rows];
                    newRows[idx] = { ...row, flowChainId, sourceFlowId: '', value: '' };
                    updateRows(newRows);
                  }}
                  disabled={!editMode || flowChainIds.length === 0}
                >
                  <option value="">FlowChain 선택</option>
                  {flowChainIds
                    .filter(id => {
                      // 현재 chain이거나 이전 chain들만 선택 가능
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
                {/* 2단계: Flow 선택 */}
                {row.flowChainId && flowChainMap[String(row.flowChainId || '')] && (
                  <select
                    className="border border-gray-300 rounded px-2 py-1 bg-white"
                    value={typeof row.sourceFlowId === 'string' ? row.sourceFlowId : ''}
                    onChange={e => {
                      if (!editMode) return;
                      const sourceFlowId = e.target.value;
                      const newRows = [...rows];
                      newRows[idx] = { ...row, sourceFlowId, value: sourceFlowId };
                      updateRows(newRows);
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
                            // 현재 chain인 경우, 현재 flow보다 이전에 실행된 flow들만 선택 가능
                            const currentFlowIndex = selectedChain.flowIds.indexOf(flowId);
                            const targetFlowIndex = selectedChain.flowIds.indexOf(fid);
                            return targetFlowIndex < currentFlowIndex;
                          } else {
                            // 이전 chain인 경우, 모든 flow 선택 가능
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
                {/* 결과 없음 안내 */}
                {row.flowChainId && flowChainMap[String(row.flowChainId || '')] && (
                  (() => {
                    const chain = flowChainMap[String(row.flowChainId || '')];
                    let results: any[] = [];
                    if (row.sourceFlowId === '__all__') {
                      results = chain.flowIds.flatMap(fid => chain.flowMap[fid]?.lastResults || []);
                      if (results.length === 0) {
                        return <span className="text-gray-400 text-sm ml-2">전체 결과 없음</span>;
                      }
                    } else if (row.sourceFlowId === '__selected__') {
                      results = chain.selectedFlowIds.flatMap(fid => chain.flowMap[fid]?.lastResults || []);
                      if (results.length === 0) {
                        return <span className="text-gray-400 text-sm ml-2">선택 결과 없음</span>;
                      }
                    } else if (row.sourceFlowId) {
                      const flow = chain.flowMap[String(row.sourceFlowId || '')];
                      if (!flow || !Array.isArray(flow.lastResults) || flow.lastResults.length === 0) {
                        return <span className="text-gray-400 text-sm ml-2">해당 Flow 결과 없음</span>;
                      }
                    }
                    return null;
                  })()
                )}
              </div>
          )}
          {/* 위/아래/삭제 */}
          <div className="flex gap-1 ml-2">
            <button type="button" onClick={() => moveRow(idx, 'up')} disabled={!editMode || idx === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-50">{UpIcon}</button>
            <button type="button" onClick={() => moveRow(idx, 'down')} disabled={!editMode || idx === rows.length - 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-50">{DownIcon}</button>
            <button type="button" onClick={() => removeRow(idx)} disabled={!editMode || rows.length === 1} className="p-1 rounded hover:bg-red-100 disabled:opacity-50">{TrashIcon}</button>
          </div>
        </div>
      ))}
      </div>
      {/* 입력 추가 버튼: row 하단 우측 정렬 */}
      {editMode && (
        <div className="flex justify-end mb-2">
          <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded" onClick={() => addRow()}>+ 입력 추가</button>
        </div>
      )}
      {/* FlowResultDisplay 항상 표시 */}
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