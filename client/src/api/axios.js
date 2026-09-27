import axios from 'axios';

const API = axios.create({
  // Was: http://localhost:5000/api — now pointing at the deployed ECS/ALB backend.
  // Swap this back to localhost when you want to test against your local server again.
  baseURL: 'http://skillmatch-alb-741847994.ap-south-1.elb.amazonaws.com/api'
});

// Attach JWT token to every request automatically
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

// Handle token expiry globally
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default API;