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
  const [stats, setStats] = useState({ total: 0, departmentCount: 0, averageSalary: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);

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
        const userRes = await createUser({ name: payload.name, email: payload.email, roleId: payload.roleId });

        try {
          await createEmployee(payload);
        } catch (employeeError) {
          console.warn("Employee creation failed, rolling back user creation...");
          const userId = userRes?.user?.id ?? userRes?.id;
          if (userId) {
            await deleteUser(userId).catch((rollbackError) => {
              console.error("Rollback failed — a user account may be orphaned:", rollbackError);
            });
          }
          throw employeeError;
        }

        setTempPassword(userRes?.temporaryPassword);
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
        {/* Top Header */}
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
              <span>Add Member</span>
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

        {/* 3 Metric Stat Cards */}
        <div className="metrics-overview">
          <div className="metric-card">
            <div className="metric-icon-wrap icon-purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="metric-data">
              <h3>Total Members</h3>
              <h2>{stats.total}</h2>
              <span className="trend positive">Active Team</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon-wrap icon-blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
              </svg>
            </div>
            <div className="metric-data">
              <h3>Departments</h3>
              <h2>{stats.departmentCount}</h2>
              <span className="trend neutral">Across Enterprise</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon-wrap icon-amber">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div className="metric-data">
              <h3>Average Salary</h3>
              <h2>₹ {Math.round(Number(stats.averageSalary) || 0).toLocaleString()}</h2>
              <span className="trend neutral">Current Fiscal Year</span>
            </div>
          </div>
        </div>

        {/* Employee Roster Table */}
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
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <h3>No team members found</h3>
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
