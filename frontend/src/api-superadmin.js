import axios from 'axios';

const saApi = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api/superadmin`,
  withCredentials: true,
});

saApi.interceptors.response.use(
  res => res,
  err => {
    if (
      err.response?.status === 401 &&
      !err.config?.url?.includes('/auth/me') &&
      !window.location.pathname.startsWith('/sa/login')
    ) {
      window.location.href = '/sa/login';
    }
    return Promise.reject(err);
  }
);

export default saApi;
