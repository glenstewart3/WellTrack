import axios from 'axios';

const _basePath = (process.env.REACT_APP_BASE_PATH || '').replace(/\/$/, '');
const _loginPath = `${_basePath}/login`;

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
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
