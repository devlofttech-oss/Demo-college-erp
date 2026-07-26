import {
  Bell,
  BarChart3,
  BookOpen,
  BookOpenCheck,
  BedDouble,
  CalendarDays,
  FileText,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Settings,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

export const moduleDisplayOrder = [
  'academics',
  'attendance',
  'communication',
  'calendar',
  'dashboard',
  'document-management',
  'examination-results',
  'faculty-staff',
  'hostel-management',
  'parent-portal',
  'fees',
  'reports',
  'settings',
  'students',
  'subject-notes',
  'timetable',
  'user-roles',
];

const moduleIdAliases = {
  'notice-board': 'communication',
  'financial-reports': 'reports',
};

const modulePathAliases = {
  '/modules/notice-board': '/modules/communication',
  '/modules/financial-reports': '/modules/reports',
};

const displayOrder = moduleDisplayOrder.reduce((map, id, index) => {
  map[id] = index;
  return map;
}, {});

export const moduleRegistry = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    group: 'Daily Work',
    icon: LayoutDashboard,
    status: 'active',
    permission: 'dashboard.view',
    hideFromSidebar: true,
  },
  {
    id: 'students',
    label: 'Students',
    path: '/students',
    group: 'Daily Work',
    icon: GraduationCap,
    status: 'active',
    permission: 'students.view',
  },
  {
    id: 'faculty-staff',
    label: 'Faculty',
    path: '/modules/faculty-staff',
    group: 'Daily Work',
    icon: Users,
    status: 'active',
    permission: 'staff.view',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    path: '/modules/attendance',
    group: 'Daily Work',
    icon: Bell,
    status: 'active',
    permission: 'attendance.view',
  },
  {
    id: 'timetable',
    label: 'Timetable',
    path: '/modules/timetable',
    group: 'Daily Work',
    icon: BookOpen,
    status: 'active',
    permission: 'timetable.view',
  },
  {
    id: 'subject-notes',
    label: 'Subject Notes',
    path: '/modules/subject-notes',
    group: 'Daily Work',
    icon: BookOpenCheck,
    status: 'active',
    permission: 'subjectNotes.view',
  },
  {
    id: 'examination-results',
    label: 'Exams',
    path: '/modules/examination-results',
    group: 'Daily Work',
    icon: TrendingUp,
    status: 'active',
    permission: 'exams.view',
  },
  {
    id: 'communication',
    label: 'Communication',
    path: '/modules/communication',
    group: 'Daily Work',
    icon: MessageSquare,
    status: 'active',
    permission: 'notices.view',
  },
  {
    id: 'calendar',
    label: 'Curriculum',
    path: '/modules/calendar',
    group: 'Daily Work',
    icon: CalendarDays,
    status: 'active',
    permission: 'academicCurriculum.view',
  },
  {
    id: 'hostel-management',
    label: 'Hostel',
    path: '/modules/hostel-management',
    group: 'Daily Work',
    icon: BedDouble,
    status: 'active',
    permission: 'hostel.view',
  },
  {
    id: 'document-management',
    label: 'Documents',
    path: '/modules/document-management',
    group: 'Daily Work',
    icon: FileText,
    status: 'active',
    permission: 'documents.view',
  },
  {
    id: 'fees',
    label: 'Payment',
    path: '/modules/fees',
    group: 'Daily Work',
    icon: Wallet,
    status: 'active',
    permission: 'fees.view',
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/modules/reports',
    group: 'Daily Work',
    icon: BarChart3,
    status: 'active',
    permission: 'reports.view',
  },
  {
    id: 'academics',
    label: 'Academics',
    path: '/modules/academics',
    group: 'Admin Setup',
    icon: GraduationCap,
    status: 'active',
    permission: 'academics.view',
    hideFromSidebar: true,
  },
  {
    id: 'user-roles',
    label: 'Users & Roles',
    path: '/modules/user-roles',
    group: 'Admin Setup',
    icon: Settings,
    status: 'active',
    permission: 'users.view',
    hideFromSidebar: true,
  },
  {
    id: 'parent-portal',
    label: 'Parent Portal',
    path: '/modules/parent-portal',
    group: 'Parent Portal',
    icon: Users,
    status: 'active',
    permission: 'parentPortal.view',
    hideFromSidebar: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/modules/settings',
    group: 'Admin Setup',
    icon: Settings,
    status: 'active',
    permission: 'settings.view',
    footer: true,
  },
];

export function getEnabledModules() {
  return moduleRegistry.filter((module) => module.status !== 'disabled');
}

export function sortModulesByDisplayOrder(modules = []) {
  return [...modules].sort((first, second) => {
    const firstOrder = displayOrder[first.id] ?? 999;
    const secondOrder = displayOrder[second.id] ?? 999;
    if (firstOrder !== secondOrder) return firstOrder - secondOrder;
    return String(first.label || first.id).localeCompare(String(second.label || second.id));
  });
}

export function getModuleById(id) {
  const resolvedId = moduleIdAliases[id] || id;
  return moduleRegistry.find((module) => module.id === resolvedId) || null;
}

export function getModuleByPath(path) {
  const resolvedPath = modulePathAliases[path] || path;
  return moduleRegistry.find((module) => module.path === resolvedPath) || null;
}

export function getCanonicalModulePath(id) {
  return getModuleById(id)?.path || null;
}

