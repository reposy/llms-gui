import axios, { AxiosRequestConfig, Method, AxiosError } from 'axios';
import { HTTPMethod } from '../types/nodes.ts';

interface CallApiParams {
  url: string;
  method: HTTPMethod;
  headers?: Record<string, string>;
  body?: any;
  queryParams?: Record<string, string>;
}

/**
 * Makes an API request using axios.
 *
 * @param params The API request parameters.
 * @returns The response data.
 */
export async function callApi({
  url,
  method,
  headers = {},
  body = null,
  queryParams = {}
}: CallApiParams): Promise<any> {
  const config: AxiosRequestConfig = {
    url,
    method: method as Method, // Cast HTTPMethod to Axios Method
    headers,
    params: queryParams,
    data: body
  };

  console.log(`[apiService] Making ${config.method} request to ${config.url}`);

  try {
    const response = await axios(config);
    console.log(`[apiService] Received response status: ${response.status}`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError;
    let errorMessage = `Request failed: ${axiosError.message}`;
    let statusCode: number | undefined;

    if (axiosError.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      statusCode = axiosError.response.status;
      errorMessage = `API error (${statusCode}): ${JSON.stringify(axiosError.response.data)}`;
      console.error(`[apiService] API Error Response (${statusCode}):`, axiosError.response.data);
    } else if (axiosError.request) {
      // The request was made but no response was received
      errorMessage = 'API error: No response received from server.';
      console.error('[apiService] API No Response Error:', axiosError.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('[apiService] API Setup Error:', axiosError.message);
    }

    // Re-throw a more structured error or handle it as needed
    const apiError = new Error(errorMessage) as any;
    apiError.statusCode = statusCode;
    apiError.requestUrl = url;
    apiError.requestMethod = method;
    throw apiError;
  }
} 