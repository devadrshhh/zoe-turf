import axios from 'axios';

/**
 * ============================================
 * 🌐 API Base URL Configuration
 * ============================================
 * Uses Vite environment variable in production.
 * Falls back to localhost for local development.
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * ============================================
 * 🚀 Axios Instance
 * ============================================
 */

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * ============================================
 * 🔐 Request Interceptor
 * Automatically attach admin token
 * ============================================
 */

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

/**
 * ============================================
 * 🛡️ Response Interceptor
 * ============================================
 */

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const status = error.response.status;

      console.error(
        `❌ API Error ${status}:`,
        error.response.data?.message || error.message
      );

      // Handle unauthorized access
      if (status === 401) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');

        window.location.href = '/admin/login';
      }
    } else if (error.request) {
      console.error(
        '❌ Backend not responding or CORS issue.'
      );
    } else {
      console.error('❌ Axios Setup Error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default api;