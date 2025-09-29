/**
 * API Client
 * Axios-based HTTP client with interceptors and error handling
 */

import axios, { AxiosError } from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import type { ApiResponse, ApiError, PaginationMeta } from '@/types/datawarehouse';

// Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:37951';
const API_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching
    config.params = {
      ...config.params,
      _t: Date.now(),
    };

    // Add request ID for tracking
    config.headers['X-Request-Id'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Log request in development
    if (import.meta.env.DEV) {
      console.log('🚀 API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        params: config.params,
        data: config.data,
      });
    }

    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    // Log response in development
    if (import.meta.env.DEV) {
      console.log('✅ API Response:', {
        url: response.config.url,
        status: response.status,
        data: response.data,
      });
    }
    return response;
  },
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: number };

    // Handle network errors
    if (!error.response) {
      console.error('❌ Network Error:', error.message);
      return Promise.reject(createApiError('NETWORK_ERROR', 'Network connection failed'));
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED') {
      console.error('❌ Timeout Error:', error.message);
      return Promise.reject(createApiError('TIMEOUT', 'Request timed out'));
    }

    // Retry logic for 5xx errors
    if (
      error.response.status >= 500 &&
      originalRequest &&
      (!originalRequest._retry || originalRequest._retry < MAX_RETRIES)
    ) {
      originalRequest._retry = (originalRequest._retry || 0) + 1;

      console.warn(`🔄 Retrying request (${originalRequest._retry}/${MAX_RETRIES})...`);

      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * originalRequest._retry!));

      return apiClient(originalRequest);
    }

    // Log error details
    console.error('❌ API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.error?.message || error.message,
      data: error.response?.data,
    });

    // Extract and format error
    const apiError = extractApiError(error);
    return Promise.reject(apiError);
  }
);

// Helper function to create API error
function createApiError(code: string, message: string, details?: Record<string, unknown>): ApiError {
  return {
    code,
    message,
    details,
  };
}

// Helper function to extract API error from axios error
function extractApiError(error: AxiosError<ApiResponse<unknown>>): ApiError {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  if (error.response) {
    return createApiError(
      `HTTP_${error.response.status}`,
      error.response.statusText || 'Request failed',
      {
        status: error.response.status,
        data: error.response.data,
      }
    );
  }

  return createApiError(
    'UNKNOWN_ERROR',
    error.message || 'An unknown error occurred',
    { error }
  );
}

// Generic request function with proper typing
async function request<T>(
  config: AxiosRequestConfig
): Promise<T> {
  try {
    const response = await apiClient.request<ApiResponse<T>>(config);

    // Check if response indicates success
    if (response.data.success === false) {
      throw response.data.error || createApiError('REQUEST_FAILED', 'Request failed');
    }

    return response.data.data as T;
  } catch (error) {
    if ((error as ApiError).code) {
      throw error;
    }
    throw extractApiError(error as AxiosError<ApiResponse<T>>);
  }
}

// HTTP method helpers
export const api = {
  get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    return request<T>({ method: 'GET', url, params });
  },

  post<T>(url: string, data?: unknown, params?: Record<string, unknown>): Promise<T> {
    return request<T>({ method: 'POST', url, data, params });
  },

  put<T>(url: string, data?: unknown, params?: Record<string, unknown>): Promise<T> {
    return request<T>({ method: 'PUT', url, data, params });
  },

  patch<T>(url: string, data?: unknown, params?: Record<string, unknown>): Promise<T> {
    return request<T>({ method: 'PATCH', url, data, params });
  },

  delete<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    return request<T>({ method: 'DELETE', url, params });
  },

  // Special method for paginated responses
  async getPaginated<T>(
    url: string,
    params?: Record<string, unknown>
  ): Promise<{ data: T[]; meta: PaginationMeta }> {
    const response = await apiClient.get(url, { params });

    if (response.data.success === false) {
      throw response.data.error || createApiError('REQUEST_FAILED', 'Request failed');
    }

    return {
      data: response.data.data as T[],
      meta: response.data.meta as PaginationMeta,
    };
  },

  // Method for file downloads
  async download(url: string, params?: Record<string, unknown>): Promise<Blob> {
    const response = await apiClient.get(url, {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

// Export the raw client for advanced use cases
export { apiClient };

// Export types
export type { ApiError } from '@/types/datawarehouse';