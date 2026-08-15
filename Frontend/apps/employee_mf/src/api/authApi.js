import axios from "axios";
import { ensureFreshAccessToken, getAuthServiceBaseUrl } from "./hostBridge";

// Prefer the base URL the host bridge already knows (its own VITE_AUTH_SERVICE_URL) so this
// remote never has to duplicate/guess AuthService's address; VITE_AUTH_API remains as a fallback
// for standalone dev outside the host shell.
const authApi = axios.create({
  baseURL: getAuthServiceBaseUrl() || import.meta.env.VITE_AUTH_API,
});

authApi.interceptors.request.use(async (config) => {
  const token = await ensureFreshAccessToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default authApi;
