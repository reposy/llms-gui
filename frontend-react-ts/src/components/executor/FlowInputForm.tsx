import React, { useState, useEffect, useRef } from 'react';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';

interface FlowInputFormProps {
  flowId: string;
  inputs?: any[];
  onInputChange?: (inputs: any[]) => void;
  isChainInput?: boolean;
}

type InputType = 'text' | 'file' | 'flow-result';

interface InputRow {
  type: InputType;
  value: string | File | null;
  sourceFlowId?: string;
}

const FlowInputForm: React.FC<FlowInputFormProps> = ({ flowId, inputs: propInputs, onInputChange, isChainInput = false }) => {
  const store = useFlowExecutorStore();
  const focusedFlowChainId = store.focusedFlowChainId;
  const chain = focusedFlowChainId ? store.chains[focusedFlowChainId] : undefined;
  const flow = chain && flowId ? chain.flowMap[flowId] : undefined;
  const prevFlows = chain ? chain.flowIds.filter(id => id !== flowId && chain.flowIds.indexOf(id) < chain.flowIds.indexOf(flowId)) : [];

  // store의 값을 직접 구독 (propInputs가 없으면)
  const initialRows = propInputs && propInputs.length > 0 ? propInputs : (flow?.inputs && flow.inputs.length > 0 ? flow.inputs : [{ type: 'text', value: '' }]);
  const [rows, setRows] = useState<InputRow[]>(initialRows);
  const [editMode, setEditMode] = useState(false);
  const [draftInputs, setDraftInputs] = useState<InputRow[]>(rows);

  useEffect(() => {
    if (propInputs) setRows(propInputs);
    else if (flow && flow.inputs) setRows(flow.inputs);
  }, [propInputs, flow]);

  useEffect(() => {
    setDraftInputs(rows);
  }, [rows]);

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
    else if (type === 'flow-result') newRows[idx] = { type, value: '', sourceFlowId: prevFlows[0] || '' };
    else newRows[idx] = { type, value: '' };
    updateRows(newRows);
  };

  // 파일 선택
  const handleFileChange = (idx: number, file: File | null) => {
    const newRows = [...rows];
    newRows[idx] = { type: 'file', value: file };
    updateRows(newRows);
  };

  // Flow Result 선택
  const handleFlowResultChange = (idx: number, flowId: string) => {
    const newRows = [...rows];
    newRows[idx] = { type: 'flow-result', value: flowId, sourceFlowId: flowId };
    updateRows(newRows);
  };

  // 텍스트 입력
  const handleTextChange = (idx: number, value: string) => {
    const newRows = [...rows];
    newRows[idx] = { type: 'text', value };
    updateRows(newRows);
  };

  // Shift+Enter로 Row 추가
  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
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
      store.setFlowInputData(focusedFlowChainId, flowId, draftInputs);
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
        {editMode && (
          <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded" onClick={() => addRow()}>+ 입력 추가</button>
        )}
      </div>
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded" onDrop={e => handleDrop(idx, e)} onDragOver={e => e.preventDefault()}>
          {/* 타입 토글 */}
          <div className="flex gap-1">
            <button type="button" className={`px-2 py-1 rounded ${row.type === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} onClick={() => editMode && setType(idx, 'text')} disabled={!editMode}>Text</button>
            <button type="button" className={`px-2 py-1 rounded ${row.type === 'file' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} onClick={() => editMode && setType(idx, 'file')} disabled={!editMode}>File</button>
            <button type="button" className={`px-2 py-1 rounded ${row.type === 'flow-result' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} onClick={() => editMode && setType(idx, 'flow-result')} disabled={!editMode}>Flow Result</button>
          </div>
          {/* 입력 UI */}
          {row.type === 'text' && (
            <input
              className="flex-1 border border-gray-300 rounded px-2 py-1 bg-white"
              type="text"
              value={typeof row.value === 'string' ? row.value : ''}
              onChange={e => editMode && handleTextChange(idx, e.target.value)}
              onKeyDown={e => editMode && handleKeyDown(e, idx)}
              placeholder="입력값을 입력하세요"
              readOnly={!editMode}
            />
          )}
          {row.type === 'file' && (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="file"
                className="hidden"
                id={`file-input-${idx}`}
                onChange={e => editMode && handleFileChange(idx, e.target.files ? e.target.files[0] : null)}
                disabled={!editMode}
              />
              <label htmlFor={`file-input-${idx}`} className={`px-2 py-1 border rounded cursor-pointer bg-white hover:bg-gray-100 ${!editMode ? 'opacity-50 cursor-not-allowed' : ''}`}>파일 선택</label>
              {row.value && typeof row.value !== 'string' && (
                <span className="text-sm text-gray-700">{(row.value as File).name}</span>
              )}
              {!row.value && <span className="text-gray-400 text-sm">파일을 선택하세요</span>}
            </div>
          )}
          {row.type === 'flow-result' && (
            <select
              className="flex-1 border border-gray-300 rounded px-2 py-1 bg-white"
              value={row.sourceFlowId || ''}
              onChange={e => editMode && handleFlowResultChange(idx, e.target.value)}
              disabled={!editMode || prevFlows.length === 0}
            >
              {prevFlows.length === 0 && <option value="">선택 가능한 이전 Flow가 없습니다</option>}
              {prevFlows.map(fid => (
                <option key={fid} value={fid}>{chain?.flowMap[fid]?.name || fid}</option>
              ))}
            </select>
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
  );
};

export default FlowInputForm; 