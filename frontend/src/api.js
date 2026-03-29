import axios from 'axios';

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
      window.location.pathname !== '/login'
    ) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
