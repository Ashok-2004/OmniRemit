import { useEffect, useState } from "react";
import { getRoles } from "../services/authService";
import "../styles/modal.css";

function EmployeeModal({ isOpen, onClose, onSubmit, selectedEmployee }) {
  const [roles, setRoles] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    department: "",
    salary: "",
    roleId: "",
  });

  useEffect(() => {
    if (isOpen) {
      getRoles().then(setRoles).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedEmployee) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        ...selectedEmployee,
        roleId: selectedEmployee.roleId || "",
      });
    } else {
      setFormData({
        name: "",
        email: "",
        department: "",
        salary: "",
        roleId: "",
      });
    }
  }, [selectedEmployee, isOpen]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{selectedEmployee ? "Edit Employee" : "Add New Member"}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="name"
              placeholder="e.g. Jane Doe"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              placeholder="e.g. jane@company.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Department</label>
            <input
              type="text"
              name="department"
              placeholder="e.g. Engineering"
              value={formData.department}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Salary (₹)</label>
            <input
              type="number"
              name="salary"
              placeholder="e.g. 75000"
              value={formData.salary}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Role</label>
            <select
              name="roleId"
              value={formData.roleId}
              onChange={handleChange}
              required
            >
              <option value="" disabled>Select a role</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))
              }
            </select>
          </div>

          <button type="submit" className="submit-btn">
            {selectedEmployee ? "Save Changes" : "Create Member"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default EmployeeModal;