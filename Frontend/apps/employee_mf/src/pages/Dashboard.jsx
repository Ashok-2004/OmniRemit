import { useEffect, useState } from "react";
import { createUser, deleteUser } from "../services/authService";
import { EMPLOYEE_FEATURE_KEY, USERS_FEATURE_KEY, hasCapability } from "../api/hostBridge";
import EmployeeTable from "../components/EmployeeTable";
import EmployeeModal from "../components/EmployeeModal";
import {
  createEmployee,
  deleteEmployee,
  getEmployees,
  updateEmployee,
} from "../services/employeeService";
import "../styles/dashboard.css";

function extractErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ??
    error?.response?.data?.title ??
    error?.message ??
    fallback
  );
}

function Dashboard() {
  const [employees, setEmployees] = useState([]);
  // Real aggregates over the WHOLE roster, from the server. Deriving these from `employees` would
  // now silently mean "stats for the current page" while still being labelled as totals.
  const [stats, setStats] = useState({ total: 0, departmentCount: 0, averageSalary: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);

  // Read straight from the host's own decoded JWT claims (see hostBridge.js) — no network round
  // trip, and it re-evaluates on every render so a role change takes effect on the next interaction
  // without a page reload. "Add Member" needs BOTH capabilities because it also provisions a
  // platform login for the new hire (see handleSubmit).
  const canCreate = hasCapability(EMPLOYEE_FEATURE_KEY, "Create") && hasCapability(USERS_FEATURE_KEY, "Create");
  const canEdit = hasCapability(EMPLOYEE_FEATURE_KEY, "Edit");
  const canDelete = hasCapability(EMPLOYEE_FEATURE_KEY, "Delete");

  const loadEmployees = async () => {
    setLoadError(null);
    try {
      const result = await getEmployees();
      setEmployees(result.items);
      setStats({
        total: result.total,
        departmentCount: result.departmentCount,
        averageSalary: result.averageSalary,
      });
    } catch (error) {
      console.error("Failed to load employees:", error);
      setLoadError(extractErrorMessage(error, "Could not load employees."));
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEmployees();
  }, []);

  const handleCreate = () => {
    setSelectedEmployee(null);
    setTempPassword(null);
    setIsModalOpen(true);
  };

  const handleEdit = (employee) => {
    setSelectedEmployee(employee);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this employee?")) return;

    try {
      await deleteEmployee(id);
      await loadEmployees();
    } catch (error) {
      console.error("Failed to delete employee:", error);
      window.alert(extractErrorMessage(error, "Failed to delete this employee."));
    }
  };

  const handleSubmit = async (payload) => {
    try {
      if (selectedEmployee) {
        await updateEmployee(selectedEmployee.id, payload);
      } else {
        // Onboard: create the platform login first (AuthService generates the one-time password),
        // then the HR record. If the second call fails, roll back the first — a compensating
        // transaction across the two services' own databases, since there's no shared transaction
        // to rely on.
        const userRes = await createUser({ name: payload.name, email: payload.email, roleId: payload.roleId });

        try {
          await createEmployee(payload);
        } catch (employeeError) {
          console.warn("Employee creation failed, rolling back user creation...");
          await deleteUser(userRes.user.id).catch((rollbackError) => {
            console.error("Rollback failed — a user account may be orphaned:", rollbackError);
          });
          throw employeeError;
        }

        setTempPassword(userRes.temporaryPassword);
      }
      setIsModalOpen(false);
      await loadEmployees();
    } catch (error) {
      console.error("Error saving employee/user:", error);
      window.alert(extractErrorMessage(error, "Failed to save. Please ensure the email is unique."));
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-content">
        <div className="dashboard-top">
          <div>
            <h1>Team Directory</h1>
            <p>Manage your team members, departments, and compensation</p>
          </div>
          {canCreate && (
            <button className="create-btn" onClick={handleCreate}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Member
            </button>
          )}
        </div>

        {tempPassword && (
          <div className="temp-password-banner">
            <span>Member created. Share this temporary password securely — it won&apos;t be shown again:</span>
            <span className="temp-password-value">{tempPassword}</span>
          </div>
        )}

        {loadError && <div className="load-error-banner">{loadError}</div>}

        <div className="metrics-overview">
          <div className="metric-card">
            <div className="metric-icon">👥</div>
            <div className="metric-data">
              <h3>Total Members</h3>
              <h2>{stats.total}</h2>
              <span className="trend positive">Active Team</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">🏢</div>
            <div className="metric-data">
              <h3>Departments</h3>
              <h2>{stats.departmentCount}</h2>
              <span className="trend neutral">Across Enterprise</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">💰</div>
            <div className="metric-data">
              <h3>Average Salary</h3>
              <h2>₹ {Math.round(Number(stats.averageSalary) || 0).toLocaleString()}</h2>
              <span className="trend neutral">Current Fiscal Year</span>
            </div>
          </div>
        </div>

        {employees && employees.length > 0 ? (
          <EmployeeTable
            employees={employees}
            onEdit={handleEdit}
            onDelete={handleDelete}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ) : (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <h3>No employees found</h3>
            <p>Get started by adding a new team member to your directory.</p>
          </div>
        )}
      </div>

      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        selectedEmployee={selectedEmployee}
      />
    </div>
  );
}

export default Dashboard;
