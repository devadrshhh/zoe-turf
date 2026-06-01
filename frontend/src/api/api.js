import axios from 'axios';

/**
 * 🚀 Production-Ready API Configuration
 * 
 * Retrieves the API gateway base URL from Vite environment variables (VITE_API_URL).
 * If undefined, falls back cleanly to local development port URL for zero-friction developer onboarding.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'baseURL: import.meta.env.VITE_API_URL';

if (!import.meta.env.VITE_API_URL) {
  console.warn(
    "⚠️ [Vite Environment Warning] 'VITE_API_URL' is not defined. " +
    "Falling back to local development URL: baseURL: import.meta.env.VITE_API_URL. " +
    "For production deployments (e.g. Vercel & Render), configure 'VITE_API_URL' in your environment settings."
  );
}

// Create a highly customizable, reusable Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Auto-send secure HTTP-only cookies if verified
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

/**
 * 🔒 Reusable Request Interceptor
 * Automatically injects admin bearer token if stored in local storage.
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
    console.error('❌ [API Request Dispatch Error]:', error);
    return Promise.reject(error);
  }
);

/**
 * 🛡️ Reusable Response Interceptor
 * Handles success payload unpacking, session expirations (401), network blocks, and CORS errors.
 */
api.interceptors.response.use(
  (response) => {
    // Return standard response payloads
    return response;
  },
  (error) => {
    const originalRequest = error.config;

    if (error.response) {
      const { status, data } = error.response;

      // Handle session expiration or invalid authorization (401 Unauthorized)
      if (status === 401) {
        const isMeRequest = originalRequest.url.endsWith('/admin/me');
        const isLoginRequest = originalRequest.url.endsWith('/admin/login');

        // Avoid infinite redirects if the initial authentication check itself fails
        if (!isMeRequest && !isLoginRequest) {
          console.warn('🔒 [Session Expired] Administrative token invalid or expired. Routing back to sign-in console.');
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminUser');
          
          // Redirect smoothly back to admin login console
          window.location.href = '/admin/login?expired=true';
        }
      }

      // Output clean, structured console errors for the administrator/developer
      console.error(`❌ [API Server Error] Status ${status}:`, data?.message || error.message);
    } else if (error.request) {
      // Request was sent but no response was received (network cut-offs, backend down, CORS mismatches)
      console.error(
        '❌ [API Network Error] Connection timed out or server unreachable. ' +
        'Please verify that your Render backend is active and CORS is correctly allowed for this domain.'
      );
    } else {
      // Request preparation error
      console.error('❌ [API Setup Error] Failed to prepare outgoing request:', error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
