import { GraduationCap, Moon, Sun } from 'lucide-react';
import { getEnabledModules } from '../../moduleRegistry';
import { canAccess, defaultRoles } from '../../userRoles/rolePermissions';

export default function Sidebar({ activePage, collapsed = false, currentUser, institute, onNavigate, onThemeToggle, themeMode = 'dark' }) {
  const currentRoleId = currentUser?.roleId || 'admin';
  const collegeName = institute?.name || currentUser?.selectedCollege?.name || 'College';
  const navItems = getEnabledModules()
    .filter((module) => !module.permission || canAccess(defaultRoles, currentRoleId, module.permission))
    .filter((module) => !module.hideFromSidebar && !module.footer)
    .map((module) => {
      const Icon = module.icon;
      return {
        id: module.id,
        label: module.label,
        group: module.group,
        status: module.status,
        icon: <Icon size={18} />,
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
        icon: <Icon size={18} />,
      };
    });

  return (
    <aside className={`erp-sidebar ${collapsed ? 'is-collapsed' : ''} bg-white border-r border-slate-200 shrink-0 hidden lg:flex flex-col transition-all duration-300`}>
      <div className={collapsed ? 'px-5 pt-5 pb-4' : 'px-9 pt-5 pb-4'}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="h-12 w-12 rounded-full border-2 border-emerald-700 flex items-center justify-center text-emerald-700 shrink-0">
            <GraduationCap size={26} />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-[13px] font-bold text-slate-900">{collegeName}</div>
              <div className="text-[10px] text-slate-500">ERP Management Suite</div>
            </div>
          )}
        </div>
      </div>

      <nav className={`${collapsed ? 'px-4' : 'px-9'} py-3 flex flex-col flex-1`}>
        {navItems.map(({ id, label, icon, status }) => {
          const active = activePage === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`h-16 border-b border-slate-100 flex items-center text-[15px] ${
                collapsed ? 'justify-center' : 'justify-between'
              } ${active ? 'text-slate-800' : 'text-slate-600'}`}
              title={collapsed ? label : undefined}
            >
              <span className={`flex items-center ${collapsed ? 'justify-center h-11 w-11' : 'gap-3'} ${active ? 'bg-[#e7e7ea] rounded-md px-3 py-3 w-full' : ''}`}>
                {icon}
                {!collapsed && label}
                {!collapsed && status === 'planned' && <span className="ml-auto text-[9px] uppercase text-slate-400">Soon</span>}
                {!collapsed && status === 'demo' && <span className="ml-auto text-[9px] uppercase text-slate-400">Demo</span>}
              </span>
            </button>
          );
        })}
      </nav>

      {!!footerItems.length && (
        <nav className={`${collapsed ? 'px-4' : 'px-9'} pb-5 flex flex-col mt-auto`}>
          <button
            onClick={onThemeToggle}
            className={`h-14 border-t border-slate-100 flex items-center text-[15px] text-slate-600 ${collapsed ? 'justify-center' : 'justify-between'}`}
            title={collapsed ? 'Theme mode' : undefined}
          >
            <span className={`flex items-center ${collapsed ? 'justify-center h-11 w-11' : 'gap-3'}`}>
              {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              {!collapsed && (
                <>
                  <span>{themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                  <span className="ml-auto h-6 w-11 rounded-full bg-[#e7e7ea] border border-slate-200 p-0.5 flex items-center">
                    <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${themeMode === 'dark' ? 'translate-x-0' : 'translate-x-5'}`} />
                  </span>
                </>
              )}
            </span>
          </button>
          {footerItems.map(({ id, label, icon }) => {
            const active = activePage === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`h-14 border-t border-slate-100 flex items-center text-[15px] ${
                  collapsed ? 'justify-center' : 'justify-between'
                } ${active ? 'text-slate-800' : 'text-slate-600'}`}
                title={collapsed ? label : undefined}
              >
                <span className={`flex items-center ${collapsed ? 'justify-center h-11 w-11' : 'gap-3'} ${active ? 'bg-[#e7e7ea] rounded-md px-3 py-3 w-full' : ''}`}>
                  {icon}
                  {!collapsed && label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </aside>
  );
}
