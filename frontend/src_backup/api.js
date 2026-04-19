import axios from 'axios';

const _basePath = (process.env.REACT_APP_BASE_PATH || '').replace(/\/$/, '');
const _loginPath = `${_basePath}/login`;

// In production, each subdomain's Nginx proxies /api/ to the backend,
// so relative '/api' is correct and preserves the Host header for tenant resolution.
// In dev/preview, REACT_APP_BACKEND_URL points to the preview URL.
const _backendUrl = process.env.REACT_APP_BACKEND_URL || '';
const _baseDomain = process.env.REACT_APP_BASE_DOMAIN || 'welltrack.com.au';
const _isSubdomain = window.location.hostname.endsWith(`.${_baseDomain}`);
const _apiBase = _isSubdomain ? '/api' : `${_backendUrl}/api`;

const api = axios.create({
  baseURL: _apiBase,
  withCredentials: true,
});

// Redirect to login on session expiry. Skip /auth/me so AuthContext can
// handle unauthenticated state gracefully without a redirect loop.
api.interceptors.response.use(
  res => res,
  err => {
    if (
      err.response?.status === 401 &&
      err.config?.url !== '/auth/me' &&
      window.location.pathname !== _loginPath
    ) {
      window.location.href = _loginPath;
    }
    return Promise.reject(err);
  }
);

export default api;
