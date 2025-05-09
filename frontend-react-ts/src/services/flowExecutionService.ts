import axios from 'axios';

// FastAPI 백엔드의 기본 URL (환경 변수에서 가져오거나 기본값 사용)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface ExecuteFlowParams {
  flowJson: any;
  inputs: any[];
}

interface ExecutionResponse {
  executionId: string;
  outputs: any;
  status: 'success' | 'error';
  error?: string;
}

/**
 * 백엔드에 플로우 JSON과 입력 데이터를 전송하여 실행합니다.
 */
export const executeFlow = async (params: ExecuteFlowParams): Promise<ExecutionResponse> => {
  try {
    // 파일 데이터가 포함된 경우 FormData로 처리
    if (params.inputs.some(input => input instanceof File)) {
      const formData = new FormData();
      formData.append('flow_json', JSON.stringify(params.flowJson));
      
      // 파일인 경우 files 배열에 추가, 아닌 경우 text_inputs 배열에 추가
      const textInputs: string[] = [];
      
      params.inputs.forEach((input, index) => {
        if (input instanceof File) {
          formData.append('files', input, input.name);
        } else {
          textInputs.push(typeof input === 'string' ? input : JSON.stringify(input));
        }
      });
      
      // 텍스트 입력이 있는 경우 JSON 문자열로 추가
      if (textInputs.length > 0) {
        formData.append('text_inputs', JSON.stringify(textInputs));
      }
      
      const response = await axios.post<ExecutionResponse>(
        `${API_BASE_URL}/api/execute-flow`, 
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      return response.data;
    } 
    // 파일이 없는 경우 JSON으로 처리
    else {
      const response = await axios.post<ExecutionResponse>(
        `${API_BASE_URL}/api/execute-flow`,
        {
          flow_json: params.flowJson,
          inputs: params.inputs,
        }
      );
      
      return response.data;
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('Error executing flow:', error.response.data);
      return {
        executionId: '',
        outputs: null,
        status: 'error',
        error: error.response.data.detail || 'Failed to execute flow',
      };
    }
    
    console.error('Error executing flow:', error);
    return {
      executionId: '',
      outputs: null,
      status: 'error',
      error: 'Network or server error',
    };
  }
};

/**
 * 실행 결과를 가져옵니다 (비동기 실행을 위해 필요한 경우).
 */
export const getExecutionResult = async (executionId: string): Promise<ExecutionResponse> => {
  try {
    const response = await axios.get<ExecutionResponse>(
      `${API_BASE_URL}/api/execution-result/${executionId}`
    );
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('Error getting execution result:', error.response.data);
      return {
        executionId,
        outputs: null,
        status: 'error',
        error: error.response.data.detail || 'Failed to get execution result',
      };
    }
    
    console.error('Error getting execution result:', error);
    return {
      executionId,
      outputs: null,
      status: 'error',
      error: 'Network or server error',
    };
  }
}; 