import axios from "axios";

  console.log("VITE_AUTH_API =", import.meta.env.VITE_AUTH_API);
const authApi = axios.create({
  baseURL: import.meta.env.VITE_AUTH_API || '/api',
});

export default authApi;
