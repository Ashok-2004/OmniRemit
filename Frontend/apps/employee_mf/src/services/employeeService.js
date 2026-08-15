import api from "../api/employeeApi";

/**
 * Fetches one page of employees. The backend pages, filters and sorts server-side — it used to
 * return the entire table on every call, which does not survive a real roster.
 *
 * @returns {Promise<{items: Array, total: number, page: number, pageSize: number}>}
 */
export const getEmployees = async ({ page = 1, pageSize = 25, search = "", sortBy = "", sortDesc = false } = {}) => {
  const response = await api.get("/api/employees", {
    params: {
      page,
      pageSize,
      // Omit empty optional filters entirely rather than sending blanks.
      ...(search ? { search } : {}),
      ...(sortBy ? { sortBy, sortDesc } : {}),
    },
  });

  const paged = response.data.data;
  return {
    items: paged.items ?? [],
    total: paged.total ?? 0,
    page: paged.page ?? page,
    pageSize: paged.pageSize ?? pageSize,
  };
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
