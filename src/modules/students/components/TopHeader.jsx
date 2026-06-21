import { LogOut, Menu, MessageSquareText, Moon, Sun, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { canAccess, defaultRoles, getRoleById } from '../../userRoles/rolePermissions';

export default function TopHeader({
  academicYear,
  academicYears = [],
  institute,
  onAcademicYearChange,
  onMenuToggle,
  onNavigate,
  onThemeToggle,
  themeMode = 'dark',
  user,
  onLogout,
}) {
  const currentRoleId = user?.roleId || 'admin';
  const currentRole = getRoleById(defaultRoles, currentRoleId);
  const canViewNotices = canAccess(defaultRoles, currentRoleId, 'notices.view');
  const userDisplayId = user?.displayId || user?.adminId || user?.employeeId || user?.uid?.slice(0, 8) || '-';
  const instituteId = user?.selectedCollege?.code || institute?.instituteId || institute?.code || '-';

  const openNoticeBoard = () => {
    if (!canViewNotices) {
      toast.error('You do not have permission to open the notice board.');
      return;
    }
    onNavigate?.('notice-board');
  };

  return (
    <header className="erp-header h-[72px] bg-white border-b border-slate-200 flex items-center justify-between px-5 lg:px-10 shrink-0">
      <div className="flex items-center gap-5 min-w-0">
        <button
          onClick={onMenuToggle}
          className="h-12 w-12 rounded-full bg-[#fb9a5b] text-slate-800 flex items-center justify-center shadow-sm shrink-0"
          title="Toggle menu"
        >
          <Menu size={20} />
        </button>
        <div className="hidden md:flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500">
            <span className="sr-only">Academic Year</span>
            <select
              value={academicYear}
              onChange={(event) => onAcademicYearChange?.(event.target.value)}
              className="w-44 h-11 bg-white border border-slate-200 rounded-lg shadow-[0_2px_8px_rgba(15,23,42,0.04)] px-4 text-sm text-slate-600 outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
            >
              {academicYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <button
          onClick={onThemeToggle}
          className="erp-theme-toggle h-10 w-10 rounded-full border border-slate-200 flex items-center justify-center"
          title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
        >
          {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button onClick={openNoticeBoard} className="erp-notification-button relative h-10 w-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-500" title="Open notice board">
          <MessageSquareText size={18} />
          {canViewNotices && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 border border-white" />}
        </button>
        <div className="hidden sm:block h-9 w-px bg-slate-200" />
        <div className="hidden sm:block text-xs text-slate-700 leading-5">
          <div>User ID : {userDisplayId}</div>
          <div>Institute ID : {instituteId}</div>
        </div>
        <div className="hidden sm:block h-9 w-px bg-slate-200" />
        <div className="text-right leading-tight">
          <div className="text-sm font-bold text-slate-900">{user?.name || 'Admin'}</div>
          <span className="inline-flex bg-[#ff9f68] text-white text-[9px] px-2 py-0.5 rounded-sm font-bold uppercase">
            {currentRole?.name || 'Admin'}
          </span>
        </div>
        <div className="h-10 w-10 rounded-full bg-[#2e333b] text-emerald-300 flex items-center justify-center">
          <UserRound size={22} />
        </div>
        <button
          onClick={onLogout}
          className="h-10 w-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
