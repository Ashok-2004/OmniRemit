import "../styles/table.css";

function EmployeeTable({ employees, onEdit, onDelete, canEdit, canDelete }) {
  const showActionsColumn = canEdit || canDelete;

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Department</th>
            <th>Salary</th>
            {showActionsColumn && <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td>
                <div style={{ fontWeight: 500, color: 'var(--text-h)' }}>
                  {employee.name}
                </div>
              </td>
              <td style={{ color: '#64748b' }}>{employee.email}</td>
              <td>
                <span className="department-badge">
                  {employee.department}
                </span>
              </td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                ₹ {employee.salary.toLocaleString()}
              </td>
              {showActionsColumn && (
                <td>
                  <div className="actions-cell" style={{ justifyContent: 'flex-end' }}>
                    {canEdit && (
                      <button
                        className="icon-btn edit"
                        onClick={() => onEdit(employee)}
                        title="Edit"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="icon-btn delete"
                        onClick={() => onDelete(employee.id)}
                        title="Delete"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default EmployeeTable;