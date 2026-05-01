import axios, { AxiosInstance } from 'axios';

export interface ApiClientOptions {
  baseURL: string;
  timeout?: number;
  getToken?: () => string | null | undefined;
  onAuthError?: (error: any) => void;
}

/**
 * Create a configured Axios instance.
 *
 * @param {Object} options
 * @param {string} options.baseURL — Base URL for the API
 * @param {number} [options.timeout=10000] — Request timeout in ms
 * @param {Function} [options.getToken] — Function that returns the JWT token
 * @param {Function} [options.onAuthError] — Called on 401 responses
 * @returns {import('axios').AxiosInstance}
 */
export function createApiClient({ baseURL, timeout = 10000, getToken, onAuthError }: ApiClientOptions): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout,
    headers: { 'Content-Type': 'application/json' },
  });

  // ── Request Interceptor: attach JWT ──
  client.interceptors.request.use(
    (config) => {
      if (getToken) {
        const token = getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // ── Response Interceptor: unwrap data & handle errors ──
  client.interceptors.response.use(
    (response) => response.data,
    (error) => {
      if (error.response?.status === 401 && onAuthError) {
        onAuthError(error);
      }
      return Promise.reject(error.response?.data || error);
    }
  );

  return client;
}


