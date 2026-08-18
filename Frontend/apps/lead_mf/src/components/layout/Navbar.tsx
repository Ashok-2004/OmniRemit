import React from 'react';
import { Bell, Search, PanelLeft } from 'lucide-react';
import { useLeadStore } from '../../store/useLeadStore';

export const Navbar: React.FC = () => {
  const { toggleSidebar, isSidebarExpanded, searchQuery, setSearchQuery } = useLeadStore();

  return (
    <header className="top-navbar">
      {/* Left: Sidebar Toggle + Search Bar */}
      <div className="navbar-left">
        <button
          type="button"
          className="navbar-icon-btn"
          onClick={toggleSidebar}
          title={isSidebarExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
          aria-label={isSidebarExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
          style={{ marginRight: '8px' }}
        >
          <PanelLeft size={18} />
        </button>
        <div className="navbar-search-box">
          <Search size={14} color="#94a3b8" />
          <input
            type="text"
            className="navbar-search-input"
            placeholder="Search leads, IC, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Right: Notifications + Profile */}
      <div className="navbar-right">
        {/* Notifications Icon */}
        <button
          type="button"
          className="navbar-icon-btn"
          title="Notifications"
        >
          <Bell size={17} />
          <span className="navbar-notification-dot" />
        </button>

        {/* Divider */}
        <div className="navbar-divider" />

        {/* User Profile */}
        <div className="navbar-profile">
          <div className="navbar-profile-avatar">
            A
          </div>
          <div className="navbar-profile-info">
            <div className="navbar-profile-name">Admin User</div>
            <div className="navbar-profile-role">Administrator</div>
          </div>
        </div>
      </div>
    </header>
  );
};
