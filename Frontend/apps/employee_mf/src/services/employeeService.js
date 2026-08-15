import api from "../api/employeeApi";

export const getEmployees = async () => {
  const response = await api.get("/api/employees");
  return response.data.data;
};

export const createEmployee = async (payload) => {
  const response = await api.post("/api/employees", payload);
  return response.data.data;
};

export const updateEmployee = async (id, payload) => {
  const response = await api.put(`/api/employees/${id}`, payload);
  return response.data.data;
};

export const deleteEmployee = async (id) => {
  await api.delete(`/api/employees/${id}`);
};
