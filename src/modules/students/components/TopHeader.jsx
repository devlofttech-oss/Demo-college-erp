import { useEffect, useRef, useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import { defaultRoles, getRoleById } from '../../userRoles/rolePermissions';

export default function TopHeader({
  academicYear,
  academicYears = [],
  courseCode = 'all',
  courses = [],
  institute,
  onAcademicYearChange,
  onCourseChange,
  user,
  onLogout,
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const currentRoleId = user?.roleId || 'admin';
  const currentRole = getRoleById(defaultRoles, currentRoleId);
  const isSuperAdmin = currentRoleId === 'super-admin';
  const isParent = currentRoleId === 'parent';
  const userDisplayId = user?.displayId || user?.adminId || user?.employeeId || user?.uid?.slice(0, 8) || '-';
  const instituteId = user?.selectedCollege?.code || institute?.instituteId || institute?.code || '-';

  useEffect(() => {
    const closeProfileMenu = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', closeProfileMenu);
    return () => document.removeEventListener('mousedown', closeProfileMenu);
  }, []);

  return (
    <header className="erp-header h-[72px] bg-white border-b border-slate-200 flex items-center justify-between px-5 lg:px-10 shrink-0">
      <div className="flex items-center gap-5 min-w-0">
        <div className="hidden md:flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500">
            <span className="sr-only">Course</span>
            <select
              value={courseCode}
              onChange={(event) => onCourseChange?.(event.target.value)}
              className="w-72 h-11 bg-white border border-slate-200 rounded-lg shadow-[0_2px_8px_rgba(15,23,42,0.04)] px-4 text-sm text-slate-600 outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
              title="Select course"
            >
              <option value="all">All Courses</option>
              {courses.map((course) => (
                <option key={course.courseCode} value={course.courseCode}>
                  {course.courseName} - {course.admissionType || course.courseYear}
                </option>
              ))}
            </select>
          </label>
          {!isParent && (
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
          )}
        </div>
      </div>

      <div className="flex items-center gap-5">
        {isSuperAdmin && (
          <>
            <div className="hidden sm:block h-9 w-px bg-slate-200" />
            <div className="hidden sm:block text-xs text-slate-700 leading-5">
              <div>User ID : {userDisplayId}</div>
              <div>Institute ID : {instituteId}</div>
            </div>
            <div className="hidden sm:block h-9 w-px bg-slate-200" />
          </>
        )}
        <div className="text-right leading-tight">
          <div className="text-sm font-bold text-slate-900">{user?.name || 'Admin'}</div>
          <span className="inline-flex bg-[#ff9f68] text-white text-[9px] px-2 py-0.5 rounded-sm font-bold uppercase">
            {currentRole?.name || 'Admin'}
          </span>
        </div>
        <div ref={profileMenuRef} className="erp-profile-menu-wrap relative">
          <button
            onClick={() => setProfileOpen((open) => !open)}
            className="h-10 w-10 rounded-full bg-[#2e333b] text-emerald-300 flex items-center justify-center"
            title="Profile"
          >
            <UserRound size={22} />
          </button>
          {profileOpen && (
            <div className="erp-profile-menu absolute right-0 top-12 w-44 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
              <button
                onClick={onLogout}
                className="erp-profile-logout w-full h-10 rounded-md px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
