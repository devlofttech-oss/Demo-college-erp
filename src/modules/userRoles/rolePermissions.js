export const permissionGroups = [
  {
    id: 'students',
    label: 'Student Information',
    permissions: [
      ['students.view', 'View students'],
      ['students.create', 'Create admissions'],
      ['students.edit', 'Edit profiles'],
      ['students.archive', 'Archive/restore'],
      ['students.documents', 'Upload documents'],
      ['students.verifyDocuments', 'Verify documents'],
      ['students.promote', 'Promote/transfer'],
    ],
  },
  {
    id: 'staff',
    label: 'Faculty & Staff',
    permissions: [
      ['staff.view', 'View faculty/staff'],
      ['staff.create', 'Create faculty/staff'],
      ['staff.edit', 'Edit faculty/staff'],
      ['staff.archive', 'Archive/restore staff'],
      ['staff.leave', 'Manage leave'],
      ['staff.attendance', 'Mark attendance'],
    ],
  },
  {
    id: 'users',
    label: 'Users & Roles',
    permissions: [
      ['users.view', 'View users'],
      ['users.create', 'Create users'],
      ['users.edit', 'Edit users'],
      ['roles.view', 'View roles'],
      ['roles.edit', 'Edit permissions'],
    ],
  },
  {
    id: 'modules',
    label: 'Module Access',
    permissions: [
      ['attendance.view', 'Attendance module'],
      ['academicCurriculum.view', 'Academic curriculum module'],
      ['academics.view', 'Academics module'],
      ['academics.manage', 'Manage academics'],
      ['attendance.markStudents', 'Mark student attendance'],
      ['attendance.markStaff', 'Mark staff attendance'],
      ['attendance.reports', 'View attendance reports'],
      ['attendance.notifyParents', 'Parent notifications'],
      ['timetable.view', 'Timetable module'],
      ['timetable.create', 'Create timetable'],
      ['timetable.edit', 'Edit timetable'],
      ['timetable.publish', 'Publish timetable'],
      ['timetable.classrooms', 'Manage classrooms'],
      ['exams.view', 'Exams module'],
      ['exams.schedule', 'Schedule exams'],
      ['exams.assessments', 'Manage assessments'],
      ['exams.marks', 'Enter marks'],
      ['exams.results', 'Generate results'],
      ['exams.reportCards', 'Generate report cards'],
      ['fees.view', 'Fees module'],
      ['fees.setup', 'Set up fee structures'],
      ['fees.assign', 'Assign fees'],
      ['fees.collect', 'Record manual collections'],
      ['fees.adjust', 'Approve adjustments'],
      ['fees.reports', 'View fee reports'],
      ['financialReports.view', 'Financial reports module'],
      ['financialReports.export', 'Export financial reports'],
      ['financialReports.snapshots', 'Save financial summaries'],
      ['notices.view', 'Notice board module'],
      ['notices.create', 'Create announcements'],
      ['notices.edit', 'Edit announcements'],
      ['notices.archive', 'Archive announcements'],
      ['documents.view', 'Document management module'],
      ['documents.upload', 'Upload documents'],
      ['documents.verify', 'Verify documents'],
      ['documents.archive', 'Archive documents'],
      ['parentPortal.view', 'Parent portal'],
      ['parentPortal.viewAll', 'View all parent portal students'],
      ['settings.view', 'Settings module'],
      ['settings.manage', 'Manage settings'],
    ],
  },
];

export const defaultRoles = [
  {
    id: 'super-admin',
    name: 'Super Admin',
    description: 'Full ERP control including users, roles, and all modules.',
    locked: true,
    permissions: permissionGroups.flatMap((group) => group.permissions.map(([key]) => key)),
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Administrative ERP access for daily operations.',
    locked: false,
    permissions: [
      'students.view',
      'students.edit',
      'staff.view',
      'staff.create',
      'staff.edit',
      'staff.archive',
      'staff.leave',
      'staff.attendance',
      'attendance.view',
      'attendance.markStudents',
      'attendance.markStaff',
      'attendance.reports',
      'attendance.notifyParents',
      'timetable.view',
      'timetable.create',
      'timetable.edit',
      'timetable.publish',
      'timetable.classrooms',
      'exams.view',
      'exams.schedule',
      'exams.assessments',
      'exams.marks',
      'exams.results',
      'exams.reportCards',
      'fees.view',
      'fees.setup',
      'fees.assign',
      'fees.collect',
      'fees.adjust',
      'fees.reports',
      'financialReports.view',
      'financialReports.export',
      'financialReports.snapshots',
      'documents.view',
      'documents.upload',
      'documents.verify',
      'documents.archive',
      'parentPortal.view',
      'parentPortal.viewAll',
      'settings.view',
      'settings.manage',
    ],
  },
  {
    id: 'faculty',
    name: 'Faculty',
    description: 'Academic staff access for assigned student and academic workflows.',
    locked: false,
    permissions: [
      'attendance.view',
      'academicCurriculum.view',
      'timetable.view',
      'exams.view',
      'notices.view',
    ],
  },
  {
    id: 'parent',
    name: 'Parent',
    description: 'Parent portal access for student information visibility.',
    locked: false,
    permissions: [
      'academicCurriculum.view',
      'timetable.view',
      'notices.view',
      'documents.view',
      'parentPortal.view',
    ],
  },
];

export function hasPermission(role, permission) {
  return Boolean(role?.permissions?.includes(permission));
}

export function getRoleById(roles, roleId) {
  return roles.find((role) => role.id === roleId) || null;
}

export function canAccess(roles, roleId, permission) {
  return hasPermission(getRoleById(roles, roleId), permission);
}

export function togglePermission(role, permission) {
  const permissions = new Set(role.permissions || []);
  if (permissions.has(permission)) {
    permissions.delete(permission);
  } else {
    permissions.add(permission);
  }
  return [...permissions].sort();
}

export function validateUserForm(form) {
  if (!form.name?.trim()) return 'Name is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email || '')) return 'Valid email is required.';
  if (!form.roleId) return 'Role is required.';
  if (!form.password || form.password.length < 12) return 'Password must be at least 12 characters.';
  return '';
}

export function validateUserUpdate(form) {
  if (!form.name?.trim()) return 'Name is required.';
  if (!form.roleId) return 'Role is required.';
  if (!form.status) return 'Status is required.';
  return '';
}


