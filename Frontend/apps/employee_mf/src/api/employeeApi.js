import axios from "axios";
import { getToken } from "../services/authService";

const api = axios.create({
  baseURL: import.meta.env.VITE_EMPLOYEE_API,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;