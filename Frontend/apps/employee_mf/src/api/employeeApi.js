import axios from "axios";
import { ensureFreshAccessToken } from "./hostBridge";

// VITE_EMPLOYEE_API must point at this service's path-base root, e.g.
// http://localhost:5285/api/employee-service — see Backend/EmployeeService/Program.cs's
// UsePathBase. Callers pass the controller-relative path including its own "api/" segment
// (e.g. "/api/employees"), matching EmployeeService's real route attributes exactly.
const api = axios.create({
  baseURL: import.meta.env.VITE_EMPLOYEE_API,
});

api.interceptors.request.use(async (config) => {
  const token = await ensureFreshAccessToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
