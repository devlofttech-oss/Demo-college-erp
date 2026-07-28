import { useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  Menu,
  Moon,
  Sun,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { getEnabledModules, sortModulesByDisplayOrder } from '../../moduleRegistry';
import { canAccess, canAccessFinancialReports, defaultRoles } from '../../userRoles/rolePermissions';
import devloftLogo from '../../../../assets/logo.png';

export default function Sidebar({ activePage, activeSubmenuId = '', collapsed = false, currentUser, onNavigate, onThemeToggle, onToggleCollapse, themeMode = 'dark' }) {
  const [expandedState, setExpandedState] = useState({ page: activePage, moduleId: activePage });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentRoleId = currentUser?.roleId || 'admin';
  const isSuperAdmin = currentRoleId === 'super-admin';
  const isAdmin = currentRoleId === 'admin';
  const navItems = useMemo(() => {
    const canShowHiddenModule = (module) => {
      if (module.id === 'dashboard') return isAdmin || isSuperAdmin;
      if (module.id === 'parent-portal') return currentRoleId === 'parent';
      return isSuperAdmin && ['academics', 'user-roles'].includes(module.id);
    };
    return sortModulesByDisplayOrder(getEnabledModules()
      .filter((module) => !module.permission || canAccess(defaultRoles, currentRoleId, module.permission))
      .filter((module) => !module.hideFromSidebar || canShowHiddenModule(module)))
      .map((module) => {
        const Icon = module.icon;
        return {
          id: module.id,
          label: module.label,
          group: module.group,
          status: module.status,
          icon: <Icon className="erp-sidebar-icon" size={18} />,
        };
      });
  }, [currentRoleId, isAdmin, isSuperAdmin]);

  const selectTheme = (nextTheme) => {
    if (nextTheme !== themeMode) onThemeToggle?.();
  };

  const submenuItemsByModule = useMemo(() => ({
    attendance: [
      {
        id: 'general-attendance',
        label: 'General Attendance',
        icon: <CalendarDays size={16} />,
        moduleId: 'attendance',
        state: { attendanceSubmenu: 'general-attendance', attendanceTask: 'students', attendanceBranch: 'mark-general-students', attendanceMode: 'students' },
        enabled: canAccess(defaultRoles, currentRoleId, 'attendance.view'),
      },
      {
        id: 'staff-attendance',
        label: 'Staff Attendance',
        icon: <UserCheck size={16} />,
        moduleId: 'attendance',
        state: { attendanceSubmenu: 'staff-attendance', attendanceTask: 'staff', attendanceBranch: 'mark-staff', attendanceMode: 'staff' },
        enabled: canAccess(defaultRoles, currentRoleId, 'attendance.markStaff') || canAccess(defaultRoles, currentRoleId, 'staff.attendance'),
      },
      {
        id: 'student-attendance',
        label: 'Student Attendance',
        icon: <Users size={16} />,
        moduleId: 'attendance',
        state: { attendanceSubmenu: 'student-attendance', attendanceTask: 'students', attendanceBranch: 'mark-students', attendanceMode: 'students' },
        enabled: canAccess(defaultRoles, currentRoleId, 'attendance.view'),
      },
    ],
    reports: [
      {
        id: 'attendance',
        label: 'Attendance',
        icon: <ClipboardList size={16} />,
        moduleId: 'reports',
        state: { reportCategory: 'attendance' },
        enabled: canAccess(defaultRoles, currentRoleId, 'attendance.reports'),
      },
      {
        id: 'documents',
        label: 'Documents',
        icon: <FileCheck2 size={16} />,
        moduleId: 'reports',
        state: { reportCategory: 'documents' },
        enabled: canAccess(defaultRoles, currentRoleId, 'documents.view') || canAccess(defaultRoles, currentRoleId, 'students.documents'),
      },
      {
        id: 'exams',
        label: 'Exams',
        icon: <BookOpenCheck size={16} />,
        moduleId: 'reports',
        state: { reportCategory: 'exams' },
        enabled: canAccess(defaultRoles, currentRoleId, 'exams.view') || canAccess(defaultRoles, currentRoleId, 'exams.results'),
      },
      {
        id: 'financial',
        label: 'Financial',
        icon: <Wallet size={16} />,
        moduleId: 'reports',
        state: { reportCategory: 'financial' },
        enabled: canAccessFinancialReports(defaultRoles, currentRoleId),
      },
      {
        id: 'students',
        label: 'Student',
        icon: <GraduationCap size={16} />,
        moduleId: 'reports',
        state: { reportCategory: 'students' },
        enabled: canAccess(defaultRoles, currentRoleId, 'students.view'),
      },
    ],
  }), [currentRoleId]);
  const visibleMobileItems = useMemo(() => navItems, [navItems]);
  const activeDefaultExpandedModuleId = submenuItemsByModule[activePage]?.some((item) => item.enabled) ? activePage : '';
  const expandedModuleId = expandedState.page === activePage ? expandedState.moduleId : activeDefaultExpandedModuleId;

  const renderNavButton = ({ id, label, icon, status }) => {
    const active = activePage === id;
    const submenuItems = (submenuItemsByModule[id] || []).filter((item) => item.enabled);
    const expanded = Boolean(!collapsed && submenuItems.length > 0 && expandedModuleId === id);
    const handleClick = () => {
      if (submenuItems.length && !collapsed) {
        setExpandedState({ page: activePage, moduleId: expandedModuleId === id ? '' : id });
        return;
      }
      setExpandedState({ page: activePage, moduleId: '' });
      onNavigate(id);
    };
    return (
      <div key={id} className="erp-sidebar-item-wrap">
        <button
          type="button"
          onClick={handleClick}
          className={`erp-sidebar-item ${active ? 'is-active' : ''}`}
          data-tooltip={collapsed ? label : undefined}
          aria-label={collapsed ? label : undefined}
          aria-expanded={submenuItems.length > 0 ? expanded : undefined}
          title={collapsed ? label : undefined}
        >
          <span className="erp-sidebar-item-icon">{icon}</span>
          {!collapsed && <span className="erp-sidebar-item-label">{label}</span>}
          {!collapsed && submenuItems.length > 0 && <ChevronRight className={`erp-sidebar-submenu-chevron ${expanded ? 'is-open' : ''}`} size={16} />}
          {!collapsed && status === 'planned' && <span className="erp-sidebar-item-badge">Soon</span>}
          {!collapsed && status === 'demo' && <span className="erp-sidebar-item-badge">Demo</span>}
        </button>
        {expanded && (
          <div className="erp-sidebar-submenu">
            {submenuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setExpandedState({ page: activePage, moduleId: item.moduleId });
                  onNavigate(item.moduleId, { state: item.state });
                }}
                className={`erp-sidebar-subitem ${activeSubmenuId === item.id || activeSubmenuId === item.state.reportCategory ? 'is-active' : ''}`}
              >
                <span className="erp-sidebar-subitem-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleMobileNavigate = (item) => {
    setExpandedState({ page: activePage, moduleId: '' });
    setMobileMenuOpen(false);
    onNavigate(item.id);
  };

  const handleMobileSubmenuNavigate = (item) => {
    setExpandedState({ page: activePage, moduleId: item.moduleId });
    setMobileMenuOpen(false);
    onNavigate(item.moduleId, { state: item.state });
  };

  const renderMobileDrawerItem = ({ id, label, icon, status }) => {
    const active = activePage === id;
    const submenuItems = (submenuItemsByModule[id] || []).filter((item) => item.enabled);
    const expanded = submenuItems.length > 0 && expandedModuleId === id;
    return (
      <div key={id} className="erp-mobile-drawer-item-wrap">
        <button
          type="button"
          onClick={() => {
            if (submenuItems.length > 0) {
              setExpandedState({ page: activePage, moduleId: expanded ? '' : id });
              return;
            }
            handleMobileNavigate({ id });
          }}
          className={`erp-mobile-drawer-item ${active ? 'is-active' : ''}`}
          aria-expanded={submenuItems.length > 0 ? expanded : undefined}
        >
          <span className="erp-mobile-drawer-item-icon">{icon}</span>
          <span>{label}</span>
          {status === 'planned' && <span className="erp-sidebar-item-badge">Soon</span>}
          {status === 'demo' && <span className="erp-sidebar-item-badge">Demo</span>}
          {submenuItems.length > 0 && <ChevronRight className={`erp-sidebar-submenu-chevron ${expanded ? 'is-open' : ''}`} size={16} />}
        </button>
        {expanded && (
          <div className="erp-mobile-drawer-submenu">
            {submenuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleMobileSubmenuNavigate(item)}
                className={`erp-mobile-drawer-subitem ${activeSubmenuId === item.id || activeSubmenuId === item.state.reportCategory ? 'is-active' : ''}`}
              >
                <span className="erp-sidebar-subitem-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
    <aside className={`erp-sidebar ${collapsed ? 'is-collapsed' : ''} bg-white border-r border-slate-200 shrink-0 hidden md:flex flex-col transition-all duration-300`}>
      <div className="erp-sidebar-sticky">
        <div className="erp-sidebar-brand-card">
          {collapsed ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="erp-sidebar-logo erp-sidebar-expand-logo"
              aria-label="Expand sidebar"
            >
              <img src={devloftLogo} alt="" className="h-full w-full object-contain rounded-lg" />
            </button>
          ) : (
            <div className="erp-sidebar-logo">
              <img src={devloftLogo} alt="" className="h-full w-full object-contain rounded-lg" />
            </div>
          )}
          {!collapsed && (
            <div className="erp-sidebar-brand-copy">
              <div className="erp-sidebar-brand-name">Devloft College Management</div>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="erp-sidebar-collapse-button"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        <div className="erp-sidebar-menu-card">
          <nav className="erp-sidebar-nav">
            {navItems.map(renderNavButton)}
          </nav>
        </div>

        <div className="erp-sidebar-theme-switch" aria-label="Theme mode">
          <button
            type="button"
            onClick={() => selectTheme('light')}
            className={`erp-theme-mode-button ${themeMode === 'light' ? 'is-active' : ''}`}
            title="Light mode"
            aria-pressed={themeMode === 'light'}
          >
            <Sun size={18} />
            {!collapsed && <span>Light</span>}
          </button>
          <button
            type="button"
            onClick={() => selectTheme('dark')}
            className={`erp-theme-mode-button ${themeMode === 'dark' ? 'is-active' : ''}`}
            title="Dark mode"
            aria-pressed={themeMode === 'dark'}
          >
            <Moon size={18} />
            {!collapsed && <span>Dark</span>}
          </button>
        </div>
      </div>
    </aside>
    <button
      type="button"
      onClick={() => setMobileMenuOpen(true)}
      className="erp-mobile-menu-button md:hidden"
      aria-label="Open menu"
    >
      <Menu size={22} />
    </button>
    <div className={`erp-mobile-drawer-shell md:hidden ${mobileMenuOpen ? 'is-open' : ''}`} aria-hidden={!mobileMenuOpen}>
      <button
        type="button"
        className="erp-mobile-drawer-backdrop"
        onClick={() => setMobileMenuOpen(false)}
        aria-label="Close menu"
      />
      <aside className="erp-mobile-drawer" aria-label="Mobile modules">
        <div className="erp-mobile-drawer-header">
          <div className="erp-sidebar-logo">
            <img src={devloftLogo} alt="" className="h-full w-full object-contain rounded-lg" />
          </div>
          <div className="erp-mobile-drawer-title">Devloft College Management</div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="erp-mobile-drawer-close"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="erp-mobile-drawer-nav">
          {visibleMobileItems.map(renderMobileDrawerItem)}
        </nav>
        <div className="erp-mobile-drawer-theme" aria-label="Theme mode">
          <button
            type="button"
            onClick={() => selectTheme('light')}
            className={`erp-theme-mode-button ${themeMode === 'light' ? 'is-active' : ''}`}
            aria-pressed={themeMode === 'light'}
          >
            <Sun size={16} />
            Light
          </button>
          <button
            type="button"
            onClick={() => selectTheme('dark')}
            className={`erp-theme-mode-button ${themeMode === 'dark' ? 'is-active' : ''}`}
            aria-pressed={themeMode === 'dark'}
          >
            <Moon size={16} />
            Dark
          </button>
        </div>
      </aside>
    </div>
    </>
  );
}
