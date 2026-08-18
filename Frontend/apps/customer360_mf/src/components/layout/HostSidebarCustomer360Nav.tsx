import React, { useEffect, useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  User,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import { useNavigationStore, C360Page } from '../../store/navigationStore';
import { useCustomerStore } from '../../store/customerStore';
import {
  canViewProfile,
  canViewAuditLogs,
} from '../../api/hostBridge';

interface SubNavItem {
  id: C360Page;
  label: string;
  icon: React.ReactNode;
  visible: boolean;
  onClick: () => void;
}

export const HostSidebarCustomer360Nav: React.FC = () => {
  const { activePage, setActivePage } = useNavigationStore();
  const { setCustomerType } = useCustomerStore();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const chevronBtnRef = useRef<HTMLButtonElement | null>(null);

  const userCanViewProfile = canViewProfile();
  const userCanViewAuditLogs = canViewAuditLogs();

  const navItems: SubNavItem[] = [
    {
      id: 'individual',
      label: 'Individual',
      icon: <User size={15} />,
      visible: userCanViewProfile,
      onClick: () => {
        setActivePage('individual');
        setCustomerType('individual');
      },
    },
    {
      id: 'non-individual',
      label: 'Non-Individual',
      icon: <Building2 size={15} />,
      visible: userCanViewProfile,
      onClick: () => {
        setActivePage('non-individual');
        setCustomerType('corporate');
      },
    },
    {
      id: 'audit-logs',
      label: 'Audit Logs',
      icon: <ShieldCheck size={15} />,
      visible: userCanViewAuditLogs,
      onClick: () => {
        setActivePage('audit-logs');
      },
    },
  ];

  const visibleItems = navItems.filter((i) => i.visible);

  const toggleExpand = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsExpanded((prev) => !prev);
  }, []);

  useEffect(() => {
    // Locate the Customer 360 link in the host sidebar across multiple possible selectors
    const findC360Link = (): HTMLAnchorElement | null => {
      const byHref = document.querySelector<HTMLAnchorElement>(
        'a[href*="/apps/customer360"], a[href*="/apps/customer-360"], a[href*="/apps/customer_360"], a[href*="/app/customer360"], a[href*="/apps/customer"]'
      );
      if (byHref) return byHref;

      const allLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('aside nav a, aside a'));
      return (
        allLinks.find((el) => {
          const text = (el.textContent || '').toLowerCase();
          return text.includes('customer 360') || text.includes('customer360') || text.includes('customer');
        }) || null
      );
    };

    const attachToSidebar = () => {
      const c360Link = findC360Link();
      if (!c360Link) return false;

      let container = document.getElementById('c360-host-sidebar-subnav');
      if (!container) {
        container = document.createElement('div');
        container.id = 'c360-host-sidebar-subnav';
        container.className = 'c360-host-sidebar-subnav-wrapper';
        c360Link.insertAdjacentElement('afterend', container);
      }

      // Add styled chevron toggle button inside the Host Customer 360 nav item
      let chevronBtn = c360Link.querySelector<HTMLButtonElement>('.c360-sidebar-chevron-btn');
      if (!chevronBtn) {
        chevronBtn = document.createElement('button');
        chevronBtn.type = 'button';
        chevronBtn.className = 'c360-sidebar-chevron-btn';
        chevronBtn.setAttribute('aria-label', 'Toggle Customer 360 Sub-Menu');
        chevronBtn.style.cssText = `
          margin-left: auto;
          background: transparent;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          padding: 0;
          color: inherit;
          opacity: 0.75;
          transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease;
        `;
        chevronBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="c360-chevron-svg" style="transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        `;

        chevronBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleExpand();
        };

        chevronBtn.onmouseenter = () => {
          chevronBtn!.style.opacity = '1';
        };
        chevronBtn.onmouseleave = () => {
          chevronBtn!.style.opacity = '0.75';
        };

        c360Link.appendChild(chevronBtn);
      }

      chevronBtnRef.current = chevronBtn;
      setPortalTarget(container);
      return true;
    };

    // Immediate attempt
    if (!attachToSidebar()) {
      // Retry for up to 4 seconds in case Host sidebar apps are loading asynchronously from ModuleRegistry
      const intervalId = setInterval(() => {
        if (attachToSidebar()) {
          clearInterval(intervalId);
        }
      }, 150);

      const timeoutId = setTimeout(() => {
        clearInterval(intervalId);
      }, 4000);

      return () => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
        const existingContainer = document.getElementById('c360-host-sidebar-subnav');
        if (existingContainer?.parentNode) {
          existingContainer.parentNode.removeChild(existingContainer);
        }
        if (chevronBtnRef.current?.parentNode) {
          chevronBtnRef.current.parentNode.removeChild(chevronBtnRef.current);
        }
      };
    }

    return () => {
      const existingContainer = document.getElementById('c360-host-sidebar-subnav');
      if (existingContainer?.parentNode) {
        existingContainer.parentNode.removeChild(existingContainer);
      }
      if (chevronBtnRef.current?.parentNode) {
        chevronBtnRef.current.parentNode.removeChild(chevronBtnRef.current);
      }
    };
  }, [toggleExpand]);

  // Sync chevron rotation
  useEffect(() => {
    if (chevronBtnRef.current) {
      const svg = chevronBtnRef.current.querySelector<SVGElement>('.c360-chevron-svg');
      if (svg) {
        svg.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
      }
    }
  }, [isExpanded]);

  if (!portalTarget || !isExpanded) {
    return null;
  }

  return ReactDOM.createPortal(
    <div
      id="customer360-mf-scope"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        width: 'calc(100% - 24px)',
        paddingLeft: '10px',
        borderLeft: '2px solid #e2e8f0',
        marginLeft: '22px',
        marginTop: '2px',
        marginBottom: '6px',
        boxSizing: 'border-box',
      }}
    >
      {visibleItems.map((item) => {
        const isActive =
          activePage === item.id ||
          (item.id === 'individual' && activePage === 'customer-360' && useCustomerStore.getState().customerType === 'individual') ||
          (item.id === 'non-individual' && activePage === 'customer-360' && useCustomerStore.getState().customerType === 'corporate');
        const isHovered = hoveredId === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              item.onClick();
            }}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
            id={`host-subnav-${item.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '7px 10px',
              borderRadius: '8px',
              border: 'none',
              background: isActive
                ? '#eff6ff'
                : isHovered
                ? '#f8fafc'
                : 'transparent',
              color: isActive
                ? '#1d4ed8'
                : isHovered
                ? '#0f172a'
                : '#475569',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 120ms ease',
              textAlign: 'left',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              letterSpacing: '-0.01em',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          >
            <span
              style={{
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isActive
                  ? '#2563eb'
                  : isHovered
                  ? '#475569'
                  : '#94a3b8',
                transition: 'color 120ms ease',
                flexShrink: 0,
              }}
            >
              {item.icon}
            </span>
            <span
              style={{
                flex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>,
    portalTarget
  );
};
