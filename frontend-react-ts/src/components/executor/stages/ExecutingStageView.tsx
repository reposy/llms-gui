import React from 'react';

const ExecutingStageView: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex flex-col items-center justify-center py-10">
        <div className="w-12 h-12 rounded-full border-t-2 border-b-2 border-indigo-500 animate-spin mb-4"></div>
        <span className="text-xl font-medium text-gray-700">
          Flow 실행 중...
        </span>
        <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요. 처리 중입니다.</p>
      </div>
    </div>
  );
};

export default ExecutingStageView; 