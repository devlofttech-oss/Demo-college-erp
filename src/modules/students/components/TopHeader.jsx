import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, LogOut, UserRound } from 'lucide-react';
import { defaultRoles, getRoleById } from '../../userRoles/rolePermissions';
import mauryaLogo from '../../../../assets/maurya.png';

const departmentOrder = [
  'Maurya College of Nursing',
  'Maurya College of Physiotherapy',
  'Maurya College of Allied Health Sciences',
];

function getCourseLabel(course = {}) {
  const suffix = course.admissionType || course.courseYear || '';
  return [course.courseName || course.name || course.courseCode, suffix].filter(Boolean).join(' - ');
}

function getDepartmentLabel(course = {}) {
  const source = [
    course.department,
    course.departmentName,
    course.collegeName,
    course.institute,
    course.courseName,
    course.courseCode,
  ].filter(Boolean).join(' ').toLowerCase();

  if (source.includes('nursing')) return 'Maurya College of Nursing';
  if (source.includes('physio') || source.includes('bpt')) return 'Maurya College of Physiotherapy';
  if (
    source.includes('allied') ||
    source.includes('bot') ||
    source.includes('atot') ||
    source.includes('occupational') ||
    source.includes('anaesthesia') ||
    source.includes('anesthesia') ||
    source.includes('operation') ||
    source.includes('imaging') ||
    source.includes('mit') ||
    source.includes('mlt')
  ) {
    return 'Maurya College of Allied Health Sciences';
  }

  const fallback = course.collegeName || course.department || course.institute || 'Other Courses';
  return fallback
    .replace(/\([^)]*\)/g, '')
    .replace(/\bMysore\b|\bMysuru\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Other Courses';
}

