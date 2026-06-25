import { ChevronLeft, ChevronRight, GraduationCap, Moon, Sun } from 'lucide-react';
import { getEnabledModules } from '../../moduleRegistry';
import { canAccess, defaultRoles } from '../../userRoles/rolePermissions';

export default function Sidebar({ activePage, collapsed = false, currentUser, institute, onNavigate, onThemeToggle, onToggleCollapse, themeMode = 'dark' }) {
  const currentRoleId = currentUser?.roleId || 'admin';
  const isSuperAdmin = currentRoleId === 'super-admin';
  const collegeName = institute?.name || '-';
  const navItems = getEnabledModules()
    .filter((module) => !module.permission || canAccess(defaultRoles, currentRoleId, module.permission))
    .filter((module) => !module.footer)
    .filter((module) => isSuperAdmin || !module.hideFromSidebar)
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
  const footerItems = getEnabledModules()
    .filter((module) => !module.permission || canAccess(defaultRoles, currentRoleId, module.permission))
    .filter((module) => !module.hideFromSidebar && module.footer)
    .map((module) => {
      const Icon = module.icon;
      return {
        id: module.id,
        label: module.label,
        icon: <Icon className="erp-sidebar-icon" size={18} />,
      };
    });

  const selectTheme = (nextTheme) => {
    if (nextTheme !== themeMode) onThemeToggle?.();
  };

  const renderNavButton = ({ id, label, icon, status }) => {
    const active = activePage === id;
    return (
      <button
        key={id}
        onClick={() => onNavigate(id)}
        className={`erp-sidebar-item ${active ? 'is-active' : ''}`}
        title={collapsed ? label : undefined}
      >
        <span className="erp-sidebar-item-icon">{icon}</span>
        {!collapsed && <span className="erp-sidebar-item-label">{label}</span>}
        {!collapsed && status === 'planned' && <span className="erp-sidebar-item-badge">Soon</span>}
        {!collapsed && status === 'demo' && <span className="erp-sidebar-item-badge">Demo</span>}
      </button>
    );
  };

  return (
    <aside className={`erp-sidebar ${collapsed ? 'is-collapsed' : ''} bg-white border-r border-slate-200 shrink-0 hidden lg:flex flex-col transition-all duration-300`}>
      <div className="erp-sidebar-sticky">
        <div className="erp-sidebar-brand-card">
          {collapsed ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="erp-sidebar-logo erp-sidebar-expand-logo"
              title="Expand sidebar"
            >
              <ChevronRight className="erp-sidebar-logo-icon" size={26} />
            </button>
          ) : (
            <div className="erp-sidebar-logo">
              <GraduationCap className="erp-sidebar-logo-icon" size={26} />
            </div>
          )}
          {!collapsed && (
            <div className="erp-sidebar-brand-copy">
              <div className="erp-sidebar-brand-name">{collegeName}</div>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="erp-sidebar-collapse-button"
              title="Collapse sidebar"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        <div className="erp-sidebar-menu-card">
          <nav className="erp-sidebar-nav">
            {navItems.map(renderNavButton)}
            {footerItems.map(renderNavButton)}
          </nav>
        </div>

        <div className="erp-sidebar-theme-switch" aria-label="Theme mode">
          <button
            type="button"
            onClick={() => selectTheme('light')}
            className={themeMode === 'light' ? 'is-active' : ''}
            title="Light mode"
          >
            <Sun size={18} />
            {!collapsed && <span>Light</span>}
          </button>
          <button
            type="button"
            onClick={() => selectTheme('dark')}
            className={themeMode === 'dark' ? 'is-active' : ''}
            title="Dark mode"
          >
            <Moon size={18} />
            {!collapsed && <span>Dark</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
