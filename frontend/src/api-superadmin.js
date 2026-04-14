import axios from 'axios';
import { SA_PATH_PREFIX } from './context/SABasePath';

// In production on admin.welltrack.com.au, API calls go to the same origin (no CORS).
// In dev/preview, they go to REACT_APP_BACKEND_URL.
const BASE_DOMAIN = process.env.REACT_APP_BASE_DOMAIN || 'welltrack.com.au';
const isAdminSubdomain = window.location.hostname === `admin.${BASE_DOMAIN}`;
const apiBase = isAdminSubdomain
  ? '/api/superadmin'
  : `${process.env.REACT_APP_BACKEND_URL}/api/superadmin`;

const saApi = axios.create({
  baseURL: apiBase,
  withCredentials: true,
});

saApi.interceptors.response.use(
  res => res,
  err => {
    const loginPath = `${SA_PATH_PREFIX}/login`;
    if (
      err.response?.status === 401 &&
      !err.config?.url?.includes('/auth/me') &&
      !window.location.pathname.endsWith('/login')
    ) {
      window.location.href = loginPath;
    }
    return Promise.reject(err);
  }
);

export default saApi;