function buildDepartmentCourseGroups(courses = []) {
  const groups = new Map();
  courses.forEach((course) => {
    if (!course?.courseCode) return;
    const departmentName = getDepartmentLabel(course);
    if (!groups.has(departmentName)) groups.set(departmentName, { name: departmentName, courses: [] });
    groups.get(departmentName).courses.push(course);
  });

  return [...groups.values()].sort((a, b) => {
    const firstIndex = departmentOrder.indexOf(a.name);
    const secondIndex = departmentOrder.indexOf(b.name);
    if (firstIndex !== -1 || secondIndex !== -1) {
      return (firstIndex === -1 ? 999 : firstIndex) - (secondIndex === -1 ? 999 : secondIndex);
    }
    return a.name.localeCompare(b.name);
  });
}

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
  const [courseMenuOpen, setCourseMenuOpen] = useState(false);
  const [expandedDepartment, setExpandedDepartment] = useState('');
  const profileMenuRef = useRef(null);
  const courseMenuRef = useRef(null);
  const currentRoleId = user?.roleId || 'admin';
  const currentRole = getRoleById(defaultRoles, currentRoleId);
  const isSuperAdmin = currentRoleId === 'super-admin';
  const isParent = currentRoleId === 'parent';
  const userDisplayId = user?.displayId || user?.adminId || user?.employeeId || user?.uid?.slice(0, 8) || '-';
  const instituteId = user?.selectedCollege?.code || institute?.instituteId || institute?.code || '-';
  const collegeName = institute?.name || user?.selectedCollege?.name || 'College Management';
  const roleLabel = (currentRole?.name || 'Admin').toUpperCase();
  const selectedCourseValue = isParent && !courses.some((course) => course.courseCode === courseCode)
    ? courses[0]?.courseCode || ''
    : courseCode;
  const selectedCourse = useMemo(
    () => courses.find((course) => course.courseCode === selectedCourseValue) || null,
    [courses, selectedCourseValue]
  );
  const courseGroups = useMemo(() => buildDepartmentCourseGroups(courses), [courses]);
  const selectedDepartmentName = selectedCourse ? getDepartmentLabel(selectedCourse) : '';
  const selectedCourseLabel = selectedCourse
    ? getCourseLabel(selectedCourse)
    : isParent && !courses.length
      ? 'Student Course'
      : 'All Courses';
  const coursePickerDisabled = isParent && courses.length <= 1;

  const toggleCourseMenu = () => {
    if (coursePickerDisabled) return;
    if (!courseMenuOpen) setExpandedDepartment(selectedDepartmentName);
    setCourseMenuOpen((open) => !open);
  };

  const selectCourse = (nextCourseCode) => {
    onCourseChange?.(nextCourseCode);
    setCourseMenuOpen(false);
  };

  useEffect(() => {
    const closeMenus = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileOpen(false);
      }
      if (!courseMenuRef.current?.contains(event.target)) {
        setCourseMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeMenus);
    return () => document.removeEventListener('mousedown', closeMenus);
  }, []);

  return (
    <header className="erp-header min-h-[72px] bg-white border-b border-slate-200 px-4 lg:px-8 py-3 shrink-0">
      <div className="erp-header-grid">
        <div className="erp-header-college-title" title={collegeName}>
          <img src={mauryaLogo} alt="" className="erp-header-logo" />
          <span className="erp-header-college-name">{collegeName}</span>
        </div>
        <div className="erp-header-actions">
        <div className="erp-header-filters">
          <label className="erp-course-picker-label text-xs font-semibold text-slate-500">
            <span className="sr-only">Course</span>
            <div ref={courseMenuRef} className={`erp-course-picker ${courseMenuOpen ? 'is-open' : ''}`}>
              <button
                type="button"
                onClick={toggleCourseMenu}
                disabled={coursePickerDisabled}
                className="erp-header-select erp-course-picker-button bg-white border border-slate-200 rounded-lg shadow-[0_2px_8px_rgba(15,23,42,0.04)] px-3 text-xs text-slate-600 outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
                title="Select course"
                aria-haspopup="menu"
                aria-expanded={courseMenuOpen}
              >
                <span>{selectedCourseLabel}</span>
                <ChevronDown className="erp-course-picker-chevron" size={15} />
              </button>
              {courseMenuOpen && !coursePickerDisabled && (
                <div className="erp-course-picker-menu" role="menu">
                  {!isParent && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedDepartment('');
                        selectCourse('all');
                      }}
                      className={`erp-course-picker-all ${selectedCourseValue === 'all' ? 'is-selected' : ''}`}
                      role="menuitem"
                    >
                      <span>All Courses</span>
                      {selectedCourseValue === 'all' && <Check size={15} />}
                    </button>
                  )}
                  {isParent && !courses.length && (
                    <div className="erp-course-picker-empty">Student Course</div>
                  )}
                  {courseGroups.map((group) => {
                    const expanded = expandedDepartment === group.name;
                    return (
                      <div key={group.name} className="erp-course-picker-group">
                        <button
                          type="button"
                          onClick={() => setExpandedDepartment(expanded ? '' : group.name)}
                          className="erp-course-picker-department"
                          aria-expanded={expanded}
                        >
                          <span>{group.name}</span>
                          <span className="erp-course-picker-count">{group.courses.length}</span>
                          <ChevronRight className={`erp-course-picker-group-chevron ${expanded ? 'is-expanded' : ''}`} size={15} />
                        </button>
                        {expanded && (
                          <div className="erp-course-picker-courses">
                            {group.courses.map((course) => {
                              const selected = selectedCourseValue === course.courseCode;
                              return (
                                <button
                                  type="button"
                                  key={course.courseCode}
                                  onClick={() => selectCourse(course.courseCode)}
                                  className={`erp-course-picker-course ${selected ? 'is-selected' : ''}`}
                                  role="menuitem"
                                >
                                  <span>{getCourseLabel(course)}</span>
                                  {selected && <Check size={14} />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </label>
          {!isParent && (
          <label className="text-xs font-semibold text-slate-500">
            <span className="sr-only">Academic Year</span>
            <select
              value={academicYear}
              onChange={(event) => onAcademicYearChange?.(event.target.value)}
              disabled={!academicYears.length}
              className="erp-header-year-select bg-white border border-slate-200 rounded-lg shadow-[0_2px_8px_rgba(15,23,42,0.04)] px-3 text-xs text-slate-600 outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
            >
              {!academicYears.length && <option value="">Academic Year</option>}
              {academicYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          )}
        </div>
        <div className="erp-header-user-cluster">
        {isSuperAdmin && (
          <>
            <div className="hidden sm:block h-9 w-px bg-slate-200" />
            <div className="hidden xl:block text-xs text-slate-700 leading-5 whitespace-nowrap">
              <div>User ID : {userDisplayId}</div>
              <div>Institute ID : {instituteId}</div>
            </div>
            <div className="hidden xl:block h-9 w-px bg-slate-200" />
          </>
        )}
        <div className="erp-header-user-text text-right leading-tight min-w-0">
          <div className="text-sm font-bold text-slate-900 whitespace-nowrap">{user?.name || 'Admin'}</div>
          <span className="erp-header-role-badge inline-flex bg-[#ff9f68] text-white text-[10px] px-3 py-1 rounded-md font-bold uppercase whitespace-nowrap leading-none">
            {roleLabel}
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
      </div>
      </div>
    </header>
  );
}
