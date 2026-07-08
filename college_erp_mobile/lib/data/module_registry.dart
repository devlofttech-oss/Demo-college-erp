import 'package:flutter/material.dart';

import '../models/erp_module.dart';
import '../theme/app_theme.dart';

const mobileModules = <ErpModule>[
  ErpModule(
    id: 'dashboard',
    label: 'Dashboard',
    group: 'Daily Work',
    permission: 'dashboard.view',
    icon: Icons.dashboard_rounded,
    color: Color(0xFF4F79D8),
  ),
  ErpModule(
    id: 'students',
    label: 'Students',
    group: 'Academics',
    permission: 'students.view',
    icon: Icons.school_rounded,
    color: Color(0xFF20B46B),
  ),
  ErpModule(
    id: 'faculty-staff',
    label: 'Teachers',
    group: 'Academics',
    permission: 'staff.view',
    icon: Icons.groups_rounded,
    color: Color(0xFFE5835A),
  ),
  ErpModule(
    id: 'attendance',
    label: 'Attendance',
    group: 'Academics',
    permission: 'attendance.view',
    icon: Icons.fact_check_rounded,
    color: Color(0xFF43576B),
  ),
  ErpModule(
    id: 'calendar',
    label: 'Syllabus',
    group: 'Academics',
    permission: 'academicCurriculum.view',
    icon: Icons.menu_book_rounded,
    color: Color(0xFF6E8FC7),
  ),
  ErpModule(
    id: 'timetable',
    label: 'Time Table',
    group: 'Academics',
    permission: 'timetable.view',
    icon: Icons.calendar_month_rounded,
    color: Color(0xFF2196C9),
  ),
  ErpModule(
    id: 'examination-results',
    label: 'Results',
    group: 'Academics',
    permission: 'exams.view',
    icon: Icons.assignment_turned_in_rounded,
    color: Color(0xFF8357C5),
  ),
  ErpModule(
    id: 'fees',
    label: 'Fees',
    group: 'Academics',
    permission: 'fees.view',
    icon: Icons.receipt_long_rounded,
    color: Color(0xFFF0A93B),
  ),
  ErpModule(
    id: 'communication',
    label: 'Events',
    group: 'Communication',
    permission: 'notices.view',
    icon: Icons.event_available_rounded,
    color: Color(0xFFDE5E74),
  ),
  ErpModule(
    id: 'document-management',
    label: 'Documents',
    group: 'Communication',
    permission: 'documents.view',
    icon: Icons.folder_copy_rounded,
    color: Color(0xFF12A6A6),
  ),
  ErpModule(
    id: 'hostel-management',
    label: 'Hostel',
    group: 'Operations',
    permission: 'hostel.view',
    icon: Icons.bed_rounded,
    color: Color(0xFF6B8B4E),
  ),
  ErpModule(
    id: 'reports',
    label: 'Reports',
    group: 'Operations',
    permission: 'reports.view',
    icon: Icons.bar_chart_rounded,
    color: Color(0xFF334E68),
  ),
  ErpModule(
    id: 'parent-portal',
    label: 'Parent',
    group: 'Portal',
    permission: 'parentPortal.view',
    icon: Icons.family_restroom_rounded,
    color: Color(0xFF20B46B),
  ),
  ErpModule(
    id: 'academics',
    label: 'Academics',
    group: 'Admin Setup',
    permission: 'academics.view',
    icon: Icons.account_tree_rounded,
    color: Color(0xFF6E8FC7),
  ),
  ErpModule(
    id: 'user-roles',
    label: 'Users',
    group: 'Admin Setup',
    permission: 'users.view',
    icon: Icons.admin_panel_settings_rounded,
    color: Color(0xFF43576B),
  ),
  ErpModule(
    id: 'settings',
    label: 'Settings',
    group: 'Admin Setup',
    permission: 'settings.view',
    icon: Icons.settings_rounded,
    color: AppColors.primaryDark,
  ),
];

ErpModule moduleById(String id) {
  return mobileModules.firstWhere(
    (module) => module.id == id,
    orElse: () => mobileModules.first,
  );
}
