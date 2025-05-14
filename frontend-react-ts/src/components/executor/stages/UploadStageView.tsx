import React from 'react';
import FileUploader from '../../executor/FileUploader'; // 경로 수정 필요에 따라

const UploadStageView: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-700">Flow 업로드</h2>
      <p className="mb-4 text-gray-600">Flow JSON 파일을 업로드하거나, Flow Editor에서 생성한 Flow를 불러오세요.</p>
      <FileUploader />
    </div>
  );
};

export default UploadStageView; 