import authApi from "../api/authApi";

export const getRoles = async () => {
  const response = await authApi.get("/Roles");
  console.log(response);
  return response.data;
};

export const createUser = async (payload) => {
  const response = await authApi.post("/users", payload);
  return response.data;
};

export const deleteUser = async (userId) => {
  const response = await authApi.delete(`/users/${userId}`);
  return response.data;
};

export const getToken = () => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; token=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
};

export const getCurrentUser = async () => {
    const token = getToken();
    if (!token) return null;
    
    try {
        const response = await authApi.get("/auth/me", {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch {
        return null;
    }
};

export const getUserPermissions = async (userId) => {
    try {
        const response = await authApi.get(`/access/userpermissions/${userId}`);
        return response.data;
    } catch {
        return [];
    }
};

export const verifyBackendPermission = async (userId, moduleName, action) => {
    try {
        const response = await authApi.get(`/access/CheckPermission?userId=${userId}&moduleName=${moduleName}&action=${action}`);
        return response.data.hasPermission;
    } catch (error) {
        console.error("Permission check failed:", error);
        return false;
    }
};
