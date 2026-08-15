import authApi from "../api/authApi";

/** GET /api/roles — requires host.settings.roles:View. Feeds the Employee form's role dropdown. */
export const getRoles = async () => {
  const response = await authApi.get("/api/roles", { params: { pageSize: 100 } });
  return response.data.items;
};

/**
 * POST /api/users — requires host.settings.users:Create. "Add Member" here provisions a platform
 * login alongside the HR record, so AuthService is the source of truth for the account: it
 * generates the one-time temporary password server-side, this never sends one.
 */
export const createUser = async ({ name, email, roleId }) => {
  const response = await authApi.post("/api/users", {
    name,
    email,
    phoneNumber: null,
    roleId: roleId || null,
    isActive: true,
  });
  return response.data; // { user, temporaryPassword }
};

/** DELETE /api/users/{id} — compensating action if employee creation fails after the linked user account was already created. */
export const deleteUser = async (userId) => {
  await authApi.delete(`/api/users/${userId}`);
};
