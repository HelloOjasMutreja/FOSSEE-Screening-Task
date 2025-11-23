import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/',
  // timeout: 10000,
});

// For dev only: attach BasicAuth easily when needed
export function authConfig(username, password) {
  return {
    auth: { username, password }
  };
}

export default api;
