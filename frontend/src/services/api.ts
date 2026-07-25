import axios from 'axios';
import { toast } from 'sonner';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const status = error.response.status;
      const message =
        error.response.data?.message || error.response.statusText || 'An unexpected error occurred';

      if (status === 401) {
        // Clear token — AuthContext will handle state cleanup
        localStorage.removeItem('token');
        // Don't redirect for profile restoration calls (AuthContext handles this)
        // Only redirect for user-initiated actions that get 401
        const requestUrl = error.config?.url ?? '';
        if (!requestUrl.includes('/auth/profile')) {
          const currentPath = window.location.pathname;
          if (currentPath !== '/login' && currentPath !== '/register') {
            window.location.href = '/login';
          }
        }
      } else if (status >= 400) {
        // Show error toast for all other 4xx/5xx errors
        toast.error(message);
      }
    } else if (error.request) {
      // Network error — no response received
      toast.error('Network error. Please check your connection.');
    }

    return Promise.reject(error);
  }
);

export default api;
