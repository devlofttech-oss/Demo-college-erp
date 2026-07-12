import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/module_registry.dart';
import '../data/role_permissions.dart';
import '../models/app_user.dart';
import '../models/erp_module.dart';
import '../models/erp_role.dart';
import '../navigation/app_routes.dart';
import '../services/auth_repository.dart';
import '../services/erp_repository.dart';
import '../theme/app_theme.dart';
import '../utils/field_reader.dart';
import '../widgets/mobile_chrome.dart';

String _attendanceDisplayDate(DateTime date) =>
    DateFormat('dd MMM yyyy').format(date);

const _curriculumEventTypes = [
  'Academic',
  'Exam',
  'Holiday',
  'Admission',
  'Activity',
];
const _curriculumAudiences = ['All', 'Students', 'Faculty', 'Parents'];
const _curriculumStatuses = ['Draft', 'Active', 'Published'];

DateTime? _parseAttendanceDisplayDate(String text) {
  final trimmed = text.trim();
  if (trimmed.isEmpty) return null;
  final isoDate = DateTime.tryParse(trimmed);
  if (isoDate != null) return isoDate;
  for (final pattern in const ['dd MMM yyyy', 'd MMM yyyy']) {
    try {
      return DateFormat(pattern).parseStrict(trimmed);
    } catch (_) {
      // Try the next known attendance display pattern.
    }
  }
  return null;
}

String _attendanceRecordDateText(Map<String, dynamic> record) {
  final explicit = readText(record, const ['dateText'], fallback: '');
  if (explicit.isNotEmpty) return explicit;
  final date = readDate(
    record['date'] ?? record['attendanceDate'] ?? record['createdAt'],
  );
  return date == null ? '' : _attendanceDisplayDate(date);
}

DateTime? _attendanceRecordDate(Map<String, dynamic> record) {
  final explicit = _parseAttendanceDisplayDate(
    readText(record, const ['dateText'], fallback: ''),
  );
  if (explicit != null) return explicit;
  return readDate(
    record['date'] ?? record['attendanceDate'] ?? record['createdAt'],
  );
}

class ModuleScreen extends StatefulWidget {
  const ModuleScreen({
    super.key,
    required this.module,
    required this.user,
    required this.roles,
    required this.repository,
    required this.authRepository,
    this.initialState = const {},
  });

  final ErpModule module;
  final AppUser user;
  final List<ErpRole> roles;
  final ErpRepository repository;
  final AuthRepository authRepository;
  final Map<String, String> initialState;

  @override
  State<ModuleScreen> createState() => _ModuleScreenState();
}

class _ModuleScreenState extends State<ModuleScreen> {
  static const _pendingAdmissionStatus = 'Pending Approval';
  static const _approvedAdmissionStatus = 'Approved';
  static const _activeStudentStatus = 'Active';
  static const _defaultAcademicYear = '2025-2026';
  static final _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  var _query = '';
  var _academicYear = '';
  var _studentStatusFilter = 'active';
  var _studentCourseCode = 'all';
  var _staffTypeFilter = 'All';
  var _staffStatusFilter = 'active';
  var _attendanceTask = '';
  var _attendanceBranch = '';
  var _attendanceMode = 'students';
  var _attendanceScope = 'subject';
  var _attendanceSubjectCode = '';
  var _attendanceSelectedEntityId = '';
  DateTime _attendanceSelectedDate = DateTime.now();
  var _timetableStatusView = 'active';
  var _examTask = '';
  var _examBranch = '';
  var _examSelectedScheduleId = '';
  var _feeTask = '';
  var _feeBranch = '';
  var _feeSelectedAssignmentId = '';
  var _feeStatusFilter = 'all';
  var _communicationTask = 'notices';
  var _communicationSelectedNoticeId = '';
  var _communicationTypeFilter = '';
  var _communicationAudienceFilter = '';
  var _communicationStatusFilter = '';
  var _hostelTab = 'rooms';
  var _documentSelectedId = '';
  var _documentOwnerTypeFilter = '';
  var _documentCategoryFilter = '';
  var _documentStatusFilter = '';
  var _curriculumSelectedEventId = '';
  var _reportCategory = 'students';
  var _attendanceReportScope = 'daily';
  var _financialReportTab = 'collections';
  var _academicsTab = 'programs';
  var _selectedUserRoleId = 'admin';
  late Future<Map<String, List<Map<String, dynamic>>>> _future;

  @override
  void initState() {
    super.initState();
    _applyInitialState();
    _future = _load();
  }

  void _applyInitialState() {
    if (widget.module.id == 'reports') {
      final category = widget.initialState['reportCategory'];
      if (category != null && category.isNotEmpty) {
        _reportCategory = category;
      }
      return;
    }

    if (widget.module.id != 'fees') return;

    const branchesByTask = {
      'collections': {'collect-fee'},
      'structures': {'create-structure', 'manage-structures'},
      'adjustments': {'approve-adjustment', 'adjustment-history'},
      'due-tracking': {'due-list'},
    };
    final task = widget.initialState['feeTask'];
    if (task == null || !branchesByTask.containsKey(task)) return;

    _feeTask = task;
    final branch = widget.initialState['feeBranch'];
    if (branch != null && branchesByTask[task]!.contains(branch)) {
      _feeBranch = branch;
    }
  }

  Future<Map<String, List<Map<String, dynamic>>>> _load() {
    return widget.repository.moduleData(
      widget.module.id,
      user: widget.user,
      academicYear: _academicYear,
    );
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  bool _can(String permission) =>
      canAccess(widget.roles, widget.user.roleId, permission);

  void _openModuleById(
    String id, {
    Map<String, String> initialState = const {},
  }) {
    final module = moduleById(id);
    if (!_can(module.permission)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${module.label} is not available for your role.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    if (module.id == widget.module.id && initialState.isEmpty) {
      _refresh();
      return;
    }
    AppRoutes.openModule<void>(
      context: context,
      module: module,
      user: widget.user,
      roles: widget.roles,
      repository: widget.repository,
      authRepository: widget.authRepository,
      initialState: initialState,
    );
  }

  @override
  Widget build(BuildContext context) {
    return MobileScaffold(
      title: widget.module.label,
      showHome: true,
      onHome: () => AppRoutes.goHome(context),
      actions: [
        IconButton(
          tooltip: 'Refresh',
          icon: const Icon(Icons.refresh_rounded),
          onPressed: _refresh,
        ),
      ],
      onRefresh: _refresh,
      body: FutureBuilder<Map<String, List<Map<String, dynamic>>>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            );
          }
          if (snapshot.hasError) {
            return EmptyState(
              title: 'Unable to load ${widget.module.label}',
              message: snapshot.error.toString(),
              icon: Icons.cloud_off_rounded,
              actionLabel: 'Retry',
              actionIcon: Icons.refresh_rounded,
              onAction: _refresh,
            );
          }
          final data =
              snapshot.data ?? const <String, List<Map<String, dynamic>>>{};
          return AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeInCubic,
            child: ListView(
              key: ValueKey('${widget.module.id}-$_academicYear'),
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
              children: [
                SearchBox(
                  hint: 'Search ${widget.module.label}',
                  onChanged: (value) => setState(() => _query = value),
                ),
                const SizedBox(height: 12),
                _AcademicYearField(
                  value: _academicYear,
                  onChanged: (value) {
                    setState(() {
                      _academicYear = value;
                      _future = _load();
                    });
                  },
                ),
                _ModuleActionBar(actions: _actionsForModule(data)),
                const SizedBox(height: 4),
                _buildBody(data),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildBody(Map<String, List<Map<String, dynamic>>> data) {
    switch (widget.module.id) {
      case 'students':
        return _students(data);
      case 'faculty-staff':
        return _staffParity(data);
      case 'attendance':
        return _attendance(data);
      case 'timetable':
        return _timetable(data);
      case 'examination-results':
        return _resultsParity(data);
      case 'fees':
        return _feesParity(data);
      case 'communication':
        return _events(data);
      case 'document-management':
        return _documents(data);
      case 'hostel-management':
        return _hostel(data);
      case 'parent-portal':
        return _parentPortal(data);
      case 'calendar':
        return _curriculum(data);
      case 'academics':
        return _academics(data);
      case 'user-roles':
        return _usersAndRoles(data);
      case 'settings':
        return _settings(data);
      case 'dashboard':
        return _dashboard(data);
      case 'reports':
      default:
        return _reports(data);
    }
  }

  List<Map<String, dynamic>> _items(
    Map<String, List<Map<String, dynamic>>> data,
    String key,
  ) {
    return data[key] ?? const [];
  }

  List<_ModuleAction> _actionsForModule(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    switch (widget.module.id) {
      case 'students':
        return [
          if (_can('students.create'))
            _ModuleAction(
              label: 'New Admission',
              icon: Icons.person_add_alt_1_rounded,
              onTap: () => _showStudentAdmissionSheet(data),
            ),
          if (_can('students.documents'))
            _ModuleAction(
              label: 'Student Document',
              icon: Icons.note_add_rounded,
              onTap: () => _showCreateRecordSheet(
                title: 'Add Student Document',
                collectionName: 'studentDocuments',
                fields: const [
                  _FieldSpec('studentId', 'Student ID', isRequired: true),
                  _FieldSpec('studentName', 'Student name'),
                  _FieldSpec('documentType', 'Document type', isRequired: true),
                  _FieldSpec('fileName', 'File name / reference'),
                ],
                defaults: {'status': 'Uploaded'},
              ),
            ),
        ];
      case 'faculty-staff':
        return [
          if (_can('staff.create'))
            _ModuleAction(
              label: 'New Faculty / Staff',
              icon: Icons.group_add_rounded,
              onTap: () => _showStaffSheet(data: data),
            ),
        ];
      case 'attendance':
        return [
          if (_can('attendance.markStudents') || _can('attendance.markStaff'))
            _ModuleAction(
              label: 'Mark',
              icon: Icons.add_task_rounded,
              onTap: () => _showAttendanceSheet(data),
            ),
        ];
      case 'timetable':
        return [
          if (_can('timetable.create'))
            _ModuleAction(
              label: 'New Entry',
              icon: Icons.calendar_month_rounded,
              onTap: () => _showTimetableEntrySheet(data: data),
            ),
        ];
      case 'examination-results':
        return [
          if (_can('exams.schedule'))
            _ModuleAction(
              label: 'Schedule',
              icon: Icons.event_note_rounded,
              onTap: () => _showExamScheduleSheet(data: data),
            ),
          if (_can('exams.marks'))
            _ModuleAction(
              label: 'Marks',
              icon: Icons.assignment_turned_in_rounded,
              onTap: () => _showMarksEntrySheet(data: data),
            ),
        ];
      case 'fees':
        return [
          if (_can('fees.setup'))
            _ModuleAction(
              label: 'Structure',
              icon: Icons.settings_rounded,
              onTap: () => _showFeeStructureSheet(data: data),
            ),
          if (_can('fees.assign'))
            _ModuleAction(
              label: 'Assign',
              icon: Icons.assignment_rounded,
              onTap: () => _showFeeAssignmentSheet(data: data),
            ),
          if (_can('fees.collect'))
            _ModuleAction(
              label: 'Collect',
              icon: Icons.payments_rounded,
              onTap: () => _showFeeCollectionSheet(data: data),
            ),
          if (_can('fees.adjust'))
            _ModuleAction(
              label: 'Adjust',
              icon: Icons.tune_rounded,
              onTap: () => _showFeeAdjustmentSheet(data: data),
            ),
        ];
      case 'communication':
        return [
          if (_can('notices.create'))
            _ModuleAction(
              label: _communicationTask == 'alerts'
                  ? 'Alert'
                  : _communicationTask == 'parents'
                  ? 'Parent Message'
                  : 'Announcement',
              icon: Icons.campaign_rounded,
              onTap: () => _showCommunicationNoticeSheet(data: data),
            ),
        ];
      case 'document-management':
        return [
          if (_can('documents.upload'))
            _ModuleAction(
              label: 'Upload',
              icon: Icons.upload_file_rounded,
              onTap: () => _showDocumentUploadSheet(data: data),
            ),
        ];
      case 'hostel-management':
        return [
          if (_can('hostel.manage'))
            _ModuleAction(
              label: 'New ${_hostelTabLabel(_hostelTab, singular: true)}',
              icon: _hostelTabIcon(_hostelTab),
              onTap: () => _showHostelEntrySheet(data),
            ),
        ];
      case 'calendar':
        return [
          if (_can('academics.manage'))
            _ModuleAction(
              label: 'Add Event',
              icon: Icons.add_rounded,
              onTap: () => _showCurriculumEventSheet(data: data),
            ),
          if (_can('academics.manage'))
            _ModuleAction(
              label: 'Publish',
              icon: Icons.send_rounded,
              onTap: () => _publishCurriculum(data),
            ),
          _ModuleAction(
            label: 'Download',
            icon: Icons.download_rounded,
            onTap: () => _downloadCurriculum(data),
          ),
        ];
      case 'academics':
        return [
          if (_can('academics.manage'))
            _ModuleAction(
              label:
                  'Create ${_academicsTabLabel(_academicsTab, singular: true)}',
              icon: _academicsTabIcon(_academicsTab),
              onTap: _showAcademicRecordSheet,
            ),
        ];
      case 'user-roles':
        return [
          if (_can('roles.edit'))
            _ModuleAction(
              label: 'Sync Roles',
              icon: Icons.sync_rounded,
              onTap: () => _syncDefaultRoles(data),
            ),
          if (_can('users.create'))
            _ModuleAction(
              label: 'New User',
              icon: Icons.person_add_alt_1_rounded,
              onTap: () => _showUserRoleUserSheet(data: data),
            ),
        ];
      case 'dashboard':
        return const [];
      case 'reports':
        return [
          if (_reportCategory == 'financial' &&
              _can('financialReports.snapshots'))
            _ModuleAction(
              label: 'Save Summary',
              icon: Icons.save_alt_rounded,
              onTap: () => _saveFinancialSnapshot(data),
            ),
          if (_canExportReportCategory(_reportCategory))
            _ModuleAction(
              label: 'Export',
              icon: Icons.download_rounded,
              onTap: () => _exportActiveReport(data),
            ),
        ];
      default:
        return const [];
    }
  }

  Widget _students(Map<String, List<Map<String, dynamic>>> data) {
    final allStudents = _items(data, 'students');
    final activeStudents = allStudents
        .where((student) => !_isArchivedStudent(student))
        .toList();
    final archivedStudents = allStudents.where(_isArchivedStudent).toList();
    final courseOptions = _studentCourseOptions(data);
    final course = _selectedStudentCourse(courseOptions);
    final visibleStudents =
        (_studentStatusFilter == 'archived' ? archivedStudents : activeStudents)
            .where((student) => _studentMatchesCourse(student, course))
            .where(
              (item) => containsQuery(item, _query, const [
                'name',
                'studentId',
                'admissionNo',
                'className',
                'section',
                'program',
                'courseCode',
                'courseName',
                'phone',
                'mobileNo',
              ]),
            )
            .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InfoCard(
          child: Row(
            children: [
              Container(
                height: 56,
                width: 56,
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.school_rounded,
                  color: AppColors.accent,
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Students',
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      course == null ? 'All Students' : course.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    const Text(
                      'Browse active and archived records.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (courseOptions.length > 1)
          DropdownButtonFormField<String>(
            initialValue:
                courseOptions.any(
                  (option) => option.courseCode == _studentCourseCode,
                )
                ? _studentCourseCode
                : 'all',
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.account_tree_rounded, size: 18),
              labelText: 'Course',
            ),
            items: courseOptions
                .map(
                  (option) => DropdownMenuItem(
                    value: option.courseCode,
                    child: Text(
                      option.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                )
                .toList(),
            onChanged: (value) {
              if (value == null) return;
              setState(() => _studentCourseCode = value);
            },
          ),
        const SizedBox(height: 12),
        _SegmentedFilter(
          value: _studentStatusFilter,
          options: const {'active': 'Active & Pending', 'archived': 'Archived'},
          onChanged: (value) => setState(() => _studentStatusFilter = value),
        ),
        _SummaryRow(
          stats: [
            _Stat(
              'Students',
              allStudents.length.toString(),
              Icons.school_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Active',
              activeStudents.length.toString(),
              Icons.verified_user_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Archived',
              archivedStudents.length.toString(),
              Icons.archive_rounded,
              AppColors.danger,
            ),
          ],
        ),
        const SectionTitle('Student Information Management'),
        if (visibleStudents.isEmpty)
          EmptyState(
            title:
                'No ${_studentStatusFilter == 'archived' ? 'archived' : 'active'} student records found',
            message: 'Try a different search, course, or academic year.',
          )
        else
          ...visibleStudents.map(
            (student) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _StudentParityCard(
                student: student,
                onTap: () => _showStudentSheet(student, data),
                canEdit: _can('students.edit'),
                canArchive: _can('students.archive'),
                showApprove: _canApproveStudent(student, data),
                onEdit: () => _showStudentProfileSheet(student),
                onApprove: () => _approveStudentAdmission(student, data),
                onArchive: () => _archiveStudent(student),
                onRestore: () => _restoreStudent(student),
              ),
            ),
          ),
        const SizedBox(height: 4),
        _StudentCollectionSummary(
          admissions: _items(data, 'admissions').length,
          documents: _items(data, 'documents').length,
          health: _items(data, 'health').length,
        ),
      ],
    );
  }

  List<_StudentCourseOption> _studentCourseOptions(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    final byCode = <String, _StudentCourseOption>{
      'all': const _StudentCourseOption('all', 'All Students'),
    };
    for (final record in [
      ..._items(data, 'admissionBatches'),
      ..._items(data, 'admissions'),
      ..._items(data, 'students'),
    ]) {
      final code = readText(record, const [
        'courseCode',
        'program',
        'courseName',
        'className',
      ], fallback: '');
      if (code.isEmpty || byCode.containsKey(code)) continue;
      final name = readText(record, const [
        'courseName',
        'program',
        'className',
      ], fallback: code);
      final type = readText(record, const [
        'admissionType',
        'courseYear',
        'section',
      ], fallback: '');
      byCode[code] = _StudentCourseOption(
        code,
        type.isEmpty ? name : '$name - $type',
        courseName: name,
        courseYear: readText(record, const [
          'courseYear',
          'className',
        ], fallback: ''),
        admissionType: readText(record, const [
          'admissionType',
          'section',
        ], fallback: ''),
        collegeName: readText(record, const ['collegeName'], fallback: ''),
        collegeCode: readText(record, const ['collegeCode'], fallback: ''),
      );
    }
    return byCode.values.toList();
  }

  _StudentCourseOption? _selectedStudentCourse(
    List<_StudentCourseOption> options,
  ) {
    if (_studentCourseCode == 'all') return null;
    for (final option in options) {
      if (option.courseCode == _studentCourseCode) return option;
    }
    return null;
  }

  bool _studentMatchesCourse(
    Map<String, dynamic> student,
    _StudentCourseOption? selectedCourse,
  ) {
    if (selectedCourse == null) return true;
    final selected = selectedCourse.courseCode.toLowerCase();
    final values = [
      readText(student, const ['courseCode'], fallback: ''),
      readText(student, const ['courseName'], fallback: ''),
      readText(student, const ['program'], fallback: ''),
      readText(student, const ['className'], fallback: ''),
    ].map((value) => value.toLowerCase()).where((value) => value.isNotEmpty);
    return values.any(
      (value) =>
          value == selected ||
          value.contains(selected) ||
          selected.contains(value),
    );
  }

  bool _isArchivedStudent(Map<String, dynamic> student) =>
      readText(student, const ['status'], fallback: '').toLowerCase() ==
      'archived';

  bool _isAdmittedStatus(String status) {
    final normalized = status.toLowerCase();
    return normalized.contains('active') ||
        normalized.contains('approved') ||
        normalized.contains('admitted');
  }

  bool _canApproveStudent(
    Map<String, dynamic> student,
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    if (widget.user.roleId != 'super-admin' || _isArchivedStudent(student)) {
      return false;
    }
    final studentStatus = readText(student, const ['status'], fallback: '');
    final latestAdmission = _latestRelatedRecord(
      _items(data, 'admissions'),
      student,
    );
    final admissionStatus = latestAdmission == null
        ? ''
        : readText(latestAdmission, const ['status'], fallback: '');
    return !_isAdmittedStatus(studentStatus) &&
        !_isAdmittedStatus(admissionStatus);
  }

  Map<String, dynamic>? _latestRelatedRecord(
    List<Map<String, dynamic>> records,
    Map<String, dynamic> student,
  ) {
    final related = _relatedRecords(records, student);
    return related.isEmpty ? null : related.last;
  }

  List<Map<String, dynamic>> _relatedRecords(
    List<Map<String, dynamic>> records,
    Map<String, dynamic> student,
  ) {
    final studentId = readText(student, const ['studentId'], fallback: '');
    final recordId = readText(student, const ['id'], fallback: '');
    return records.where((record) {
      final values = [
        readText(record, const ['studentRecordId'], fallback: ''),
        readText(record, const ['entityRecordId'], fallback: ''),
        readText(record, const ['ownerRecordId'], fallback: ''),
        readText(record, const ['studentId'], fallback: ''),
        readText(record, const ['entityId'], fallback: ''),
        readText(record, const ['ownerId'], fallback: ''),
      ];
      return values.contains(recordId) || values.contains(studentId);
    }).toList();
  }

  String _displayDateNow() => DateFormat('dd MMM yyyy').format(DateTime.now());

  int _nextStudentNumber(Map<String, List<Map<String, dynamic>>> data) {
    final candidates = _items(data, 'students')
        .where(
          (student) => readText(student, const [
            'studentId',
            'admissionNo',
          ], fallback: '').isNotEmpty,
        )
        .map((student) {
          final text = readText(student, const [
            'studentId',
            'admissionNo',
          ], fallback: '');
          final match = RegExp(r'(\d+)$').firstMatch(text);
          return int.tryParse(match?.group(1) ?? '') ?? 0;
        })
        .toList();
    final highest = candidates.isEmpty
        ? _items(data, 'students').length
        : candidates.reduce((first, second) => first > second ? first : second);
    return highest + 1;
  }

  Widget _staffParity(Map<String, List<Map<String, dynamic>>> data) {
    final allStaff = _items(data, 'staff');
    final activeStaff = allStaff
        .where((member) => !_isArchivedStaff(member))
        .toList();
    final archivedStaff = allStaff.where(_isArchivedStaff).toList();
    final statusScoped = _staffStatusFilter == 'archived'
        ? archivedStaff
        : activeStaff;
    final typeScoped = _staffTypeFilter == 'All'
        ? statusScoped
        : statusScoped
              .where(
                (member) =>
                    readText(member, const ['staffType'], fallback: '') ==
                    _staffTypeFilter,
              )
              .toList();
    final staff = typeScoped
        .where(
          (item) => containsQuery(item, _query, const [
            'name',
            'employeeId',
            'department',
            'designation',
            'staffType',
            'phone',
            'email',
          ]),
        )
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InfoCard(
          child: Row(
            children: [
              Container(
                height: 56,
                width: 56,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5835A).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.groups_rounded,
                  color: Color(0xFFE5835A),
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Faculty & Staff',
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'All Faculty & Staff',
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Browse active and archived records.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _SegmentedFilter(
          value: _staffTypeFilter,
          options: const {'All': 'All', 'Faculty': 'Faculty', 'Staff': 'Staff'},
          onChanged: (value) => setState(() => _staffTypeFilter = value),
        ),
        const SizedBox(height: 12),
        _SegmentedFilter(
          value: _staffStatusFilter,
          options: const {'active': 'Active Records', 'archived': 'Archived'},
          onChanged: (value) => setState(() => _staffStatusFilter = value),
        ),
        _SummaryRow(
          stats: [
            _Stat(
              'Faculty',
              allStaff
                  .where(
                    (member) =>
                        readText(member, const ['staffType'], fallback: '') ==
                        'Faculty',
                  )
                  .length
                  .toString(),
              Icons.groups_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Departments',
              _items(data, 'departments').length.toString(),
              Icons.apartment_rounded,
              const Color(0xFFE5835A),
            ),
            _Stat(
              'Leave',
              _items(data, 'leave').length.toString(),
              Icons.beach_access_rounded,
              AppColors.warning,
            ),
          ],
        ),
        const SectionTitle('Faculty & Staff Management'),
        if (staff.isEmpty)
          EmptyState(
            title:
                'No ${_staffStatusFilter == 'archived' ? 'archived' : 'active'} faculty or staff records found',
            message: 'Try a different search, type, or academic year.',
          )
        else
          ...staff.map(
            (member) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _StaffCard(
                member: member,
                onTap: () => _showStaffDetailSheet(member, data),
                canEdit: _can('staff.edit'),
                canManageLeave: _can('staff.leave'),
                canArchive: _can('staff.archive'),
                onEdit: () => _showStaffSheet(data: data, member: member),
                onLeave: () => _showStaffLeaveSheet(member),
                onArchive: () => _archiveStaff(member),
                onRestore: () => _restoreStaff(member),
              ),
            ),
          ),
      ],
    );
  }

  bool _isArchivedStaff(Map<String, dynamic> member) =>
      readText(member, const ['status'], fallback: '').toLowerCase() ==
      'archived';

  String _staffDisplayDateNow() =>
      DateFormat('dd MMM yyyy').format(DateTime.now());

  Future<void> _showStaffSheet({
    required Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic>? member,
  }) async {
    final isEdit = member != null;
    final defaultDepartment = _items(data, 'departments').isEmpty
        ? 'Science'
        : readText(_items(data, 'departments').first, const [
            'name',
          ], fallback: 'Science');
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _RecordFormSheet(
        title: isEdit ? 'Edit Staff Record' : 'New Faculty / Staff',
        helper: isEdit
            ? 'Update employment and department details.'
            : 'Create a faculty or staff master record.',
        saveLabel: isEdit ? 'Save Changes' : 'Save Record',
        initialValues: {
          'staffType': 'Faculty',
          'department': defaultDepartment,
          'status': 'Active',
          ...?member,
        },
        fields: [
          const _FieldSpec('name', 'Name', isRequired: true),
          const _FieldSpec('employeeId', 'Employee ID', isRequired: true),
          const _FieldSpec('designation', 'Designation', isRequired: true),
          const _FieldSpec('phone', 'Phone', isRequired: true),
          const _FieldSpec('email', 'Email'),
          const _FieldSpec('qualification', 'Qualification'),
          const _FieldSpec('staffType', 'Staff Type', isRequired: true),
          const _FieldSpec('department', 'Department', isRequired: true),
          const _FieldSpec('institution', 'Institution'),
          const _FieldSpec('specialization', 'Specialization'),
          const _FieldSpec('city', 'City'),
          const _FieldSpec('dateOfBirth', 'Date of Birth'),
          const _FieldSpec('joiningDate', 'Joining Date'),
          const _FieldSpec('appointmentType', 'Appointment'),
          const _FieldSpec('address', 'Address'),
          const _FieldSpec('previousExperience', 'Previous Experience'),
          const _FieldSpec('publications', 'Publications'),
          const _FieldSpec('researchProjects', 'Research Projects'),
          if (isEdit) const _FieldSpec('status', 'Status', isRequired: true),
        ],
        onSave: (values) async {
          final payload = {
            ...values,
            'name': (values['name'] ?? '').toString().trim(),
            'employeeId': (values['employeeId'] ?? '').toString().trim(),
            'designation': (values['designation'] ?? '').toString().trim(),
            'phone': (values['phone'] ?? '').toString().trim(),
            'email': (values['email'] ?? '').toString().trim(),
            'qualification': (values['qualification'] ?? '').toString().trim(),
          };
          final id = readText(member ?? const {}, const ['id'], fallback: '');
          if (id.isEmpty) {
            await widget.repository.createDocument('staffMembers', {
              ...payload,
              'status': 'Active',
              'createdAtText': _staffDisplayDateNow(),
              'createdBy': widget.user.uid,
            });
          } else {
            await widget.repository.updateDocument('staffMembers', id, {
              ...payload,
              'updatedAtText': _staffDisplayDateNow(),
            });
          }
        },
      ),
    );

    if (!mounted) return;
    if (saved == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isEdit ? 'Staff record updated' : 'Staff record saved'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    }
  }

  Future<void> _showStaffLeaveSheet(Map<String, dynamic> member) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _RecordFormSheet(
        title: 'Leave Request',
        helper:
            '${readText(member, const ['name'])} / ${readText(member, const ['employeeId'])}',
        saveLabel: 'Save Leave',
        initialValues: const {'leaveType': 'Casual Leave'},
        fields: const [
          _FieldSpec('leaveType', 'Leave Type', isRequired: true),
          _FieldSpec('fromDate', 'From Date', isRequired: true),
          _FieldSpec('toDate', 'To Date', isRequired: true),
          _FieldSpec('reason', 'Reason', isRequired: true),
        ],
        onSave: (values) async {
          await widget.repository.createDocument('staffLeaveRecords', {
            'staffRecordId': readText(member, const ['id'], fallback: ''),
            'employeeId': readText(member, const ['employeeId'], fallback: ''),
            ...values,
            'reason': (values['reason'] ?? '').toString().trim(),
            'status': 'Pending Review',
            'requestedAtText': _staffDisplayDateNow(),
            if (_academicYear.trim().isNotEmpty)
              'academicYear': _academicYear.trim(),
            'createdBy': widget.user.uid,
          });
        },
      ),
    );

    if (!mounted) return;
    if (saved == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Leave request saved'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    }
  }

  Future<void> _archiveStaff(Map<String, dynamic> member) async {
    final confirmed = await _confirmStudentAction(
      title: 'Archive staff record?',
      message: 'Archived records stay available from the Archived filter.',
      actionLabel: 'Archive',
    );
    if (!confirmed) return;
    await _updateStaff(member, {
      'status': 'Archived',
      'archivedAt': FieldValue.serverTimestamp(),
      'archivedAtText': _staffDisplayDateNow(),
    }, 'Staff record archived');
  }

  Future<void> _restoreStaff(Map<String, dynamic> member) async {
    await _updateStaff(member, {
      'status': 'Active',
      'restoredAt': FieldValue.serverTimestamp(),
      'restoredAtText': _staffDisplayDateNow(),
    }, 'Staff record restored');
    if (mounted) setState(() => _staffStatusFilter = 'active');
  }

  Future<void> _updateStaff(
    Map<String, dynamic> member,
    Map<String, dynamic> updates,
    String successMessage,
  ) async {
    final id = readText(member, const ['id'], fallback: '');
    if (id.isEmpty) return;
    try {
      await widget.repository.updateDocument('staffMembers', id, updates);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(successMessage),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Staff update failed: $error'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _markStaffAttendance(
    Map<String, dynamic> member,
    Map<String, List<Map<String, dynamic>>> data,
    String status,
  ) async {
    final dateText = _staffDisplayDateNow();
    final employeeId = readText(member, const ['employeeId'], fallback: '');
    final duplicate = _items(data, 'attendance').any(
      (record) =>
          readText(record, const ['employeeId'], fallback: '') == employeeId &&
          readText(record, const ['dateText'], fallback: '') == dateText,
    );
    if (duplicate) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Attendance already marked for today.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    await widget.repository.createDocument('staffAttendanceRecords', {
      'staffRecordId': readText(member, const ['id'], fallback: ''),
      'employeeId': employeeId,
      if (_academicYear.trim().isNotEmpty) 'academicYear': _academicYear.trim(),
      'dateText': dateText,
      'status': status,
      'markedAtText': dateText,
      'createdBy': widget.user.uid,
    });
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Attendance marked ${status.toLowerCase()}'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    await _refresh();
  }

  Future<void> _decideStaffLeave(
    Map<String, dynamic> leaveRecord,
    String status,
  ) async {
    final id = readText(leaveRecord, const ['id'], fallback: '');
    if (id.isEmpty) return;
    await widget.repository.updateDocument('staffLeaveRecords', id, {
      'status': status,
      'decidedAtText': _staffDisplayDateNow(),
    });
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Leave ${status.toLowerCase()}'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    await _refresh();
  }

  // ignore: unused_element
  Widget _staff(Map<String, List<Map<String, dynamic>>> data) {
    final staff = _items(data, 'staff')
        .where(
          (item) => containsQuery(item, _query, const [
            'name',
            'employeeId',
            'department',
            'designation',
            'phone',
          ]),
        )
        .toList();
    return Column(
      children: [
        _SummaryRow(
          stats: [
            _Stat(
              'Staff',
              staff.length.toString(),
              Icons.groups_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Departments',
              _items(data, 'departments').length.toString(),
              Icons.apartment_rounded,
              const Color(0xFFE5835A),
            ),
            _Stat(
              'Leave',
              _items(data, 'leave').length.toString(),
              Icons.beach_access_rounded,
              AppColors.warning,
            ),
          ],
        ),
        const SectionTitle('Faculty & Staff'),
        if (staff.isEmpty)
          const EmptyState(
            title: 'No staff found',
            message: 'Try a different search.',
          )
        else
          ...staff.map(
            (member) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InfoCard(
                child: Row(
                  children: [
                    _Avatar(
                      label: readText(member, const ['name'], fallback: '?'),
                      color: const Color(0xFFE5835A),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            readText(member, const ['name']),
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${readText(member, const ['designation'], fallback: 'Staff')} · ${readText(member, const ['department'], fallback: 'Department')}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    StatusPill(
                      label: readText(member, const [
                        'status',
                      ], fallback: 'Active'),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _attendance(Map<String, List<Map<String, dynamic>>> data) {
    final students = _attendanceStudents(data)
        .where(
          (item) => containsQuery(item, _query, const [
            'name',
            'studentId',
            'className',
            'section',
            'courseCode',
            'courseName',
          ]),
        )
        .toList();
    final staff = _attendanceStaff(data)
        .where(
          (item) => containsQuery(item, _query, const [
            'name',
            'employeeId',
            'department',
            'designation',
            'staffType',
          ]),
        )
        .toList();
    final studentRecords = _items(data, 'studentAttendance');
    final staffRecords = _items(data, 'staffAttendance');
    final dateText = _attendanceDisplayDate(_attendanceSelectedDate);
    final subjectOptions = _attendanceSubjectOptions(data);
    final selectedSubject = _selectedAttendanceSubject(subjectOptions);
    final subjectName =
        _attendanceMode == 'students' && _attendanceScope == 'subject'
        ? selectedSubject?.name ?? ''
        : '';
    final activeRecords = _attendanceMode == 'students'
        ? studentRecords
        : staffRecords;
    final scopedRecords = _attendanceScopedRecords(
      activeRecords,
      subjectName: subjectName,
    );
    final selectedDateRecords = scopedRecords
        .where((record) => _attendanceRecordDateText(record) == dateText)
        .toList();
    final homeDateRecords = [
      ...studentRecords,
      ...staffRecords,
    ].where((record) => _attendanceRecordDateText(record) == dateText).toList();
    final summary = _summarizeAttendance(
      _attendanceBranch.isEmpty ? homeDateRecords : selectedDateRecords,
    );
    final canMarkStudents = _can('attendance.markStudents');
    final canMarkStaff = _can('attendance.markStaff');
    final canMark = _attendanceMode == 'students'
        ? canMarkStudents
        : canMarkStaff;
    final roster = _attendanceMode == 'students' ? students : staff;
    final activeTaskTitle = _attendanceTask == 'staff'
        ? 'Staff Attendance'
        : 'Student Attendance';
    final activeBranchTitle = _attendanceBranch == 'mark-general-students'
        ? 'Mark General Attendance'
        : _attendanceBranch == 'mark-staff'
        ? 'Mark Staff Attendance'
        : 'Mark Subject Attendance';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InfoCard(
          child: Row(
            children: [
              Container(
                height: 56,
                width: 56,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.fact_check_rounded,
                  color: AppColors.primary,
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Academics / Attendance Management',
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _attendanceTask.isEmpty
                          ? 'Attendance Management'
                          : activeBranchTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      _attendanceTask.isEmpty
                          ? 'Student and faculty attendance tracking.'
                          : '$activeTaskTitle / $dateText',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _AttendanceDateButton(label: dateText, onPressed: _pickAttendanceDate),
        _SummaryRow(
          stats: [
            _Stat(
              'Present',
              summary.present.toString(),
              Icons.check_circle_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Absent',
              summary.absent.toString(),
              Icons.cancel_rounded,
              AppColors.danger,
            ),
            _Stat(
              'Attendance %',
              '${summary.percentage}%',
              Icons.calendar_month_rounded,
              AppColors.primary,
            ),
          ],
        ),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 220),
          switchInCurve: Curves.easeOutCubic,
          switchOutCurve: Curves.easeInCubic,
          child: _attendanceTask.isEmpty
              ? Column(
                  key: const ValueKey('attendance-tasks'),
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SectionTitle('Attendance Management'),
                    _AttendanceTaskCard(
                      title: 'Student Attendance',
                      description: 'Mark students and follow up absentees.',
                      icon: Icons.school_rounded,
                      meta: '${students.length} students',
                      enabled: true,
                      onTap: () => _openAttendanceTask(
                        task: 'students',
                        mode: 'students',
                      ),
                    ),
                    const SizedBox(height: 10),
                    _AttendanceTaskCard(
                      title: 'Staff Attendance',
                      description: 'Mark faculty and staff attendance.',
                      icon: Icons.badge_rounded,
                      meta: '${staff.length} staff',
                      enabled: canMarkStaff || _can('attendance.view'),
                      onTap: () =>
                          _openAttendanceTask(task: 'staff', mode: 'staff'),
                    ),
                    const SectionTitle('Month View'),
                    _AttendanceCalendar(
                      records: [...studentRecords, ...staffRecords],
                    ),
                  ],
                )
              : _attendanceBranch.isEmpty
              ? Column(
                  key: const ValueKey('attendance-branches'),
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _BackActionButton(onPressed: _backAttendanceStep),
                    const SectionTitle('Choose Next Step'),
                    if (_attendanceTask == 'students') ...[
                      _AttendanceTaskCard(
                        title: 'Mark General Attendance',
                        description:
                            'Mark daily student attendance without a subject.',
                        icon: Icons.calendar_today_rounded,
                        meta: canMarkStudents ? 'Mark enabled' : 'View only',
                        enabled: true,
                        onTap: () => _openAttendanceBranch(
                          branch: 'mark-general-students',
                          mode: 'students',
                          scope: 'general',
                        ),
                      ),
                      const SizedBox(height: 10),
                      _AttendanceTaskCard(
                        title: 'Mark Subject Attendance',
                        description: 'Select a subject, then mark students.',
                        icon: Icons.check_circle_outline_rounded,
                        meta: '${subjectOptions.length} subjects',
                        enabled: true,
                        onTap: () => _openAttendanceBranch(
                          branch: 'mark-students',
                          mode: 'students',
                          scope: 'subject',
                        ),
                      ),
                    ] else
                      _AttendanceTaskCard(
                        title: 'Mark Staff Attendance',
                        description: 'Select a staff member, then mark status.',
                        icon: Icons.assignment_ind_rounded,
                        meta: canMarkStaff ? 'Mark enabled' : 'View only',
                        enabled: true,
                        onTap: () => _openAttendanceBranch(
                          branch: 'mark-staff',
                          mode: 'staff',
                          scope: 'staff',
                        ),
                      ),
                  ],
                )
              : Column(
                  key: ValueKey('attendance-roster-$_attendanceBranch'),
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _BackActionButton(onPressed: _backAttendanceStep),
                    if (_attendanceMode == 'students' &&
                        _attendanceScope == 'subject') ...[
                      DropdownButtonFormField<String>(
                        initialValue:
                            subjectOptions.any(
                              (option) => option.code == _attendanceSubjectCode,
                            )
                            ? _attendanceSubjectCode
                            : null,
                        decoration: const InputDecoration(
                          prefixIcon: Icon(Icons.menu_book_rounded, size: 18),
                          labelText: 'Subject',
                        ),
                        items: subjectOptions
                            .map(
                              (option) => DropdownMenuItem(
                                value: option.code,
                                child: Text(
                                  option.name,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: (value) => setState(
                          () => _attendanceSubjectCode = value ?? '',
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (!canMark)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 12),
                        child: InfoCard(
                          child: Text(
                            'You can view attendance but cannot mark it.',
                            style: TextStyle(
                              color: AppColors.muted,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    if (_attendanceMode == 'students' &&
                        _attendanceScope == 'subject' &&
                        subjectOptions.isEmpty)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 12),
                        child: EmptyState(
                          title: 'No live subjects found',
                          message:
                              'Create academic subjects on the web ERP before marking subject attendance.',
                        ),
                      ),
                    const SectionTitle('Attendance Roster'),
                    if (roster.isEmpty)
                      EmptyState(
                        title: _attendanceMode == 'students'
                            ? 'No students found'
                            : 'No faculty or staff found',
                        message:
                            'Try a different search or academic year filter.',
                      )
                    else
                      ...roster.map((entity) {
                        final record = _attendanceRecordForEntity(
                          scopedRecords,
                          entity,
                          dateText: dateText,
                          subjectName: subjectName,
                        );
                        final editable = _isAttendanceRecordEditable(record);
                        final subjectReady =
                            _attendanceMode != 'students' ||
                            _attendanceScope != 'subject' ||
                            selectedSubject != null;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _AttendanceRosterCard(
                            entity: entity,
                            mode: _attendanceMode,
                            record: record,
                            selected:
                                readText(entity, const ['id'], fallback: '') ==
                                _attendanceSelectedEntityId,
                            canMark: canMark && subjectReady,
                            editable: editable,
                            onTap: () => setState(
                              () => _attendanceSelectedEntityId = readText(
                                entity,
                                const ['id'],
                                fallback: '',
                              ),
                            ),
                            onMark: (status) =>
                                _markAttendanceEntity(data, entity, status),
                          ),
                        );
                      }),
                    const SectionTitle('Recent Attendance'),
                    if (scopedRecords.isEmpty)
                      const EmptyState(
                        title: 'No attendance records',
                        message:
                            'Attendance records from Firestore appear here.',
                      )
                    else
                      ...scopedRecords
                          .take(12)
                          .map(
                            (record) => Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: _CompactRow(
                                title: readText(
                                  record,
                                  const ['entityName', 'studentName', 'name'],
                                  fallback: readText(record, const [
                                    'entityId',
                                    'studentId',
                                    'employeeId',
                                  ]),
                                ),
                                subtitle:
                                    '${_attendanceRecordDateText(record)} / ${readText(record, const ['subjectName', 'attendanceScope'], fallback: _attendanceMode == 'students' ? 'General' : 'Staff')}',
                                trailing: StatusPill(
                                  label: readText(record, const [
                                    'status',
                                  ], fallback: 'Present'),
                                ),
                              ),
                            ),
                          ),
                  ],
                ),
        ),
      ],
    );
  }

  List<Map<String, dynamic>> _attendanceStudents(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    return _items(data, 'students')
        .where(
          (student) =>
              readText(student, const ['status'], fallback: '').toLowerCase() !=
              'archived',
        )
        .toList();
  }

  List<Map<String, dynamic>> _attendanceStaff(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    return _items(data, 'staff')
        .where(
          (member) =>
              readText(member, const ['status'], fallback: '').toLowerCase() !=
              'archived',
        )
        .toList();
  }

  List<_AttendanceSubjectOption> _attendanceSubjectOptions(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    final byCode = <String, _AttendanceSubjectOption>{};
    for (final subject in _items(data, 'academicSubjects')) {
      final name = readText(subject, const [
        'subjectName',
        'name',
        'subject',
      ], fallback: '');
      if (name.isEmpty) continue;
      final code = readText(subject, const [
        'subjectCode',
        'code',
        'id',
      ], fallback: name);
      byCode[code] = _AttendanceSubjectOption(code, name);
    }
    return byCode.values.toList();
  }

  _AttendanceSubjectOption? _selectedAttendanceSubject(
    List<_AttendanceSubjectOption> options,
  ) {
    for (final option in options) {
      if (option.code == _attendanceSubjectCode) return option;
    }
    return null;
  }

  List<Map<String, dynamic>> _attendanceScopedRecords(
    List<Map<String, dynamic>> records, {
    required String subjectName,
  }) {
    if (_attendanceMode == 'staff') return records;
    return records.where((record) {
      final recordSubject = readText(record, const [
        'subjectName',
        'subject',
      ], fallback: '');
      if (_attendanceScope == 'general') return recordSubject.isEmpty;
      if (subjectName.isEmpty) return recordSubject.isNotEmpty;
      return recordSubject == subjectName;
    }).toList();
  }

  _AttendanceSummary _summarizeAttendance(List<Map<String, dynamic>> records) {
    final present = records
        .where((record) => readText(record, const ['status']) == 'Present')
        .length;
    final absent = records
        .where((record) => readText(record, const ['status']) == 'Absent')
        .length;
    final leave = records
        .where((record) => readText(record, const ['status']) == 'Leave')
        .length;
    final percentage = records.isEmpty ? 0 : (present / records.length * 100);
    return _AttendanceSummary(
      total: records.length,
      present: present,
      absent: absent,
      leave: leave,
      percentage: percentage.round(),
    );
  }

  Map<String, dynamic>? _attendanceRecordForEntity(
    List<Map<String, dynamic>> records,
    Map<String, dynamic> entity, {
    required String dateText,
    required String subjectName,
  }) {
    final entityRecordId = readText(entity, const ['id'], fallback: '');
    final entityId = readText(entity, const [
      'studentId',
      'employeeId',
    ], fallback: entityRecordId);
    for (final record in records) {
      final recordEntityRecordId = readText(record, const [
        'entityRecordId',
        'studentRecordId',
        'staffRecordId',
      ], fallback: '');
      final recordEntityId = readText(record, const [
        'entityId',
        'studentId',
        'employeeId',
      ], fallback: '');
      final recordSubject = readText(record, const [
        'subjectName',
        'subject',
      ], fallback: '');
      final sameEntity =
          recordEntityRecordId == entityRecordId || recordEntityId == entityId;
      final sameSubject =
          _attendanceMode == 'staff' || _attendanceScope == 'general'
          ? recordSubject.isEmpty
          : recordSubject == subjectName;
      if (sameEntity &&
          sameSubject &&
          _attendanceRecordDateText(record) == dateText) {
        return record;
      }
    }
    return null;
  }

  bool _isAttendanceRecordEditable(Map<String, dynamic>? record) {
    if (record == null) return true;
    final markedAt = _attendanceMarkedAt(record);
    if (markedAt == null) return true;
    final elapsed = DateTime.now().difference(markedAt);
    return !elapsed.isNegative && elapsed.inMinutes <= 24 * 60;
  }

  DateTime? _attendanceMarkedAt(Map<String, dynamic> record) {
    final markedAtIso = readText(record, const [
      'markedAtIso',
      'createdAtIso',
      'editedAtIso',
    ], fallback: '');
    final iso = DateTime.tryParse(markedAtIso);
    if (iso != null) return iso;
    final timestamp = readDate(record['markedAt'] ?? record['createdAt']);
    if (timestamp != null) return timestamp;
    return _parseAttendanceDisplayDate(
      readText(record, const ['markedAtText', 'dateText'], fallback: ''),
    );
  }

  void _openAttendanceTask({required String task, required String mode}) {
    setState(() {
      _attendanceTask = task;
      _attendanceBranch = '';
      _attendanceMode = mode;
      _attendanceScope = mode == 'students' ? 'subject' : 'staff';
      _attendanceSelectedEntityId = '';
    });
  }

  void _openAttendanceBranch({
    required String branch,
    required String mode,
    required String scope,
  }) {
    setState(() {
      _attendanceTask = mode == 'staff' ? 'staff' : 'students';
      _attendanceBranch = branch;
      _attendanceMode = mode;
      _attendanceScope = scope;
      _attendanceSelectedEntityId = '';
    });
  }

  void _backAttendanceStep() {
    setState(() {
      if (_attendanceBranch.isNotEmpty) {
        _attendanceBranch = '';
        _attendanceSelectedEntityId = '';
      } else {
        _attendanceTask = '';
        _attendanceMode = 'students';
        _attendanceScope = 'subject';
        _attendanceSelectedEntityId = '';
      }
    });
  }

  Future<void> _pickAttendanceDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _attendanceSelectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(DateTime.now().year + 5, 12, 31),
    );
    if (picked == null || !mounted) return;
    setState(() => _attendanceSelectedDate = picked);
  }

  Future<void> _markAttendanceEntity(
    Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic> entity,
    String status,
  ) async {
    final isStudentMode = _attendanceMode == 'students';
    final canMark = isStudentMode
        ? _can('attendance.markStudents')
        : _can('attendance.markStaff');
    if (!canMark) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You do not have permission to mark attendance.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final subjectOptions = _attendanceSubjectOptions(data);
    final selectedSubject = _selectedAttendanceSubject(subjectOptions);
    if (isStudentMode &&
        _attendanceScope == 'subject' &&
        selectedSubject == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Select a live subject before marking attendance.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final dateText = _attendanceDisplayDate(_attendanceSelectedDate);
    final subjectName = isStudentMode && _attendanceScope == 'subject'
        ? selectedSubject?.name ?? ''
        : '';
    final sourceRecords = isStudentMode
        ? _items(data, 'studentAttendance')
        : _items(data, 'staffAttendance');
    final existing = _attendanceRecordForEntity(
      sourceRecords,
      entity,
      dateText: dateText,
      subjectName: subjectName,
    );
    final entityRecordId = readText(entity, const ['id'], fallback: '');
    final entityId = readText(entity, const [
      'studentId',
      'employeeId',
    ], fallback: entityRecordId);
    final entityName = readText(entity, const [
      'name',
      'studentName',
    ], fallback: entityId);

    try {
      if (existing != null) {
        if (readText(existing, const ['status'], fallback: '') == status) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('$entityName is already marked $status.'),
              behavior: SnackBarBehavior.floating,
            ),
          );
          return;
        }
        if (!_isAttendanceRecordEditable(existing)) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Attendance can only be edited within 24 hours.'),
              behavior: SnackBarBehavior.floating,
            ),
          );
          return;
        }
        await widget.repository.updateDocument(
          isStudentMode ? 'studentAttendanceRecords' : 'staffAttendanceRecords',
          readText(existing, const ['id'], fallback: ''),
          {
            'status': status,
            'editedAtText': _attendanceDisplayDate(DateTime.now()),
            'editedAtIso': DateTime.now().toIso8601String(),
            'editedBy': widget.user.uid,
          },
        );
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$entityName updated to $status.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        await _refresh();
        return;
      }

      await widget.repository.createDocument(
        isStudentMode ? 'studentAttendanceRecords' : 'staffAttendanceRecords',
        {
          'entityType': isStudentMode ? 'Student' : 'Staff',
          'entityRecordId': entityRecordId,
          'entityId': entityId,
          'entityName': entityName,
          if (!isStudentMode) 'staffRecordId': entityRecordId,
          if (!isStudentMode) 'employeeId': entityId,
          if (isStudentMode) 'studentRecordId': entityRecordId,
          if (isStudentMode) 'studentId': entityId,
          if (_academicYear.trim().isNotEmpty)
            'academicYear': _academicYear.trim(),
          'className': readText(entity, const ['className'], fallback: ''),
          'section': readText(entity, const ['section'], fallback: ''),
          'department': readText(entity, const ['department'], fallback: ''),
          'courseCode': readText(entity, const ['courseCode'], fallback: ''),
          'courseName': readText(entity, const [
            'courseName',
            'program',
          ], fallback: ''),
          'attendanceScope': isStudentMode ? _attendanceScope : 'staff',
          'subjectCode': isStudentMode && _attendanceScope == 'subject'
              ? selectedSubject?.code ?? ''
              : '',
          'subjectName': subjectName,
          'dateText': dateText,
          'status': status,
          'markedAtText': _attendanceDisplayDate(DateTime.now()),
          'markedAtIso': DateTime.now().toIso8601String(),
          'parentNotified': false,
          'createdBy': widget.user.uid,
        },
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$entityName marked $status.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Attendance was not saved: $error'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Widget _timetable(Map<String, List<Map<String, dynamic>>> data) {
    final canCreate = _can('timetable.create');
    final canEdit = _can('timetable.edit');
    final statusView = canEdit ? _timetableStatusView : 'active';
    final allEntries = _timetableScopedEntries(data);
    final visibleEntries = allEntries
        .where(
          (entry) => statusView == 'archived'
              ? _isArchivedTimetableEntry(entry)
              : !_isArchivedTimetableEntry(entry),
        )
        .toList();
    final entries = visibleEntries
        .where(
          (item) => containsQuery(item, _query, const [
            'subject',
            'subjectName',
            'classKey',
            'facultyName',
            'classroomName',
            'teacherName',
            'day',
            'className',
            'division',
            'timeSlot',
          ]),
        )
        .toList();
    final activeEntries = allEntries
        .where((entry) => !_isArchivedTimetableEntry(entry))
        .toList();
    final archivedEntries = allEntries.where(_isArchivedTimetableEntry).length;
    final slots = _timetableTimeSlotOptions(
      _query.trim().isEmpty ? visibleEntries : entries,
      includeDefaults: canCreate && statusView != 'archived',
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InfoCard(
          child: Row(
            children: [
              Container(
                height: 56,
                width: 56,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.calendar_month_rounded,
                  color: AppColors.primary,
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Academics / Timetable Management',
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Timetable Management',
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Class timetable creation and schedule management.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (canEdit) ...[
          const SizedBox(height: 12),
          _SegmentedFilter(
            value: statusView,
            options: const {
              'active': 'Active Timetable',
              'archived': 'Archive',
            },
            onChanged: (value) => setState(() => _timetableStatusView = value),
          ),
        ],
        _SummaryRow(
          stats: [
            _Stat(
              'Active',
              activeEntries.length.toString(),
              Icons.calendar_month_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Classrooms',
              _items(data, 'classrooms').length.toString(),
              Icons.meeting_room_rounded,
              const Color(0xFF2196C9),
            ),
            _Stat(
              canEdit ? 'Archived' : 'Published',
              canEdit
                  ? archivedEntries.toString()
                  : _items(data, 'publications').length.toString(),
              canEdit ? Icons.archive_rounded : Icons.publish_rounded,
              canEdit ? AppColors.danger : AppColors.accent,
            ),
          ],
        ),
        const SectionTitle('Time Table'),
        if (entries.isEmpty)
          EmptyState(
            title: _query.trim().isEmpty
                ? 'No timetable entries'
                : 'No timetable entries matched',
            message: _query.trim().isEmpty
                ? 'Published and draft timetable records will appear here.'
                : 'Try a different subject, faculty, classroom, or day.',
            actionLabel: canCreate && statusView != 'archived'
                ? 'New Entry'
                : null,
            actionIcon: Icons.add_rounded,
            onAction: canCreate && statusView != 'archived'
                ? () => _showTimetableEntrySheet(data: data)
                : null,
          )
        else
          _TimetableBoard(
            entries: entries,
            slots: slots,
            statusView: statusView,
            canCreate: canCreate,
            canEdit: canEdit,
            canArchive: canEdit,
            onCreate: (defaults) =>
                _showTimetableEntrySheet(data: data, defaults: defaults),
            onEdit: (entry) =>
                _showTimetableEntrySheet(data: data, entry: entry),
            onArchive: _archiveTimetableEntry,
            onRestore: _restoreTimetableEntry,
          ),
        const SectionTitle('Classroom Allocation'),
        if (_items(data, 'classrooms').isEmpty)
          const EmptyState(
            title: 'No classrooms',
            message: 'Classroom records from the web ERP will appear here.',
          )
        else
          ..._items(data, 'classrooms')
              .take(8)
              .map(
                (room) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _CompactRow(
                    title:
                        'Room ${readText(room, const ['roomNo', 'roomNumber', 'name'])}',
                    subtitle:
                        '${readText(room, const ['building', 'block'], fallback: 'Classroom')} / ${readText(room, const ['capacity'], fallback: '-')} seats',
                    trailing: const Icon(
                      Icons.meeting_room_rounded,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ),
      ],
    );
  }

  List<Map<String, dynamic>> _timetableScopedEntries(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    final entries = _items(data, 'entries');
    if (!widget.user.isParent) return entries;
    final linkedCourseCodes = _items(data, 'students')
        .map((student) => readText(student, const ['courseCode'], fallback: ''))
        .where((code) => code.isNotEmpty)
        .toSet();
    if (linkedCourseCodes.isEmpty) return entries;
    return entries
        .where(
          (entry) => linkedCourseCodes.contains(
            readText(entry, const ['courseCode'], fallback: ''),
          ),
        )
        .toList();
  }

  bool _isArchivedTimetableEntry(Map<String, dynamic> entry) =>
      readText(entry, const ['status'], fallback: '').toLowerCase() ==
      'archived';

  List<String> _timetableClassOptions(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    final options =
        _items(data, 'students')
            .where(
              (student) =>
                  readText(student, const [
                    'status',
                  ], fallback: '').toLowerCase() !=
                  'archived',
            )
            .map(_timetableClassKey)
            .where((item) => item.trim().isNotEmpty && item != '- - -')
            .toSet()
            .toList()
          ..sort();
    return options;
  }

  String _timetableClassKey(Map<String, dynamic> student) {
    final className = readText(student, const [
      'className',
      'courseYear',
      'courseName',
      'program',
    ], fallback: '');
    final section = readText(student, const [
      'section',
      'division',
      'admissionType',
    ], fallback: '');
    if (className.isEmpty) return section;
    if (section.isEmpty) return className;
    return '$className - $section';
  }

  List<Map<String, dynamic>> _timetableFaculty(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    return _items(data, 'staff')
        .where(
          (member) =>
              readText(member, const ['staffType'], fallback: '') ==
                  'Faculty' &&
              readText(member, const ['status'], fallback: '').toLowerCase() !=
                  'archived',
        )
        .toList();
  }

  List<_TimetableSlotOption> _timetableTimeSlotOptions(
    List<Map<String, dynamic>> entries, {
    bool includeArchived = false,
    bool includeDefaults = false,
  }) {
    final byLabel = <String, _TimetableSlotOption>{};
    if (includeDefaults) {
      for (final label in _defaultTimetableSlots) {
        final parsed = _parseTimetableSlot(label);
        byLabel[label] = _TimetableSlotOption(
          label: label,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
        );
      }
    }
    for (final rawEntry in entries) {
      if (!includeArchived && _isArchivedTimetableEntry(rawEntry)) continue;
      final entry = _normalizeTimetableSlotFields(rawEntry);
      final label = _timetableSlotLabel(entry);
      if (label.isEmpty) continue;
      byLabel[label] = _TimetableSlotOption(
        label: label,
        startTime: readText(entry, const ['startTime'], fallback: ''),
        endTime: readText(entry, const ['endTime'], fallback: ''),
      );
    }
    final values = byLabel.values.toList()
      ..sort(
        (first, second) =>
            _timeToMinutes(
              first.startTime.isEmpty
                  ? first.label.split('-').first
                  : first.startTime,
            ).compareTo(
              _timeToMinutes(
                second.startTime.isEmpty
                    ? second.label.split('-').first
                    : second.startTime,
              ),
            ),
      );
    return values;
  }

  static const _defaultTimetableSlots = [
    '09:00 - 10:00',
    '10:00 - 11:00',
    '11:00 - 12:00',
    '11:15 - 12:15',
    '12:00 - 01:00',
    '12:15 - 01:15',
    '01:00 - 02:00',
    '02:00 - 03:00',
    '03:00 - 04:00',
    '04:00 - 05:00',
  ];

  static const _timetableWeekDays = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  _TimetableSlotParts _parseTimetableSlot(String timeSlot) {
    final parts = timeSlot.split(RegExp(r'\s*-\s*'));
    return _TimetableSlotParts(
      startTime: _parseTimetableTimePart(parts.isNotEmpty ? parts.first : ''),
      endTime: _parseTimetableTimePart(parts.length > 1 ? parts[1] : ''),
    );
  }

  String _parseTimetableTimePart(String value) {
    final match = RegExp(
      r'^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$',
      caseSensitive: false,
    ).firstMatch(value.trim());
    if (match == null) return '';
    var hours = int.tryParse(match.group(1) ?? '') ?? 0;
    final minutes = int.tryParse(match.group(2) ?? '0') ?? 0;
    final meridiem = (match.group(3) ?? '').toLowerCase();
    if (meridiem == 'pm' && hours < 12) hours += 12;
    if (meridiem == 'am' && hours == 12) hours = 0;
    if (meridiem.isEmpty && hours >= 1 && hours <= 5) hours += 12;
    return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}';
  }

  int _timeToMinutes(String value) {
    final parsed = _parseTimetableTimePart(value);
    if (parsed.isEmpty) return 1 << 30;
    final pieces = parsed.split(':').map((piece) => int.parse(piece)).toList();
    return pieces[0] * 60 + pieces[1];
  }

  String _timetableSlotLabel(Map<String, dynamic> entry) {
    final slot = readText(entry, const ['timeSlot'], fallback: '');
    if (slot.isNotEmpty) return slot;
    final start = readText(entry, const ['startTime'], fallback: '');
    final end = readText(entry, const ['endTime'], fallback: '');
    if (start.isNotEmpty && end.isNotEmpty) return '$start - $end';
    return '';
  }

  Map<String, dynamic> _normalizeTimetableSlotFields(
    Map<String, dynamic> entry,
  ) {
    final label = _timetableSlotLabel(entry);
    final parsed = _parseTimetableSlot(label);
    return {
      ...entry,
      'timeSlot': label,
      'startTime': readText(entry, const [
        'startTime',
      ], fallback: parsed.startTime),
      'endTime': readText(entry, const ['endTime'], fallback: parsed.endTime),
    };
  }

  bool _hasTimetableConflict(
    List<Map<String, dynamic>> entries,
    Map<String, dynamic> candidate, {
    String ignoreId = '',
  }) {
    final candidateSlot = _timetableSlotLabel(candidate);
    for (final entry in entries) {
      if (readText(entry, const ['id'], fallback: '') == ignoreId ||
          _isArchivedTimetableEntry(entry)) {
        continue;
      }
      final sameSlot =
          readText(entry, const ['day'], fallback: '') ==
              readText(candidate, const ['day'], fallback: '') &&
          _timetableSlotLabel(entry) == candidateSlot;
      if (!sameSlot) continue;
      if (readText(entry, const ['classKey'], fallback: '') ==
              readText(candidate, const ['classKey'], fallback: '') ||
          readText(entry, const ['facultyId'], fallback: '') ==
              readText(candidate, const ['facultyId'], fallback: '') ||
          readText(entry, const ['classroomId'], fallback: '') ==
              readText(candidate, const ['classroomId'], fallback: '')) {
        return true;
      }
    }
    return false;
  }

  Future<void> _showTimetableEntrySheet({
    required Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic>? entry,
    Map<String, dynamic> defaults = const {},
  }) async {
    final isEdit = entry != null;
    final classOptions = _timetableClassOptions(data);
    final faculty = _timetableFaculty(data);
    final classrooms = _items(data, 'classrooms');
    final slotOptions = _timetableTimeSlotOptions(
      _timetableScopedEntries(data),
      includeDefaults: true,
    );
    final initial = {
      if (classOptions.isNotEmpty) 'classKey': classOptions.first,
      if (faculty.isNotEmpty)
        'facultyId': readText(faculty.first, const ['id'], fallback: ''),
      if (classrooms.isNotEmpty)
        'classroomId': readText(classrooms.first, const ['id'], fallback: ''),
      'day': _timetableWeekDays.first,
      if (slotOptions.isNotEmpty) 'timeSlot': slotOptions.first.label,
      if (slotOptions.isNotEmpty) 'startTime': slotOptions.first.startTime,
      if (slotOptions.isNotEmpty) 'endTime': slotOptions.first.endTime,
      ...defaults,
      ...?entry,
    };

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _TimetableEntrySheet(
        initialValues: initial,
        classOptions: classOptions,
        faculty: faculty,
        classrooms: classrooms,
        timeSlotOptions: slotOptions,
        isEdit: isEdit,
        onSave: (form) async {
          final validation = _validateTimetableForm(form);
          if (validation.isNotEmpty) throw ArgumentError(validation);
          final payload = _buildTimetableEntryPayload(data, form);
          final id = readText(entry ?? const {}, const ['id'], fallback: '');
          if (_hasTimetableConflict(
            _timetableScopedEntries(data),
            payload,
            ignoreId: id,
          )) {
            throw StateError(
              'Conflict detected for class, faculty, or classroom in the same slot.',
            );
          }
          if (isEdit) {
            if (!_can('timetable.edit')) {
              throw StateError(
                'You do not have permission to edit timetable entries.',
              );
            }
            await widget.repository.updateDocument('timetableEntries', id, {
              ...payload,
              'updatedAtText': _displayDateNow(),
            });
          } else {
            if (!_can('timetable.create')) {
              throw StateError(
                'You do not have permission to create timetable entries.',
              );
            }
            await widget.repository.createDocument('timetableEntries', {
              ...payload,
              if (_academicYear.trim().isNotEmpty)
                'academicYear': _academicYear.trim(),
              'createdAtText': _displayDateNow(),
              'createdBy': widget.user.uid,
            });
          }
        },
      ),
    );
    if (!mounted) return;
    if (saved == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isEdit ? 'Timetable entry updated' : 'Timetable entry saved',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    }
  }

  String _validateTimetableForm(Map<String, dynamic> form) {
    for (final required in const [
      ['classKey', 'Class'],
      ['subject', 'Subject'],
      ['facultyId', 'Faculty'],
      ['classroomId', 'Classroom'],
      ['day', 'Day'],
      ['timeSlot', 'Time slot'],
    ]) {
      if (readText(form, [required[0]], fallback: '').trim().isEmpty) {
        return '${required[1]} is required.';
      }
    }
    return '';
  }

  Map<String, dynamic> _buildTimetableEntryPayload(
    Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic> form,
  ) {
    final normalizedForm = _normalizeTimetableSlotFields(form);
    final faculty = _timetableFaculty(data);
    final classrooms = _items(data, 'classrooms');
    final classStudent = _items(data, 'students')
        .cast<Map<String, dynamic>?>()
        .firstWhere(
          (student) =>
              student != null &&
              _timetableClassKey(student) == form['classKey'],
          orElse: () => null,
        );
    final facultyMember = faculty.cast<Map<String, dynamic>?>().firstWhere(
      (member) =>
          member != null &&
          readText(member, const ['id'], fallback: '') ==
              readText(form, const ['facultyId'], fallback: ''),
      orElse: () => null,
    );
    final classroom = classrooms.cast<Map<String, dynamic>?>().firstWhere(
      (room) =>
          room != null &&
          readText(room, const ['id'], fallback: '') ==
              readText(form, const ['classroomId'], fallback: ''),
      orElse: () => null,
    );
    return {
      ...form,
      ...normalizedForm,
      'subject': readText(form, const ['subject'], fallback: '').trim(),
      'facultyName': facultyMember == null
          ? ''
          : readText(facultyMember, const ['name'], fallback: ''),
      'classroomName': classroom == null
          ? ''
          : readText(classroom, const [
              'roomNo',
              'roomNumber',
              'name',
            ], fallback: ''),
      'courseCode': classStudent == null
          ? readText(form, const ['courseCode'], fallback: '')
          : readText(classStudent, const ['courseCode'], fallback: ''),
      'courseName': classStudent == null
          ? readText(form, const ['courseName'], fallback: '')
          : readText(classStudent, const [
              'courseName',
              'program',
            ], fallback: ''),
      'status': 'Draft',
    };
  }

  Future<void> _archiveTimetableEntry(Map<String, dynamic> entry) async {
    if (!_can('timetable.edit')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You do not have permission to archive entries.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final id = readText(entry, const ['id'], fallback: '');
    if (id.isEmpty) return;
    await widget.repository.updateDocument('timetableEntries', id, {
      'status': 'Archived',
      'archivedAt': FieldValue.serverTimestamp(),
      'archivedAtText': _displayDateNow(),
    });
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Timetable entry archived'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    await _refresh();
  }

  Future<void> _restoreTimetableEntry(Map<String, dynamic> entry) async {
    if (!_can('timetable.edit')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You do not have permission to restore entries.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final id = readText(entry, const ['id'], fallback: '');
    if (id.isEmpty) return;
    await widget.repository.updateDocument('timetableEntries', id, {
      'status': 'Draft',
      'restoredAt': FieldValue.serverTimestamp(),
      'restoredAtText': _displayDateNow(),
    });
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Timetable entry restored'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    setState(() => _timetableStatusView = 'active');
    await _refresh();
  }

  Widget _resultsParity(Map<String, List<Map<String, dynamic>>> data) {
    final canSchedule = _can('exams.schedule');
    final canAssess = _can('exams.assessments');
    final canEnterMarks = _can('exams.marks');
    final canGenerateResults = _can('exams.results');
    final canGenerateReportCards = _can('exams.reportCards');
    final students = _examStudents(data);
    final schedules = _examScopedSchedules(data);
    final marks = _examScopedRecords(_items(data, 'marks'), students)
        .where(
          (item) => containsQuery(item, _query, const [
            'studentName',
            'studentId',
            'subject',
            'examName',
            'classKey',
          ]),
        )
        .toList();
    final results = _examScopedRecords(_items(data, 'results'), students);
    final reportCards = _examScopedRecords(
      _items(data, 'reportCards'),
      students,
    );
    final assessments = _items(data, 'assessments');
    final filteredSchedules = schedules
        .where(
          (item) => containsQuery(item, _query, const [
            'examName',
            'subject',
            'className',
            'classKey',
            'facultyName',
            'examType',
          ]),
        )
        .toList();
    final selectedSchedule = _examSelectedSchedule(data);
    final selectedScheduleMarks = selectedSchedule == null
        ? const <Map<String, dynamic>>[]
        : marks
              .where(
                (mark) =>
                    readText(mark, const ['examScheduleId'], fallback: '') ==
                    readText(selectedSchedule, const ['id'], fallback: ''),
              )
              .toList();
    final marksCompletion = schedules.isNotEmpty && students.isNotEmpty
        ? ((marks.length / (schedules.length * students.length)) * 100).round()
        : 0;
    final passCount = results
        .where((item) => readText(item, const ['status']) == 'Pass')
        .length;
    final needsImprovement = results
        .where(
          (item) => readText(item, const ['status']) == 'Needs Improvement',
        )
        .length;
    final pendingCount = (students.length - results.length).clamp(0, 1 << 30);
    final activeBranchTitle = _examBranchTitle(_examBranch);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InfoCard(
          child: Row(
            children: [
              Container(
                height: 56,
                width: 56,
                decoration: BoxDecoration(
                  color: const Color(0xFF8357C5).withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.assignment_turned_in_rounded,
                  color: Color(0xFF8357C5),
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Academics / Examination & Result Management',
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _examTask.isEmpty
                          ? 'Examination & Result Management'
                          : activeBranchTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    const Text(
                      'Exam scheduling, marks, results, and report cards.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        _SummaryRow(
          stats: [
            _Stat(
              'Schedules',
              schedules.length.toString(),
              Icons.event_note_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Marks',
              marks.length.toString(),
              Icons.assignment_turned_in_rounded,
              const Color(0xFF8357C5),
            ),
            _Stat(
              'Results',
              results.length.toString(),
              Icons.emoji_events_rounded,
              AppColors.accent,
            ),
          ],
        ),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 220),
          switchInCurve: Curves.easeOutCubic,
          switchOutCurve: Curves.easeInCubic,
          child: _examTask.isEmpty
              ? Column(
                  key: const ValueKey('exam-home'),
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SectionTitle('Exam Readiness'),
                    InfoCard(
                      child: Column(
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: LabelValue(
                                  label: 'Marks Completion',
                                  value: '$marksCompletion%',
                                ),
                              ),
                              Expanded(
                                child: LabelValue(
                                  label: 'Report Cards',
                                  value: reportCards.length.toString(),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              Expanded(
                                child: LabelValue(
                                  label: 'Pass',
                                  value: passCount.toString(),
                                ),
                              ),
                              Expanded(
                                child: LabelValue(
                                  label: 'Needs Improvement',
                                  value: needsImprovement.toString(),
                                ),
                              ),
                              Expanded(
                                child: LabelValue(
                                  label: 'Pending',
                                  value: pendingCount.toString(),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SectionTitle('Exam Desk Workflow'),
                    _AttendanceTaskCard(
                      title: 'Exam Schedules',
                      description: 'Create and review exam schedules.',
                      icon: Icons.assignment_rounded,
                      meta:
                          '${schedules.length} schedules / ${canSchedule ? 'Schedule enabled' : 'View only'}',
                      enabled: true,
                      onTap: () => _openExamTask('schedules'),
                    ),
                    const SizedBox(height: 10),
                    _AttendanceTaskCard(
                      title: 'Marks Entry',
                      description: 'Enter and review student marks.',
                      icon: Icons.school_rounded,
                      meta:
                          '${marks.length} entries / ${canEnterMarks ? 'Entry enabled' : 'View only'}',
                      enabled: true,
                      onTap: () => _openExamTask('marks'),
                    ),
                    const SizedBox(height: 10),
                    _AttendanceTaskCard(
                      title: 'Results & Cards',
                      description: 'Generate results and report cards.',
                      icon: Icons.description_rounded,
                      meta:
                          '${results.length} results / ${reportCards.length} cards',
                      enabled: true,
                      onTap: () => _openExamTask('results'),
                    ),
                  ],
                )
              : _examBranch.isEmpty
              ? Column(
                  key: ValueKey('exam-branches-$_examTask'),
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _BackActionButton(onPressed: _backExamStep),
                    const SectionTitle('Choose Next Step'),
                    ..._examBranchCards(
                      data: data,
                      canSchedule: canSchedule,
                      canAssess: canAssess,
                      canEnterMarks: canEnterMarks,
                      canGenerateResults: canGenerateResults,
                      canGenerateReportCards: canGenerateReportCards,
                    ),
                  ],
                )
              : Column(
                  key: ValueKey('exam-branch-$_examBranch'),
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _BackActionButton(onPressed: _backExamStep),
                    InfoCard(
                      child: Row(
                        children: [
                          Container(
                            height: 48,
                            width: 48,
                            decoration: BoxDecoration(
                              color: AppColors.accent.withValues(alpha: 0.13),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              _examBranchIcon(_examBranch),
                              color: AppColors.accent,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  activeBranchTitle,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _examBranchHelper(_examBranch),
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_examBranch == 'internal-assessment' ||
                        _examBranch == 'generate-results' ||
                        _examBranch == 'report-cards') ...[
                      const SectionTitle('Results & Cards'),
                      _ExamResultsPanel(
                        marks: marks,
                        results: results,
                        reportCards: reportCards,
                        assessments: assessments,
                      ),
                      const SizedBox(height: 12),
                      if (_examBranch == 'internal-assessment')
                        PrimaryActionButton(
                          label: 'Create Assessment',
                          icon: Icons.note_add_rounded,
                          onPressed: canAssess
                              ? () => _showAssessmentSheet(data: data)
                              : null,
                        ),
                      if (_examBranch == 'generate-results')
                        PrimaryActionButton(
                          label: 'Generate Results',
                          icon: Icons.auto_awesome_rounded,
                          onPressed: canGenerateResults
                              ? () => _showResultNameSheet(data: data)
                              : null,
                        ),
                      if (_examBranch == 'report-cards')
                        PrimaryActionButton(
                          label: 'Generate Report Cards',
                          icon: Icons.feed_rounded,
                          onPressed: canGenerateReportCards
                              ? () => _generateReportCards(data)
                              : null,
                        ),
                    ] else ...[
                      if (_examBranch == 'create-schedule' && canSchedule) ...[
                        const SizedBox(height: 12),
                        PrimaryActionButton(
                          label: 'Open Form',
                          icon: Icons.add_rounded,
                          onPressed: () => _showExamScheduleSheet(data: data),
                        ),
                      ],
                      if (_examBranch == 'enter-marks' && canEnterMarks) ...[
                        const SizedBox(height: 12),
                        PrimaryActionButton(
                          label: 'Open Marks Entry',
                          icon: Icons.assignment_turned_in_rounded,
                          onPressed: () => _showMarksEntrySheet(
                            data: data,
                            schedule: selectedSchedule,
                          ),
                        ),
                      ],
                      const SectionTitle('Exam Schedules'),
                      if (filteredSchedules.isEmpty)
                        const EmptyState(
                          title: 'No exam schedules found',
                          message:
                              'Create schedules before entering marks or generating results.',
                        )
                      else
                        ...filteredSchedules.map(
                          (schedule) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _ExamScheduleCard(
                              schedule: schedule,
                              selected:
                                  readText(schedule, const [
                                    'id',
                                  ], fallback: '') ==
                                  _examSelectedScheduleId,
                              onTap: () => setState(
                                () => _examSelectedScheduleId = readText(
                                  schedule,
                                  const ['id'],
                                  fallback: '',
                                ),
                              ),
                              canEdit: canSchedule,
                              onEdit: () => _showExamScheduleSheet(
                                data: data,
                                schedule: schedule,
                              ),
                            ),
                          ),
                        ),
                      const SectionTitle('Exam Details'),
                      if (selectedSchedule == null)
                        const EmptyState(
                          title: 'No schedule selected',
                          message:
                              'Tap an exam schedule to review details and related actions.',
                        )
                      else
                        _ExamScheduleDetail(
                          schedule: selectedSchedule,
                          markCount: selectedScheduleMarks.length,
                          canEdit: canSchedule,
                          canEnterMarks: canEnterMarks,
                          onEdit: () => _showExamScheduleSheet(
                            data: data,
                            schedule: selectedSchedule,
                          ),
                          onMarks: () => _showMarksEntrySheet(
                            data: data,
                            schedule: selectedSchedule,
                          ),
                        ),
                      const SectionTitle('Recent Marks'),
                      _MarksTable(marks: marks),
                    ],
                  ],
                ),
        ),
      ],
    );
  }

  List<Widget> _examBranchCards({
    required Map<String, List<Map<String, dynamic>>> data,
    required bool canSchedule,
    required bool canAssess,
    required bool canEnterMarks,
    required bool canGenerateResults,
    required bool canGenerateReportCards,
  }) {
    final cards = <Widget>[];
    void add({
      required String id,
      required String title,
      required String description,
      required IconData icon,
      required bool enabled,
      VoidCallback? afterOpen,
    }) {
      cards.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _AttendanceTaskCard(
            title: title,
            description: enabled ? description : 'Not available right now.',
            icon: icon,
            meta: enabled ? 'Open' : 'Restricted',
            enabled: enabled,
            onTap: () {
              _openExamBranch(id);
              afterOpen?.call();
            },
          ),
        ),
      );
    }

    if (_examTask == 'schedules') {
      add(
        id: 'create-schedule',
        title: 'Create Schedule',
        description: 'Open a new exam schedule form.',
        icon: Icons.add_rounded,
        enabled: canSchedule,
        afterOpen: canSchedule
            ? () => _showExamScheduleSheet(data: data)
            : null,
      );
      add(
        id: 'review-schedules',
        title: 'Review Schedules',
        description: 'Select an exam schedule to view or edit.',
        icon: Icons.assignment_rounded,
        enabled: true,
      );
    } else if (_examTask == 'marks') {
      add(
        id: 'enter-marks',
        title: 'Enter Marks',
        description: 'Open marks entry, or select a schedule first.',
        icon: Icons.school_rounded,
        enabled: canEnterMarks,
        afterOpen: canEnterMarks
            ? () => _showMarksEntrySheet(data: data)
            : null,
      );
      add(
        id: 'review-marks',
        title: 'Review Marks',
        description: 'Select a schedule to review entered marks.',
        icon: Icons.search_rounded,
        enabled: true,
      );
      add(
        id: 'internal-assessment',
        title: 'Internal Assessment',
        description: 'Create an internal assessment from an exam schedule.',
        icon: Icons.note_add_rounded,
        enabled: canAssess,
      );
    } else {
      add(
        id: 'generate-results',
        title: 'Generate Results',
        description: 'Generate combined student results.',
        icon: Icons.auto_awesome_rounded,
        enabled: canGenerateResults,
      );
      add(
        id: 'report-cards',
        title: 'Report Cards',
        description: 'Generate and review report cards.',
        icon: Icons.feed_rounded,
        enabled: canGenerateReportCards,
      );
    }
    return cards;
  }

  void _openExamTask(String task) {
    setState(() {
      _examTask = task;
      _examBranch = '';
      _examSelectedScheduleId = '';
    });
  }

  void _openExamBranch(String branch) {
    setState(() {
      _examBranch = branch;
      _examSelectedScheduleId = '';
    });
  }

  void _backExamStep() {
    setState(() {
      if (_examBranch.isNotEmpty) {
        _examBranch = '';
        _examSelectedScheduleId = '';
      } else {
        _examTask = '';
        _examSelectedScheduleId = '';
      }
    });
  }

  String _examBranchTitle(String branch) {
    switch (branch) {
      case 'create-schedule':
        return 'Create Schedule';
      case 'review-schedules':
        return 'Review Schedules';
      case 'enter-marks':
        return 'Enter Marks';
      case 'review-marks':
        return 'Review Marks';
      case 'internal-assessment':
        return 'Internal Assessment';
      case 'generate-results':
        return 'Generate Results';
      case 'report-cards':
        return 'Report Cards';
      default:
        return _examTask == 'marks'
            ? 'Marks Entry'
            : _examTask == 'results'
            ? 'Results & Cards'
            : 'Exam Schedules';
    }
  }

  String _examBranchHelper(String branch) {
    switch (branch) {
      case 'create-schedule':
        return 'Create subject-wise exam schedules for a class.';
      case 'review-schedules':
        return 'Select an exam schedule to inspect or edit.';
      case 'enter-marks':
        return 'Enter marks for a scheduled exam.';
      case 'review-marks':
        return 'Review marks by selecting a schedule.';
      case 'internal-assessment':
        return 'Create an assessment from a live schedule.';
      case 'generate-results':
        return 'Generate combined student results from marks.';
      case 'report-cards':
        return 'Generate report card records from results.';
      default:
        return 'Choose the next exam workflow step.';
    }
  }

  IconData _examBranchIcon(String branch) {
    switch (branch) {
      case 'create-schedule':
        return Icons.add_rounded;
      case 'review-schedules':
        return Icons.assignment_rounded;
      case 'enter-marks':
      case 'review-marks':
        return Icons.school_rounded;
      case 'internal-assessment':
        return Icons.note_add_rounded;
      case 'generate-results':
        return Icons.auto_awesome_rounded;
      case 'report-cards':
        return Icons.feed_rounded;
      default:
        return Icons.assignment_turned_in_rounded;
    }
  }

  List<Map<String, dynamic>> _examStudents(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    return _items(data, 'students')
        .where(
          (student) =>
              readText(student, const ['status'], fallback: '').toLowerCase() !=
              'archived',
        )
        .toList();
  }

  List<Map<String, dynamic>> _examFaculty(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    return _items(data, 'staff')
        .where(
          (member) =>
              readText(member, const ['staffType'], fallback: '') ==
                  'Faculty' &&
              readText(member, const ['status'], fallback: '').toLowerCase() !=
                  'archived',
        )
        .toList();
  }

  List<Map<String, dynamic>> _examScopedSchedules(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    final schedules = _items(data, 'schedules');
    if (!widget.user.isParent) return schedules;
    final students = _examStudents(data);
    final courseCodes = students
        .map((student) => readText(student, const ['courseCode'], fallback: ''))
        .where((value) => value.isNotEmpty)
        .toSet();
    final classKeys = students.map(_timetableClassKey).toSet();
    return schedules.where((schedule) {
      final courseCode = readText(schedule, const ['courseCode'], fallback: '');
      final classKey = readText(schedule, const ['classKey'], fallback: '');
      return (courseCode.isNotEmpty && courseCodes.contains(courseCode)) ||
          (classKey.isNotEmpty && classKeys.contains(classKey));
    }).toList();
  }

  List<Map<String, dynamic>> _examScopedRecords(
    List<Map<String, dynamic>> records,
    List<Map<String, dynamic>> students,
  ) {
    if (!widget.user.isParent) return records;
    final recordIds = students
        .map((student) => readText(student, const ['id'], fallback: ''))
        .toSet();
    final studentIds = students
        .map((student) => readText(student, const ['studentId'], fallback: ''))
        .toSet();
    return records.where((record) {
      final recordStudentId = readText(record, const [
        'studentId',
        'entityId',
      ], fallback: '');
      final recordStudentRecordId = readText(record, const [
        'studentRecordId',
        'entityRecordId',
      ], fallback: '');
      return studentIds.contains(recordStudentId) ||
          recordIds.contains(recordStudentRecordId);
    }).toList();
  }

  Map<String, dynamic>? _examSelectedSchedule(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    if (_examSelectedScheduleId.isEmpty) return null;
    for (final schedule in _examScopedSchedules(data)) {
      if (readText(schedule, const ['id'], fallback: '') ==
          _examSelectedScheduleId) {
        return schedule;
      }
    }
    return null;
  }

  int _examPercentage(num obtained, num maximum) {
    if (maximum <= 0) return 0;
    return ((obtained / maximum) * 100).round();
  }

  String _examGrade(num percentage) {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  }

  String _examResultStatus(num percentage) =>
      percentage >= 40 ? 'Pass' : 'Needs Improvement';

  _ExamMarkSummary _summarizeExamMarks(List<Map<String, dynamic>> marks) {
    final totalObtained = marks.fold<num>(
      0,
      (total, item) =>
          total +
          readNumber(item, const ['marksObtained', 'marks'], fallback: 0),
    );
    final totalMax = marks.fold<num>(
      0,
      (total, item) =>
          total + readNumber(item, const ['maxMarks'], fallback: 0),
    );
    final percentage = _examPercentage(totalObtained, totalMax);
    return _ExamMarkSummary(
      totalObtained: totalObtained,
      totalMax: totalMax,
      percentage: percentage,
      grade: _examGrade(percentage),
      status: _examResultStatus(percentage),
    );
  }

  Future<void> _showExamScheduleSheet({
    required Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic>? schedule,
  }) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _ExamScheduleSheet(
        initialValues: schedule,
        classOptions: _timetableClassOptions(data),
        faculty: _examFaculty(data),
        isEdit: schedule != null,
        onSave: (form) async {
          final validation = _validateExamSchedule(form);
          if (validation.isNotEmpty) throw ArgumentError(validation);
          final payload = _buildExamSchedulePayload(data, form);
          final id = readText(schedule ?? const {}, const ['id'], fallback: '');
          if (schedule == null) {
            if (!_can('exams.schedule')) {
              throw StateError('You do not have permission to schedule exams.');
            }
            await widget.repository.createDocument('examSchedules', {
              ...payload,
              if (_academicYear.trim().isNotEmpty)
                'academicYear': _academicYear.trim(),
              'createdAtText': _displayDateNow(),
              'createdBy': widget.user.uid,
            });
          } else {
            if (!_can('exams.schedule')) {
              throw StateError('You do not have permission to edit exams.');
            }
            await widget.repository.updateDocument('examSchedules', id, {
              ...payload,
              'updatedAtText': _displayDateNow(),
            });
          }
        },
      ),
    );
    if (!mounted) return;
    if (saved == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(schedule == null ? 'Exam scheduled' : 'Exam updated'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    }
  }

  String _validateExamSchedule(Map<String, dynamic> form) {
    for (final required in const [
      ['examName', 'Exam name'],
      ['classKey', 'Class'],
      ['subject', 'Subject'],
      ['examDate', 'Exam date'],
      ['maxMarks', 'Max marks'],
    ]) {
      if (readText(form, [required[0]], fallback: '').trim().isEmpty) {
        return '${required[1]} is required.';
      }
    }
    if (readNumber(form, const ['maxMarks']) <= 0) {
      return 'Max marks must be greater than zero.';
    }
    return '';
  }

  Map<String, dynamic> _buildExamSchedulePayload(
    Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic> form,
  ) {
    final faculty = _examFaculty(data);
    final facultyMember = faculty.cast<Map<String, dynamic>?>().firstWhere(
      (member) =>
          member != null &&
          readText(member, const ['id'], fallback: '') ==
              readText(form, const ['facultyId'], fallback: ''),
      orElse: () => null,
    );
    final classStudent = _items(data, 'students')
        .cast<Map<String, dynamic>?>()
        .firstWhere(
          (student) =>
              student != null &&
              _timetableClassKey(student) ==
                  readText(form, const ['classKey'], fallback: ''),
          orElse: () => null,
        );
    return {
      ...form,
      'examName': readText(form, const ['examName'], fallback: '').trim(),
      'subject': readText(form, const ['subject'], fallback: '').trim(),
      'maxMarks': readNumber(form, const ['maxMarks'], fallback: 0),
      'durationMinutes': readNumber(form, const [
        'durationMinutes',
      ], fallback: 0),
      'roomNo': readText(form, const ['roomNo'], fallback: '').trim(),
      'facultyName': facultyMember == null
          ? ''
          : readText(facultyMember, const ['name'], fallback: ''),
      'courseCode': classStudent == null
          ? readText(form, const ['courseCode'], fallback: '')
          : readText(classStudent, const ['courseCode'], fallback: ''),
      'courseName': classStudent == null
          ? readText(form, const ['courseName'], fallback: '')
          : readText(classStudent, const [
              'courseName',
              'program',
            ], fallback: ''),
      'status': readText(form, const ['status'], fallback: 'Scheduled'),
    };
  }

  Future<void> _showMarksEntrySheet({
    required Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic>? schedule,
  }) async {
    final schedules = _examScopedSchedules(data);
    final students = _examStudents(data);
    if (schedules.isEmpty || students.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Create exam schedules and students before marks entry.',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _MarksEntrySheet(
        schedules: schedules,
        students: students,
        initialScheduleId: readText(schedule ?? const {}, const [
          'id',
        ], fallback: ''),
        onSave: (form) async {
          if (!_can('exams.marks')) {
            throw StateError('You do not have permission to enter marks.');
          }
          final selectedSchedule = schedules.firstWhere(
            (item) =>
                readText(item, const ['id'], fallback: '') ==
                readText(form, const ['examScheduleId'], fallback: ''),
          );
          final student = students.firstWhere(
            (item) =>
                readText(item, const ['id'], fallback: '') ==
                readText(form, const ['studentRecordId'], fallback: ''),
          );
          final maxMarks = readNumber(selectedSchedule, const ['maxMarks']);
          final marksObtained = readNumber(form, const [
            'marksObtained',
          ], fallback: -1);
          final validation = _validateMarksEntry(
            form,
            maxMarks: maxMarks,
            marksObtained: marksObtained,
          );
          if (validation.isNotEmpty) throw ArgumentError(validation);
          final percentage = _examPercentage(marksObtained, maxMarks);
          final payload = {
            'examScheduleId': readText(selectedSchedule, const ['id']),
            'studentRecordId': readText(student, const ['id']),
            'studentId': readText(student, const ['studentId']),
            'studentName': readText(student, const ['name']),
            'classKey': readText(selectedSchedule, const ['classKey']),
            'subject': readText(selectedSchedule, const ['subject']),
            if (_academicYear.trim().isNotEmpty)
              'academicYear': _academicYear.trim(),
            'marksObtained': marksObtained,
            'maxMarks': maxMarks,
            'percentage': percentage,
            'grade': _examGrade(percentage),
            'status': 'Entered',
            'enteredAtText': _displayDateNow(),
            'enteredBy': widget.user.uid,
          };
          final existing = _items(data, 'marks').firstWhere(
            (item) =>
                readText(item, const ['examScheduleId'], fallback: '') ==
                    payload['examScheduleId'] &&
                readText(item, const ['studentRecordId'], fallback: '') ==
                    payload['studentRecordId'],
            orElse: () => const <String, dynamic>{},
          );
          final existingId = readText(existing, const ['id'], fallback: '');
          if (existingId.isEmpty) {
            await widget.repository.createDocument('marksEntries', payload);
          } else {
            await widget.repository.updateDocument(
              'marksEntries',
              existingId,
              payload,
            );
          }
        },
      ),
    );
    if (!mounted) return;
    if (saved == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Marks saved'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    }
  }

  String _validateMarksEntry(
    Map<String, dynamic> form, {
    required num maxMarks,
    required num marksObtained,
  }) {
    if (readText(form, const ['studentRecordId'], fallback: '').isEmpty) {
      return 'Student is required.';
    }
    if (readText(form, const ['examScheduleId'], fallback: '').isEmpty) {
      return 'Exam schedule is required.';
    }
    if (marksObtained < 0) return 'Marks cannot be negative.';
    if (marksObtained > maxMarks) return 'Marks cannot exceed max marks.';
    return '';
  }

  Future<void> _showAssessmentSheet({
    required Map<String, List<Map<String, dynamic>>> data,
  }) async {
    final schedules = _examScopedSchedules(data);
    if (schedules.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Create an exam schedule before assessments.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _AssessmentSheet(
        schedules: schedules,
        onSave: (form) async {
          if (!_can('exams.assessments')) {
            throw StateError(
              'You do not have permission to manage assessments.',
            );
          }
          final base = schedules.firstWhere(
            (item) =>
                readText(item, const ['id'], fallback: '') ==
                readText(form, const ['examScheduleId'], fallback: ''),
          );
          final title = readText(form, const ['title'], fallback: '').trim();
          final maxMarks = readNumber(form, const ['maxMarks']);
          if (title.isEmpty) {
            throw ArgumentError('Assessment title is required.');
          }
          if (maxMarks < 1) {
            throw ArgumentError('Max marks must be at least 1.');
          }
          await widget.repository.createDocument('internalAssessments', {
            'examScheduleId': readText(base, const ['id']),
            'title': title,
            'classKey': readText(base, const ['classKey']),
            'subject': readText(base, const ['subject']),
            'maxMarks': maxMarks,
            'status': readText(form, const ['status'], fallback: 'Active'),
            if (_academicYear.trim().isNotEmpty)
              'academicYear': _academicYear.trim(),
            'createdAtText': _displayDateNow(),
            'createdBy': widget.user.uid,
          });
        },
      ),
    );
    if (!mounted) return;
    if (saved == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Assessment created'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    }
  }

  Future<void> _showResultNameSheet({
    required Map<String, List<Map<String, dynamic>>> data,
  }) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) =>
          _ResultNameSheet(onSave: (name) => _generateResults(data, name)),
    );
    if (!mounted) return;
    if (saved == true) await _refresh();
  }

  Future<void> _generateResults(
    Map<String, List<Map<String, dynamic>>> data,
    String resultName,
  ) async {
    if (!_can('exams.results')) {
      throw StateError('You do not have permission to generate results.');
    }
    final examName = resultName.trim();
    if (examName.isEmpty) throw ArgumentError('Result name is required.');
    final students = _examStudents(data);
    final marks = _examScopedRecords(_items(data, 'marks'), students);
    final generated = <Map<String, dynamic>>[];
    for (final student in students) {
      final studentRecordId = readText(student, const ['id']);
      final studentMarks = marks
          .where(
            (mark) =>
                readText(mark, const ['studentRecordId'], fallback: '') ==
                    studentRecordId ||
                readText(mark, const ['studentId'], fallback: '') ==
                    readText(student, const ['studentId']),
          )
          .toList();
      final summary = _summarizeExamMarks(studentMarks);
      if (summary.totalMax <= 0) continue;
      generated.add({
        'studentRecordId': studentRecordId,
        'studentId': readText(student, const ['studentId']),
        'studentName': readText(student, const ['name']),
        'classKey': _timetableClassKey(student),
        'examName': examName,
        if (_academicYear.trim().isNotEmpty)
          'academicYear': _academicYear.trim(),
        'totalObtained': summary.totalObtained,
        'totalMax': summary.totalMax,
        'percentage': summary.percentage,
        'grade': summary.grade,
        'status': summary.status,
        'generatedAtText': _displayDateNow(),
        'generatedBy': widget.user.uid,
      });
    }
    if (generated.isEmpty) {
      throw StateError('No marks are available for generating results.');
    }
    for (final result in generated) {
      await widget.repository.createDocument('studentResults', result);
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Results generated'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _generateReportCards(
    Map<String, List<Map<String, dynamic>>> data,
  ) async {
    if (!_can('exams.reportCards')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You do not have permission to generate report cards.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final students = _examStudents(data);
    final results = _examScopedRecords(_items(data, 'results'), students);
    if (results.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Generate results before report cards.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    for (final result in results) {
      await widget.repository.createDocument('reportCards', {
        'studentRecordId': readText(result, const ['studentRecordId']),
        'studentId': readText(result, const ['studentId']),
        'examName': readText(result, const ['examName']),
        if (_academicYear.trim().isNotEmpty)
          'academicYear': _academicYear.trim(),
        'status': 'Generated',
        'generatedAtText': _displayDateNow(),
        'generatedBy': widget.user.uid,
      });
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Report cards generated'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    await _refresh();
  }

  // ignore: unused_element
  Widget _results(Map<String, List<Map<String, dynamic>>> data) {
    final marks = _items(data, 'marks')
        .where(
          (item) => containsQuery(item, _query, const [
            'studentName',
            'studentId',
            'subject',
            'examName',
          ]),
        )
        .toList();
    final schedules = _items(data, 'schedules')
        .where(
          (item) => containsQuery(item, _query, const [
            'examName',
            'subject',
            'className',
          ]),
        )
        .toList();
    return Column(
      children: [
        _SummaryRow(
          stats: [
            _Stat(
              'Schedules',
              schedules.length.toString(),
              Icons.event_note_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Marks',
              marks.length.toString(),
              Icons.assignment_turned_in_rounded,
              const Color(0xFF8357C5),
            ),
            _Stat(
              'Results',
              _items(data, 'results').length.toString(),
              Icons.emoji_events_rounded,
              AppColors.accent,
            ),
          ],
        ),
        const SectionTitle('Result Sheet'),
        _MarksTable(marks: marks),
        const SectionTitle('Exam Schedule'),
        if (schedules.isEmpty)
          const EmptyState(
            title: 'No exams found',
            message: 'Exam schedules will appear here.',
          )
        else
          ...schedules
              .take(20)
              .map(
                (exam) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _CompactRow(
                    title: readText(exam, const [
                      'examName',
                      'subject',
                      'title',
                    ]),
                    subtitle:
                        '${readText(exam, const ['className', 'program'], fallback: 'Class')} · ${formatDateValue(exam['examDate'] ?? exam['date'])}',
                    trailing: StatusPill(
                      label: readText(exam, const [
                        'status',
                      ], fallback: 'Scheduled'),
                    ),
                  ),
                ),
              ),
      ],
    );
  }

  Widget _feesParity(Map<String, List<Map<String, dynamic>>> data) {
    final students = _feeStudents(data);
    final structures = _feeStructures(data);
    final assignments = _feeAssignments(data, students);
    final collections = _feeCollections(data, assignments, students);
    final adjustments = _feeAdjustments(data, assignments, students);
    final rows = assignments
        .map(
          (assignment) =>
              _feeSnapshot(assignment, collections, adjustments, structures),
        )
        .toList();
    final visibleRows = rows
        .where((row) => _feeMatchesQuery(row))
        .where((row) => _feeMatchesStatus(row))
        .toList();
    final payableRows = rows.where((row) => row.due > 0).toList();
    final totalAssigned = rows.fold<num>(0, (total, row) => total + row.total);
    final totalCollected = rows.fold<num>(0, (total, row) => total + row.paid);
    final totalAdjusted = rows.fold<num>(
      0,
      (total, row) => total + row.adjusted,
    );
    final totalOutstanding = rows.fold<num>(0, (total, row) => total + row.due);
    final tasks = [
      _FeeTaskOption(
        id: 'collections',
        title: 'Fee Collections',
        description: 'Manual payments.',
        icon: Icons.payments_rounded,
        meta: [formatMoney(totalCollected), '${collections.length} posted'],
      ),
      _FeeTaskOption(
        id: 'structures',
        title: 'Payment Settings',
        description: 'Create, edit, and assign fee structures.',
        icon: Icons.settings_rounded,
        meta: [
          '${structures.length} active',
          _can('fees.setup') ? 'Setup enabled' : 'View only',
        ],
      ),
      _FeeTaskOption(
        id: 'adjustments',
        title: 'Adjustments',
        description: 'Approve waivers and fee corrections.',
        icon: Icons.tune_rounded,
        meta: ['${adjustments.length} approved', formatMoney(totalAdjusted)],
      ),
      _FeeTaskOption(
        id: 'due-tracking',
        title: 'Due Fee Tracking',
        description: 'Track pending fees and message parents on WhatsApp.',
        icon: Icons.message_rounded,
        meta: ['${payableRows.length} due', formatMoney(totalOutstanding)],
      ),
    ];

    return Column(
      key: ValueKey('fees-$_feeTask-$_feeBranch-$_feeStatusFilter'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InfoCard(
          child: Row(
            children: [
              Container(
                height: 56,
                width: 56,
                decoration: BoxDecoration(
                  color: const Color(0xFF465A6E).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.account_balance_wallet_rounded,
                  color: Color(0xFF465A6E),
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Finance / Payment',
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Payment',
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Student payment collection, due tracking, fee setup, waivers, and receipts.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        _SummaryRow(
          stats: [
            _Stat(
              'Assigned',
              formatMoney(totalAssigned),
              Icons.receipt_long_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Collected',
              formatMoney(totalCollected),
              Icons.payments_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Due',
              formatMoney(totalOutstanding),
              Icons.warning_rounded,
              AppColors.danger,
            ),
          ],
        ),
        if (_feeTask.isEmpty) ...[
          const SectionTitle('Payment'),
          ...tasks.map(
            (task) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _FeeTaskCard(
                option: task,
                onTap: () => _openFeeTask(task.id),
              ),
            ),
          ),
        ] else if (_feeBranch.isEmpty) ...[
          _FeeBackButton(onPressed: _goBackOneFeeStep),
          SectionTitle(tasks.firstWhere((task) => task.id == _feeTask).title),
          ..._feeBranchOptions(payableRows.length).map(
            (branch) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _FeeTaskCard(
                option: branch,
                disabled: branch.disabled,
                onTap: branch.disabled
                    ? null
                    : () {
                        _openFeeBranch(branch.id);
                        if (branch.id == 'create-structure') {
                          _showFeeStructureSheet(data: data);
                        }
                      },
              ),
            ),
          ),
        ] else ...[
          _FeeBackButton(onPressed: _goBackOneFeeStep),
          _feeBranchHeader(data),
          if (_feeBranch == 'collect-fee')
            _feeCollectionsView(data, collections, payableRows)
          else if (_feeBranch == 'create-structure' ||
              _feeBranch == 'manage-structures')
            _feeStructuresView(data, structures)
          else if (_feeBranch == 'approve-adjustment')
            _feeAssignmentsView(
              data: data,
              rows: payableRows,
              emptyTitle: 'No payable assignments',
              emptyMessage: 'All fee assignments are currently cleared.',
              showCollect: false,
              showAdjust: true,
            )
          else if (_feeBranch == 'adjustment-history')
            _feeReportsView(collections, adjustments)
          else
            _feeAssignmentsView(
              data: data,
              rows: visibleRows.where((row) => row.due > 0).toList(),
              emptyTitle: 'No due fees',
              emptyMessage: 'No matching due fee records found.',
              showCollect: _can('fees.collect'),
              showNotify: true,
            ),
        ],
      ],
    );
  }

  List<_FeeTaskOption> _feeBranchOptions(int payableCount) {
    switch (_feeTask) {
      case 'collections':
        return [
          _FeeTaskOption(
            id: 'collect-fee',
            title: 'Fee Collections',
            description: 'Record a student payment against an assigned fee.',
            icon: Icons.payments_rounded,
            disabled: !_can('fees.collect'),
          ),
        ];
      case 'structures':
        return [
          _FeeTaskOption(
            id: 'create-structure',
            title: 'Create Structure',
            description: 'Open a new fee structure form.',
            icon: Icons.add_rounded,
            disabled: !_can('fees.setup'),
          ),
          const _FeeTaskOption(
            id: 'manage-structures',
            title: 'Manage Structures',
            description: 'Edit or assign existing structures.',
            icon: Icons.settings_rounded,
          ),
        ];
      case 'adjustments':
        return [
          _FeeTaskOption(
            id: 'approve-adjustment',
            title: 'Approve Adjustment',
            description: 'Select a student fee, then approve adjustment.',
            icon: Icons.tune_rounded,
            disabled: !_can('fees.adjust') || payableCount == 0,
          ),
          const _FeeTaskOption(
            id: 'adjustment-history',
            title: 'Adjustment History',
            description: 'Review recent waivers and corrections.',
            icon: Icons.description_rounded,
          ),
        ];
      case 'due-tracking':
        return const [
          _FeeTaskOption(
            id: 'due-list',
            title: 'Due Fee Tracking',
            description: 'Review due students and notify parents on WhatsApp.',
            icon: Icons.message_rounded,
          ),
        ];
      default:
        return const [];
    }
  }

  Widget _feeBranchHeader(Map<String, List<Map<String, dynamic>>> data) {
    final branch = _feeBranchOptions(1).firstWhere(
      (item) => item.id == _feeBranch,
      orElse: () => const _FeeTaskOption(
        id: 'fees',
        title: 'Payment Details',
        description: '',
        icon: Icons.receipt_long_rounded,
      ),
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InfoCard(
        child: Row(
          children: [
            Container(
              height: 48,
              width: 48,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(branch.icon, color: AppColors.primaryDark),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    branch.title,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  if (branch.description.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      branch.description,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (_feeBranch == 'create-structure' && _can('fees.setup'))
              IconButton.filledTonal(
                tooltip: 'Create Structure',
                onPressed: () => _showFeeStructureSheet(data: data),
                icon: const Icon(Icons.add_rounded),
              ),
            if (_feeBranch == 'collect-fee' && _can('fees.collect'))
              IconButton.filledTonal(
                tooltip: 'Record Payment',
                onPressed: () => _showFeeCollectionSheet(data: data),
                icon: const Icon(Icons.add_card_rounded),
              ),
          ],
        ),
      ),
    );
  }

  Widget _feeCollectionsView(
    Map<String, List<Map<String, dynamic>>> data,
    List<Map<String, dynamic>> collections,
    List<_FeeAssignmentSnapshot> payableRows,
  ) {
    final visibleCollections = collections
        .where(
          (item) => containsQuery(item, _query, const [
            'studentName',
            'studentId',
            'classKey',
            'paymentMode',
            'referenceNo',
            'receiptNo',
            'paymentDate',
          ]),
        )
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_can('fees.collect')) ...[
          PrimaryActionButton(
            label: 'Record Payment',
            icon: Icons.add_card_rounded,
            onPressed: () => _showFeeCollectionSheet(data: data),
          ),
          const SizedBox(height: 10),
        ],
        const SectionTitle('Recent Collections'),
        if (visibleCollections.isEmpty)
          const EmptyState(
            title: 'No fee collections',
            message: 'Posted fee collections will appear here.',
          )
        else
          ...visibleCollections
              .take(20)
              .map(
                (collection) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _FeeCollectionCard(
                    collection: collection,
                    canEdit: _can('fees.collect'),
                    onEdit: () => _showFeeCollectionSheet(
                      data: data,
                      collection: collection,
                    ),
                  ),
                ),
              ),
        const SectionTitle('Outstanding Fee Assignments'),
        _feeAssignmentsView(
          data: data,
          rows: payableRows,
          emptyTitle: 'No outstanding fees',
          emptyMessage: 'All assigned fees are currently cleared.',
          showCollect: _can('fees.collect'),
          showAdjust: false,
          includeSectionTitle: false,
        ),
      ],
    );
  }

  Widget _feeStructuresView(
    Map<String, List<Map<String, dynamic>>> data,
    List<Map<String, dynamic>> structures,
  ) {
    final visibleStructures = structures
        .where(
          (item) => containsQuery(item, _query, const [
            'name',
            'classKey',
            'courseName',
            'academicYear',
            'status',
          ]),
        )
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_can('fees.setup')) ...[
          PrimaryActionButton(
            label: 'Create Structure',
            icon: Icons.add_rounded,
            onPressed: () => _showFeeStructureSheet(data: data),
          ),
          const SizedBox(height: 10),
        ],
        const SectionTitle('Fee Structures'),
        if (visibleStructures.isEmpty)
          const EmptyState(
            title: 'No fee structures',
            message: 'Create fee structures to assign class-wise fees.',
          )
        else
          ...visibleStructures.map(
            (structure) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _FeeStructureCard(
                structure: structure,
                canEdit: _can('fees.setup'),
                canAssign: _can('fees.assign'),
                onEdit: () =>
                    _showFeeStructureSheet(data: data, structure: structure),
                onAssign: () => _assignFeeStructure(data, structure),
              ),
            ),
          ),
      ],
    );
  }

  Widget _feeReportsView(
    List<Map<String, dynamic>> collections,
    List<Map<String, dynamic>> adjustments,
  ) {
    final recentCollections = collections
        .where(
          (item) => containsQuery(item, _query, const [
            'studentName',
            'studentId',
            'paymentMode',
            'referenceNo',
          ]),
        )
        .take(8)
        .toList();
    final recentAdjustments = adjustments
        .where(
          (item) => containsQuery(item, _query, const [
            'studentName',
            'studentId',
            'reason',
            'status',
          ]),
        )
        .take(8)
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionTitle('Recent Collections'),
        if (recentCollections.isEmpty)
          const EmptyState(
            title: 'No collections',
            message: 'No matching fee collections found.',
          )
        else
          ...recentCollections.map(
            (collection) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _FeeCollectionCard(
                collection: collection,
                canEdit: false,
                onEdit: () {},
              ),
            ),
          ),
        const SectionTitle('Adjustments & Waivers'),
        if (recentAdjustments.isEmpty)
          const EmptyState(
            title: 'No adjustments',
            message: 'Approved fee adjustments will appear here.',
          )
        else
          ...recentAdjustments.map(
            (adjustment) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _FeeAdjustmentCard(adjustment: adjustment),
            ),
          ),
      ],
    );
  }

  Widget _feeAssignmentsView({
    required Map<String, List<Map<String, dynamic>>> data,
    required List<_FeeAssignmentSnapshot> rows,
    required String emptyTitle,
    required String emptyMessage,
    bool showCollect = false,
    bool showAdjust = false,
    bool showNotify = false,
    bool includeSectionTitle = true,
  }) {
    final visibleRows = rows
        .where(_feeMatchesQuery)
        .where(_feeMatchesStatus)
        .toList();
    _FeeAssignmentSnapshot? selected;
    if (_feeSelectedAssignmentId.isNotEmpty) {
      for (final row in rows) {
        if (row.id == _feeSelectedAssignmentId) {
          selected = row;
          break;
        }
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (includeSectionTitle)
          SectionTitle(
            'Fee Assignments',
            trailing: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _feeStatusFilter,
                isDense: true,
                items: const [
                  DropdownMenuItem(value: 'all', child: Text('All')),
                  DropdownMenuItem(value: 'due', child: Text('Due')),
                  DropdownMenuItem(value: 'partial', child: Text('Partial')),
                  DropdownMenuItem(value: 'paid', child: Text('Paid')),
                ],
                onChanged: (value) {
                  if (value == null) return;
                  setState(() => _feeStatusFilter = value);
                },
              ),
            ),
          ),
        if (visibleRows.isEmpty)
          EmptyState(title: emptyTitle, message: emptyMessage)
        else
          ...visibleRows
              .take(30)
              .map(
                (row) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _FeeAssignmentCard(
                    row: row,
                    selected: row.id == _feeSelectedAssignmentId,
                    onTap: () =>
                        setState(() => _feeSelectedAssignmentId = row.id),
                    onCollect: showCollect && row.due > 0
                        ? () => _showFeeCollectionSheet(
                            data: data,
                            assignment: row.assignment,
                          )
                        : null,
                    onAdjust: showAdjust && row.due > 0
                        ? () => _showFeeAdjustmentSheet(
                            data: data,
                            assignment: row.assignment,
                          )
                        : null,
                    onNotify: showNotify && row.due > 0
                        ? () => _sendFeeReminder(data, row)
                        : null,
                  ),
                ),
              ),
        if (selected != null) ...[
          const SectionTitle('Payment Details'),
          _FeeAssignmentDetail(row: selected),
        ],
      ],
    );
  }

  void _openFeeTask(String task) {
    setState(() {
      _feeTask = task;
      _feeSelectedAssignmentId = '';
      _feeStatusFilter = 'all';
      _feeBranch = task == 'collections'
          ? 'collect-fee'
          : task == 'due-tracking'
          ? 'due-list'
          : '';
    });
  }

  void _openFeeBranch(String branch) {
    setState(() {
      _feeBranch = branch;
      _feeSelectedAssignmentId = '';
      _feeStatusFilter = 'all';
    });
  }

  void _goBackOneFeeStep() {
    setState(() {
      if (_feeBranch.isNotEmpty) {
        if (_feeTask == 'collections' || _feeTask == 'due-tracking') {
          _feeTask = '';
        }
        _feeBranch = '';
        _feeSelectedAssignmentId = '';
        return;
      }
      _feeTask = '';
      _feeSelectedAssignmentId = '';
    });
  }

  List<Map<String, dynamic>> _feeStudents(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    return _items(
      data,
      'students',
    ).where((student) => !_isArchivedStudent(student)).toList();
  }

  List<Map<String, dynamic>> _feeStructures(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    final structures = [..._items(data, 'structures')];
    structures.sort(
      (first, second) =>
          readText(first, const [
            'courseName',
            'classKey',
            'name',
          ], fallback: '').compareTo(
            readText(second, const [
              'courseName',
              'classKey',
              'name',
            ], fallback: ''),
          ),
    );
    return structures;
  }

  List<Map<String, dynamic>> _feeAssignments(
    Map<String, List<Map<String, dynamic>>> data,
    List<Map<String, dynamic>> students,
  ) {
    final assignments = [..._items(data, 'assignments')];
    if (!widget.user.isParent) return assignments;
    final studentKeys = _feeStudentKeys(students);
    return assignments
        .where(
          (assignment) => _feeRecordMatchesStudentKeys(assignment, studentKeys),
        )
        .toList();
  }

  List<Map<String, dynamic>> _feeCollections(
    Map<String, List<Map<String, dynamic>>> data,
    List<Map<String, dynamic>> assignments,
    List<Map<String, dynamic>> students,
  ) {
    final collections = [..._items(data, 'collections')];
    if (!widget.user.isParent) return collections;
    final assignmentIds = assignments
        .map((assignment) => readText(assignment, const ['id'], fallback: ''))
        .where((id) => id.isNotEmpty)
        .toSet();
    final studentKeys = _feeStudentKeys(students);
    return collections.where((collection) {
      final assignmentId = readText(collection, const [
        'assignmentId',
      ], fallback: '');
      return assignmentIds.contains(assignmentId) ||
          _feeRecordMatchesStudentKeys(collection, studentKeys);
    }).toList();
  }

  List<Map<String, dynamic>> _feeAdjustments(
    Map<String, List<Map<String, dynamic>>> data,
    List<Map<String, dynamic>> assignments,
    List<Map<String, dynamic>> students,
  ) {
    final adjustments = [..._items(data, 'adjustments')];
    if (!widget.user.isParent) return adjustments;
    final assignmentIds = assignments
        .map((assignment) => readText(assignment, const ['id'], fallback: ''))
        .where((id) => id.isNotEmpty)
        .toSet();
    final studentKeys = _feeStudentKeys(students);
    return adjustments.where((adjustment) {
      final assignmentId = readText(adjustment, const [
        'assignmentId',
      ], fallback: '');
      return assignmentIds.contains(assignmentId) ||
          _feeRecordMatchesStudentKeys(adjustment, studentKeys);
    }).toList();
  }

  Set<String> _feeStudentKeys(List<Map<String, dynamic>> students) {
    return students
        .expand(
          (student) => [
            readText(student, const ['id'], fallback: ''),
            readText(student, const ['studentId'], fallback: ''),
            readText(student, const ['admissionNo'], fallback: ''),
          ],
        )
        .where((value) => value.isNotEmpty)
        .toSet();
  }

  bool _feeRecordMatchesStudentKeys(
    Map<String, dynamic> record,
    Set<String> keys,
  ) {
    if (keys.isEmpty) return false;
    return [
      readText(record, const ['studentRecordId'], fallback: ''),
      readText(record, const ['studentId'], fallback: ''),
      readText(record, const ['admissionNo'], fallback: ''),
      readText(record, const ['entityRecordId'], fallback: ''),
      readText(record, const ['entityId'], fallback: ''),
    ].any(keys.contains);
  }

  _FeeAssignmentSnapshot _feeSnapshot(
    Map<String, dynamic> assignment,
    List<Map<String, dynamic>> collections,
    List<Map<String, dynamic>> adjustments,
    List<Map<String, dynamic>> structures,
  ) {
    final assignmentId = readText(assignment, const ['id'], fallback: '');
    final structureId = readText(assignment, const [
      'feeStructureId',
    ], fallback: '');
    final structure = _feeFindById(structures, structureId);
    final paidFromCollections = collections
        .where(
          (collection) =>
              readText(collection, const ['assignmentId'], fallback: '') ==
              assignmentId,
        )
        .fold<num>(0, (total, item) => total + _feeCollectionAmount(item));
    final adjustedFromRecords = adjustments
        .where(
          (adjustment) =>
              readText(adjustment, const ['assignmentId'], fallback: '') ==
              assignmentId,
        )
        .fold<num>(0, (total, item) => total + _feeAdjustmentAmount(item));
    final total = _feeAssignmentTotal(assignment);
    final paid = paidFromCollections > 0
        ? paidFromCollections
        : readNumber(assignment, const ['paidAmount', 'paid', 'totalPaid']);
    final adjusted = adjustedFromRecords > 0
        ? adjustedFromRecords
        : readNumber(assignment, const ['adjustmentAmount', 'adjustedAmount']);
    final storedDue = readNumber(assignment, const [
      'dueAmount',
      'balanceAmount',
      'amountDue',
      'unpaid',
    ], fallback: -1);
    final due = total > 0
        ? _feeDue(total, paid, adjusted)
        : storedDue < 0
        ? 0
        : storedDue;
    final status = _feeStatus(total, paid, adjusted, due);
    final dueDate = readText(assignment, const ['dueDate'], fallback: '');
    return _FeeAssignmentSnapshot(
      assignment: assignment,
      title: readText(assignment, const [
        'feeName',
        'feeStructureName',
        'name',
      ], fallback: readText(structure ?? const {}, const ['name'])),
      total: total,
      paid: paid,
      adjusted: adjusted,
      due: due,
      status: status,
      dueBucket: _feeDueBucket(dueDate, status),
    );
  }

  bool _feeMatchesQuery(_FeeAssignmentSnapshot row) {
    return containsQuery(row.assignment, _query, const [
          'studentName',
          'studentId',
          'classKey',
          'className',
          'feeName',
          'feeStructureName',
          'status',
          'academicYear',
        ]) ||
        row.title.toLowerCase().contains(_query.trim().toLowerCase());
  }

  bool _feeMatchesStatus(_FeeAssignmentSnapshot row) {
    switch (_feeStatusFilter) {
      case 'due':
        return row.due > 0;
      case 'partial':
        return row.status == 'Partially Paid';
      case 'paid':
        return row.due <= 0;
      default:
        return true;
    }
  }

  num _feeAssignmentTotal(Map<String, dynamic> assignment) {
    final explicit = readNumber(assignment, const [
      'totalAmount',
      'assignedAmount',
      'feeAmount',
      'amount',
    ]);
    if (explicit > 0) return explicit;
    return _feeComponentTotal(assignment);
  }

  num _feeCollectionAmount(Map<String, dynamic> collection) {
    return readNumber(collection, const [
      'amount',
      'paidAmount',
      'totalPaid',
      'collectedAmount',
    ]);
  }

  num _feeAdjustmentAmount(Map<String, dynamic> adjustment) {
    return readNumber(adjustment, const [
      'amount',
      'adjustmentAmount',
      'discountAmount',
      'waiverAmount',
    ]);
  }

  num _feeComponentTotal(Map<String, dynamic> source) {
    return _feeComponentFields.fold<num>(
      0,
      (total, field) => total + readNumber(source, [field.key]),
    );
  }

  num _feeDue(num total, num paid, num adjusted) {
    final due = total - paid - adjusted;
    return due < 0 ? 0 : due;
  }

  String _feeStatus(num total, num paid, num adjusted, num due) {
    if (due <= 0 && total > 0) return 'Paid';
    if (paid > 0 || adjusted > 0) return 'Partially Paid';
    return 'Due';
  }

  String _feeDueBucket(String dueDate, String status) {
    if (status == 'Paid') return 'Cleared';
    if (dueDate.trim().isEmpty) return 'No Due Date';
    final due = DateTime.tryParse(dueDate);
    if (due == null) return 'No Due Date';
    final days = due.difference(DateTime.now()).inDays;
    if (days < 0) return 'Overdue';
    if (days <= 7) return 'Due Soon';
    return 'Upcoming';
  }

  Map<String, dynamic>? _feeFindById(
    List<Map<String, dynamic>> items,
    String id,
  ) {
    if (id.isEmpty) return null;
    for (final item in items) {
      if (readText(item, const ['id'], fallback: '') == id) return item;
    }
    return null;
  }

  String _feeClassKey(Map<String, dynamic> student) {
    final explicit = readText(student, const ['classKey'], fallback: '');
    if (explicit.isNotEmpty) return explicit;
    final className = readText(student, const [
      'className',
      'standard',
      'courseYear',
      'program',
      'courseName',
    ], fallback: '');
    final section = readText(student, const [
      'section',
      'division',
      'batch',
    ], fallback: '');
    return [className, section].where((value) => value.isNotEmpty).join(' - ');
  }

  List<String> _feeClassOptions(Map<String, List<Map<String, dynamic>>> data) {
    final options = <String>{
      ..._feeStudents(data).map(_feeClassKey),
      ..._feeStructures(data).map(
        (structure) => readText(structure, const ['classKey'], fallback: ''),
      ),
    }..removeWhere((value) => value.isEmpty);
    final sorted = options.toList()..sort();
    return sorted;
  }

  Future<void> _showFeeStructureSheet({
    required Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic>? structure,
  }) async {
    if (!_can('fees.setup')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You cannot manage fee structures.')),
      );
      return;
    }
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _FeeStructureFormSheet(
        classOptions: _feeClassOptions(data),
        academicYear: _academicYear.trim().isEmpty
            ? _defaultAcademicYear
            : _academicYear.trim(),
        structure: structure,
        onSave: (values) async {
          final payload = {
            ...values,
            if (structure == null) 'createdBy': widget.user.uid,
            if (structure == null) 'createdAtText': _displayDateNow(),
            if (structure != null) 'updatedAtText': _displayDateNow(),
          };
          if (structure == null) {
            await widget.repository.createDocument('feeStructures', payload);
          } else {
            await widget.repository.updateDocument(
              'feeStructures',
              readText(structure, const ['id'], fallback: ''),
              payload,
            );
          }
        },
      ),
    );
    if (!mounted || saved != true) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          structure == null ? 'Fee structure created' : 'Fee structure updated',
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
    await _refresh();
  }

  Future<void> _showFeeAssignmentSheet({
    required Map<String, List<Map<String, dynamic>>> data,
  }) async {
    if (!_can('fees.assign')) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('You cannot assign fees.')));
      return;
    }
    final structures = _feeStructures(data);
    final students = _feeStudents(data);
    if (structures.isEmpty || students.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Create structures and active students before assigning fees.',
          ),
        ),
      );
      return;
    }
    final assignedCount = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _FeeAssignmentFormSheet(
        students: students,
        structures: structures,
        classKeyForStudent: _feeClassKey,
        onSave: (values) => _createFeeAssignments(data, values),
      ),
    );
    if (!mounted || assignedCount == null) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          assignedCount == 0
              ? 'Selected fee structure is already assigned.'
              : 'Assigned fee to $assignedCount student${assignedCount == 1 ? '' : 's'}',
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
    await _refresh();
  }

  Future<int> _createFeeAssignments(
    Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic> values,
  ) async {
    final students = _feeStudents(data);
    final assignments = _feeAssignments(data, students);
    final structure = _feeFindById(
      _feeStructures(data),
      readText(values, const ['feeStructureId'], fallback: ''),
    );
    if (structure == null) {
      throw ArgumentError('Fee structure is required.');
    }
    final mode = readText(values, const ['assignMode'], fallback: 'class');
    final targetStudentId = readText(values, const [
      'studentRecordId',
    ], fallback: '');
    final structureClassKey = readText(structure, const [
      'classKey',
    ], fallback: '');
    final targets = students.where((student) {
      if (mode == 'student') {
        return readText(student, const ['id'], fallback: '') == targetStudentId;
      }
      return _feeClassKey(student) == structureClassKey;
    }).toList();
    if (targets.isEmpty) {
      throw ArgumentError('No matching active students found.');
    }
    final existingKeys = assignments
        .map(
          (assignment) =>
              '${readText(assignment, const ['studentRecordId'], fallback: '')}-${readText(assignment, const ['feeStructureId'], fallback: '')}',
        )
        .toSet();
    var created = 0;
    for (final student in targets) {
      final studentRecordId = readText(student, const ['id'], fallback: '');
      final structureId = readText(structure, const ['id'], fallback: '');
      if (existingKeys.contains('$studentRecordId-$structureId')) continue;
      final totalAmount = _feeAssignmentTotal(structure);
      final payload = {
        'feeStructureId': structureId,
        'feeStructureName': readText(structure, const ['name'], fallback: ''),
        'studentRecordId': studentRecordId,
        'studentId': readText(student, const [
          'studentId',
          'admissionNo',
        ], fallback: ''),
        'studentName': readText(student, const [
          'name',
          'studentName',
        ], fallback: ''),
        'classKey': structureClassKey.isEmpty
            ? _feeClassKey(student)
            : structureClassKey,
        'academicYear': readText(
          structure,
          const ['academicYear'],
          fallback: _academicYear.trim().isEmpty
              ? _defaultAcademicYear
              : _academicYear.trim(),
        ),
        'courseCode': readText(structure, const [
          'courseCode',
        ], fallback: readText(student, const ['courseCode'], fallback: '')),
        'courseName': readText(
          structure,
          const ['courseName', 'programName'],
          fallback: readText(student, const [
            'courseName',
            'program',
          ], fallback: ''),
        ),
        for (final field in _feeComponentFields)
          field.key: readNumber(structure, [field.key]),
        'totalAmount': totalAmount,
        'paidAmount': 0,
        'adjustmentAmount': 0,
        'dueAmount': totalAmount,
        'dueDate': readText(structure, const ['dueDate'], fallback: ''),
        'status': 'Due',
        'assignedAtText': _displayDateNow(),
        'createdBy': widget.user.uid,
      };
      await widget.repository.createDocument('feeAssignments', payload);
      created += 1;
    }
    return created;
  }

  Future<void> _showFeeCollectionSheet({
    required Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic>? assignment,
    Map<String, dynamic>? collection,
  }) async {
    if (!_can('fees.collect')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You cannot record fee collections.')),
      );
      return;
    }
    final students = _feeStudents(data);
    final assignments = _feeAssignments(data, students);
    final structures = _feeStructures(data);
    final collections = _feeCollections(data, assignments, students);
    final adjustments = _feeAdjustments(data, assignments, students);
    final rows = assignments
        .map((item) => _feeSnapshot(item, collections, adjustments, structures))
        .where(
          (row) =>
              collection != null ||
              row.due > 0 ||
              readText(row.assignment, const ['id'], fallback: '') ==
                  readText(assignment ?? const {}, const ['id'], fallback: ''),
        )
        .toList();
    if (rows.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No outstanding fee assignment found.')),
      );
      return;
    }
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _FeeCollectionFormSheet(
        rows: rows,
        initialAssignmentId: collection == null
            ? readText(assignment ?? const {}, const ['id'], fallback: '')
            : readText(collection, const ['assignmentId'], fallback: ''),
        collection: collection,
        onSave: (values) => _saveFeeCollection(data, values, collection),
      ),
    );
    if (!mounted || saved != true) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          collection == null
              ? 'Fee collection posted'
              : 'Fee collection updated',
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
    await _refresh();
  }

  Future<void> _saveFeeCollection(
    Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic> values,
    Map<String, dynamic>? editingCollection,
  ) async {
    final students = _feeStudents(data);
    final assignments = _feeAssignments(data, students);
    final structures = _feeStructures(data);
    final collections = _feeCollections(data, assignments, students);
    final adjustments = _feeAdjustments(data, assignments, students);
    final assignmentId = readText(values, const ['assignmentId'], fallback: '');
    final assignment = _feeFindById(assignments, assignmentId);
    if (assignment == null) throw ArgumentError('Fee assignment is required.');
    final row = _feeSnapshot(assignment, collections, adjustments, structures);
    final amount = readNumber(values, const ['amount']);
    final oldAmount = editingCollection == null
        ? 0
        : _feeCollectionAmount(editingCollection);
    final dueBeforePayment = row.due + oldAmount;
    if (amount <= 0) throw ArgumentError('Collection amount is required.');
    if (amount > dueBeforePayment) {
      throw ArgumentError('Collection amount cannot exceed outstanding due.');
    }
    final nextPaid = row.paid - oldAmount + amount;
    final safePaid = nextPaid < 0 ? 0 : nextPaid;
    final nextDue = _feeDue(row.total, safePaid, row.adjusted);
    final assignmentUpdates = {
      'paidAmount': safePaid,
      'dueAmount': nextDue,
      'status': _feeStatus(row.total, safePaid, row.adjusted, nextDue),
      'updatedAtText': _displayDateNow(),
    };
    final payload = {
      'assignmentId': assignmentId,
      'feeStructureId': readText(assignment, const [
        'feeStructureId',
      ], fallback: ''),
      'feeStructureName': row.title,
      'studentRecordId': readText(assignment, const [
        'studentRecordId',
      ], fallback: ''),
      'studentId': readText(assignment, const ['studentId'], fallback: ''),
      'studentName': readText(assignment, const ['studentName'], fallback: ''),
      'classKey': readText(assignment, const ['classKey'], fallback: ''),
      'amount': amount,
      'academicYear': readText(
        assignment,
        const ['academicYear'],
        fallback: _academicYear.trim().isEmpty
            ? _defaultAcademicYear
            : _academicYear.trim(),
      ),
      'paymentMode': readText(values, const ['paymentMode'], fallback: 'Cash'),
      'referenceNo': readText(values, const ['referenceNo'], fallback: ''),
      'receiptNo': readText(values, const ['receiptNo'], fallback: ''),
      'paymentDate': readText(values, const ['paymentDate'], fallback: ''),
      'collectedBy': readText(values, const [
        'collectedBy',
      ], fallback: widget.user.name),
      'status': 'Posted',
      if (editingCollection == null) 'createdAtText': _displayDateNow(),
      if (editingCollection != null) 'updatedAtText': _displayDateNow(),
      if (editingCollection == null) 'createdBy': widget.user.uid,
    };
    if (editingCollection == null) {
      await widget.repository.createDocument('feeCollections', payload);
    } else {
      await widget.repository.updateDocument(
        'feeCollections',
        readText(editingCollection, const ['id'], fallback: ''),
        payload,
      );
    }
    await widget.repository.updateDocument(
      'feeAssignments',
      assignmentId,
      assignmentUpdates,
    );
  }

  Future<void> _showFeeAdjustmentSheet({
    required Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic>? assignment,
  }) async {
    if (!_can('fees.adjust')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You cannot approve fee adjustments.')),
      );
      return;
    }
    final students = _feeStudents(data);
    final assignments = _feeAssignments(data, students);
    final structures = _feeStructures(data);
    final collections = _feeCollections(data, assignments, students);
    final adjustments = _feeAdjustments(data, assignments, students);
    final rows = assignments
        .map((item) => _feeSnapshot(item, collections, adjustments, structures))
        .where((row) => row.due > 0)
        .toList();
    if (rows.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No payable assignment found.')),
      );
      return;
    }
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _FeeAdjustmentFormSheet(
        rows: rows,
        initialAssignmentId: readText(assignment ?? const {}, const [
          'id',
        ], fallback: ''),
        onSave: (values) => _saveFeeAdjustment(data, values),
      ),
    );
    if (!mounted || saved != true) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Fee adjustment approved'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    await _refresh();
  }

  Future<void> _saveFeeAdjustment(
    Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic> values,
  ) async {
    final students = _feeStudents(data);
    final assignments = _feeAssignments(data, students);
    final structures = _feeStructures(data);
    final collections = _feeCollections(data, assignments, students);
    final adjustments = _feeAdjustments(data, assignments, students);
    final assignmentId = readText(values, const ['assignmentId'], fallback: '');
    final assignment = _feeFindById(assignments, assignmentId);
    if (assignment == null) throw ArgumentError('Fee assignment is required.');
    final row = _feeSnapshot(assignment, collections, adjustments, structures);
    final amount = readNumber(values, const ['amount']);
    final reason = readText(values, const ['reason'], fallback: '');
    if (amount <= 0) throw ArgumentError('Adjustment amount is required.');
    if (amount > row.due) {
      throw ArgumentError('Adjustment amount cannot exceed outstanding due.');
    }
    if (reason.isEmpty) throw ArgumentError('Adjustment reason is required.');
    final nextAdjusted = row.adjusted + amount;
    final nextDue = _feeDue(row.total, row.paid, nextAdjusted);
    await widget.repository.createDocument('feeAdjustments', {
      'assignmentId': assignmentId,
      'studentRecordId': readText(assignment, const [
        'studentRecordId',
      ], fallback: ''),
      'studentId': readText(assignment, const ['studentId'], fallback: ''),
      'studentName': readText(assignment, const ['studentName'], fallback: ''),
      'amount': amount,
      'academicYear': readText(
        assignment,
        const ['academicYear'],
        fallback: _academicYear.trim().isEmpty
            ? _defaultAcademicYear
            : _academicYear.trim(),
      ),
      'reason': reason,
      'status': 'Approved',
      'createdAtText': _displayDateNow(),
      'createdBy': widget.user.uid,
    });
    await widget.repository.updateDocument('feeAssignments', assignmentId, {
      'adjustmentAmount': nextAdjusted,
      'dueAmount': nextDue,
      'status': _feeStatus(row.total, row.paid, nextAdjusted, nextDue),
      'updatedAtText': _displayDateNow(),
    });
  }

  Future<void> _assignFeeStructure(
    Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic> structure,
  ) async {
    if (!_can('fees.assign')) return;
    try {
      final count = await _createFeeAssignments(data, {
        'feeStructureId': readText(structure, const ['id'], fallback: ''),
        'assignMode': 'class',
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            count == 0
                ? 'This structure is already assigned to all matching students.'
                : 'Fee structure assigned to $count student${count == 1 ? '' : 's'}',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _sendFeeReminder(
    Map<String, List<Map<String, dynamic>>> data,
    _FeeAssignmentSnapshot row,
  ) async {
    Map<String, dynamic>? student;
    for (final candidate in _feeStudents(data)) {
      final matches =
          readText(candidate, const ['id'], fallback: '') ==
              readText(row.assignment, const [
                'studentRecordId',
              ], fallback: '') ||
          readText(candidate, const ['studentId'], fallback: '') ==
              readText(row.assignment, const ['studentId'], fallback: '');
      if (matches) {
        student = candidate;
        break;
      }
    }
    final rawPhone = readText(student ?? const {}, const [
      'parentPhone',
      'guardianPhone',
      'fatherPhone',
      'motherPhone',
      'phone',
      'mobile',
    ], fallback: '');
    final digits = rawPhone.replaceAll(RegExp(r'\D'), '');
    final phone = digits.length == 10 ? '91$digits' : digits;
    if (phone.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No parent WhatsApp number found.')),
      );
      return;
    }
    final parentName = readText(student ?? const {}, const [
      'guardianName',
      'fatherName',
      'motherName',
    ], fallback: 'Parent');
    final message = [
      'Dear $parentName,',
      'This is a fee reminder for ${readText(row.assignment, const ['studentName'], fallback: 'student')}.',
      'Outstanding due: ${formatMoney(row.due)}.',
      'Due date: ${readText(row.assignment, const ['dueDate'], fallback: 'Not specified')}.',
      'Please complete the payment at the earliest.',
    ].join('\n');
    final uri = Uri.parse(
      'https://wa.me/$phone?text=${Uri.encodeComponent(message)}',
    );
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          launched
              ? 'WhatsApp reminder opened'
              : 'Unable to open WhatsApp reminder',
        ),
      ),
    );
  }

  Widget _events(Map<String, List<Map<String, dynamic>>> data) {
    final canCreate = _can('notices.create');
    final canEdit = _can('notices.edit');
    final canArchive = _can('notices.archive');
    final canManage = canCreate || canEdit || canArchive;
    final roleScopedNotices = _items(
      data,
      'notices',
    ).where((notice) => _noticeVisibleForRole(notice, canManage)).toList();
    final taskScopedNotices = roleScopedNotices
        .where((notice) => _noticeMatchesCommunicationTask(notice))
        .toList();
    final visibleNotices = taskScopedNotices
        .where((notice) => _noticeMatchesFilters(notice, canManage))
        .toList();
    final selectedNotice = _selectedCommunicationNotice(
      taskScopedNotices,
      visibleNotices,
    );
    final summary = _noticeSummary(roleScopedNotices);
    final tasks = [
      _CommunicationTaskOption(
        id: 'notices',
        title: 'Notices & Announcements',
        helper: 'Circulars, public notices, and event announcements.',
        icon: Icons.campaign_rounded,
        count: roleScopedNotices.length,
      ),
      _CommunicationTaskOption(
        id: 'alerts',
        title: 'SMS/WhatsApp Alerts',
        helper: 'Short alerts for urgent updates and reminders.',
        icon: Icons.message_rounded,
        count: roleScopedNotices
            .where((notice) => _isAlertNotice(notice))
            .length,
      ),
      _CommunicationTaskOption(
        id: 'parents',
        title: 'Parent Communication',
        helper: 'Parent-facing messages and guardian updates.',
        icon: Icons.family_restroom_rounded,
        count: roleScopedNotices
            .where((notice) => _isParentCommunicationNotice(notice))
            .length,
      ),
    ];
    final activeTask = tasks.firstWhere(
      (task) => task.id == _communicationTask,
      orElse: () => tasks.first,
    );
    return Column(
      key: ValueKey(
        'communication-$_communicationTask-$_communicationTypeFilter-$_communicationAudienceFilter-$_communicationStatusFilter',
      ),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InfoCard(
          child: Row(
            children: [
              Container(
                height: 56,
                width: 56,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5835A).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.campaign_rounded,
                  color: Color(0xFFE5835A),
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Administration / Communication',
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Communication',
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Announcements, circular management, event communication, audience targeting, and publication status.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        _SummaryRow(
          stats: [
            _Stat(
              'Total',
              summary.total.toString(),
              Icons.campaign_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Published',
              summary.published.toString(),
              Icons.send_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Urgent',
              summary.urgent.toString(),
              Icons.priority_high_rounded,
              AppColors.danger,
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...tasks.map(
          (task) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _CommunicationTaskCard(
              task: task,
              selected: task.id == _communicationTask,
              onTap: () => setState(() {
                _communicationTask = task.id;
                _communicationSelectedNoticeId = '';
                _communicationTypeFilter = '';
                _communicationAudienceFilter = '';
                _communicationStatusFilter = '';
              }),
            ),
          ),
        ),
        if (canCreate) ...[
          const SizedBox(height: 10),
          PrimaryActionButton(
            label: _communicationTask == 'alerts'
                ? 'Create Alert'
                : _communicationTask == 'parents'
                ? 'Create Parent Message'
                : 'Create Announcement',
            icon: Icons.add_rounded,
            onPressed: () => _showCommunicationNoticeSheet(data: data),
          ),
        ],
        const SizedBox(height: 12),
        _MonthStrip(items: visibleNotices),
        SectionTitle(activeTask.title),
        _CommunicationFilterPanel(
          typeFilter: _communicationTypeFilter,
          audienceFilter: _communicationAudienceFilter,
          statusFilter: _communicationStatusFilter,
          canManage: canManage,
          isParentViewer: widget.user.roleId == 'parent' && !canManage,
          onTypeChanged: (value) =>
              setState(() => _communicationTypeFilter = value),
          onAudienceChanged: (value) =>
              setState(() => _communicationAudienceFilter = value),
          onStatusChanged: (value) =>
              setState(() => _communicationStatusFilter = value),
        ),
        const SizedBox(height: 12),
        if (visibleNotices.isEmpty)
          const EmptyState(
            title: 'No announcements found',
            message:
                'Matching notices, alerts, and parent messages will appear here.',
          )
        else
          ...visibleNotices.map(
            (notice) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _CommunicationNoticeCard(
                notice: notice,
                selected:
                    readText(notice, const ['id'], fallback: '') ==
                    _communicationSelectedNoticeId,
                showActions: canManage,
                canEdit: canEdit,
                canArchive: canArchive,
                onTap: () => setState(
                  () => _communicationSelectedNoticeId = readText(
                    notice,
                    const ['id'],
                    fallback: '',
                  ),
                ),
                onEdit: () =>
                    _showCommunicationNoticeSheet(data: data, notice: notice),
                onPublish: () => _publishCommunicationNotice(notice),
                onArchive: () => _archiveCommunicationNotice(notice),
              ),
            ),
          ),
        const SectionTitle('Preview'),
        _CommunicationPreviewCard(
          notice: selectedNotice,
          showActions: canManage,
          canPublish: canEdit,
          onPublish: selectedNotice == null
              ? null
              : () => _publishCommunicationNotice(selectedNotice),
        ),
      ],
    );
  }

  bool _noticeVisibleForRole(Map<String, dynamic> notice, bool canManage) {
    if (canManage) return true;
    if (_noticeDisplayStatus(notice) != 'Published') return false;
    final audience = readText(notice, const ['audience'], fallback: '');
    switch (widget.user.roleId) {
      case 'parent':
        return audience == 'Parents';
      case 'faculty':
        return audience == 'All' || audience == 'Faculty';
      case 'student':
        return audience == 'All' || audience == 'Students';
      default:
        return audience == 'All' || audience == 'Administration';
    }
  }

  bool _noticeMatchesCommunicationTask(Map<String, dynamic> notice) {
    if (_communicationTask == 'alerts') return _isAlertNotice(notice);
    if (_communicationTask == 'parents') {
      return _isParentCommunicationNotice(notice);
    }
    return true;
  }

  bool _isAlertNotice(Map<String, dynamic> notice) {
    return readText(notice, const ['type'], fallback: '') ==
            'SMS/WhatsApp Alert' ||
        readText(notice, const ['communicationFeature'], fallback: '') ==
            'alerts';
  }

  bool _isParentCommunicationNotice(Map<String, dynamic> notice) {
    return readText(notice, const ['audience'], fallback: '') == 'Parents' ||
        readText(notice, const ['type'], fallback: '') ==
            'Parent Communication' ||
        readText(notice, const ['communicationFeature'], fallback: '') ==
            'parents';
  }

  bool _noticeMatchesFilters(Map<String, dynamic> notice, bool canManage) {
    final typeMatches =
        _communicationTypeFilter.isEmpty ||
        readText(notice, const ['type'], fallback: '') ==
            _communicationTypeFilter;
    final audienceMatches =
        _communicationAudienceFilter.isEmpty ||
        readText(notice, const ['audience'], fallback: '') ==
            _communicationAudienceFilter;
    final statusMatches =
        !canManage ||
        _communicationStatusFilter.isEmpty ||
        _noticeDisplayStatus(notice) == _communicationStatusFilter;
    final query = _query.trim().toLowerCase();
    final textMatches =
        query.isEmpty ||
        [
          'title',
          'subject',
          'referenceNo',
          'body',
          'message',
          'description',
          'createdByName',
          'type',
          'audience',
        ].any(
          (key) => (notice[key] ?? '').toString().toLowerCase().contains(query),
        );
    return typeMatches && audienceMatches && statusMatches && textMatches;
  }

  Map<String, dynamic>? _selectedCommunicationNotice(
    List<Map<String, dynamic>> taskScopedNotices,
    List<Map<String, dynamic>> visibleNotices,
  ) {
    if (_communicationSelectedNoticeId.isNotEmpty) {
      for (final notice in taskScopedNotices) {
        if (readText(notice, const ['id'], fallback: '') ==
            _communicationSelectedNoticeId) {
          return notice;
        }
      }
    }
    if (visibleNotices.isNotEmpty) return visibleNotices.first;
    if (taskScopedNotices.isNotEmpty) return taskScopedNotices.first;
    return null;
  }

  _CommunicationNoticeSummary _noticeSummary(
    List<Map<String, dynamic>> notices,
  ) {
    return notices.fold(const _CommunicationNoticeSummary(), (summary, notice) {
      final status = _noticeDisplayStatus(notice);
      return _CommunicationNoticeSummary(
        total: summary.total + 1,
        published: summary.published + (status == 'Published' ? 1 : 0),
        drafts: summary.drafts + (status == 'Draft' ? 1 : 0),
        scheduled: summary.scheduled + (status == 'Scheduled' ? 1 : 0),
        expired: summary.expired + (status == 'Expired' ? 1 : 0),
        urgent:
            summary.urgent +
            (readText(notice, const ['priority'], fallback: '') == 'Urgent'
                ? 1
                : 0),
      );
    });
  }

  String _noticeDisplayStatus(Map<String, dynamic> notice) {
    final status = readText(notice, const ['status'], fallback: '');
    if (status == 'Archived') return 'Archived';
    if (status == 'Draft') return 'Draft';
    if (_noticeIsExpired(notice)) return 'Expired';
    if (_noticeIsPublished(notice)) return 'Published';
    return 'Scheduled';
  }

  bool _noticeIsPublished(Map<String, dynamic> notice) {
    if (readText(notice, const ['status'], fallback: '') != 'Published') {
      return false;
    }
    final date = readDate(notice['publishDate']);
    if (date == null) return true;
    final publishAt = DateTime(date.year, date.month, date.day);
    final now = DateTime.now();
    return !publishAt.isAfter(DateTime(now.year, now.month, now.day));
  }

  bool _noticeIsExpired(Map<String, dynamic> notice) {
    final date = readDate(notice['expiryDate']);
    if (date == null) return false;
    final expiresAt = DateTime(date.year, date.month, date.day, 23, 59, 59);
    return expiresAt.isBefore(DateTime.now());
  }

  String _communicationDisplayDateNow() =>
      DateFormat('dd MMM yyyy').format(DateTime.now());

  Future<void> _showCommunicationNoticeSheet({
    required Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic>? notice,
  }) async {
    final isEdit = notice != null;
    if (isEdit && !_can('notices.edit')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You cannot edit announcements.')),
      );
      return;
    }
    if (!isEdit && !_can('notices.create')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You cannot create announcements.')),
      );
      return;
    }
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _CommunicationNoticeFormSheet(
        notice: notice,
        task: _communicationTask,
        academicYear: _academicYear.trim(),
        onSave: (values) async {
          final payload = _communicationPayload(values);
          if (isEdit) {
            await widget.repository.updateDocument(
              'noticeItems',
              readText(notice, const ['id'], fallback: ''),
              {...payload, 'updatedAtText': _communicationDisplayDateNow()},
            );
          } else {
            await widget.repository.createDocument('noticeItems', {
              ...payload,
              'academicYear': _academicYear.trim(),
              'createdAtText': _communicationDisplayDateNow(),
              'createdBy': widget.user.uid,
            });
          }
        },
      ),
    );
    if (!mounted || saved != true) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(isEdit ? 'Announcement updated' : 'Announcement created'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    await _refresh();
  }

  Map<String, dynamic> _communicationPayload(Map<String, dynamic> values) {
    final type = readText(values, const ['type'], fallback: 'Digital Notice');
    final title = readText(values, const ['title'], fallback: '');
    final referenceNo = readText(values, const ['referenceNo'], fallback: '');
    return {
      ...values,
      'type': type,
      'title': title,
      'referenceNo': referenceNo.isEmpty
          ? '${type.split(' ').first.toUpperCase()}-${DateTime.now().millisecondsSinceEpoch}'
          : referenceNo,
      'body': readText(values, const ['body'], fallback: ''),
      'message': readText(values, const ['body'], fallback: ''),
      'createdByName': widget.user.name.isEmpty
          ? 'Admin Office'
          : widget.user.name,
      'communicationFeature': _communicationTask,
      'channel': _communicationTask == 'alerts'
          ? 'SMS/WhatsApp'
          : 'Notice Board',
    };
  }

  Future<void> _publishCommunicationNotice(Map<String, dynamic> notice) async {
    if (!_can('notices.edit')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You cannot publish announcements.')),
      );
      return;
    }
    if (readText(notice, const ['status'], fallback: '') != 'Draft') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Only draft announcements can be published.'),
        ),
      );
      return;
    }
    await widget.repository.updateDocument(
      'noticeItems',
      readText(notice, const ['id'], fallback: ''),
      {
        'status': 'Published',
        'publishedAtText': _communicationDisplayDateNow(),
      },
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Announcement published'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    await _refresh();
  }

  Future<void> _archiveCommunicationNotice(Map<String, dynamic> notice) async {
    if (!_can('notices.archive')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You cannot archive announcements.')),
      );
      return;
    }
    await widget.repository.updateDocument(
      'noticeItems',
      readText(notice, const ['id'], fallback: ''),
      {'status': 'Archived', 'archivedAtText': _communicationDisplayDateNow()},
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Announcement archived'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    await _refresh();
  }

  Widget _documents(Map<String, List<Map<String, dynamic>>> data) {
    final students = _documentStudents(data);
    final staff = _documentStaff(data);
    final sourceDocuments = _documentRoleScopedDocuments(
      _items(data, 'documents'),
      students,
    );
    final documents = sourceDocuments
        .map((document) => _normalizedDocument(document, students, staff))
        .where(_documentMatchesFilters)
        .toList();
    final selectedDocument = _selectedDocument(documents);
    final summary = _documentSummary(sourceDocuments);
    final canModerate =
        !widget.user.isParent && widget.user.roleId != 'faculty';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InfoCard(
          child: Row(
            children: [
              Container(
                height: 56,
                width: 56,
                decoration: BoxDecoration(
                  color: const Color(0xFF12A6A6).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.folder_rounded,
                  color: Color(0xFF12A6A6),
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Administration / Document Management',
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Document Management',
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Search documents, inspect metadata, verify records, and open uploaded files.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        _SummaryRow(
          stats: [
            _Stat(
              'Documents',
              summary.total.toString(),
              Icons.folder_rounded,
              const Color(0xFF12A6A6),
            ),
            _Stat(
              'Verified',
              summary.verified.toString(),
              Icons.verified_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Pending',
              summary.pending.toString(),
              Icons.pending_actions_rounded,
              AppColors.warning,
            ),
          ],
        ),
        if (_can('documents.upload')) ...[
          const SizedBox(height: 12),
          PrimaryActionButton(
            label: 'Upload Document',
            icon: Icons.upload_file_rounded,
            onPressed: () => _showDocumentUploadSheet(data: data),
          ),
        ],
        const SectionTitle('Filters'),
        _DocumentFilterPanel(
          ownerTypeFilter: _documentOwnerTypeFilter,
          categoryFilter: _documentCategoryFilter,
          statusFilter: _documentStatusFilter,
          hideOwnerFilter:
              widget.user.isParent || widget.user.roleId == 'faculty',
          onOwnerTypeChanged: (value) =>
              setState(() => _documentOwnerTypeFilter = value),
          onCategoryChanged: (value) =>
              setState(() => _documentCategoryFilter = value),
          onStatusChanged: (value) =>
              setState(() => _documentStatusFilter = value),
        ),
        const SectionTitle('Documents'),
        if (documents.isEmpty)
          const EmptyState(
            title: 'No documents',
            message:
                'Uploaded ERP documents matching your filters will appear here.',
          )
        else
          ...documents.map(
            (doc) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _DocumentCard(
                document: doc,
                selected:
                    readText(doc, const ['id'], fallback: '') ==
                    _documentSelectedId,
                showActions: canModerate,
                canVerify: _can('documents.verify'),
                canArchive: _can('documents.archive'),
                onTap: () => setState(
                  () => _documentSelectedId = readText(doc, const [
                    'id',
                  ], fallback: ''),
                ),
                onOpen: () => _openDocument(doc),
                onVerify: (status) => _verifyDocument(doc, status),
                onArchive: () => _archiveDocument(doc),
              ),
            ),
          ),
        const SectionTitle('Document Details'),
        _DocumentPreviewCard(
          document: selectedDocument,
          showActions: canModerate,
          canVerify: _can('documents.verify'),
          canArchive: _can('documents.archive'),
          onOpen: selectedDocument == null
              ? null
              : () => _openDocument(selectedDocument),
          onVerify: selectedDocument == null
              ? null
              : (status) => _verifyDocument(selectedDocument, status),
          onArchive: selectedDocument == null
              ? null
              : () => _archiveDocument(selectedDocument),
        ),
        const SectionTitle('Academic Records Archive'),
        _DocumentArchiveList(
          documents: sourceDocuments
              .map((document) => _normalizedDocument(document, students, staff))
              .where(
                (document) =>
                    readText(document, const ['ownerType'], fallback: '') ==
                        'Academic Archive' ||
                    readText(document, const [
                          'verificationStatus',
                        ], fallback: '') ==
                        'Archived',
              )
              .take(5)
              .toList(),
        ),
      ],
    );
  }

  List<Map<String, dynamic>> _documentStudents(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    return _items(
      data,
      'students',
    ).where((student) => !_isArchivedStudent(student)).toList();
  }

  List<Map<String, dynamic>> _documentStaff(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    return _items(data, 'staff')
        .where(
          (member) =>
              readText(member, const ['status'], fallback: '').toLowerCase() !=
              'archived',
        )
        .toList();
  }

  List<Map<String, dynamic>> _documentRoleScopedDocuments(
    List<Map<String, dynamic>> documents,
    List<Map<String, dynamic>> students,
  ) {
    if (widget.user.isParent) {
      final studentKeys = _feeStudentKeys(students);
      return documents
          .where(
            (document) =>
                readText(document, const ['ownerType'], fallback: '') ==
                    'Student' &&
                _documentMatchesOwnerKeys(document, studentKeys),
          )
          .toList();
    }
    if (widget.user.roleId == 'faculty') {
      final tokens = _documentCurrentUserTokens();
      return documents
          .where((document) => _documentMatchesCurrentStaff(document, tokens))
          .toList();
    }
    return documents;
  }

  Set<String> _documentCurrentUserTokens() {
    return {
          widget.user.uid,
          widget.user.email,
          widget.user.displayId,
          widget.user.name,
        }
        .map((value) => value.trim().toLowerCase())
        .where((value) => value.isNotEmpty)
        .toSet();
  }

  bool _documentMatchesCurrentStaff(
    Map<String, dynamic> document,
    Set<String> tokens,
  ) {
    if (tokens.isEmpty) return false;
    final uploadFields = [
      'uploadedByUid',
      'createdByUid',
      'uploadedById',
      'createdById',
      'userId',
      'staffId',
      'uploadedByEmail',
      'createdByEmail',
      'uploadedBy',
      'createdByName',
    ].map((key) => readText(document, [key], fallback: '').toLowerCase());
    if (uploadFields.any(tokens.contains)) return true;
    if (readText(document, const ['ownerType'], fallback: '') != 'Staff') {
      return false;
    }
    return ['ownerRecordId', 'ownerId', 'ownerName', 'employeeId', 'email']
        .map((key) => readText(document, [key], fallback: '').toLowerCase())
        .any(tokens.contains);
  }

  bool _documentMatchesOwnerKeys(
    Map<String, dynamic> document,
    Set<String> keys,
  ) {
    if (keys.isEmpty) return false;
    return [
      readText(document, const ['ownerRecordId'], fallback: ''),
      readText(document, const ['ownerId'], fallback: ''),
      readText(document, const ['studentRecordId'], fallback: ''),
      readText(document, const ['studentId'], fallback: ''),
    ].any(keys.contains);
  }

  Map<String, dynamic> _normalizedDocument(
    Map<String, dynamic> document,
    List<Map<String, dynamic>> students,
    List<Map<String, dynamic>> staff,
  ) {
    final ownerName = readText(document, const ['ownerName'], fallback: '');
    if (ownerName.isNotEmpty) return document;
    final ownerType = readText(document, const ['ownerType'], fallback: '');
    final ownerRecordId = readText(document, const [
      'ownerRecordId',
    ], fallback: '');
    final ownerId = readText(document, const ['ownerId'], fallback: '');
    if (ownerType == 'Student') {
      Map<String, dynamic>? student;
      for (final item in students) {
        if (readText(item, const ['id'], fallback: '') == ownerRecordId ||
            readText(item, const ['studentId'], fallback: '') == ownerId) {
          student = item;
          break;
        }
      }
      return {
        ...document,
        'ownerName': readText(
          student ?? const <String, dynamic>{},
          const ['name', 'studentName'],
          fallback: ownerId.isEmpty ? 'Student' : ownerId,
        ),
      };
    }
    if (ownerType == 'Staff') {
      Map<String, dynamic>? member;
      for (final item in staff) {
        if (readText(item, const ['id'], fallback: '') == ownerRecordId ||
            readText(item, const ['employeeId'], fallback: '') == ownerId) {
          member = item;
          break;
        }
      }
      return {
        ...document,
        'ownerName': readText(
          member ?? const <String, dynamic>{},
          const ['name'],
          fallback: ownerId.isEmpty ? 'Staff' : ownerId,
        ),
      };
    }
    return {
      ...document,
      'ownerName': readText(document, const [
        'archiveTitle',
      ], fallback: 'Other'),
    };
  }

  bool _documentMatchesFilters(Map<String, dynamic> document) {
    final ownerMatches =
        _documentOwnerTypeFilter.isEmpty ||
        readText(document, const ['ownerType'], fallback: '') ==
            _documentOwnerTypeFilter;
    final categoryMatches =
        _documentCategoryFilter.isEmpty ||
        readText(document, const ['category'], fallback: '') ==
            _documentCategoryFilter;
    final statusMatches =
        _documentStatusFilter.isEmpty ||
        _documentStatus(document) == _documentStatusFilter;
    final queryMatches = containsQuery(document, _query, const [
      'title',
      'documentType',
      'ownerName',
      'ownerId',
      'fileName',
      'archiveTitle',
      'note',
      'notes',
      'tags',
      'verificationStatus',
      'category',
    ]);
    return ownerMatches && categoryMatches && statusMatches && queryMatches;
  }

  Map<String, dynamic>? _selectedDocument(
    List<Map<String, dynamic>> documents,
  ) {
    if (_documentSelectedId.isNotEmpty) {
      for (final document in documents) {
        if (readText(document, const ['id'], fallback: '') ==
            _documentSelectedId) {
          return document;
        }
      }
    }
    if (documents.isEmpty) return null;
    return documents.first;
  }

  _DocumentSummary _documentSummary(List<Map<String, dynamic>> documents) {
    return documents.fold(const _DocumentSummary(), (summary, document) {
      final status = _documentStatus(document);
      return _DocumentSummary(
        total: summary.total + 1,
        verified: summary.verified + (status == 'Verified' ? 1 : 0),
        pending: summary.pending + (status == 'Pending Review' ? 1 : 0),
        rejected: summary.rejected + (status == 'Rejected' ? 1 : 0),
        archived: summary.archived + (status == 'Archived' ? 1 : 0),
      );
    });
  }

  String _documentStatus(Map<String, dynamic> document) {
    final status = readText(document, const [
      'verificationStatus',
      'documentStatus',
      'status',
    ], fallback: '');
    if (status.isEmpty || status == 'Uploaded') return 'Pending Review';
    return status;
  }

  String _documentDisplayDateNow() =>
      DateFormat('dd MMM yyyy').format(DateTime.now());

  Future<void> _verifyDocument(
    Map<String, dynamic> document,
    String status,
  ) async {
    if (!_can('documents.verify')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You cannot verify documents.')),
      );
      return;
    }
    await widget.repository.updateDocument(
      'managedDocuments',
      readText(document, const ['id'], fallback: ''),
      {
        'verificationStatus': status,
        'verifiedAtText': _documentDisplayDateNow(),
      },
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Document marked ${status.toLowerCase()}'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    await _refresh();
  }

  Future<void> _archiveDocument(Map<String, dynamic> document) async {
    if (!_can('documents.archive')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You cannot archive documents.')),
      );
      return;
    }
    await widget.repository.updateDocument(
      'managedDocuments',
      readText(document, const ['id'], fallback: ''),
      {
        'verificationStatus': 'Archived',
        'archivedAtText': _documentDisplayDateNow(),
      },
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Document archived'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    await _refresh();
  }

  Widget _hostel(Map<String, List<Map<String, dynamic>>> data) {
    final rooms = _items(data, 'rooms');
    final allocations = _items(data, 'allocations');
    final records = _items(data, 'records');
    final summary = _hostelSummary(rooms, allocations, records);
    final activeRows =
        (_hostelTab == 'rooms'
                ? rooms
                : _hostelTab == 'allocations'
                ? allocations
                : records)
            .where((item) => _hostelMatchesQuery(item, _query))
            .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InfoCard(
          child: Row(
            children: [
              Container(
                height: 56,
                width: 56,
                decoration: BoxDecoration(
                  color: const Color(0xFFFB9A5B).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.bed_rounded,
                  color: Color(0xFFFB8D49),
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Campus Services / Hostel Management',
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Hostel Management',
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Room allocation, hostel occupancy tracking, and hostel records management.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        _SummaryRow(
          stats: [
            _Stat(
              'Rooms',
              summary.rooms.toString(),
              Icons.home_rounded,
              const Color(0xFFFB8D49),
            ),
            _Stat(
              'Capacity',
              summary.totalCapacity.toString(),
              Icons.bed_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Occupied',
              '${summary.occupancyRate}%',
              Icons.groups_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Open',
              summary.openRecords.toString(),
              Icons.assignment_rounded,
              AppColors.warning,
            ),
          ],
        ),
        if (_can('hostel.manage')) ...[
          const SizedBox(height: 12),
          PrimaryActionButton(
            label: 'New ${_hostelTabLabel(_hostelTab, singular: true)}',
            icon: _hostelTabIcon(_hostelTab),
            onPressed: () => _showHostelEntrySheet(data),
          ),
        ],
        const SectionTitle('Hostel Desk'),
        _SegmentedFilter(
          value: _hostelTab,
          options: const {
            'rooms': 'Rooms',
            'allocations': 'Allocations',
            'records': 'Records',
          },
          onChanged: (value) => setState(() => _hostelTab = value),
        ),
        SectionTitle(_hostelTabLabel(_hostelTab)),
        if (activeRows.isEmpty)
          EmptyState(
            title: 'No ${_hostelTabLabel(_hostelTab).toLowerCase()} found',
            message:
                'Hostel ${_hostelTabLabel(_hostelTab).toLowerCase()} matching your search will appear here.',
          )
        else
          ...activeRows.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _HostelCard(
                tab: _hostelTab,
                item: item,
                onTap: () => _showHostelDetailSheet(_hostelTab, item),
              ),
            ),
          ),
      ],
    );
  }

  List<Map<String, dynamic>> _hostelActiveStudents(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    return _items(
      data,
      'students',
    ).where((student) => !_isArchivedStudent(student)).toList();
  }

  Future<void> _showHostelEntrySheet(
    Map<String, List<Map<String, dynamic>>> data,
  ) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _HostelEntrySheet(
        activeTab: _hostelTab,
        rooms: _items(data, 'rooms'),
        allocations: _items(data, 'allocations'),
        students: _hostelActiveStudents(data),
        academicYear: _academicYear,
        onSave: (values) => _saveHostelEntry(values, data),
      ),
    );
    if (!mounted) return;
    if (saved == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Hostel record created'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    }
  }

  Future<void> _saveHostelEntry(
    Map<String, dynamic> values,
    Map<String, List<Map<String, dynamic>>> data,
  ) async {
    if (!_can('hostel.manage')) {
      throw StateError('You do not have permission to manage hostel records.');
    }
    final createdAtText = DateFormat('dd MMM yyyy').format(DateTime.now());
    if (_hostelTab == 'rooms') {
      final payload = {
        'roomNo': readText(values, const ['roomNo']).trim(),
        'hostelName': readText(values, const ['hostelName']).trim(),
        'blockName': readText(values, const ['blockName']).trim(),
        'floor': readText(values, const ['floor']).trim(),
        'capacity': readNumber(values, const ['capacity'], fallback: 0),
        'occupiedCount': readNumber(values, const [
          'occupiedCount',
        ], fallback: 0),
        'status': readText(values, const ['status'], fallback: 'Available'),
        if (_academicYear.trim().isNotEmpty) 'academicYear': _academicYear,
        'wardenName': readText(values, const ['wardenName']).trim(),
        'createdAtText': createdAtText,
      };
      final message = _validateHostelRoom(payload);
      if (message.isNotEmpty) throw ArgumentError(message);
      await widget.repository.createDocument('hostelRooms', payload);
      return;
    }

    if (_hostelTab == 'allocations') {
      final roomId = readText(values, const ['roomId']);
      final studentRecordId = readText(values, const ['studentRecordId']);
      final room = _hostelFindById(_items(data, 'rooms'), roomId);
      final student = _hostelFindById(
        _hostelActiveStudents(data),
        studentRecordId,
      );
      if (room == null) throw ArgumentError('Select an available hostel room.');
      if (student == null) throw ArgumentError('Select a student to allocate.');
      final capacity = readNumber(room, const ['capacity'], fallback: 0);
      final currentOccupied = readNumber(room, const [
        'occupiedCount',
      ], fallback: 0);
      if (currentOccupied >= capacity) {
        throw ArgumentError('Selected hostel room is already full.');
      }
      final payload = {
        'studentRecordId': studentRecordId,
        'studentName': readText(student, const [
          'name',
          'studentName',
        ], fallback: ''),
        'studentId': readText(student, const [
          'studentId',
          'admissionNo',
        ], fallback: ''),
        'courseName': readText(student, const [
          'courseName',
          'program',
          'className',
        ], fallback: ''),
        'courseCode': readText(student, const ['courseCode'], fallback: ''),
        'roomNo': readText(room, const ['roomNo', 'roomNumber']),
        'hostelName': readText(room, const ['hostelName']),
        'allocatedOn': readText(values, const ['allocatedOn']),
        if (_academicYear.trim().isNotEmpty) 'academicYear': _academicYear,
        'status': readText(values, const ['status'], fallback: 'Active'),
        'guardianPhone': readText(student, const ['phone'], fallback: ''),
        'createdAtText': createdAtText,
      };
      final message = _validateHostelAllocation(payload);
      if (message.isNotEmpty) throw ArgumentError(message);
      await widget.repository.createDocument('hostelAllocations', payload);
      final occupiedCount = currentOccupied + 1;
      await widget.repository.updateDocument('hostelRooms', roomId, {
        'occupiedCount': occupiedCount,
        'status': occupiedCount >= capacity ? 'Full' : 'Available',
      });
      return;
    }

    final roomId = readText(values, const ['roomId']);
    final room = _hostelFindById(_items(data, 'rooms'), roomId);
    final payload = {
      'recordType': readText(values, const ['recordType']).trim(),
      'title': readText(values, const ['title']).trim(),
      'hostelName': readText(room ?? values, const [
        'hostelName',
      ], fallback: '').trim(),
      'roomNo': readText(room ?? values, const ['roomNo'], fallback: '').trim(),
      'recordDate': readText(values, const ['recordDate']),
      'status': readText(values, const ['status'], fallback: 'Open'),
      'notes': readText(values, const ['notes']).trim(),
      if (_academicYear.trim().isNotEmpty) 'academicYear': _academicYear,
      'createdAtText': createdAtText,
    };
    final message = _validateHostelRecord(payload);
    if (message.isNotEmpty) throw ArgumentError(message);
    await widget.repository.createDocument('hostelRecords', payload);
  }

  Map<String, dynamic>? _hostelFindById(
    List<Map<String, dynamic>> items,
    String id,
  ) {
    for (final item in items) {
      if (readText(item, const ['id'], fallback: '') == id) return item;
    }
    return null;
  }

  void _showHostelDetailSheet(String tab, Map<String, dynamic> item) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _HostelDetailSheet(tab: tab, item: item),
    );
  }

  Widget _parentPortal(Map<String, List<Map<String, dynamic>>> data) {
    final students = _items(data, 'students')
        .where(
          (item) => containsQuery(item, _query, const [
            'name',
            'studentId',
            'className',
          ]),
        )
        .toList();
    return Column(
      children: [
        _SummaryRow(
          stats: [
            _Stat(
              'Students',
              students.length.toString(),
              Icons.family_restroom_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Attendance',
              _items(data, 'attendance').length.toString(),
              Icons.fact_check_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Fees',
              _items(data, 'fees').length.toString(),
              Icons.receipt_long_rounded,
              const Color(0xFFF0A93B),
            ),
          ],
        ),
        const SectionTitle('Linked Students'),
        if (students.isEmpty)
          const EmptyState(
            title: 'No linked students',
            message:
                'Ask the ERP administrator to link students to this parent account.',
          )
        else
          ...students.map(
            (student) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _StudentCard(
                student: student,
                onTap: () => _showStudentSheet(student, data),
              ),
            ),
          ),
      ],
    );
  }

  Widget _curriculum(Map<String, List<Map<String, dynamic>>> data) {
    final allEvents = [..._items(data, 'events')]
      ..sort(
        (first, second) => _curriculumEventDateText(
          first,
        ).compareTo(_curriculumEventDateText(second)),
      );
    final events = allEvents
        .where(
          (item) => containsQuery(item, _query, const [
            'title',
            'eventName',
            'eventType',
            'audience',
            'status',
          ]),
        )
        .toList();
    final published = allEvents
        .where(
          (event) =>
              readText(event, const ['status'], fallback: '') == 'Published',
        )
        .length;
    final drafts = allEvents
        .where(
          (event) => readText(event, const ['status'], fallback: '') == 'Draft',
        )
        .length;
    final selectedEvent = _curriculumSelectedEventId.isEmpty
        ? (events.isEmpty ? null : events.first)
        : events.cast<Map<String, dynamic>?>().firstWhere(
            (event) =>
                readText(event ?? const {}, const ['id'], fallback: '') ==
                _curriculumSelectedEventId,
            orElse: () => events.isEmpty ? null : events.first,
          );

    return Column(
      key: ValueKey('curriculum-$_query-$_curriculumSelectedEventId'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InfoCard(
          child: Row(
            children: [
              Container(
                height: 56,
                width: 56,
                decoration: BoxDecoration(
                  color: const Color(0xFF6E8FC7).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.menu_book_rounded,
                  color: Color(0xFF6E8FC7),
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Academics / Curriculum',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Curriculum',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Calendar view for classes, tests, holidays, admissions, and academic events.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        _SummaryRow(
          stats: [
            _Stat(
              'Events',
              allEvents.length.toString(),
              Icons.event_available_rounded,
              const Color(0xFF6E8FC7),
            ),
            _Stat(
              'Published',
              published.toString(),
              Icons.send_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Drafts',
              drafts.toString(),
              Icons.edit_calendar_rounded,
              AppColors.warning,
            ),
          ],
        ),
        const SectionTitle('Curriculum Events'),
        if (events.isEmpty)
          EmptyState(
            title: _query.trim().isEmpty
                ? 'No curriculum events'
                : 'No matching curriculum events',
            message: _query.trim().isEmpty
                ? 'Add class, test, holiday, admission, or activity events.'
                : 'Try another search term.',
            icon: Icons.event_busy_rounded,
          )
        else
          ...events.map((event) {
            final selected =
                readText(event, const ['id'], fallback: '') ==
                readText(selectedEvent ?? const {}, const ['id'], fallback: '');
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _CurriculumEventCard(
                event: event,
                selected: selected,
                onTap: () => setState(
                  () => _curriculumSelectedEventId = readText(event, const [
                    'id',
                  ], fallback: ''),
                ),
              ),
            );
          }),
        const SectionTitle('Event Details'),
        _CurriculumEventDetails(event: selectedEvent),
      ],
    );
  }

  String _curriculumEventDateText(Map<String, dynamic> event) {
    return readText(event, const [
      'eventDate',
      'date',
      'startsOn',
    ], fallback: '');
  }

  String _curriculumCsvValue(Object? value) {
    return '"${(value ?? '').toString().replaceAll('"', '""')}"';
  }

  Future<void> _showCurriculumEventSheet({
    required Map<String, List<Map<String, dynamic>>> data,
  }) async {
    if (!_can('academics.manage')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You do not have permission to manage curriculum.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _CurriculumEventSheet(
        academicYear: _academicYear,
        onSave: (values) async {
          final title = readText(values, const ['title'], fallback: '').trim();
          final eventDate = readText(values, const [
            'eventDate',
          ], fallback: '').trim();
          if (title.isEmpty) {
            throw StateError('Event title is required.');
          }
          if (eventDate.isEmpty) {
            throw StateError('Event date is required.');
          }
          final id = await widget.repository
              .createDocument('academicCalendarEvents', {
                ...values,
                'title': title,
                'eventDate': eventDate,
                if (_academicYear.trim().isNotEmpty)
                  'academicYear': _academicYear.trim(),
                'createdBy': widget.user.uid,
                'createdAtText': _displayDateNow(),
              });
          if (mounted) {
            setState(() => _curriculumSelectedEventId = id);
          }
        },
      ),
    );
    if (saved == true) {
      await _refresh();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Curriculum event added'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _publishCurriculum(
    Map<String, List<Map<String, dynamic>>> data,
  ) async {
    if (!_can('academics.manage')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You do not have permission to publish curriculum.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final publishable = _items(data, 'events')
        .where(
          (event) =>
              readText(event, const ['status'], fallback: '') != 'Published' &&
              readText(event, const ['id'], fallback: '').isNotEmpty,
        )
        .toList();
    if (publishable.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Curriculum is already published'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final updates = {
      'status': 'Published',
      'publishedAtText': _displayDateNow(),
      'updatedBy': widget.user.uid,
    };
    for (final event in publishable) {
      await widget.repository.updateDocument(
        'academicCalendarEvents',
        readText(event, const ['id'], fallback: ''),
        updates,
      );
    }
    await _refresh();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${publishable.length} curriculum events published'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _downloadCurriculum(
    Map<String, List<Map<String, dynamic>>> data,
  ) async {
    final events = [..._items(data, 'events')]
      ..sort(
        (first, second) => _curriculumEventDateText(
          first,
        ).compareTo(_curriculumEventDateText(second)),
      );
    final rows = [
      ['Title', 'Type', 'Date', 'Audience', 'Status'],
      ...events.map(
        (event) => [
          readText(event, const ['title', 'eventName'], fallback: ''),
          readText(event, const ['eventType'], fallback: ''),
          _curriculumEventDateText(event),
          readText(event, const ['audience'], fallback: ''),
          readText(event, const ['status'], fallback: ''),
        ],
      ),
    ];
    final csv = rows
        .map((row) => row.map(_curriculumCsvValue).join(','))
        .join('\n');
    await Clipboard.setData(ClipboardData(text: csv));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          events.isEmpty
              ? 'Curriculum CSV copied with headers only'
              : 'Curriculum CSV copied for ${events.length} events',
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Widget _academics(Map<String, List<Map<String, dynamic>>> data) {
    final programs = _items(data, 'programs');
    final subjects = _items(data, 'subjects');
    final batches = _items(data, 'batches');
    final activeRows = _academicRowsForTab(data, _academicsTab)
        .where(
          (item) => containsQuery(item, _query, const [
            'name',
            'code',
            'subjectName',
            'subjectCode',
            'programName',
            'program',
            'className',
            'section',
            'classTeacher',
            'academicYear',
            'status',
          ]),
        )
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InfoCard(
          child: Row(
            children: [
              Container(
                height: 44,
                width: 44,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.account_tree_rounded,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Academics',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Programs, subjects, batches, and sections setup.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _SummaryRow(
          stats: [
            _Stat(
              'Programs',
              programs.length.toString(),
              Icons.account_tree_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Subjects',
              subjects.length.toString(),
              Icons.menu_book_rounded,
              const Color(0xFF6E8FC7),
            ),
            _Stat(
              'Batches',
              batches.length.toString(),
              Icons.groups_2_rounded,
              AppColors.danger,
            ),
          ],
        ),
        const SectionTitle('Academic Setup'),
        _SegmentedFilter(
          value: _academicsTab,
          options: const {
            'programs': 'Programs',
            'subjects': 'Subjects',
            'batches': 'Batches',
          },
          onChanged: (value) => setState(() => _academicsTab = value),
        ),
        SectionTitle(_academicsTabLabel(_academicsTab)),
        if (activeRows.isEmpty)
          EmptyState(
            title:
                'No ${_academicsTabLabel(_academicsTab).toLowerCase()} found',
            message: 'Create academic records from the action bar.',
          )
        else
          ...activeRows
              .take(30)
              .map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _ReportDataCard(
                    icon: _academicsTabIcon(_academicsTab),
                    color: _academicsTabColor(_academicsTab),
                    title: _academicRecordTitle(item, _academicsTab),
                    subtitle: _academicRecordSubtitle(item, _academicsTab),
                    meta: _academicRecordMeta(item, _academicsTab),
                    trailing: StatusPill(
                      label: readText(item, const [
                        'status',
                      ], fallback: 'Active'),
                    ),
                  ),
                ),
              ),
      ],
    );
  }

  String _academicsTabLabel(String tab, {bool singular = false}) {
    switch (tab) {
      case 'subjects':
        return singular ? 'Subject' : 'Subjects';
      case 'batches':
        return singular ? 'Batch' : 'Batches';
      case 'programs':
      default:
        return singular ? 'Program' : 'Programs';
    }
  }

  IconData _academicsTabIcon(String tab) {
    switch (tab) {
      case 'subjects':
        return Icons.menu_book_rounded;
      case 'batches':
        return Icons.groups_2_rounded;
      case 'programs':
      default:
        return Icons.account_tree_rounded;
    }
  }

  Color _academicsTabColor(String tab) {
    switch (tab) {
      case 'subjects':
        return const Color(0xFF6E8FC7);
      case 'batches':
        return AppColors.danger;
      case 'programs':
      default:
        return AppColors.primary;
    }
  }

  List<Map<String, dynamic>> _academicRowsForTab(
    Map<String, List<Map<String, dynamic>>> data,
    String tab,
  ) {
    switch (tab) {
      case 'subjects':
        return _items(data, 'subjects');
      case 'batches':
        return _items(data, 'batches');
      case 'programs':
      default:
        return _items(data, 'programs');
    }
  }

  String _academicRecordTitle(Map<String, dynamic> item, String tab) {
    switch (tab) {
      case 'subjects':
        return readText(item, const [
          'subjectName',
          'name',
          'subjectCode',
          'code',
        ]);
      case 'batches':
        final className = readText(item, const ['className'], fallback: '');
        final section = readText(item, const ['section'], fallback: '');
        final title = [
          className,
          section,
        ].where((value) => value.isNotEmpty).join(' - ');
        return title.isEmpty ? 'Academic batch' : title;
      case 'programs':
      default:
        return readText(item, const ['name', 'programName', 'code']);
    }
  }

  String _academicRecordSubtitle(Map<String, dynamic> item, String tab) {
    switch (tab) {
      case 'subjects':
        return readText(item, const [
          'subjectCode',
          'code',
        ], fallback: 'Subject code not set');
      case 'batches':
        return readText(item, const [
          'programName',
          'program',
        ], fallback: 'Program not set');
      case 'programs':
      default:
        return readText(item, const ['code'], fallback: 'Program code not set');
    }
  }

  List<String> _academicRecordMeta(Map<String, dynamic> item, String tab) {
    switch (tab) {
      case 'subjects':
        return [
          readText(item, const ['programName', 'program'], fallback: ''),
          _formatAcademicNumber(item, const ['creditHours'], 'credits'),
          readText(item, const ['academicYear'], fallback: ''),
        ];
      case 'batches':
        return [
          readText(item, const ['classTeacher'], fallback: ''),
          _formatAcademicNumber(item, const ['capacity'], 'seats'),
          readText(item, const ['academicYear'], fallback: ''),
        ];
      case 'programs':
      default:
        return [
          readText(item, const ['academicYear'], fallback: ''),
          readText(item, const ['courseName'], fallback: ''),
        ];
    }
  }

  String _formatAcademicNumber(
    Map<String, dynamic> item,
    List<String> keys,
    String suffix,
  ) {
    final value = readNumber(item, keys, fallback: -1);
    if (value < 0) return '';
    return '$value $suffix';
  }

  Future<void> _showAcademicRecordSheet() async {
    if (!_can('academics.manage')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You do not have permission to manage academics.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final label = _academicsTabLabel(_academicsTab, singular: true);
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _RecordFormSheet(
        title: 'Create $label',
        helper: 'Saved to the same live Academics data used by the web ERP.',
        fields: _academicRecordFields(_academicsTab),
        initialValues: const {'status': 'Active'},
        saveLabel: 'Save $label',
        onSave: _saveAcademicRecord,
      ),
    );

    if (!mounted) return;
    if (saved == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$label saved'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    }
  }

  List<_FieldSpec> _academicRecordFields(String tab) {
    switch (tab) {
      case 'subjects':
        return const [
          _FieldSpec('subjectName', 'Subject name', isRequired: true),
          _FieldSpec('subjectCode', 'Subject code', isRequired: true),
          _FieldSpec('programName', 'Program', isRequired: true),
          _FieldSpec('creditHours', 'Credit hours', numeric: true),
          _FieldSpec('status', 'Status'),
        ];
      case 'batches':
        return const [
          _FieldSpec('className', 'Class name', isRequired: true),
          _FieldSpec('section', 'Section', isRequired: true),
          _FieldSpec('programName', 'Program', isRequired: true),
          _FieldSpec('classTeacher', 'Class teacher'),
          _FieldSpec('capacity', 'Capacity', numeric: true),
          _FieldSpec('status', 'Status'),
        ];
      case 'programs':
      default:
        return const [
          _FieldSpec('name', 'Program name', isRequired: true),
          _FieldSpec('code', 'Program code', isRequired: true),
          _FieldSpec('status', 'Status'),
        ];
    }
  }

  Future<void> _saveAcademicRecord(Map<String, dynamic> values) async {
    final academicYear = _academicYear.trim().isEmpty
        ? _defaultAcademicYear
        : _academicYear.trim();
    final status = readText(values, const ['status'], fallback: 'Active');
    final basePayload = {
      'academicYear': academicYear,
      'status': status.isEmpty ? 'Active' : status,
      'createdAtText': _displayDateNow(),
      'createdBy': widget.user.uid,
      'courseCode': '',
      'courseName': '',
    };

    switch (_academicsTab) {
      case 'subjects':
        final subjectName = _requiredAcademicValue(values, const [
          'subjectName',
        ], 'Subject name');
        final subjectCode = _requiredAcademicValue(values, const [
          'subjectCode',
        ], 'Subject code');
        final programName = _requiredAcademicValue(values, const [
          'programName',
        ], 'Program');
        await widget.repository.createDocument('academicSubjects', {
          ...basePayload,
          'subjectName': subjectName,
          'subjectCode': subjectCode,
          'name': subjectName,
          'code': subjectCode,
          'programName': programName,
          'program': programName,
          'creditHours': values['creditHours'] ?? '',
        });
        return;
      case 'batches':
        final className = _requiredAcademicValue(values, const [
          'className',
        ], 'Class name');
        final section = _requiredAcademicValue(values, const [
          'section',
        ], 'Section');
        final programName = _requiredAcademicValue(values, const [
          'programName',
        ], 'Program');
        await widget.repository.createDocument('academicBatches', {
          ...basePayload,
          'className': className,
          'section': section,
          'programName': programName,
          'program': programName,
          'classTeacher': readText(values, const [
            'classTeacher',
          ], fallback: ''),
          'capacity': values['capacity'] ?? '',
        });
        return;
      case 'programs':
      default:
        final name = _requiredAcademicValue(values, const [
          'name',
        ], 'Program name');
        final code = _requiredAcademicValue(values, const [
          'code',
        ], 'Program code');
        await widget.repository.createDocument('academicPrograms', {
          ...basePayload,
          'name': name,
          'code': code,
        });
    }
  }

  String _requiredAcademicValue(
    Map<String, dynamic> values,
    List<String> keys,
    String label,
  ) {
    final value = readText(values, keys, fallback: '').trim();
    if (value.isEmpty) throw StateError('$label is required.');
    return value;
  }

  Widget _usersAndRoles(Map<String, List<Map<String, dynamic>>> data) {
    final roles = _userRoleModels(data);
    final selectedRole = _selectedUserRole(roles);
    final rolesById = {for (final role in roles) role.id: role};
    final allUsers = _items(data, 'users');
    final users = allUsers
        .where(
          (item) => containsQuery(item, _query, const [
            'name',
            'email',
            'roleId',
            'status',
          ]),
        )
        .toList();
    final canEditUsers = _can('users.edit');
    final canEditRoles = _can('roles.edit');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InfoCard(
          child: Row(
            children: [
              Container(
                height: 44,
                width: 44,
                decoration: BoxDecoration(
                  color: AppColors.primaryDark.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.admin_panel_settings_rounded,
                  color: AppColors.primaryDark,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'User & Role Management',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Create ERP users, assign roles, and manage module permissions.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        _SummaryRow(
          stats: [
            _Stat(
              'Users',
              allUsers.length.toString(),
              Icons.people_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Active Users',
              allUsers
                  .where(
                    (user) =>
                        readText(user, const ['status'], fallback: 'Active') !=
                        'Suspended',
                  )
                  .length
                  .toString(),
              Icons.verified_user_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Roles',
              roles.length.toString(),
              Icons.shield_rounded,
              const Color(0xFF8357C5),
            ),
          ],
        ),
        const SectionTitle('Roles'),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: roles
                .map(
                  (role) => Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      selected: selectedRole?.id == role.id,
                      avatar: Icon(
                        role.locked
                            ? Icons.lock_rounded
                            : Icons.verified_user_rounded,
                        size: 16,
                        color: selectedRole?.id == role.id
                            ? Colors.white
                            : AppColors.muted,
                      ),
                      label: Text(role.name),
                      onSelected: (_) =>
                          setState(() => _selectedUserRoleId = role.id),
                      selectedColor: AppColors.primaryDark,
                      labelStyle: TextStyle(
                        color: selectedRole?.id == role.id
                            ? Colors.white
                            : AppColors.ink,
                        fontWeight: FontWeight.w800,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                        side: BorderSide(
                          color: selectedRole?.id == role.id
                              ? AppColors.primaryDark
                              : AppColors.line,
                        ),
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        ),
        SectionTitle(
          'Users',
          trailing: Text(
            '${users.length} shown',
            style: const TextStyle(
              color: AppColors.muted,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        if (users.isEmpty)
          const EmptyState(
            title: 'No users',
            message: 'Create ERP users from the action bar.',
          )
        else
          ...users.map(
            (user) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _ReportDataCard(
                icon: Icons.person_rounded,
                color: AppColors.primaryDark,
                title: readText(user, const ['name', 'email']),
                subtitle: readText(user, const [
                  'email',
                ], fallback: readText(user, const ['uid'])),
                meta: [
                  rolesById[readText(user, const ['roleId'], fallback: '')]
                          ?.name ??
                      readText(user, const [
                        'roleId',
                      ], fallback: 'Role not set'),
                  readText(user, const ['status'], fallback: 'Active'),
                  if (readText(user, const [
                    'linkedStudentIds',
                  ], fallback: '').isNotEmpty)
                    'Linked parent',
                ],
                trailing: IconButton(
                  tooltip: 'Edit user',
                  onPressed: canEditUsers
                      ? () => _showUserRoleUserSheet(data: data, user: user)
                      : null,
                  icon: const Icon(Icons.edit_rounded),
                ),
              ),
            ),
          ),
        if (selectedRole != null)
          _rolePermissionEditor(role: selectedRole, canEdit: canEditRoles),
      ],
    );
  }

  List<ErpRole> _userRoleModels(Map<String, List<Map<String, dynamic>>> data) {
    final byId = <String, ErpRole>{
      for (final role in defaultRoles) role.id: role,
    };
    for (final role in widget.roles) {
      byId[role.id] = _mergeRoleWithFallback(role, byId[role.id]);
    }
    for (final item in _items(data, 'roles')) {
      final id = readText(item, const ['id'], fallback: '');
      if (id.isEmpty) continue;
      final role = ErpRole.fromMap(id, item);
      byId[role.id] = _mergeRoleWithFallback(role, byId[role.id]);
    }
    return byId.values.toList();
  }

  ErpRole _mergeRoleWithFallback(ErpRole role, ErpRole? fallback) {
    return ErpRole(
      id: role.id,
      name: role.name.isEmpty ? fallback?.name ?? role.id : role.name,
      description: role.description.isEmpty
          ? fallback?.description ?? ''
          : role.description,
      permissions: role.permissions.isEmpty
          ? fallback?.permissions ?? const []
          : role.permissions,
      locked: role.locked || (fallback?.locked ?? false),
    );
  }

  ErpRole? _selectedUserRole(List<ErpRole> roles) {
    if (roles.isEmpty) return null;
    for (final role in roles) {
      if (role.id == _selectedUserRoleId) return role;
    }
    return roles.first;
  }

  List<Map<String, dynamic>> _activeStudentsForUserRoles(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    return _items(data, 'students')
        .where(
          (student) =>
              readText(student, const ['status'], fallback: 'Active') !=
              'Archived',
        )
        .toList();
  }

  Future<void> _syncDefaultRoles(
    Map<String, List<Map<String, dynamic>>> data,
  ) async {
    if (!_can('roles.edit')) {
      _showUserRoleSnack('You do not have permission to edit roles.');
      return;
    }
    final liveRoleIds = _items(data, 'roles')
        .map((role) => readText(role, const ['id'], fallback: ''))
        .where((id) => id.isNotEmpty)
        .toSet();
    final missingRoles = defaultRoles
        .where((role) => !liveRoleIds.contains(role.id))
        .toList();
    try {
      for (final role in missingRoles) {
        await widget.repository.setDocument(
          'roles',
          role.id,
          _rolePayload(role),
          includeCreatedAt: true,
        );
      }
      if (!mounted) return;
      _showUserRoleSnack(
        missingRoles.isEmpty
            ? 'Default roles already available'
            : 'Default roles synced',
      );
      await _refresh();
    } catch (error) {
      if (!mounted) return;
      _showUserRoleSnack('Default roles were not synced to live data.');
    }
  }

  Future<void> _showUserRoleUserSheet({
    required Map<String, List<Map<String, dynamic>>> data,
    Map<String, dynamic>? user,
  }) async {
    final editing = user != null;
    if (editing && !_can('users.edit')) {
      _showUserRoleSnack('You do not have permission to edit users.');
      return;
    }
    if (!editing && !_can('users.create')) {
      _showUserRoleSnack('You do not have permission to create users.');
      return;
    }
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _UserRoleUserSheet(
        initialUser: user,
        roles: _userRoleModels(data),
        students: _activeStudentsForUserRoles(data),
        onSave: (values) => editing
            ? _updateManagedUser(user, values)
            : _createManagedUser(values),
      ),
    );
    if (!mounted) return;
    if (saved == true) {
      _showUserRoleSnack(editing ? 'User updated' : 'User created');
      await _refresh();
    }
  }

  Future<void> _createManagedUser(Map<String, dynamic> values) async {
    final name = _requiredUserValue(values, const ['name'], 'Name');
    final email = _requiredUserValue(values, const ['email'], 'Email');
    final password = _requiredUserValue(values, const ['password'], 'Password');
    final roleId = _requiredUserValue(values, const ['roleId'], 'Role');
    if (!_emailPattern.hasMatch(email)) {
      throw StateError('Valid email is required.');
    }
    if (password.length < 12) {
      throw StateError('Password must be at least 12 characters.');
    }
    final authUser = await widget.authRepository.createManagedAuthUser(
      name: name,
      email: email,
      password: password,
    );
    await widget.repository.setDocument(
      'users',
      authUser.uid,
      {
        'uid': authUser.uid,
        'name': name,
        'email': authUser.email,
        'roleId': roleId,
        'status': 'Active',
        'createdBy': widget.user.uid,
        'createdAtText': _displayDateNow(),
        ..._linkedStudentPayload(values),
      },
      merge: false,
      includeCreatedAt: true,
    );
  }

  Future<void> _updateManagedUser(
    Map<String, dynamic> user,
    Map<String, dynamic> values,
  ) async {
    final uid = readText(user, const ['uid', 'id'], fallback: '');
    if (uid.isEmpty) throw StateError('A live user id is required.');
    final name = _requiredUserValue(values, const ['name'], 'Name');
    final roleId = _requiredUserValue(values, const ['roleId'], 'Role');
    final status = _requiredUserValue(values, const ['status'], 'Status');
    await widget.repository.updateDocument('users', uid, {
      'name': name,
      'roleId': roleId,
      'status': status,
      'updatedAtText': _displayDateNow(),
      ..._linkedStudentPayload(values),
    });
  }

  Map<String, dynamic> _linkedStudentPayload(Map<String, dynamic> values) {
    if (readText(values, const ['roleId'], fallback: '') != 'parent') {
      return {
        'linkedStudentRecordIds': <String>[],
        'linkedStudentIds': <String>[],
      };
    }
    final recordIds = _stringListValue(values['linkedStudentRecordIds']);
    final studentIds = _stringListValue(values['linkedStudentIds']);
    return {
      'linkedStudentRecordIds': recordIds,
      'linkedStudentIds': studentIds,
    };
  }

  List<String> _stringListValue(Object? value) {
    if (value is Iterable) {
      return value
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList();
    }
    return const [];
  }

  Widget _rolePermissionEditor({required ErpRole role, required bool canEdit}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionTitle(
          'Permissions',
          trailing: Text(
            '${role.permissions.length} enabled',
            style: const TextStyle(
              color: AppColors.muted,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        InfoCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    height: 42,
                    width: 42,
                    decoration: BoxDecoration(
                      color: AppColors.primaryDark.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      role.locked ? Icons.lock_rounded : Icons.shield_rounded,
                      color: AppColors.primaryDark,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          role.name,
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          role.description,
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 12,
                          ),
                        ),
                        if (role.locked || !canEdit) ...[
                          const SizedBox(height: 6),
                          Text(
                            role.locked
                                ? 'Locked role permissions cannot be edited.'
                                : 'You can view permissions but cannot edit this role.',
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              ...permissionGroups.entries.map(
                (group) => Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        _permissionGroupLabel(group.key),
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 6),
                      ...group.value.map(
                        (permission) => Container(
                          margin: const EdgeInsets.only(bottom: 6),
                          decoration: BoxDecoration(
                            color: AppColors.page,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: CheckboxListTile(
                            value: role.permissions.contains(permission),
                            onChanged: role.locked || !canEdit
                                ? null
                                : (_) =>
                                      _toggleRolePermission(role, permission),
                            dense: true,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 10,
                            ),
                            title: Text(
                              _permissionLabel(permission),
                              style: const TextStyle(fontSize: 13),
                            ),
                            controlAffinity: ListTileControlAffinity.trailing,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _toggleRolePermission(ErpRole role, String permission) async {
    if (!_can('roles.edit')) {
      _showUserRoleSnack('You do not have permission to edit roles.');
      return;
    }
    if (role.locked) return;
    final permissions = role.permissions.toSet();
    if (permissions.contains(permission)) {
      permissions.remove(permission);
    } else {
      permissions.add(permission);
    }
    final nextRole = ErpRole(
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: (permissions.toList()..sort()),
      locked: role.locked,
    );
    try {
      await widget.repository.setDocument(
        'roles',
        role.id,
        _rolePayload(nextRole),
      );
      if (!mounted) return;
      _showUserRoleSnack('Role permissions updated');
      await _refresh();
    } catch (_) {
      if (!mounted) return;
      _showUserRoleSnack('Role permissions were not saved to live data.');
    }
  }

  Map<String, dynamic> _rolePayload(ErpRole role) {
    return {
      'id': role.id,
      'name': role.name,
      'description': role.description,
      'locked': role.locked,
      'permissions': role.permissions,
    };
  }

  String _requiredUserValue(
    Map<String, dynamic> values,
    List<String> keys,
    String label,
  ) {
    final value = readText(values, keys, fallback: '').trim();
    if (value.isEmpty) throw StateError('$label is required.');
    return value;
  }

  String _permissionGroupLabel(String id) {
    return _permissionGroupLabels[id] ?? id;
  }

  String _permissionLabel(String id) {
    return _permissionLabels[id] ?? id;
  }

  void _showUserRoleSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  Widget _settings(Map<String, List<Map<String, dynamic>>> data) {
    final settings = _items(data, 'settings');
    final institute = settings.firstWhere(
      (item) => readText(item, const ['id'], fallback: '') == 'institute',
      orElse: () => _items(data, 'colleges').isNotEmpty
          ? _items(data, 'colleges').first
          : const <String, dynamic>{},
    );
    return Column(
      children: [
        const SectionTitle('Institute'),
        InfoCard(
          child: Column(
            children: [
              LabelValue(
                label: 'Name',
                value: readText(institute, const ['name'], fallback: 'College'),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: LabelValue(
                      label: 'Code',
                      value: readText(institute, const ['instituteId', 'code']),
                    ),
                  ),
                  Expanded(
                    child: LabelValue(
                      label: 'City',
                      value: readText(institute, const ['city', 'location']),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              LabelValue(
                label: 'Address',
                value: readText(institute, const ['address', 'location']),
              ),
            ],
          ),
        ),
        const SectionTitle('Settings Records'),
        ...settings.map(
          (setting) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _CompactRow(
              title: readText(setting, const ['id', 'name']),
              subtitle: readText(setting, const [
                'updatedAtText',
                'status',
              ], fallback: 'System setting'),
              trailing: const Icon(
                Icons.tune_rounded,
                color: AppColors.primary,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _dashboard(Map<String, List<Map<String, dynamic>>> data) {
    final students = _items(data, 'students');
    final admissions = _items(data, 'admissions');
    final staff = _items(data, 'staff');
    final documents = _items(data, 'documents')
        .where(
          (item) =>
              readText(item, const [
                'verificationStatus',
                'status',
              ], fallback: '').toLowerCase() !=
              'archived',
        )
        .toList();
    final activeStudents = students
        .where((student) => !_isArchivedStudent(student))
        .toList();
    final facultyCount = staff
        .where(
          (member) =>
              !_isArchivedStaff(member) &&
              readText(member, const [
                    'staffType',
                  ], fallback: '').toLowerCase() ==
                  'faculty',
        )
        .length;
    final feeStudents = _feeStudents(data);
    final feeStructures = _feeStructures(data);
    final feeAssignments = _feeAssignments(data, feeStudents);
    final feeCollections = _feeCollections(data, feeAssignments, feeStudents);
    final feeAdjustments = _feeAdjustments(data, feeAssignments, feeStudents);
    final feeRows = feeAssignments
        .map(
          (assignment) => _feeSnapshot(
            assignment,
            feeCollections,
            feeAdjustments,
            feeStructures,
          ),
        )
        .toList();
    final payableRows = feeRows.where((row) => row.due > 0).toList();
    final totalAssigned = feeRows.fold<num>(
      0,
      (total, row) => total + row.total,
    );
    final totalCollected = feeRows.fold<num>(
      0,
      (total, row) => total + row.paid,
    );
    final totalAdjusted = feeRows.fold<num>(
      0,
      (total, row) => total + row.adjusted,
    );
    final totalOutstanding = feeRows.fold<num>(
      0,
      (total, row) => total + row.due,
    );
    final collectionRate = totalAssigned <= 0
        ? 0
        : ((totalCollected / totalAssigned) * 100).clamp(0, 100).round();
    final pendingDocuments = documents
        .where(
          (item) =>
              readText(item, const [
                'verificationStatus',
                'status',
              ], fallback: '') ==
              'Pending Review',
        )
        .toList();
    final verifiedDocuments = documents.where((item) {
      final status = readText(item, const [
        'verificationStatus',
        'status',
      ], fallback: '');
      return status == 'Verified' || status == 'Source PDF';
    }).length;
    final documentReadiness = documents.isEmpty
        ? 0
        : ((verifiedDocuments / documents.length) * 100).round();
    final upcomingExams = [..._items(data, 'exams')]
      ..removeWhere(
        (item) =>
            readText(item, const ['status'], fallback: '').toLowerCase() ==
            'archived',
      )
      ..sort(
        (first, second) => readText(
          first,
          const ['examDate', 'date'],
          fallback: '',
        ).compareTo(readText(second, const ['examDate', 'date'], fallback: '')),
      );
    final collectionTrend = _dashboardCollectionTrend(feeCollections);
    final courseStrength = _dashboardCourseStrength(activeStudents);
    final query = _query.trim().toLowerCase();
    final visibleExams = upcomingExams
        .where(
          (exam) =>
              query.isEmpty ||
              containsQuery(exam, query, const [
                'examName',
                'name',
                'subject',
                'classKey',
                'className',
                'program',
                'status',
              ]),
        )
        .take(6)
        .toList();
    final applicationSource = admissions.isEmpty ? students : admissions;
    final reviewStatuses = RegExp(
      'review|pending|submitted|draft',
      caseSensitive: false,
    );
    final admittedStatuses = RegExp(
      'active|approved|admitted',
      caseSensitive: false,
    );
    final admissionStages = [
      _DashboardValueShare(
        label: 'Applications',
        value: applicationSource.length,
        color: AppColors.festival,
      ),
      _DashboardValueShare(
        label: 'In Review',
        value: applicationSource
            .where(
              (item) => reviewStatuses.hasMatch(
                readText(item, const ['status'], fallback: ''),
              ),
            )
            .length,
        color: AppColors.warning,
      ),
      _DashboardValueShare(
        label: 'Admitted',
        value: activeStudents
            .where(
              (student) => admittedStatuses.hasMatch(
                readText(student, const ['status'], fallback: ''),
              ),
            )
            .length,
        color: AppColors.accent,
      ),
      _DashboardValueShare(
        label: 'Archived',
        value: students.where(_isArchivedStudent).length,
        color: const Color(0xFF8357C5),
      ),
    ];
    final paymentSplit = [
      _DashboardValueShare(
        label: 'Collected',
        value: totalCollected,
        color: AppColors.accent,
      ),
      _DashboardValueShare(
        label: 'Pending',
        value: totalOutstanding,
        color: AppColors.warning,
      ),
      _DashboardValueShare(
        label: 'Adjusted',
        value: totalAdjusted,
        color: AppColors.danger,
      ),
    ];
    final splitTotal = paymentSplit.fold<num>(
      0,
      (total, item) => total + item.value,
    );
    final hasCards =
        _can('students.view') ||
        _can('staff.view') ||
        _can('fees.view') ||
        _can('documents.view') ||
        _can('exams.view');

    return Column(
      key: ValueKey('dashboard-$_query'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InfoCard(
          child: Row(
            children: [
              Container(
                height: 56,
                width: 56,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.dashboard_rounded,
                  color: AppColors.primary,
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Dashboard',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _academicYear.trim().isEmpty
                          ? 'Today college overview'
                          : 'Today college overview for $_academicYear',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (hasCards) ...[
          const SectionTitle('Overview'),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.42,
            children: [
              if (_can('students.view'))
                _DashboardMetricCard(
                  label: 'Students',
                  value: activeStudents.length.toString(),
                  helper: 'Active records',
                  icon: Icons.groups_rounded,
                  color: AppColors.festival,
                  onTap: () => _openModuleById('students'),
                ),
              if (_can('staff.view'))
                _DashboardMetricCard(
                  label: 'Faculty',
                  value: facultyCount.toString(),
                  helper: 'Teaching staff',
                  icon: Icons.school_rounded,
                  color: AppColors.accent,
                  onTap: () => _openModuleById('faculty-staff'),
                ),
              if (_can('fees.view'))
                _DashboardMetricCard(
                  label: 'Collection',
                  value: formatMoney(totalCollected),
                  helper: '${payableRows.length} due students',
                  icon: Icons.account_balance_wallet_rounded,
                  color: AppColors.warning,
                  onTap: () => _openModuleById('fees'),
                ),
              if (_can('documents.view'))
                _DashboardMetricCard(
                  label: 'Documents',
                  value: pendingDocuments.length.toString(),
                  helper: 'Pending review',
                  icon: Icons.folder_copy_rounded,
                  color: const Color(0xFF8B5CF6),
                  onTap: () => _openModuleById('document-management'),
                ),
              if (_can('exams.view'))
                _DashboardMetricCard(
                  label: 'Exams',
                  value: upcomingExams.length.toString(),
                  helper: 'Upcoming exams',
                  icon: Icons.trending_up_rounded,
                  color: AppColors.danger,
                  onTap: () => _openModuleById('examination-results'),
                ),
            ],
          ),
        ],
        if (_can('financialReports.view')) ...[
          const SectionTitle('Payment Trend'),
          InfoCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Smooth monthly collection movement.',
                        style: TextStyle(color: AppColors.muted, fontSize: 12),
                      ),
                    ),
                    StatusPill(
                      label: _academicYear.trim().isEmpty
                          ? 'All Years'
                          : _academicYear,
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                _DashboardTrendChart(months: collectionTrend),
              ],
            ),
          ),
        ],
        const SectionTitle('Pending Work'),
        if (_can('documents.view') &&
            _can('documents.verify') &&
            pendingDocuments.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _DashboardWorkCard(
              title: '${pendingDocuments.length} documents need review',
              helper: 'Open verification queue',
              icon: Icons.fact_check_rounded,
              color: const Color(0xFF8B5CF6),
              onTap: () => _openModuleById('document-management'),
            ),
          ),
        if (_can('exams.view') && upcomingExams.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _DashboardWorkCard(
              title: '${upcomingExams.length} upcoming exams',
              helper: 'View exam schedule',
              icon: Icons.assignment_turned_in_rounded,
              color: AppColors.danger,
              onTap: () => _openModuleById('examination-results'),
            ),
          ),
        if (_can('fees.view') && payableRows.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _DashboardWorkCard(
              title: '${payableRows.length} students have pending dues',
              helper: 'Open payment due list',
              icon: Icons.receipt_long_rounded,
              color: AppColors.warning,
              onTap: () => _openModuleById(
                'fees',
                initialState: const {
                  'feeTask': 'due-tracking',
                  'feeBranch': 'due-list',
                },
              ),
            ),
          ),
        if (!((_can('documents.view') &&
                _can('documents.verify') &&
                pendingDocuments.isNotEmpty) ||
            (_can('exams.view') && upcomingExams.isNotEmpty) ||
            (_can('fees.view') && payableRows.isNotEmpty)))
          const InfoCard(
            child: Text(
              'No pending items available for your role.',
              style: TextStyle(color: AppColors.muted, fontSize: 13),
            ),
          ),
        if (_can('students.view')) ...[
          const SectionTitle('Admissions'),
          InfoCard(
            child: Column(
              children: admissionStages
                  .map(
                    (stage) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _DashboardProgressRow(
                        label: stage.label,
                        value: stage.value.toString(),
                        percent: applicationSource.isEmpty
                            ? 0
                            : stage.value / applicationSource.length,
                        color: stage.color,
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          const SectionTitle('Course Strength'),
          InfoCard(
            child: courseStrength.isEmpty
                ? const EmptyState(
                    title: 'No active student distribution',
                    message: 'Active student distribution will appear here.',
                    icon: Icons.school_rounded,
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${activeStudents.length} active students',
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 12,
                              ),
                            ),
                          ),
                          StatusPill(
                            label: '$documentReadiness% docs ready',
                            color: documentReadiness >= 75
                                ? AppColors.accent
                                : AppColors.warning,
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      ...courseStrength.map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _DashboardProgressRow(
                            label: item.key,
                            value: item.value.toString(),
                            percent: activeStudents.isEmpty
                                ? 0
                                : item.value / activeStudents.length,
                            color: AppColors.festival,
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
        ],
        if (_can('fees.view')) ...[
          const SectionTitle('Fee Collection'),
          InfoCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: LabelValue(
                        label: 'Collection Rate',
                        value: '$collectionRate%',
                      ),
                    ),
                    Expanded(
                      child: LabelValue(
                        label: 'Assigned',
                        value: formatMoney(totalAssigned),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                ...paymentSplit.map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _DashboardProgressRow(
                      label: item.label,
                      value: formatMoney(item.value),
                      percent: splitTotal <= 0 ? 0 : item.value / splitTotal,
                      color: item.color,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
        if (_can('exams.view')) ...[
          const SectionTitle('Upcoming Exams'),
          if (visibleExams.isEmpty)
            EmptyState(
              title: query.isEmpty ? 'No upcoming exams' : 'No matching exams',
              message: query.isEmpty
                  ? 'Exam schedules will appear here when available.'
                  : 'Try a different dashboard search.',
              icon: Icons.assignment_turned_in_rounded,
            )
          else
            ...visibleExams.map(
              (exam) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: InfoCard(
                  onTap: () => _openModuleById('examination-results'),
                  child: Row(
                    children: [
                      Container(
                        height: 42,
                        width: 42,
                        decoration: BoxDecoration(
                          color: AppColors.danger.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.trending_up_rounded,
                          color: AppColors.danger,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              readText(exam, const ['examName', 'name']),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${readText(exam, const ['classKey', 'className', 'program'], fallback: 'Class')} - ${readText(exam, const ['subject'], fallback: 'Subject')}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      StatusPill(
                        label: formatDateValue(
                          exam['examDate'] ?? exam['date'],
                        ),
                        color: AppColors.primary,
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ],
    );
  }

  List<_DashboardTrendMonth> _dashboardCollectionTrend(
    List<Map<String, dynamic>> collections,
  ) {
    final datedCollections = collections
        .map(
          (item) => MapEntry(
            _dashboardDate(
              item['paymentDate'] ?? item['createdAtText'] ?? item['createdAt'],
            ),
            _feeCollectionAmount(item),
          ),
        )
        .where((entry) => entry.key != null)
        .toList();
    final referenceDate =
        datedCollections.fold<DateTime?>(
          null,
          (latest, entry) =>
              latest == null || entry.key!.isAfter(latest) ? entry.key : latest,
        ) ??
        DateTime.now();
    final months = <_DashboardTrendMonth>[];
    for (var offset = 5; offset >= 0; offset -= 1) {
      final date = DateTime(referenceDate.year, referenceDate.month - offset);
      months.add(
        _DashboardTrendMonth(
          key: '${date.year}-${date.month}',
          label: DateFormat('MMM').format(date),
          value: 0,
          year: date.year,
          month: date.month,
        ),
      );
    }
    for (final entry in datedCollections) {
      final date = entry.key!;
      final index = months.indexWhere(
        (month) => month.year == date.year && month.month == date.month,
      );
      if (index < 0) continue;
      months[index] = months[index].copyWith(
        value: months[index].value + entry.value,
      );
    }
    return months;
  }

  DateTime? _dashboardDate(Object? value) {
    final parsed = readDate(value);
    if (parsed != null) return parsed;
    final text = value?.toString().trim() ?? '';
    if (text.isEmpty) return null;
    for (final pattern in const ['d MMM yyyy', 'dd MMM yyyy', 'MMM d, yyyy']) {
      try {
        return DateFormat(pattern).parseStrict(text);
      } catch (_) {
        // Try the next dashboard date pattern.
      }
    }
    return null;
  }

  List<MapEntry<String, int>> _dashboardCourseStrength(
    List<Map<String, dynamic>> students,
  ) {
    final grouped = <String, int>{};
    for (final student in students) {
      final label = readText(student, const [
        'courseName',
        'program',
        'courseCode',
        'className',
      ], fallback: 'Unassigned');
      grouped[label] = (grouped[label] ?? 0) + 1;
    }
    final items = grouped.entries.toList()
      ..sort((first, second) => second.value.compareTo(first.value));
    return items.take(5).toList();
  }

  Widget _reports(Map<String, List<Map<String, dynamic>>> data) {
    final categories = _reportCategories();
    if (categories.isEmpty) {
      return const EmptyState(
        title: 'Reports unavailable',
        message: 'You do not have permission to view reports.',
        icon: Icons.bar_chart_rounded,
      );
    }
    final activeCategory = categories.any((item) => item.id == _reportCategory)
        ? _reportCategory
        : categories.first.id;

    return Column(
      key: ValueKey(
        'reports-$activeCategory-$_attendanceReportScope-$_financialReportTab-$_query',
      ),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InfoCard(
          child: Row(
            children: [
              Container(
                height: 56,
                width: 56,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.bar_chart_rounded,
                  color: AppColors.primary,
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ERP / Reports',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Reports',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Category-wise reports for the modules available to your role.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SectionTitle('Report Categories'),
        ...categories.map(
          (category) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _ReportCategoryCard(
              option: category,
              selected: category.id == activeCategory,
              onTap: () => setState(() => _reportCategory = category.id),
            ),
          ),
        ),
        SectionTitle(
          categories.firstWhere((item) => item.id == activeCategory).label,
        ),
        if (activeCategory == 'students')
          _studentReportsPanel(data)
        else if (activeCategory == 'attendance')
          _attendanceReportsPanel(data)
        else if (activeCategory == 'documents')
          _documentReportsPanel(data)
        else if (activeCategory == 'exams')
          _examReportsPanel(data)
        else
          _financialReportsPanel(data),
      ],
    );
  }

  List<_ReportCategoryOption> _reportCategories() {
    return [
      if (_can('students.view'))
        const _ReportCategoryOption(
          id: 'students',
          label: 'Student Reports',
          description: 'Admissions and approval queue',
          icon: Icons.school_rounded,
          color: AppColors.accent,
        ),
      if (_can('attendance.reports'))
        const _ReportCategoryOption(
          id: 'attendance',
          label: 'Attendance Reports',
          description: 'Daily, monthly, yearly',
          icon: Icons.fact_check_rounded,
          color: AppColors.primary,
        ),
      if (_can('documents.view') || _can('students.documents'))
        const _ReportCategoryOption(
          id: 'documents',
          label: 'Document Reports',
          description: 'Verification reports',
          icon: Icons.folder_copy_rounded,
          color: Color(0xFF12A6A6),
        ),
      if (_can('exams.view') || _can('exams.results'))
        const _ReportCategoryOption(
          id: 'exams',
          label: 'Exam Reports',
          description: 'Marks and results',
          icon: Icons.assignment_turned_in_rounded,
          color: Color(0xFF8357C5),
        ),
      if (_can('financialReports.view'))
        const _ReportCategoryOption(
          id: 'financial',
          label: 'Financial Reports',
          description: 'Collections and dues',
          icon: Icons.account_balance_wallet_rounded,
          color: AppColors.warning,
        ),
    ];
  }

  bool _canExportReportCategory(String category) {
    if (category == 'financial') return _can('financialReports.export');
    return _reportCategories().any((item) => item.id == category);
  }

  Widget _studentReportsPanel(Map<String, List<Map<String, dynamic>>> data) {
    final students = _items(data, 'students')
        .where(
          (student) => containsQuery(student, _query, const [
            'name',
            'studentId',
            'admissionNo',
            'className',
            'section',
            'program',
            'guardianName',
            'status',
          ]),
        )
        .toList();
    final allStudents = _items(data, 'students');
    final documents = _reportDocuments(data);
    final activeStudents = allStudents.where(
      (item) => !_isArchivedStudent(item),
    );
    final archivedStudents = allStudents.where(_isArchivedStudent);
    final pendingStudents = allStudents.where((student) {
      final status = readText(student, const ['status'], fallback: '');
      return status == 'Pending Approval' || status == 'Admission Review';
    });
    final approvedStudents = allStudents.where((student) {
      final status = readText(student, const ['status'], fallback: '');
      return status == 'Active' || status == 'Approved' || status == 'Admitted';
    });
    final classBreakdown = _countBy(allStudents, (student) {
      final className = readText(student, const [
        'className',
        'standard',
      ], fallback: 'Unassigned');
      final section = readText(student, const ['section'], fallback: '-');
      return '$className - $section';
    });
    final pendingDocuments = documents.where(
      (item) =>
          readText(item, const [
            'verificationStatus',
            'status',
          ], fallback: '') ==
          'Pending Review',
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SummaryRow(
          stats: [
            _Stat(
              'Students',
              allStudents.length.toString(),
              Icons.school_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Active',
              activeStudents.length.toString(),
              Icons.verified_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Pending',
              pendingStudents.length.toString(),
              Icons.pending_actions_rounded,
              AppColors.warning,
            ),
          ],
        ),
        const SectionTitle('Report Categories'),
        _ReportBreakdownCard(
          rows: [
            MapEntry('Approved', approvedStudents.length),
            MapEntry('Archived', archivedStudents.length),
            MapEntry('Admissions', _items(data, 'admissions').length),
            MapEntry('Documents', documents.length),
            MapEntry('Pending Documents', pendingDocuments.length),
            MapEntry('Promotions', _items(data, 'promotions').length),
            MapEntry('Classes', classBreakdown.length),
          ],
        ),
        const SectionTitle('Students'),
        if (students.isEmpty)
          EmptyState(
            title: _query.trim().isEmpty
                ? 'No students'
                : 'No matching students',
            message: _query.trim().isEmpty
                ? 'Student report rows will appear here.'
                : 'Try another search term.',
            icon: Icons.school_rounded,
          )
        else
          ...students
              .take(40)
              .map(
                (student) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _ReportDataCard(
                    icon: Icons.school_rounded,
                    color: AppColors.accent,
                    title: readText(student, const ['name']),
                    subtitle:
                        '${readText(student, const ['admissionNo'], fallback: '-')} / ${readText(student, const ['studentId'], fallback: '-')}',
                    meta: [
                      '${readText(student, const ['className', 'standard'], fallback: 'Class')} - ${readText(student, const ['section'], fallback: '-')}',
                      readText(student, const ['program'], fallback: 'Program'),
                    ],
                    trailing: StatusPill(
                      label: readText(student, const [
                        'status',
                      ], fallback: 'Active'),
                    ),
                  ),
                ),
              ),
      ],
    );
  }

  Widget _attendanceReportsPanel(Map<String, List<Map<String, dynamic>>> data) {
    final records =
        [
          ..._items(data, 'attendance'),
          ..._items(data, 'staffAttendance'),
        ].where((record) {
          return containsQuery(record, _query, const [
            'entityName',
            'studentName',
            'staffName',
            'name',
            'subjectName',
            'subject',
            'status',
            'dateText',
          ]);
        }).toList();
    final grouped = _attendanceReportRows(records);
    final present = records
        .where((record) => _attendanceStatus(record) == 'Present')
        .length;
    final absent = records
        .where((record) => _attendanceStatus(record) == 'Absent')
        .length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SegmentedFilter(
          value: _attendanceReportScope,
          options: const {
            'daily': 'Daily',
            'monthly': 'Monthly',
            'yearly': 'Yearly',
          },
          onChanged: (value) => setState(() => _attendanceReportScope = value),
        ),
        _SummaryRow(
          stats: [
            _Stat(
              'Records',
              records.length.toString(),
              Icons.fact_check_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Present',
              present.toString(),
              Icons.check_circle_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Absent',
              absent.toString(),
              Icons.cancel_rounded,
              AppColors.danger,
            ),
          ],
        ),
        const SectionTitle('Attendance Summary'),
        if (grouped.isEmpty)
          EmptyState(
            title: _query.trim().isEmpty
                ? 'No attendance reports'
                : 'No matching attendance reports',
            message: 'Attendance summaries will appear when records exist.',
            icon: Icons.fact_check_rounded,
          )
        else
          ...grouped.map(
            (row) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InfoCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      row.label,
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: LabelValue(
                            label: 'Present',
                            value: row.present.toString(),
                          ),
                        ),
                        Expanded(
                          child: LabelValue(
                            label: 'Absent',
                            value: row.absent.toString(),
                          ),
                        ),
                        Expanded(
                          child: LabelValue(
                            label: 'Total',
                            value: row.total.toString(),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _documentReportsPanel(Map<String, List<Map<String, dynamic>>> data) {
    final documents = _reportDocuments(data)
        .where(
          (document) => containsQuery(document, _query, const [
            'title',
            'documentName',
            'documentType',
            'category',
            'ownerName',
            'studentName',
            'verificationStatus',
            'status',
          ]),
        )
        .toList();
    final byStatus = _countBy(
      documents,
      (document) => readText(document, const [
        'verificationStatus',
        'status',
      ], fallback: 'Pending Review'),
    );
    final byCategory = _countBy(
      documents,
      (document) => readText(document, const [
        'category',
        'documentType',
      ], fallback: 'Uncategorized'),
    );
    final verified = documents.where((item) {
      final status = readText(item, const [
        'verificationStatus',
        'status',
      ], fallback: '');
      return status == 'Verified' || status == 'Source PDF';
    }).length;
    final pending = documents
        .where(
          (item) =>
              readText(item, const [
                'verificationStatus',
                'status',
              ], fallback: '') ==
              'Pending Review',
        )
        .length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SummaryRow(
          stats: [
            _Stat(
              'Documents',
              documents.length.toString(),
              Icons.folder_copy_rounded,
              const Color(0xFF12A6A6),
            ),
            _Stat(
              'Verified',
              verified.toString(),
              Icons.verified_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Pending',
              pending.toString(),
              Icons.pending_actions_rounded,
              AppColors.warning,
            ),
          ],
        ),
        const SectionTitle('By Status'),
        _ReportBreakdownCard(rows: byStatus.entries.toList()),
        const SectionTitle('By Category'),
        _ReportBreakdownCard(rows: byCategory.entries.toList()),
        const SectionTitle('Documents'),
        if (documents.isEmpty)
          const EmptyState(
            title: 'No document records',
            message: 'Document report rows will appear here.',
            icon: Icons.folder_copy_rounded,
          )
        else
          ...documents
              .take(30)
              .map(
                (document) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _ReportDataCard(
                    icon: Icons.description_rounded,
                    color: const Color(0xFF12A6A6),
                    title: readText(document, const [
                      'title',
                      'documentName',
                      'documentType',
                    ]),
                    subtitle: readText(document, const [
                      'ownerName',
                      'studentName',
                      'ownerId',
                    ], fallback: 'Document owner'),
                    meta: [
                      readText(document, const [
                        'category',
                        'documentType',
                      ], fallback: 'Uncategorized'),
                      formatDateValue(
                        document['createdAt'] ?? document['createdAtText'],
                      ),
                    ],
                    trailing: StatusPill(
                      label: readText(document, const [
                        'verificationStatus',
                        'status',
                      ], fallback: 'Pending Review'),
                    ),
                  ),
                ),
              ),
      ],
    );
  }

  Widget _examReportsPanel(Map<String, List<Map<String, dynamic>>> data) {
    final marks = _items(data, 'marks');
    final results = _items(data, 'results');
    final reportCards = _items(data, 'reportCards');
    final rows =
        [
          ...marks.map((item) => {'reportType': 'Marks Entry', ...item}),
          ...results.map((item) => {'reportType': 'Student Result', ...item}),
        ].where((row) {
          return containsQuery(row, _query, const [
            'reportType',
            'examName',
            'subject',
            'subjectName',
            'studentName',
            'studentId',
            'grade',
            'status',
          ]);
        }).toList();
    final subjectRows = _countBy(
      rows,
      (row) => readText(row, const [
        'subject',
        'subjectName',
        'examName',
      ], fallback: 'General'),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SummaryRow(
          stats: [
            _Stat(
              'Marks',
              marks.length.toString(),
              Icons.edit_note_rounded,
              const Color(0xFF8357C5),
            ),
            _Stat(
              'Results',
              results.length.toString(),
              Icons.assignment_turned_in_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Cards',
              reportCards.length.toString(),
              Icons.article_rounded,
              AppColors.primary,
            ),
          ],
        ),
        const SectionTitle('Subjects / Exams'),
        _ReportBreakdownCard(rows: subjectRows.entries.toList()),
        const SectionTitle('Exam Report Rows'),
        if (rows.isEmpty)
          EmptyState(
            title: _query.trim().isEmpty
                ? 'No exam report records'
                : 'No matching exam reports',
            message: 'Marks and result rows will appear here.',
            icon: Icons.assignment_turned_in_rounded,
          )
        else
          ...rows.take(40).map((row) {
            final score = readNumber(row, const ['percentage'], fallback: -1);
            final maxMarks = readNumber(row, const ['maxMarks']);
            final obtained = readNumber(row, const ['marksObtained', 'marks']);
            final scoreText = score >= 0
                ? '${score.round()}%'
                : maxMarks > 0
                ? '$obtained/$maxMarks'
                : readText(row, const ['grade', 'status'], fallback: '-');
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _ReportDataCard(
                icon: Icons.assignment_turned_in_rounded,
                color: const Color(0xFF8357C5),
                title: readText(row, const ['reportType']),
                subtitle: readText(row, const [
                  'studentName',
                  'name',
                  'studentId',
                ], fallback: 'Student'),
                meta: [
                  readText(row, const [
                    'examName',
                    'subject',
                    'subjectName',
                  ], fallback: 'Exam'),
                  scoreText,
                ],
                trailing: StatusPill(
                  label: readText(row, const [
                    'grade',
                    'status',
                  ], fallback: 'Recorded'),
                ),
              ),
            );
          }),
      ],
    );
  }

  Widget _financialReportsPanel(Map<String, List<Map<String, dynamic>>> data) {
    final rows = _financialFeeRows(data);
    final collections = _financialCollections(data, rows);
    final totalAssigned = rows.fold<num>(0, (total, row) => total + row.total);
    final totalCollected = rows.fold<num>(0, (total, row) => total + row.paid);
    final totalOutstanding = rows.fold<num>(0, (total, row) => total + row.due);
    final totalAdjusted = rows.fold<num>(
      0,
      (total, row) => total + row.adjusted,
    );
    final collectionRate = totalAssigned <= 0
        ? 0
        : ((totalCollected / totalAssigned) * 100).clamp(0, 100).round();
    final outstandingRows = rows.where((row) => row.due > 0).toList();
    final visibleCollections = collections
        .where(
          (collection) => containsQuery(collection, _query, const [
            'studentName',
            'studentId',
            'classKey',
            'paymentMode',
            'referenceNo',
            'receiptNo',
          ]),
        )
        .toList();
    final visibleOutstanding = outstandingRows
        .where(
          (row) =>
              containsQuery(row.assignment, _query, const [
                'studentName',
                'studentId',
                'classKey',
                'className',
                'feeName',
                'feeStructureName',
              ]) ||
              row.title.toLowerCase().contains(_query.toLowerCase()),
        )
        .toList();
    final analytics = _financialClassAnalytics(rows);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SummaryRow(
          stats: [
            _Stat(
              'Assigned',
              formatMoney(totalAssigned),
              Icons.account_balance_wallet_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Collected',
              formatMoney(totalCollected),
              Icons.payments_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Outstanding',
              formatMoney(totalOutstanding),
              Icons.trending_up_rounded,
              AppColors.danger,
            ),
          ],
        ),
        InfoCard(
          child: Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Collection Rate',
                  value: '$collectionRate%',
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Adjusted',
                  value: formatMoney(totalAdjusted),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Due Students',
                  value: outstandingRows.length.toString(),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _SegmentedFilter(
          value: _financialReportTab,
          options: const {'collections': 'Collection', 'outstanding': 'Due'},
          onChanged: (value) => setState(() => _financialReportTab = value),
        ),
        const SectionTitle('Class Analytics'),
        _ReportBreakdownCard(
          rows: analytics
              .map(
                (item) => MapEntry(
                  '${item.label} (${item.rate}%)',
                  formatMoney(item.outstanding),
                ),
              )
              .toList(),
        ),
        if (_financialReportTab == 'collections') ...[
          const SectionTitle('Collection Reports'),
          if (visibleCollections.isEmpty)
            const EmptyState(
              title: 'No collections',
              message: 'Collection report rows will appear here.',
              icon: Icons.payments_rounded,
            )
          else
            ...visibleCollections
                .take(40)
                .map(
                  (collection) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _ReportDataCard(
                      icon: Icons.payments_rounded,
                      color: AppColors.accent,
                      title: readText(collection, const [
                        'studentName',
                        'studentId',
                      ], fallback: 'Collection'),
                      subtitle: readText(
                        collection,
                        const ['paymentDate', 'createdAtText'],
                        fallback: formatDateValue(collection['createdAt']),
                      ),
                      meta: [
                        readText(collection, const [
                          'classKey',
                          'className',
                        ], fallback: 'Class'),
                        readText(collection, const [
                          'paymentMode',
                        ], fallback: 'Mode'),
                      ],
                      trailing: Text(
                        formatMoney(_feeCollectionAmount(collection)),
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                  ),
                ),
        ] else ...[
          const SectionTitle('Outstanding Reports'),
          if (visibleOutstanding.isEmpty)
            const EmptyState(
              title: 'No outstanding dues',
              message: 'Outstanding fee rows will appear here.',
              icon: Icons.receipt_long_rounded,
            )
          else
            ...visibleOutstanding
                .take(40)
                .map(
                  (row) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _ReportDataCard(
                      icon: Icons.receipt_long_rounded,
                      color: AppColors.danger,
                      title: readText(row.assignment, const [
                        'studentName',
                        'studentId',
                      ], fallback: row.title),
                      subtitle: row.title,
                      meta: [
                        readText(row.assignment, const [
                          'classKey',
                          'className',
                        ], fallback: 'Class'),
                        row.dueBucket,
                      ],
                      trailing: Text(
                        formatMoney(row.due),
                        style: const TextStyle(
                          color: AppColors.danger,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                ),
        ],
        const SectionTitle('Saved Financial Summaries'),
        if (_items(data, 'snapshots').isEmpty)
          const InfoCard(
            child: Text(
              'No saved financial summaries yet.',
              style: TextStyle(color: AppColors.muted, fontSize: 13),
            ),
          )
        else
          ..._items(data, 'snapshots')
              .take(6)
              .map(
                (snapshot) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _ReportDataCard(
                    icon: Icons.save_alt_rounded,
                    color: AppColors.primary,
                    title: readText(snapshot, const [
                      'reportName',
                      'title',
                    ], fallback: 'Financial Summary'),
                    subtitle: readText(snapshot, const [
                      'createdAtText',
                    ], fallback: formatDateValue(snapshot['createdAt'])),
                    meta: [
                      formatMoney(
                        readNumber(snapshot, const ['filteredCollected']),
                      ),
                      formatMoney(
                        readNumber(snapshot, const ['totalOutstanding']),
                      ),
                    ],
                    trailing: StatusPill(
                      label: readText(snapshot, const [
                        'status',
                      ], fallback: 'Generated'),
                    ),
                  ),
                ),
              ),
      ],
    );
  }

  List<Map<String, dynamic>> _reportDocuments(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    return [..._items(data, 'documents'), ..._items(data, 'studentDocuments')];
  }

  Map<String, int> _countBy(
    Iterable<Map<String, dynamic>> items,
    String Function(Map<String, dynamic> item) keyOf,
  ) {
    final counts = <String, int>{};
    for (final item in items) {
      final key = keyOf(item).trim().isEmpty ? 'Unassigned' : keyOf(item);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }

  List<_AttendanceReportSummary> _attendanceReportRows(
    List<Map<String, dynamic>> records,
  ) {
    final grouped = <String, _AttendanceReportSummary>{};
    for (final record in records) {
      final date = _attendanceRecordDate(record);
      final label = switch (_attendanceReportScope) {
        'monthly' =>
          date == null
              ? readText(record, const ['dateText'], fallback: 'Unknown')
              : DateFormat('MMM yyyy').format(date),
        'yearly' =>
          date == null
              ? readText(record, const ['dateText'], fallback: 'Unknown')
              : DateFormat('yyyy').format(date),
        _ =>
          date == null
              ? readText(record, const ['dateText'], fallback: 'Unknown')
              : _attendanceDisplayDate(date),
      };
      final existing = grouped[label] ?? _AttendanceReportSummary(label);
      grouped[label] = existing.add(_attendanceStatus(record));
    }
    final rows = grouped.values.toList()
      ..sort((first, second) => first.label.compareTo(second.label));
    return rows;
  }

  String _attendanceStatus(Map<String, dynamic> record) {
    final status = readText(record, const [
      'status',
      'attendanceStatus',
    ], fallback: 'Present');
    final normalized = status.toLowerCase();
    if (normalized.contains('absent')) return 'Absent';
    if (normalized.contains('late')) return 'Late';
    if (normalized.contains('leave')) return 'Leave';
    return 'Present';
  }

  List<_FeeAssignmentSnapshot> _financialFeeRows(
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    final students = _feeStudents(data);
    final structures = _feeStructures(data);
    final assignments = _feeAssignments(data, students);
    final collections = _feeCollections(data, assignments, students);
    final adjustments = _feeAdjustments(data, assignments, students);
    return assignments
        .map(
          (assignment) =>
              _feeSnapshot(assignment, collections, adjustments, structures),
        )
        .toList();
  }

  List<Map<String, dynamic>> _financialCollections(
    Map<String, List<Map<String, dynamic>>> data,
    List<_FeeAssignmentSnapshot> rows,
  ) {
    final students = _feeStudents(data);
    final assignments = rows.map((row) => row.assignment).toList();
    return _feeCollections(data, assignments, students);
  }

  List<_FinancialClassSummary> _financialClassAnalytics(
    List<_FeeAssignmentSnapshot> rows,
  ) {
    final grouped = <String, _FinancialClassSummary>{};
    for (final row in rows) {
      final label = readText(row.assignment, const [
        'classKey',
        'className',
        'program',
      ], fallback: 'Unassigned');
      final current = grouped[label] ?? _FinancialClassSummary(label: label);
      grouped[label] = current.add(row);
    }
    final analytics = grouped.values.toList()
      ..sort(
        (first, second) => second.outstanding.compareTo(first.outstanding),
      );
    return analytics;
  }

  Future<void> _saveFinancialSnapshot(
    Map<String, List<Map<String, dynamic>>> data,
  ) async {
    if (!_can('financialReports.snapshots')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You do not have permission to save report summaries.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final rows = _financialFeeRows(data);
    final totalAssigned = rows.fold<num>(0, (total, row) => total + row.total);
    final totalCollected = rows.fold<num>(0, (total, row) => total + row.paid);
    final totalOutstanding = rows.fold<num>(0, (total, row) => total + row.due);
    final totalAdjusted = rows.fold<num>(
      0,
      (total, row) => total + row.adjusted,
    );
    final collectionRate = totalAssigned <= 0
        ? 0
        : ((totalCollected / totalAssigned) * 100).clamp(0, 100).round();
    await widget.repository.createDocument('financialReportSnapshots', {
      'reportName': 'Finance Summary ${_displayDateNow()}',
      'totalAssigned': totalAssigned,
      'lifetimeCollected': totalCollected,
      'filteredCollected': totalCollected,
      'totalAdjusted': totalAdjusted,
      'totalOutstanding': totalOutstanding,
      'collectionRate': collectionRate,
      'dueStudentCount': rows.where((row) => row.due > 0).length,
      'classCount': _financialClassAnalytics(rows).length,
      'status': 'Generated',
      'createdAtText': _displayDateNow(),
      if (_academicYear.trim().isNotEmpty) 'academicYear': _academicYear.trim(),
      'createdBy': widget.user.uid,
    });
    await _refresh();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Financial summary saved'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _exportActiveReport(
    Map<String, List<Map<String, dynamic>>> data,
  ) async {
    if (!_canExportReportCategory(_reportCategory)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You do not have permission to export this report.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final csv = _reportCsv(data, _reportCategory);
    await Clipboard.setData(ClipboardData(text: csv));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${_reportExportLabel(_reportCategory)} CSV copied'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  String _reportExportLabel(String category) {
    return _reportCategories()
        .firstWhere(
          (item) => item.id == category,
          orElse: () => const _ReportCategoryOption(
            id: 'reports',
            label: 'Reports',
            description: '',
            icon: Icons.bar_chart_rounded,
            color: AppColors.primary,
          ),
        )
        .label;
  }

  String _csvValue(Object? value) {
    return '"${(value ?? '').toString().replaceAll('"', '""')}"';
  }

  String _csvRows(List<List<Object?>> rows) {
    return rows.map((row) => row.map(_csvValue).join(',')).join('\n');
  }

  String _reportCsv(
    Map<String, List<Map<String, dynamic>>> data,
    String category,
  ) {
    switch (category) {
      case 'attendance':
        return _csvRows([
          ['Period', 'Present', 'Absent', 'Late', 'Leave', 'Total'],
          ..._attendanceReportRows([
            ..._items(data, 'attendance'),
            ..._items(data, 'staffAttendance'),
          ]).map(
            (row) => [
              row.label,
              row.present,
              row.absent,
              row.late,
              row.leave,
              row.total,
            ],
          ),
        ]);
      case 'documents':
        return _csvRows([
          ['Document', 'Owner', 'Category', 'Status', 'Created'],
          ..._reportDocuments(data).map(
            (document) => [
              readText(document, const [
                'title',
                'documentName',
                'documentType',
              ], fallback: ''),
              readText(document, const [
                'ownerName',
                'studentName',
                'ownerId',
              ], fallback: ''),
              readText(document, const [
                'category',
                'documentType',
              ], fallback: ''),
              readText(document, const [
                'verificationStatus',
                'status',
              ], fallback: ''),
              formatDateValue(
                document['createdAt'] ?? document['createdAtText'],
              ),
            ],
          ),
        ]);
      case 'exams':
        return _csvRows([
          ['Report Type', 'Student', 'Subject / Exam', 'Score', 'Status'],
          ...[
            ..._items(
              data,
              'marks',
            ).map((item) => {'reportType': 'Marks Entry', ...item}),
            ..._items(
              data,
              'results',
            ).map((item) => {'reportType': 'Student Result', ...item}),
          ].map(
            (row) => [
              readText(row, const ['reportType'], fallback: ''),
              readText(row, const [
                'studentName',
                'name',
                'studentId',
              ], fallback: ''),
              readText(row, const [
                'examName',
                'subject',
                'subjectName',
              ], fallback: ''),
              readText(row, const [
                'percentage',
                'marksObtained',
                'marks',
              ], fallback: ''),
              readText(row, const ['grade', 'status'], fallback: ''),
            ],
          ),
        ]);
      case 'financial':
        final rows = _financialFeeRows(data);
        if (_financialReportTab == 'outstanding') {
          return _csvRows([
            ['Student', 'Class', 'Fee', 'Aging', 'Outstanding'],
            ...rows
                .where((row) => row.due > 0)
                .map(
                  (row) => [
                    readText(row.assignment, const [
                      'studentName',
                      'studentId',
                    ], fallback: ''),
                    readText(row.assignment, const [
                      'classKey',
                      'className',
                    ], fallback: ''),
                    row.title,
                    row.dueBucket,
                    row.due,
                  ],
                ),
          ]);
        }
        return _csvRows([
          ['Student', 'Class', 'Date', 'Mode', 'Reference', 'Amount'],
          ..._financialCollections(data, rows).map(
            (collection) => [
              readText(collection, const [
                'studentName',
                'studentId',
              ], fallback: ''),
              readText(collection, const [
                'classKey',
                'className',
              ], fallback: ''),
              readText(collection, const [
                'paymentDate',
                'createdAtText',
              ], fallback: ''),
              readText(collection, const ['paymentMode'], fallback: ''),
              readText(collection, const [
                'referenceNo',
                'receiptNo',
              ], fallback: ''),
              _feeCollectionAmount(collection),
            ],
          ),
        ]);
      default:
        return _csvRows([
          [
            'Student Name',
            'Student ID',
            'Admission No',
            'Class',
            'Program',
            'Guardian',
            'Status',
            'Created On',
          ],
          ..._items(data, 'students').map(
            (student) => [
              readText(student, const ['name'], fallback: ''),
              readText(student, const ['studentId'], fallback: ''),
              readText(student, const ['admissionNo'], fallback: ''),
              '${readText(student, const ['className'], fallback: '')} ${readText(student, const ['section'], fallback: '')}'
                  .trim(),
              readText(student, const ['program'], fallback: ''),
              readText(student, const ['guardianName'], fallback: ''),
              readText(student, const ['status'], fallback: ''),
              readText(student, const ['createdAtText'], fallback: ''),
            ],
          ),
        ]);
    }
  }

  Future<void> _showCreateRecordSheet({
    required String title,
    required String collectionName,
    required List<_FieldSpec> fields,
    Map<String, dynamic> defaults = const {},
  }) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _RecordFormSheet(
        title: title,
        fields: fields,
        onSave: (values) async {
          await widget.repository.createDocument(collectionName, {
            ...defaults,
            ...values,
            if (_academicYear.trim().isNotEmpty)
              'academicYear': _academicYear.trim(),
            'createdBy': widget.user.uid,
          });
        },
      ),
    );

    if (!mounted) return;
    if (saved == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$title saved'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    }
  }

  Future<void> _showStudentAdmissionSheet(
    Map<String, List<Map<String, dynamic>>> data,
  ) async {
    final courses = _studentCourseOptions(
      data,
    ).where((course) => course.courseCode != 'all').toList();
    _StudentCourseOption? selectedCourse;
    for (final course in courses) {
      if (course.courseCode == _studentCourseCode) {
        selectedCourse = course;
        break;
      }
    }
    var savedAcademicYear = '';

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _RecordFormSheet(
        title: 'New Student Admission',
        helper:
            'New admissions are saved as Pending Approval until a Super Admin approves them.',
        saveLabel: 'Save Admission',
        initialValues: {
          'academicYear': _academicYear.trim().isNotEmpty
              ? _academicYear.trim()
              : _defaultAcademicYear,
          if (selectedCourse != null) ...{
            'courseCode': selectedCourse.courseCode,
            'courseName': selectedCourse.courseName,
            'courseYear': selectedCourse.courseYear,
            'admissionType': selectedCourse.admissionType,
            'collegeName': selectedCourse.collegeName,
            'collegeCode': selectedCourse.collegeCode,
          },
        },
        fields: _studentProfileFields(includeStatus: false),
        onSave: (values) async {
          final selectedAcademicYear = (values['academicYear'] ?? '')
              .toString()
              .trim();
          if (selectedAcademicYear.isEmpty) {
            throw StateError('Academic year is required.');
          }
          savedAcademicYear = selectedAcademicYear;
          final nextNumber = _nextStudentNumber(
            data,
          ).toString().padLeft(5, '0');
          final createdAtText = _displayDateNow();
          final yearToken =
              selectedAcademicYear.replaceAll(RegExp(r'\D'), '').isEmpty
              ? DateTime.now().year.toString()
              : selectedAcademicYear.replaceAll(RegExp(r'\D'), '');
          final normalized = _normalizedStudentProfile(values);
          final validationMessage = _validateStudentProfile(normalized);
          if (validationMessage.isNotEmpty) {
            throw ArgumentError(validationMessage);
          }
          final studentPayload = {
            ...normalized,
            'admissionNo': 'ADM-$yearToken-$nextNumber',
            'studentId': 'STU-$nextNumber',
            'academicYear': selectedAcademicYear,
            'status': _pendingAdmissionStatus,
            'admissionApprovalStatus': _pendingAdmissionStatus,
            'createdAtText': createdAtText,
            'createdBy': widget.user.uid,
          };

          final studentRecordId = await widget.repository.createDocument(
            'students',
            studentPayload,
          );
          final admissionPayload = {
            'studentRecordId': studentRecordId,
            'studentId': studentPayload['studentId'],
            'admissionNo': studentPayload['admissionNo'],
            'academicYear': selectedAcademicYear,
            'idHolder': studentPayload['idHolder'],
            'courseCode': studentPayload['courseCode'],
            'courseName': studentPayload['courseName'],
            'courseYear': studentPayload['courseYear'],
            'admissionType': studentPayload['admissionType'],
            'collegeName': studentPayload['collegeName'],
            'collegeCode': studentPayload['collegeCode'],
            'admissionDate': studentPayload['admissionDate'],
            'seatType': studentPayload['seatType'],
            'actualCategory': studentPayload['actualCategory'],
            'status': _pendingAdmissionStatus,
            'submittedAtText': createdAtText,
            'createdBy': widget.user.uid,
          };
          final admissionFormPayload = {
            'studentRecordId': studentRecordId,
            'studentId': studentPayload['studentId'],
            'documentType': 'Admission Form',
            'academicYear': selectedAcademicYear,
            'uploadedBy': widget.user.name.isEmpty
                ? widget.user.email
                : widget.user.name,
            'fileName': '${studentPayload['admissionNo']}-admission-form.pdf',
            'verificationStatus': 'Pending Review',
            'uploadedAtText': createdAtText,
            'createdBy': widget.user.uid,
          };
          await Future.wait([
            widget.repository.createDocument(
              'studentAdmissions',
              admissionPayload,
            ),
            widget.repository.createDocument(
              'studentDocuments',
              admissionFormPayload,
            ),
          ]);
        },
      ),
    );

    if (!mounted) return;
    if (saved == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Student admission sent for Super Admin approval'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      if (savedAcademicYear.isNotEmpty) {
        setState(() => _academicYear = savedAcademicYear);
      }
      await _refresh();
    }
  }

  Future<void> _showStudentProfileSheet(Map<String, dynamic> student) async {
    final studentId = readText(student, const ['id'], fallback: '');
    if (studentId.isEmpty) return;
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _RecordFormSheet(
        title: 'Edit Student Profile',
        helper: 'Updates student profile and academic details.',
        saveLabel: 'Save Changes',
        initialValues: student,
        fields: _studentProfileFields(includeStatus: true),
        onSave: (values) async {
          final previousStatus = readText(student, const [
            'status',
          ], fallback: _pendingAdmissionStatus);
          final requestedStatus = (values['status'] ?? previousStatus)
              .toString()
              .trim();
          if (requestedStatus != previousStatus &&
              widget.user.roleId != 'super-admin' &&
              _isAdmittedStatus(requestedStatus)) {
            throw StateError(
              'Only Super Admin can approve or admit a student.',
            );
          }
          final normalized = _normalizedStudentProfile(values);
          final validationMessage = _validateStudentProfile(normalized);
          if (validationMessage.isNotEmpty) {
            throw ArgumentError(validationMessage);
          }
          final updates = {
            ...normalized,
            'status': requestedStatus.isEmpty
                ? _pendingAdmissionStatus
                : requestedStatus,
            'updatedAtText': _displayDateNow(),
          };
          await widget.repository.updateDocument(
            'students',
            studentId,
            updates,
          );
        },
      ),
    );

    if (!mounted) return;
    if (saved == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Student profile updated'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    }
  }

  List<_FieldSpec> _studentProfileFields({required bool includeStatus}) {
    return [
      const _FieldSpec('courseCode', 'Course code'),
      const _FieldSpec('courseName', 'Course name'),
      const _FieldSpec('courseYear', 'Course year / Class'),
      const _FieldSpec('admissionType', 'Admission type / Section'),
      const _FieldSpec('academicYear', 'Academic year', isRequired: true),
      const _FieldSpec('name', 'Student name', isRequired: true),
      const _FieldSpec('nameAsInAadhaar', 'Name as in Aadhaar'),
      const _FieldSpec('fatherName', 'Father name', isRequired: true),
      const _FieldSpec('motherName', 'Mother name'),
      const _FieldSpec('dob', 'Date of birth'),
      const _FieldSpec('gender', 'Gender'),
      const _FieldSpec('bloodGroup', 'Blood group'),
      const _FieldSpec('mobileNo', 'Mobile no', isRequired: true),
      const _FieldSpec('alternatePhoneNo', 'Phone no'),
      const _FieldSpec('email', 'Email'),
      const _FieldSpec('address', 'Address'),
      const _FieldSpec('nationality', 'Nationality'),
      const _FieldSpec('state', 'State'),
      const _FieldSpec('ruralUrban', 'Rural / Urban'),
      const _FieldSpec('religion', 'Religion'),
      const _FieldSpec('seatType', 'Admission seat type'),
      const _FieldSpec('govtSeatType', 'Govt seat type'),
      const _FieldSpec('actualCategory', 'Actual category'),
      const _FieldSpec('seatSelectCategory', 'Seat select category'),
      const _FieldSpec('admissionDate', 'Date of admission'),
      const _FieldSpec('keaCetNumber', 'KEA CET Number'),
      const _FieldSpec('sspId', 'SSP ID'),
      const _FieldSpec('neetRegNo', 'NEET Reg No'),
      const _FieldSpec('neetRank', 'NEET Rank'),
      const _FieldSpec('cetRegNo', 'CET Reg No'),
      const _FieldSpec('cetRank', 'CET Rank'),
      const _FieldSpec('qualifyingExamName', 'Qualifying Exam'),
      const _FieldSpec('qualifyingExamRegNo', 'Qualifying Exam Reg No'),
      const _FieldSpec('qualifyingMaxMarks', 'Qualifying Max Marks'),
      const _FieldSpec('qualifyingSecuredMarks', 'Qualifying Secured Marks'),
      const _FieldSpec('qualifyingPassDate', 'Qualifying Pass Date'),
      const _FieldSpec('qualifyingBoard', 'University / Board'),
      const _FieldSpec('optionalSubject', 'Optional Subject'),
      const _FieldSpec('optionalMaxMarks', 'Optional Max Marks'),
      const _FieldSpec('optionalSecuredMarks', 'Optional Secured Marks'),
      const _FieldSpec('diplomaCourse', 'Diploma Course'),
      const _FieldSpec('diplomaCourseDuration', 'Diploma Duration'),
      const _FieldSpec('diplomaPassedDate', 'Diploma Passed Date'),
      const _FieldSpec('diplomaBoard', 'Diploma University / Board'),
      const _FieldSpec('diplomaMaxMarks', 'Diploma Max Marks'),
      const _FieldSpec('diplomaSecuredMarks', 'Diploma Secured Marks'),
      const _FieldSpec('casteRdNumber', 'Caste RD Number'),
      const _FieldSpec('casteCategory', 'Caste Category'),
      const _FieldSpec('casteName', 'Caste Name'),
      const _FieldSpec(
        'casteCertificateStudentName',
        'Student Name in Caste Certificate',
      ),
      const _FieldSpec(
        'casteCertificateFatherName',
        'Father Name in Caste Certificate',
      ),
      const _FieldSpec('incomeRdNumber', 'Income RD Number'),
      const _FieldSpec('incomeCategory', 'Income Category'),
      const _FieldSpec('incomeCasteName', 'Caste Name in Income Certificate'),
      const _FieldSpec('annualIncome', 'Annual Income'),
      const _FieldSpec(
        'incomeCertificateStudentName',
        'Student Name in Income Certificate',
      ),
      const _FieldSpec(
        'incomeCertificateFatherName',
        'Father Name in Income Certificate',
      ),
      if (includeStatus) const _FieldSpec('status', 'Status', isRequired: true),
    ];
  }

  Map<String, dynamic> _normalizedStudentProfile(Map<String, dynamic> values) {
    final name = (values['name'] ?? '').toString().trim();
    final fatherName = (values['fatherName'] ?? '').toString().trim();
    final aadhaarName = (values['nameAsInAadhaar'] ?? '').toString().trim();
    final mobileNo = (values['mobileNo'] ?? values['phone'] ?? '')
        .toString()
        .trim();
    final courseYear = (values['courseYear'] ?? values['className'] ?? '')
        .toString()
        .trim();
    final courseName = (values['courseName'] ?? values['program'] ?? '')
        .toString()
        .trim();
    final admissionType = (values['admissionType'] ?? values['section'] ?? '')
        .toString()
        .trim();
    return {
      ...values,
      'name': name,
      'nameAsInAadhaar': aadhaarName,
      'fatherName': fatherName,
      'guardianName': fatherName,
      'idHolder': aadhaarName.isEmpty ? name : aadhaarName,
      'phone': mobileNo,
      'mobileNo': mobileNo,
      'className': courseYear,
      'courseYear': courseYear,
      'program': courseName,
      'courseName': courseName,
      'section': admissionType,
      'admissionType': admissionType,
    };
  }

  String _validateStudentProfile(Map<String, dynamic> form) {
    for (final field in const [
      ['name', 'Student name'],
      ['guardianName', 'Guardian name'],
      ['idHolder', 'ID holder'],
      ['phone', 'Phone'],
      ['className', 'Class'],
      ['section', 'Section'],
      ['program', 'Program'],
      ['academicYear', 'Academic year'],
    ]) {
      if (readText(form, [field.first], fallback: '').trim().isEmpty) {
        return '${field.last} is required.';
      }
    }

    final email = readText(form, const ['email'], fallback: '').trim();
    if (email.isNotEmpty &&
        !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return 'Enter a valid email address.';
    }

    final phone = readText(form, const ['phone'], fallback: '').trim();
    if (!RegExp(r'^[0-9+\-\s()]{7,20}$').hasMatch(phone)) {
      return 'Enter a valid phone number.';
    }

    return '';
  }

  Future<void> _approveStudentAdmission(
    Map<String, dynamic> student,
    Map<String, List<Map<String, dynamic>>> data,
  ) async {
    if (widget.user.roleId != 'super-admin') return;
    final confirmed = await _confirmStudentAction(
      title: 'Approve admission?',
      message:
          'This will move the student to Active and mark the latest admission as Approved.',
      actionLabel: 'Approve',
    );
    if (!confirmed) return;

    final approvedAtText = _displayDateNow();
    final studentId = readText(student, const ['id'], fallback: '');
    final admission = _latestRelatedRecord(_items(data, 'admissions'), student);
    try {
      await Future.wait([
        widget.repository.updateDocument('students', studentId, {
          'status': _activeStudentStatus,
          'admissionApprovalStatus': _approvedAdmissionStatus,
          'approvedBy': widget.user.name.isEmpty
              ? widget.user.email
              : widget.user.name,
          'approvedAtText': approvedAtText,
        }),
        if (admission != null)
          widget.repository.updateDocument(
            'studentAdmissions',
            readText(admission, const ['id'], fallback: ''),
            {
              'status': _approvedAdmissionStatus,
              'approvedBy': widget.user.name.isEmpty
                  ? widget.user.email
                  : widget.user.name,
              'approvedAtText': approvedAtText,
            },
          ),
      ]);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Student admission approved'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Student admission was not approved: $error'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _archiveStudent(Map<String, dynamic> student) async {
    final confirmed = await _confirmStudentAction(
      title: 'Archive student?',
      message: 'Archived records stay available from the Archived filter.',
      actionLabel: 'Archive',
    );
    if (!confirmed) return;
    await _updateStudentStatus(student, {
      'status': 'Archived',
      'archivedAt': FieldValue.serverTimestamp(),
      'archivedAtText': _displayDateNow(),
    }, 'Student archived');
  }

  Future<void> _restoreStudent(Map<String, dynamic> student) async {
    final restoredStatus = widget.user.roleId == 'super-admin'
        ? _activeStudentStatus
        : _pendingAdmissionStatus;
    await _updateStudentStatus(student, {
      'status': restoredStatus,
      'restoredAt': FieldValue.serverTimestamp(),
      'restoredAtText': _displayDateNow(),
    }, 'Student restored');
    if (mounted) setState(() => _studentStatusFilter = 'active');
  }

  bool _canManageHealthRecord() =>
      widget.user.roleId == 'admin' || widget.user.roleId == 'super-admin';

  Future<void> _showHealthRecordSheet(
    Map<String, dynamic> student,
    Map<String, dynamic>? existingRecord,
  ) async {
    if (!_canManageHealthRecord()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Only Admin and Super Admin can manage health records.',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final isEdit = existingRecord != null;
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _HealthRecordFormSheet(
        title: isEdit ? 'Edit Student Health Record' : 'Upload Health Record',
        helper: 'Stores the same structured health record used on the website.',
        saveLabel: isEdit ? 'Save Changes' : 'Upload Record',
        student: student,
        existingRecord: existingRecord,
        academicYear: _academicYear,
        savedAtText: _displayDateNow(),
        userName: widget.user.name.isEmpty
            ? widget.user.email
            : widget.user.name,
        onSave: (payload) async {
          final id = readText(existingRecord ?? const {}, const [
            'id',
          ], fallback: '');
          if (id.isNotEmpty) {
            await widget.repository.updateDocument(
              'studentHealthRecords',
              id,
              payload,
            );
          } else {
            await widget.repository.createDocument(
              'studentHealthRecords',
              payload,
            );
          }
        },
      ),
    );

    if (!mounted) return;
    if (saved == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isEdit
                ? 'Student health record updated'
                : 'Student health record uploaded',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    }
  }

  Future<void> _deleteHealthRecord(Map<String, dynamic> record) async {
    if (!_canManageHealthRecord()) return;
    final id = readText(record, const ['id'], fallback: '');
    if (id.isEmpty) return;
    final confirmed = await _confirmStudentAction(
      title: 'Delete health record?',
      message: 'This permanently removes the student health record.',
      actionLabel: 'Delete',
    );
    if (!confirmed) return;

    try {
      await widget.repository.deleteDocument('studentHealthRecords', id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Student health record deleted'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Health record delete failed: $error'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _updateStudentStatus(
    Map<String, dynamic> student,
    Map<String, dynamic> updates,
    String successMessage,
  ) async {
    final studentId = readText(student, const ['id'], fallback: '');
    if (studentId.isEmpty) return;
    try {
      await widget.repository.updateDocument('students', studentId, updates);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(successMessage),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Student update failed: $error'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<bool> _confirmStudentAction({
    required String title,
    required String message,
    required String actionLabel,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(actionLabel),
          ),
        ],
      ),
    );
    return result == true;
  }

  Future<void> _showDocumentUploadSheet({
    required Map<String, List<Map<String, dynamic>>> data,
  }) async {
    final students = _documentStudents(data);
    final staff = _documentStaff(data);
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _DocumentUploadSheet(
        students: students,
        staff: staff,
        onSave: ({required bytes, required fileName, required metadata}) async {
          final payload = {
            ...metadata,
            if (_academicYear.trim().isNotEmpty)
              'academicYear': _academicYear.trim(),
            'uploadedAtText': _documentDisplayDateNow(),
            'uploadedByUid': widget.user.uid,
            'uploadedByEmail': widget.user.email,
            'uploadedById': widget.user.displayId,
            'uploadedByName': widget.user.name,
            'createdBy': widget.user.uid,
          };
          if (bytes == null || fileName.trim().isEmpty) {
            await widget.repository.createDocument('managedDocuments', {
              ...payload,
              'fileName': '',
              'fileSize': 0,
              'fileUrl': '',
              'downloadUrl': '',
              'storagePath': '',
            });
            return;
          }
          await widget.repository.uploadManagedDocument(
            bytes: bytes,
            fileName: fileName,
            uploadedBy: widget.user.uid,
            metadata: payload,
          );
        },
      ),
    );

    if (!mounted) return;
    if (saved == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Document uploaded'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _refresh();
    }
  }

  Future<void> _openDocument(Map<String, dynamic> document) async {
    final url = readText(document, const [
      'downloadUrl',
      'fileUrl',
      'url',
    ], fallback: '');
    if (url.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No downloadable file is attached to this document.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final uri = Uri.tryParse(url);
    if (uri == null ||
        !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to open document link.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _showAttendanceSheet(
    Map<String, List<Map<String, dynamic>>> data,
  ) async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          18,
          20,
          MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.line,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Mark Attendance',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 6),
              const Text(
                'Choose the same attendance flow used in the web ERP.',
                style: TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              const SizedBox(height: 14),
              if (_can('attendance.markStudents')) ...[
                _AttendanceSheetChoice(
                  icon: Icons.calendar_today_rounded,
                  title: 'Mark General Attendance',
                  subtitle:
                      '${_attendanceStudents(data).length} active students',
                  onTap: () => Navigator.of(context).pop('student-general'),
                ),
                const SizedBox(height: 8),
                _AttendanceSheetChoice(
                  icon: Icons.menu_book_rounded,
                  title: 'Mark Subject Attendance',
                  subtitle:
                      '${_attendanceSubjectOptions(data).length} live subjects',
                  onTap: () => Navigator.of(context).pop('student-subject'),
                ),
                const SizedBox(height: 8),
              ],
              if (_can('attendance.markStaff'))
                _AttendanceSheetChoice(
                  icon: Icons.assignment_ind_rounded,
                  title: 'Mark Staff Attendance',
                  subtitle: '${_attendanceStaff(data).length} active staff',
                  onTap: () => Navigator.of(context).pop('staff'),
                ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded, size: 18),
                label: const Text('Cancel'),
              ),
            ],
          ),
        ),
      ),
    );
    if (!mounted || choice == null) return;
    switch (choice) {
      case 'student-general':
        _openAttendanceBranch(
          branch: 'mark-general-students',
          mode: 'students',
          scope: 'general',
        );
        break;
      case 'student-subject':
        _openAttendanceBranch(
          branch: 'mark-students',
          mode: 'students',
          scope: 'subject',
        );
        break;
      case 'staff':
        _openAttendanceBranch(
          branch: 'mark-staff',
          mode: 'staff',
          scope: 'staff',
        );
        break;
    }
  }

  void _showStudentSheet(
    Map<String, dynamic> student,
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.86,
        maxChildSize: 0.94,
        minChildSize: 0.5,
        builder: (context, controller) => _StudentDetailSheet(
          student: student,
          data: data,
          controller: controller,
          canEdit: _can('students.edit'),
          canArchive: _can('students.archive'),
          showApprove: _canApproveStudent(student, data),
          canManageHealthRecord: _canManageHealthRecord(),
          onEdit: () {
            Navigator.of(context).pop();
            _showStudentProfileSheet(student);
          },
          onApprove: () {
            Navigator.of(context).pop();
            _approveStudentAdmission(student, data);
          },
          onArchive: () {
            Navigator.of(context).pop();
            _archiveStudent(student);
          },
          onRestore: () {
            Navigator.of(context).pop();
            _restoreStudent(student);
          },
          onEditHealthRecord: (record) {
            Navigator.of(context).pop();
            _showHealthRecordSheet(student, record);
          },
          onDeleteHealthRecord: (record) {
            Navigator.of(context).pop();
            _deleteHealthRecord(record);
          },
        ),
      ),
    );
  }

  void _showStaffDetailSheet(
    Map<String, dynamic> member,
    Map<String, List<Map<String, dynamic>>> data,
  ) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.86,
        maxChildSize: 0.94,
        minChildSize: 0.5,
        builder: (context, controller) => _StaffDetailSheet(
          member: member,
          data: data,
          controller: controller,
          canEdit: _can('staff.edit'),
          canManageLeave: _can('staff.leave'),
          canMarkAttendance: _can('staff.attendance'),
          onEdit: () {
            Navigator.of(context).pop();
            _showStaffSheet(data: data, member: member);
          },
          onLeave: () {
            Navigator.of(context).pop();
            _showStaffLeaveSheet(member);
          },
          onAttendance: (status) {
            Navigator.of(context).pop();
            _markStaffAttendance(member, data, status);
          },
          onLeaveDecision: (leave, status) {
            Navigator.of(context).pop();
            _decideStaffLeave(leave, status);
          },
        ),
      ),
    );
  }
}

class _ModuleActionBar extends StatelessWidget {
  const _ModuleActionBar({required this.actions});

  final List<_ModuleAction> actions;

  @override
  Widget build(BuildContext context) {
    if (actions.isEmpty) return const SizedBox(height: 8);
    return Padding(
      padding: const EdgeInsets.only(top: 12, bottom: 2),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: actions
              .map(
                (action) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilledButton.tonalIcon(
                    onPressed: action.onTap,
                    icon: Icon(action.icon, size: 18),
                    label: Text(action.label),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                      foregroundColor: AppColors.primaryDark,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      ),
    );
  }
}

class _ModuleAction {
  const _ModuleAction({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;
}

const _permissionGroupLabels = {
  'students': 'Student Information',
  'staff': 'Faculty & Staff',
  'users': 'Users & Roles',
  'modules': 'Module Access',
};

const _permissionLabels = {
  'students.view': 'View students',
  'students.create': 'Create admissions',
  'students.edit': 'Edit profiles',
  'students.archive': 'Archive/restore',
  'students.documents': 'Upload documents',
  'students.verifyDocuments': 'Verify documents',
  'students.promote': 'Promote/transfer',
  'staff.view': 'View faculty/staff',
  'staff.create': 'Create faculty/staff',
  'staff.edit': 'Edit faculty/staff',
  'staff.archive': 'Archive/restore staff',
  'staff.leave': 'Manage leave',
  'staff.attendance': 'Mark attendance',
  'users.view': 'View users',
  'users.create': 'Create users',
  'users.edit': 'Edit users',
  'roles.view': 'View roles',
  'roles.edit': 'Edit permissions',
  'dashboard.view': 'Dashboard module',
  'attendance.view': 'Attendance module',
  'academicCurriculum.view': 'Academic curriculum module',
  'academics.view': 'Academics module',
  'academics.manage': 'Manage academics',
  'attendance.markStudents': 'Mark student attendance',
  'attendance.markStaff': 'Mark staff attendance',
  'attendance.reports': 'View attendance reports',
  'attendance.notifyParents': 'Parent notifications',
  'timetable.view': 'Timetable module',
  'timetable.create': 'Create timetable',
  'timetable.edit': 'Edit timetable',
  'timetable.publish': 'Publish timetable',
  'timetable.classrooms': 'Manage classrooms',
  'exams.view': 'Exams module',
  'exams.schedule': 'Schedule exams',
  'exams.assessments': 'Manage assessments',
  'exams.marks': 'Enter marks',
  'exams.results': 'Generate results',
  'exams.reportCards': 'Generate report cards',
  'fees.view': 'Fees module',
  'fees.setup': 'Set up fee structures',
  'fees.assign': 'Assign fees',
  'fees.collect': 'Record manual collections',
  'fees.adjust': 'Approve adjustments',
  'fees.reports': 'View fee reports',
  'hostel.view': 'Hostel module',
  'hostel.manage': 'Manage hostel records',
  'financialReports.view': 'Financial reports module',
  'financialReports.export': 'Export financial reports',
  'financialReports.snapshots': 'Save financial summaries',
  'reports.view': 'Reports module',
  'notices.view': 'Communication module',
  'notices.create': 'Create announcements',
  'notices.edit': 'Edit announcements',
  'notices.archive': 'Archive announcements',
  'documents.view': 'Document management module',
  'documents.upload': 'Upload documents',
  'documents.verify': 'Verify documents',
  'documents.archive': 'Archive documents',
  'parentPortal.view': 'Parent portal',
  'parentPortal.viewAll': 'View all parent portal students',
  'settings.view': 'Settings module',
  'settings.manage': 'Manage settings',
};

const _hostelRoomStatuses = ['Available', 'Full', 'Maintenance', 'Archived'];
const _hostelAllocationStatuses = ['Active', 'Released'];
const _hostelRecordStatuses = ['Open', 'Closed', 'Archived'];

class _HostelSummary {
  const _HostelSummary({
    required this.rooms,
    required this.totalCapacity,
    required this.occupied,
    required this.available,
    required this.occupancyRate,
    required this.activeAllocations,
    required this.openRecords,
  });

  final int rooms;
  final int totalCapacity;
  final int occupied;
  final int available;
  final int occupancyRate;
  final int activeAllocations;
  final int openRecords;
}

_HostelSummary _hostelSummary(
  List<Map<String, dynamic>> rooms,
  List<Map<String, dynamic>> allocations,
  List<Map<String, dynamic>> records,
) {
  final activeRooms = rooms
      .where(
        (room) =>
            readText(room, const ['status'], fallback: '').toLowerCase() !=
            'archived',
      )
      .toList();
  final totalCapacity = activeRooms.fold<int>(
    0,
    (total, room) => total + readNumber(room, const ['capacity']).round(),
  );
  final occupied = activeRooms.fold<int>(
    0,
    (total, room) => total + readNumber(room, const ['occupiedCount']).round(),
  );
  final activeAllocations = allocations
      .where(
        (item) => readText(item, const ['status'], fallback: '') == 'Active',
      )
      .length;
  final openRecords = records
      .where(
        (item) => ![
          'Closed',
          'Archived',
        ].contains(readText(item, const ['status'], fallback: '')),
      )
      .length;
  return _HostelSummary(
    rooms: activeRooms.length,
    totalCapacity: totalCapacity,
    occupied: occupied,
    available: totalCapacity > occupied ? totalCapacity - occupied : 0,
    occupancyRate: totalCapacity == 0
        ? 0
        : ((occupied / totalCapacity) * 100).round(),
    activeAllocations: activeAllocations,
    openRecords: openRecords,
  );
}

String _hostelTabLabel(String tab, {bool singular = false}) {
  switch (tab) {
    case 'allocations':
      return singular ? 'Allocation' : 'Allocations';
    case 'records':
      return singular ? 'Record' : 'Records';
    case 'rooms':
    default:
      return singular ? 'Room' : 'Rooms';
  }
}

IconData _hostelTabIcon(String tab) {
  switch (tab) {
    case 'allocations':
      return Icons.person_pin_circle_rounded;
    case 'records':
      return Icons.assignment_rounded;
    case 'rooms':
    default:
      return Icons.bed_rounded;
  }
}

bool _hostelMatchesQuery(Map<String, dynamic> item, String query) {
  return containsQuery(item, query, const [
    'roomNo',
    'roomNumber',
    'hostelName',
    'blockName',
    'block',
    'wardenName',
    'studentName',
    'studentId',
    'courseName',
    'recordType',
    'title',
    'status',
  ]);
}

String _validateHostelRoom(Map<String, dynamic> form) {
  if (readText(form, const ['roomNo']).trim().isEmpty) {
    return 'Room number is required.';
  }
  if (readText(form, const ['hostelName']).trim().isEmpty) {
    return 'Hostel name is required.';
  }
  final capacity = readNumber(form, const ['capacity'], fallback: 0);
  final occupied = readNumber(form, const ['occupiedCount'], fallback: 0);
  if (capacity < 1) return 'Room capacity must be at least 1.';
  if (occupied > capacity) return 'Occupied count cannot exceed capacity.';
  return '';
}

String _validateHostelAllocation(Map<String, dynamic> form) {
  if (readText(form, const ['studentName']).trim().isEmpty) {
    return 'Student name is required.';
  }
  if (readText(form, const ['studentId']).trim().isEmpty) {
    return 'Student ID is required.';
  }
  if (readText(form, const ['roomNo']).trim().isEmpty) {
    return 'Room number is required.';
  }
  if (readText(form, const ['hostelName']).trim().isEmpty) {
    return 'Hostel name is required.';
  }
  return '';
}

String _validateHostelRecord(Map<String, dynamic> form) {
  if (readText(form, const ['title']).trim().isEmpty) {
    return 'Record title is required.';
  }
  if (readText(form, const ['recordType']).trim().isEmpty) {
    return 'Record type is required.';
  }
  return '';
}

class _HostelCard extends StatelessWidget {
  const _HostelCard({
    required this.tab,
    required this.item,
    required this.onTap,
  });

  final String tab;
  final Map<String, dynamic> item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = readText(item, const ['status'], fallback: '-');
    final title = switch (tab) {
      'allocations' => readText(item, const [
        'studentName',
        'studentId',
      ], fallback: 'Student'),
      'records' => readText(item, const ['title'], fallback: 'Hostel record'),
      _ =>
        '${readText(item, const ['hostelName'], fallback: 'Hostel')} / ${readText(item, const ['roomNo', 'roomNumber'], fallback: 'Room')}',
    };
    final subtitle = switch (tab) {
      'allocations' =>
        '${readText(item, const ['studentId'], fallback: '-')} | ${readText(item, const ['courseName'], fallback: 'Course')}',
      'records' =>
        '${readText(item, const ['recordType'], fallback: 'Record')} | ${_hostelDateLabel(item, const ['recordDate', 'createdAtText'])}',
      _ =>
        '${readText(item, const ['blockName', 'block'], fallback: 'Block')} | Floor ${readText(item, const ['floor'], fallback: '-')}',
    };
    final detail = switch (tab) {
      'allocations' =>
        '${readText(item, const ['hostelName'], fallback: '-')} / ${readText(item, const ['roomNo'], fallback: '-')}',
      'records' =>
        '${readText(item, const ['hostelName'], fallback: '-')} ${readText(item, const ['roomNo'], fallback: '')}'
            .trim(),
      _ =>
        '${readNumber(item, const ['occupiedCount']).round()} / ${readNumber(item, const ['capacity']).round()} occupied',
    };
    return InfoCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            height: 46,
            width: 46,
            decoration: BoxDecoration(
              color: _hostelStatusColor(status).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(_hostelTabIcon(tab), color: _hostelStatusColor(status)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
                const SizedBox(height: 6),
                Text(
                  detail.isEmpty ? '-' : detail,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              StatusPill(label: status),
              const SizedBox(height: 8),
              const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
            ],
          ),
        ],
      ),
    );
  }
}

class _HostelDetailSheet extends StatelessWidget {
  const _HostelDetailSheet({required this.tab, required this.item});

  final String tab;
  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final fields = _hostelDetailFields(tab, item);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        18,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.line,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _hostelTabLabel(tab, singular: true),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  StatusPill(
                    label: readText(item, const ['status'], fallback: '-'),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              ...fields.map(
                (field) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: LabelValue(label: field.$1, value: field.$2),
                ),
              ),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded, size: 18),
                label: const Text('Close'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HostelEntrySheet extends StatefulWidget {
  const _HostelEntrySheet({
    required this.activeTab,
    required this.rooms,
    required this.allocations,
    required this.students,
    required this.academicYear,
    required this.onSave,
  });

  final String activeTab;
  final List<Map<String, dynamic>> rooms;
  final List<Map<String, dynamic>> allocations;
  final List<Map<String, dynamic>> students;
  final String academicYear;
  final Future<void> Function(Map<String, dynamic> values) onSave;

  @override
  State<_HostelEntrySheet> createState() => _HostelEntrySheetState();
}

class _HostelEntrySheetState extends State<_HostelEntrySheet> {
  final _roomNoController = TextEditingController();
  final _hostelNameController = TextEditingController();
  final _blockNameController = TextEditingController();
  final _floorController = TextEditingController();
  final _capacityController = TextEditingController();
  final _occupiedController = TextEditingController(text: '0');
  final _wardenController = TextEditingController();
  final _allocatedOnController = TextEditingController();
  final _recordTypeController = TextEditingController();
  final _titleController = TextEditingController();
  final _recordDateController = TextEditingController();
  final _notesController = TextEditingController();
  var _roomStatus = 'Available';
  var _allocationStatus = 'Active';
  var _recordStatus = 'Open';
  var _studentRecordId = '';
  var _roomId = '';
  var _saving = false;
  var _error = '';

  @override
  void dispose() {
    _roomNoController.dispose();
    _hostelNameController.dispose();
    _blockNameController.dispose();
    _floorController.dispose();
    _capacityController.dispose();
    _occupiedController.dispose();
    _wardenController.dispose();
    _allocatedOnController.dispose();
    _recordTypeController.dispose();
    _titleController.dispose();
    _recordDateController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _availableRooms {
    return widget.rooms.where((room) {
      final status = readText(room, const ['status'], fallback: '');
      final capacity = readNumber(room, const ['capacity'], fallback: 0);
      final occupied = readNumber(room, const ['occupiedCount'], fallback: 0);
      return status != 'Archived' && occupied < capacity;
    }).toList();
  }

  List<Map<String, dynamic>> get _availableStudents {
    final allocatedKeys = widget.allocations
        .where(
          (item) => readText(item, const ['status'], fallback: '') == 'Active',
        )
        .expand(
          (item) => [
            readText(item, const ['studentRecordId'], fallback: ''),
            readText(item, const ['studentId'], fallback: ''),
          ],
        )
        .where((value) => value.isNotEmpty)
        .toSet();
    return widget.students.where((student) {
      final recordId = readText(student, const ['id'], fallback: '');
      final studentId = readText(student, const ['studentId'], fallback: '');
      return !allocatedKeys.contains(recordId) &&
          !allocatedKeys.contains(studentId);
    }).toList();
  }

  Future<void> _save() async {
    final values = switch (widget.activeTab) {
      'allocations' => {
        'studentRecordId': _studentRecordId,
        'roomId': _roomId,
        'allocatedOn': _allocatedOnController.text.trim(),
        'status': _allocationStatus,
      },
      'records' => {
        'recordType': _recordTypeController.text.trim(),
        'title': _titleController.text.trim(),
        'roomId': _roomId,
        'hostelName': _hostelNameController.text.trim(),
        'roomNo': _roomNoController.text.trim(),
        'recordDate': _recordDateController.text.trim(),
        'status': _recordStatus,
        'notes': _notesController.text.trim(),
      },
      _ => {
        'roomNo': _roomNoController.text.trim(),
        'hostelName': _hostelNameController.text.trim(),
        'blockName': _blockNameController.text.trim(),
        'floor': _floorController.text.trim(),
        'capacity': _capacityController.text.trim(),
        'occupiedCount': _occupiedController.text.trim(),
        'wardenName': _wardenController.text.trim(),
        'status': _roomStatus,
      },
    };
    final validation = switch (widget.activeTab) {
      'allocations' =>
        _studentRecordId.isEmpty
            ? 'Select a student to allocate.'
            : _roomId.isEmpty
            ? 'Select an available hostel room.'
            : '',
      'records' => _validateHostelRecord(values),
      _ => _validateHostelRoom(values),
    };
    if (validation.isNotEmpty) {
      setState(() => _error = validation);
      return;
    }

    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await widget.onSave(values);
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _selectRoom(String id) {
    final room = widget.rooms.firstWhere(
      (item) => readText(item, const ['id'], fallback: '') == id,
      orElse: () => const <String, dynamic>{},
    );
    setState(() {
      _roomId = id;
      if (room.isNotEmpty) {
        _roomNoController.text = readText(room, const ['roomNo', 'roomNumber']);
        _hostelNameController.text = readText(room, const ['hostelName']);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final label = _hostelTabLabel(widget.activeTab, singular: true);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        18,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.line,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'New $label',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Save a live hostel record for ${widget.academicYear.isEmpty ? 'the selected academic year' : widget.academicYear}.',
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              const SizedBox(height: 14),
              ..._fieldsForActiveTab(),
              if (_error.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  _error,
                  style: const TextStyle(
                    color: AppColors.danger,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _saving
                          ? null
                          : () => Navigator.of(context).pop(false),
                      icon: const Icon(Icons.close_rounded, size: 18),
                      label: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: Icon(
                        _saving
                            ? Icons.hourglass_top_rounded
                            : Icons.save_rounded,
                        size: 18,
                      ),
                      label: Text(_saving ? 'Saving...' : 'Save $label'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _fieldsForActiveTab() {
    switch (widget.activeTab) {
      case 'allocations':
        return [
          _dropdown(
            label: _availableStudents.isEmpty
                ? 'No unallocated students'
                : 'Student *',
            value:
                _availableStudents.any(
                  (student) =>
                      readText(student, const ['id'], fallback: '') ==
                      _studentRecordId,
                )
                ? _studentRecordId
                : '',
            items: [
              const DropdownMenuItem(value: '', child: Text('Select student')),
              ..._availableStudents.map(
                (student) => DropdownMenuItem(
                  value: readText(student, const ['id'], fallback: ''),
                  child: Text(
                    [
                      readText(student, const ['name', 'studentName']),
                      readText(student, const ['studentId']),
                    ].where((value) => value.isNotEmpty).join(' - '),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
            onChanged: _saving || _availableStudents.isEmpty
                ? null
                : (value) => setState(() => _studentRecordId = value ?? ''),
          ),
          const SizedBox(height: 10),
          _dropdown(
            label: _availableRooms.isEmpty ? 'No available rooms' : 'Room *',
            value:
                _availableRooms.any(
                  (room) =>
                      readText(room, const ['id'], fallback: '') == _roomId,
                )
                ? _roomId
                : '',
            items: [
              const DropdownMenuItem(value: '', child: Text('Select room')),
              ..._availableRooms.map(
                (room) => DropdownMenuItem(
                  value: readText(room, const ['id'], fallback: ''),
                  child: Text(
                    '${readText(room, const ['hostelName'], fallback: 'Hostel')} / ${readText(room, const ['roomNo', 'roomNumber'], fallback: 'Room')}',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
            onChanged: _saving || _availableRooms.isEmpty
                ? null
                : (value) => _selectRoom(value ?? ''),
          ),
          const SizedBox(height: 10),
          _textField(
            _allocatedOnController,
            'Allocated On',
            hint: 'YYYY-MM-DD',
          ),
          const SizedBox(height: 10),
          _statusDropdown(
            value: _allocationStatus,
            options: _hostelAllocationStatuses,
            onChanged: (value) =>
                setState(() => _allocationStatus = value ?? 'Active'),
          ),
        ];
      case 'records':
        return [
          _textField(_recordTypeController, 'Record Type *'),
          const SizedBox(height: 10),
          _textField(_titleController, 'Title *'),
          const SizedBox(height: 10),
          _dropdown(
            label: 'Linked Room',
            value:
                widget.rooms.any(
                  (room) =>
                      readText(room, const ['id'], fallback: '') == _roomId,
                )
                ? _roomId
                : '',
            items: [
              const DropdownMenuItem(value: '', child: Text('No linked room')),
              ...widget.rooms.map(
                (room) => DropdownMenuItem(
                  value: readText(room, const ['id'], fallback: ''),
                  child: Text(
                    '${readText(room, const ['hostelName'], fallback: 'Hostel')} / ${readText(room, const ['roomNo', 'roomNumber'], fallback: 'Room')}',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
            onChanged: _saving ? null : (value) => _selectRoom(value ?? ''),
          ),
          const SizedBox(height: 10),
          _textField(_recordDateController, 'Record Date', hint: 'YYYY-MM-DD'),
          const SizedBox(height: 10),
          _textField(_hostelNameController, 'Hostel Name'),
          const SizedBox(height: 10),
          _textField(_roomNoController, 'Room Number'),
          const SizedBox(height: 10),
          _statusDropdown(
            value: _recordStatus,
            options: _hostelRecordStatuses,
            onChanged: (value) =>
                setState(() => _recordStatus = value ?? 'Open'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _notesController,
            enabled: !_saving,
            minLines: 3,
            maxLines: 5,
            decoration: const InputDecoration(labelText: 'Notes'),
          ),
        ];
      default:
        return [
          _textField(_roomNoController, 'Room Number *'),
          const SizedBox(height: 10),
          _textField(_hostelNameController, 'Hostel Name *'),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _textField(_blockNameController, 'Block')),
              const SizedBox(width: 10),
              Expanded(child: _textField(_floorController, 'Floor')),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _textField(
                  _capacityController,
                  'Capacity *',
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _textField(
                  _occupiedController,
                  'Occupied Count',
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _textField(_wardenController, 'Warden Name'),
          const SizedBox(height: 10),
          _statusDropdown(
            value: _roomStatus,
            options: _hostelRoomStatuses,
            onChanged: (value) =>
                setState(() => _roomStatus = value ?? 'Available'),
          ),
        ];
    }
  }

  Widget _textField(
    TextEditingController controller,
    String label, {
    String? hint,
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: controller,
      enabled: !_saving,
      keyboardType: keyboardType,
      decoration: InputDecoration(labelText: label, hintText: hint),
    );
  }

  Widget _statusDropdown({
    required String value,
    required List<String> options,
    required ValueChanged<String?> onChanged,
  }) {
    return _dropdown(
      label: 'Status',
      value: value,
      items: options
          .map((item) => DropdownMenuItem(value: item, child: Text(item)))
          .toList(),
      onChanged: _saving ? null : onChanged,
    );
  }

  Widget _dropdown({
    required String label,
    required String value,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?>? onChanged,
  }) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      decoration: InputDecoration(labelText: label),
      isExpanded: true,
      items: items,
      onChanged: onChanged,
    );
  }
}

List<(String, String)> _hostelDetailFields(
  String tab,
  Map<String, dynamic> item,
) {
  if (tab == 'allocations') {
    return [
      ('Student', readText(item, const ['studentName'], fallback: '-')),
      ('Student ID', readText(item, const ['studentId'], fallback: '-')),
      ('Course', readText(item, const ['courseName'], fallback: '-')),
      (
        'Room',
        '${readText(item, const ['hostelName'], fallback: '-')} / ${readText(item, const ['roomNo'], fallback: '-')}',
      ),
      ('Allocated On', readText(item, const ['allocatedOn'], fallback: '-')),
      (
        'Guardian Phone',
        readText(item, const ['guardianPhone'], fallback: '-'),
      ),
    ];
  }
  if (tab == 'records') {
    return [
      ('Title', readText(item, const ['title'], fallback: '-')),
      ('Record Type', readText(item, const ['recordType'], fallback: '-')),
      (
        'Room',
        '${readText(item, const ['hostelName'], fallback: '-')} ${readText(item, const ['roomNo'], fallback: '')}'
            .trim(),
      ),
      ('Record Date', readText(item, const ['recordDate'], fallback: '-')),
      ('Notes', readText(item, const ['notes'], fallback: '-')),
    ];
  }
  return [
    (
      'Room',
      '${readText(item, const ['hostelName'], fallback: '-')} / ${readText(item, const ['roomNo', 'roomNumber'], fallback: '-')}',
    ),
    ('Block', readText(item, const ['blockName', 'block'], fallback: '-')),
    ('Floor', readText(item, const ['floor'], fallback: '-')),
    ('Capacity', readNumber(item, const ['capacity']).round().toString()),
    ('Occupied', readNumber(item, const ['occupiedCount']).round().toString()),
    ('Warden', readText(item, const ['wardenName'], fallback: '-')),
  ];
}

String _hostelDateLabel(Map<String, dynamic> item, List<String> keys) {
  final explicit = readText(item, keys, fallback: '');
  if (explicit.isNotEmpty) return explicit;
  final date = readDate(item['createdAt'] ?? item['updatedAt']);
  return date == null ? '-' : DateFormat('dd MMM yyyy').format(date);
}

Color _hostelStatusColor(String status) {
  switch (status) {
    case 'Active':
    case 'Available':
    case 'Closed':
      return AppColors.accent;
    case 'Full':
    case 'Open':
      return AppColors.warning;
    case 'Maintenance':
    case 'Released':
      return AppColors.primary;
    case 'Archived':
      return AppColors.danger;
    default:
      return AppColors.primaryDark;
  }
}

const _documentOwnerTypes = ['Student', 'Staff', 'Other'];

const _documentTypes = [
  'Aadhaar',
  'PAN Card',
  'Marks Card',
  'Transfer Certificate',
  'Other',
];

const _documentCategories = [
  'Identity',
  'Admission',
  'Academic',
  'Finance',
  'Other',
];

const _documentStatuses = [
  'Pending Review',
  'Verified',
  'Rejected',
  'Archived',
];

class _DocumentSummary {
  const _DocumentSummary({
    this.total = 0,
    this.verified = 0,
    this.pending = 0,
    this.rejected = 0,
    this.archived = 0,
  });

  final int total;
  final int verified;
  final int pending;
  final int rejected;
  final int archived;
}

class _DocumentFilterPanel extends StatelessWidget {
  const _DocumentFilterPanel({
    required this.ownerTypeFilter,
    required this.categoryFilter,
    required this.statusFilter,
    required this.hideOwnerFilter,
    required this.onOwnerTypeChanged,
    required this.onCategoryChanged,
    required this.onStatusChanged,
  });

  final String ownerTypeFilter;
  final String categoryFilter;
  final String statusFilter;
  final bool hideOwnerFilter;
  final ValueChanged<String> onOwnerTypeChanged;
  final ValueChanged<String> onCategoryChanged;
  final ValueChanged<String> onStatusChanged;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          if (hideOwnerFilter)
            const Row(
              children: [
                Expanded(
                  child: LabelValue(
                    label: 'Owner Type',
                    value: 'Scoped to your account',
                  ),
                ),
                Icon(Icons.lock_rounded, size: 18, color: AppColors.muted),
              ],
            )
          else
            _DocumentDropdown(
              value: ownerTypeFilter,
              label: 'Owner Type',
              allLabel: 'All Owners',
              options: _documentOwnerTypes,
              onChanged: onOwnerTypeChanged,
            ),
          const SizedBox(height: 10),
          _DocumentDropdown(
            value: categoryFilter,
            label: 'Category',
            allLabel: 'All Categories',
            options: _documentCategories,
            onChanged: onCategoryChanged,
          ),
          const SizedBox(height: 10),
          _DocumentDropdown(
            value: statusFilter,
            label: 'Status',
            allLabel: 'All Statuses',
            options: _documentStatuses,
            onChanged: onStatusChanged,
          ),
        ],
      ),
    );
  }
}

class _DocumentDropdown extends StatelessWidget {
  const _DocumentDropdown({
    required this.value,
    required this.label,
    required this.allLabel,
    required this.options,
    required this.onChanged,
  });

  final String value;
  final String label;
  final String allLabel;
  final List<String> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonHideUnderline(
      child: DropdownButton<String>(
        value: options.contains(value) ? value : '',
        isExpanded: true,
        icon: const Icon(Icons.keyboard_arrow_down_rounded),
        items: [
          DropdownMenuItem(value: '', child: Text(allLabel)),
          ...options.map(
            (item) => DropdownMenuItem(value: item, child: Text(item)),
          ),
        ],
        onChanged: (next) => onChanged(next ?? ''),
        hint: Text(label),
      ),
    );
  }
}

enum _DocumentAction { open, verify, reject, archive }

class _DocumentCard extends StatelessWidget {
  const _DocumentCard({
    required this.document,
    required this.selected,
    required this.showActions,
    required this.canVerify,
    required this.canArchive,
    required this.onTap,
    required this.onOpen,
    required this.onVerify,
    required this.onArchive,
  });

  final Map<String, dynamic> document;
  final bool selected;
  final bool showActions;
  final bool canVerify;
  final bool canArchive;
  final VoidCallback onTap;
  final VoidCallback onOpen;
  final ValueChanged<String> onVerify;
  final VoidCallback onArchive;

  @override
  Widget build(BuildContext context) {
    final status = _documentDisplayStatus(document);
    final hasFile = _documentFileUrl(document).isNotEmpty;
    final owner = readText(document, const ['ownerName'], fallback: 'Owner');
    final ownerId = readText(document, const [
      'ownerId',
      'studentId',
      'employeeId',
    ], fallback: '');
    return InfoCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 4,
                height: 82,
                decoration: BoxDecoration(
                  color: selected
                      ? AppColors.accent
                      : _documentStatusColor(status),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            readText(document, const [
                              'title',
                              'documentType',
                              'fileName',
                            ], fallback: 'Document'),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                        ),
                        const SizedBox(width: 8),
                        StatusPill(label: status),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      [
                        readText(document, const [
                          'ownerType',
                        ], fallback: 'Owner'),
                        owner,
                        ownerId,
                      ].where((value) => value.isNotEmpty).join(' | '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        _DocumentChip(
                          label: readText(document, const [
                            'category',
                          ], fallback: 'Other'),
                        ),
                        _DocumentChip(label: _documentDateLabel(document)),
                        _DocumentChip(
                          label: hasFile
                              ? _formatDocumentFileSize(
                                  readNumber(document, const [
                                    'fileSize',
                                  ], fallback: 0),
                                )
                              : 'Metadata only',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              PopupMenuButton<_DocumentAction>(
                tooltip: 'Actions',
                onSelected: (action) {
                  switch (action) {
                    case _DocumentAction.open:
                      onOpen();
                      break;
                    case _DocumentAction.verify:
                      onVerify('Verified');
                      break;
                    case _DocumentAction.reject:
                      onVerify('Rejected');
                      break;
                    case _DocumentAction.archive:
                      onArchive();
                      break;
                  }
                },
                itemBuilder: (context) => [
                  PopupMenuItem(
                    value: _DocumentAction.open,
                    enabled: hasFile,
                    child: const ListTile(
                      leading: Icon(Icons.open_in_new_rounded),
                      title: Text('Open file'),
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                  if (showActions) ...[
                    PopupMenuItem(
                      value: _DocumentAction.verify,
                      enabled:
                          canVerify &&
                          status != 'Verified' &&
                          status != 'Archived',
                      child: const ListTile(
                        leading: Icon(Icons.verified_rounded),
                        title: Text('Verify'),
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                    PopupMenuItem(
                      value: _DocumentAction.reject,
                      enabled:
                          canVerify &&
                          status != 'Rejected' &&
                          status != 'Archived',
                      child: const ListTile(
                        leading: Icon(Icons.block_rounded),
                        title: Text('Reject'),
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                    PopupMenuItem(
                      value: _DocumentAction.archive,
                      enabled: canArchive && status != 'Archived',
                      child: const ListTile(
                        leading: Icon(Icons.archive_rounded),
                        title: Text('Archive'),
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
          if (selected) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: hasFile ? onOpen : null,
                  icon: const Icon(Icons.open_in_new_rounded, size: 18),
                  label: const Text('Open'),
                ),
                if (showActions) ...[
                  ElevatedButton.icon(
                    onPressed: canVerify && status != 'Verified'
                        ? () => onVerify('Verified')
                        : null,
                    icon: const Icon(Icons.verified_rounded, size: 18),
                    label: const Text('Verify'),
                  ),
                  OutlinedButton.icon(
                    onPressed: canVerify && status != 'Rejected'
                        ? () => onVerify('Rejected')
                        : null,
                    icon: const Icon(Icons.block_rounded, size: 18),
                    label: const Text('Reject'),
                  ),
                  OutlinedButton.icon(
                    onPressed: canArchive && status != 'Archived'
                        ? onArchive
                        : null,
                    icon: const Icon(Icons.archive_rounded, size: 18),
                    label: const Text('Archive'),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _DocumentPreviewCard extends StatelessWidget {
  const _DocumentPreviewCard({
    required this.document,
    required this.showActions,
    required this.canVerify,
    required this.canArchive,
    required this.onOpen,
    required this.onVerify,
    required this.onArchive,
  });

  final Map<String, dynamic>? document;
  final bool showActions;
  final bool canVerify;
  final bool canArchive;
  final VoidCallback? onOpen;
  final ValueChanged<String>? onVerify;
  final VoidCallback? onArchive;

  @override
  Widget build(BuildContext context) {
    final item = document;
    if (item == null) {
      return const EmptyState(
        title: 'No document selected',
        message: 'Choose a document to inspect its metadata and actions.',
      );
    }
    final status = _documentDisplayStatus(item);
    final hasFile = _documentFileUrl(item).isNotEmpty;
    final notes = readText(item, const ['notes', 'note', 'tags'], fallback: '');
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 46,
                width: 46,
                decoration: BoxDecoration(
                  color: _documentStatusColor(status).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.description_rounded,
                  color: _documentStatusColor(status),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      readText(item, const [
                        'title',
                        'documentType',
                        'fileName',
                      ], fallback: 'Document'),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      readText(item, const [
                        'fileName',
                      ], fallback: hasFile ? 'Uploaded file' : 'Metadata only'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              StatusPill(label: status),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Owner',
                  value: readText(item, const ['ownerName'], fallback: '-'),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Owner Type',
                  value: readText(item, const ['ownerType'], fallback: '-'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Owner ID',
                  value: readText(item, const [
                    'ownerId',
                    'studentId',
                    'employeeId',
                  ], fallback: '-'),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Category',
                  value: readText(item, const ['category'], fallback: '-'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Type',
                  value: readText(item, const ['documentType'], fallback: '-'),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Uploaded',
                  value: _documentDateLabel(item),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Uploaded By',
                  value: readText(item, const [
                    'uploadedByName',
                    'createdByName',
                    'uploadedByEmail',
                    'createdBy',
                  ], fallback: '-'),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'File Size',
                  value: _formatDocumentFileSize(
                    readNumber(item, const ['fileSize'], fallback: 0),
                  ),
                ),
              ),
            ],
          ),
          if (notes.isNotEmpty) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.page,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                notes,
                style: const TextStyle(fontSize: 12, color: AppColors.ink),
              ),
            ),
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ElevatedButton.icon(
                onPressed: hasFile ? onOpen : null,
                icon: const Icon(Icons.open_in_new_rounded, size: 18),
                label: const Text('Open File'),
              ),
              if (showActions) ...[
                OutlinedButton.icon(
                  onPressed: canVerify && status != 'Verified'
                      ? () => onVerify?.call('Verified')
                      : null,
                  icon: const Icon(Icons.verified_rounded, size: 18),
                  label: const Text('Verify'),
                ),
                OutlinedButton.icon(
                  onPressed: canVerify && status != 'Rejected'
                      ? () => onVerify?.call('Rejected')
                      : null,
                  icon: const Icon(Icons.block_rounded, size: 18),
                  label: const Text('Reject'),
                ),
                OutlinedButton.icon(
                  onPressed: canArchive && status != 'Archived'
                      ? onArchive
                      : null,
                  icon: const Icon(Icons.archive_rounded, size: 18),
                  label: const Text('Archive'),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _DocumentArchiveList extends StatelessWidget {
  const _DocumentArchiveList({required this.documents});

  final List<Map<String, dynamic>> documents;

  @override
  Widget build(BuildContext context) {
    if (documents.isEmpty) {
      return const EmptyState(
        title: 'No archived documents',
        message:
            'Verified archive records and archived files will appear here.',
      );
    }
    return Column(
      children: documents
          .map(
            (document) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: InfoCard(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Container(
                      height: 38,
                      width: 38,
                      decoration: BoxDecoration(
                        color: AppColors.primaryDark.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.inventory_2_rounded,
                        color: AppColors.primaryDark,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            readText(document, const [
                              'archiveTitle',
                              'title',
                              'documentType',
                            ], fallback: 'Archive record'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${readText(document, const ['category'], fallback: 'Other')} | ${_documentDateLabel(document)}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    StatusPill(label: _documentDisplayStatus(document)),
                  ],
                ),
              ),
            ),
          )
          .toList(),
    );
  }
}

class _DocumentChip extends StatelessWidget {
  const _DocumentChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.page,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label.isEmpty ? '-' : label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          color: AppColors.muted,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

String _documentFileUrl(Map<String, dynamic> document) {
  return readText(document, const [
    'downloadUrl',
    'fileUrl',
    'url',
  ], fallback: '');
}

String _documentDisplayStatus(Map<String, dynamic> document) {
  final status = readText(document, const [
    'verificationStatus',
    'documentStatus',
    'status',
  ], fallback: '');
  if (status.isEmpty || status == 'Uploaded') return 'Pending Review';
  return status;
}

Color _documentStatusColor(String status) {
  switch (status) {
    case 'Verified':
      return AppColors.accent;
    case 'Rejected':
      return AppColors.danger;
    case 'Archived':
      return AppColors.muted;
    case 'Pending Review':
      return AppColors.warning;
    default:
      return AppColors.primary;
  }
}

String _documentDateLabel(Map<String, dynamic> document) {
  final explicit = readText(document, const [
    'uploadedAtText',
    'createdAtText',
    'verifiedAtText',
    'archivedAtText',
  ], fallback: '');
  if (explicit.isNotEmpty) return explicit;
  final date = readDate(document['createdAt'] ?? document['uploadedAt']);
  return date == null ? '-' : DateFormat('dd MMM yyyy').format(date);
}

String _formatDocumentFileSize(num bytes) {
  if (bytes <= 0) return 'No file attached';
  if (bytes < 1024) return '${bytes.round()} B';
  if (bytes < 1024 * 1024) {
    return '${(bytes / 1024).toStringAsFixed(1)} KB';
  }
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

const _noticeTypes = [
  'Digital Notice',
  'Circular',
  'Event Announcement',
  'SMS/WhatsApp Alert',
  'Parent Communication',
];

const _noticeAudiences = [
  'All',
  'Students',
  'Faculty',
  'Parents',
  'Administration',
];

const _noticePriorities = ['Normal', 'Important', 'Urgent'];

const _noticeStatuses = [
  'Draft',
  'Published',
  'Scheduled',
  'Expired',
  'Archived',
];

class _CommunicationNoticeSummary {
  const _CommunicationNoticeSummary({
    this.total = 0,
    this.published = 0,
    this.drafts = 0,
    this.scheduled = 0,
    this.expired = 0,
    this.urgent = 0,
  });

  final int total;
  final int published;
  final int drafts;
  final int scheduled;
  final int expired;
  final int urgent;
}

class _CommunicationTaskOption {
  const _CommunicationTaskOption({
    required this.id,
    required this.title,
    required this.helper,
    required this.icon,
    required this.count,
  });

  final String id;
  final String title;
  final String helper;
  final IconData icon;
  final int count;
}

class _CommunicationTaskCard extends StatelessWidget {
  const _CommunicationTaskCard({
    required this.task,
    required this.selected,
    required this.onTap,
  });

  final _CommunicationTaskOption task;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            height: 48,
            width: 48,
            decoration: BoxDecoration(
              color: (selected ? AppColors.accent : AppColors.primary)
                  .withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              task.icon,
              color: selected ? AppColors.accent : AppColors.primaryDark,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        task.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    StatusPill(label: task.count.toString()),
                  ],
                ),
                const SizedBox(height: 5),
                Text(
                  task.helper,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
        ],
      ),
    );
  }
}

class _CommunicationFilterPanel extends StatelessWidget {
  const _CommunicationFilterPanel({
    required this.typeFilter,
    required this.audienceFilter,
    required this.statusFilter,
    required this.canManage,
    required this.isParentViewer,
    required this.onTypeChanged,
    required this.onAudienceChanged,
    required this.onStatusChanged,
  });

  final String typeFilter;
  final String audienceFilter;
  final String statusFilter;
  final bool canManage;
  final bool isParentViewer;
  final ValueChanged<String> onTypeChanged;
  final ValueChanged<String> onAudienceChanged;
  final ValueChanged<String> onStatusChanged;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          _CommunicationDropdown(
            value: typeFilter,
            label: 'Type',
            allLabel: 'All Types',
            options: _noticeTypes,
            onChanged: onTypeChanged,
          ),
          const SizedBox(height: 10),
          if (isParentViewer)
            const _CommunicationLockedFilter(
              label: 'Audience',
              value: 'Parents',
            )
          else
            _CommunicationDropdown(
              value: audienceFilter,
              label: 'Audience',
              allLabel: 'All Audiences',
              options: _noticeAudiences,
              onChanged: onAudienceChanged,
            ),
          if (canManage) ...[
            const SizedBox(height: 10),
            _CommunicationDropdown(
              value: statusFilter,
              label: 'Status',
              allLabel: 'All Statuses',
              options: _noticeStatuses,
              onChanged: onStatusChanged,
            ),
          ],
        ],
      ),
    );
  }
}

class _CommunicationDropdown extends StatelessWidget {
  const _CommunicationDropdown({
    required this.value,
    required this.label,
    required this.allLabel,
    required this.options,
    required this.onChanged,
  });

  final String value;
  final String label;
  final String allLabel;
  final List<String> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonHideUnderline(
      child: DropdownButton<String>(
        value: options.contains(value) ? value : '',
        isExpanded: true,
        icon: const Icon(Icons.keyboard_arrow_down_rounded),
        items: [
          DropdownMenuItem(value: '', child: Text(allLabel)),
          ...options.map(
            (item) => DropdownMenuItem(value: item, child: Text(item)),
          ),
        ],
        onChanged: (next) => onChanged(next ?? ''),
        hint: Text(label),
      ),
    );
  }
}

class _CommunicationLockedFilter extends StatelessWidget {
  const _CommunicationLockedFilter({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: LabelValue(label: label, value: value),
        ),
        const Icon(Icons.lock_rounded, size: 18, color: AppColors.muted),
      ],
    );
  }
}

enum _CommunicationNoticeAction { preview, edit, publish, archive }

class _CommunicationNoticeCard extends StatelessWidget {
  const _CommunicationNoticeCard({
    required this.notice,
    required this.selected,
    required this.showActions,
    required this.canEdit,
    required this.canArchive,
    required this.onTap,
    required this.onEdit,
    required this.onPublish,
    required this.onArchive,
  });

  final Map<String, dynamic> notice;
  final bool selected;
  final bool showActions;
  final bool canEdit;
  final bool canArchive;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onPublish;
  final VoidCallback onArchive;

  @override
  Widget build(BuildContext context) {
    final status = _communicationNoticeDisplayStatus(notice);
    return InfoCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 4,
                height: 74,
                decoration: BoxDecoration(
                  color: selected
                      ? AppColors.accent
                      : _noticePriorityColor(notice),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            readText(notice, const [
                              'title',
                              'subject',
                            ], fallback: 'Announcement'),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                        ),
                        const SizedBox(width: 8),
                        StatusPill(label: status),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '${readText(notice, const ['type'], fallback: 'Digital Notice')} | ${readText(notice, const ['audience'], fallback: 'All')}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      readText(notice, const [
                        'body',
                        'message',
                        'description',
                      ], fallback: ''),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${readText(notice, const ['referenceNo'], fallback: 'No reference')} | Publish ${_noticeDateLabel(notice['publishDate'])}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.accent,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              if (showActions)
                PopupMenuButton<_CommunicationNoticeAction>(
                  tooltip: 'Actions',
                  onSelected: (action) {
                    switch (action) {
                      case _CommunicationNoticeAction.preview:
                        onTap();
                        break;
                      case _CommunicationNoticeAction.edit:
                        onEdit();
                        break;
                      case _CommunicationNoticeAction.publish:
                        onPublish();
                        break;
                      case _CommunicationNoticeAction.archive:
                        onArchive();
                        break;
                    }
                  },
                  itemBuilder: (context) => [
                    const PopupMenuItem(
                      value: _CommunicationNoticeAction.preview,
                      child: ListTile(
                        leading: Icon(Icons.visibility_rounded),
                        title: Text('Preview'),
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                    PopupMenuItem(
                      value: _CommunicationNoticeAction.edit,
                      enabled: canEdit,
                      child: const ListTile(
                        leading: Icon(Icons.edit_rounded),
                        title: Text('Edit'),
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                    PopupMenuItem(
                      value: _CommunicationNoticeAction.publish,
                      enabled:
                          canEdit &&
                          readText(notice, const ['status'], fallback: '') ==
                              'Draft',
                      child: const ListTile(
                        leading: Icon(Icons.send_rounded),
                        title: Text('Publish'),
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                    PopupMenuItem(
                      value: _CommunicationNoticeAction.archive,
                      enabled: canArchive && status != 'Archived',
                      child: const ListTile(
                        leading: Icon(Icons.archive_rounded),
                        title: Text('Archive'),
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CommunicationPreviewCard extends StatelessWidget {
  const _CommunicationPreviewCard({
    required this.notice,
    required this.showActions,
    required this.canPublish,
    required this.onPublish,
  });

  final Map<String, dynamic>? notice;
  final bool showActions;
  final bool canPublish;
  final VoidCallback? onPublish;

  @override
  Widget build(BuildContext context) {
    final item = notice;
    if (item == null) {
      return const EmptyState(
        title: 'No preview',
        message: 'Choose an announcement to preview it.',
      );
    }
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Reference',
                  value: readText(item, const ['referenceNo'], fallback: '-'),
                ),
              ),
              StatusPill(label: _communicationNoticeDisplayStatus(item)),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.page,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${readText(item, const ['type'], fallback: 'Notice')} | ${readText(item, const ['audience'], fallback: 'All')}',
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  readText(item, const ['title', 'subject']),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  readText(item, const [
                    'body',
                    'message',
                    'description',
                  ], fallback: '-'),
                  style: const TextStyle(
                    color: AppColors.ink,
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Priority',
                  value: readText(item, const ['priority'], fallback: 'Normal'),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Created By',
                  value: readText(item, const [
                    'createdByName',
                    'createdBy',
                  ], fallback: '-'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Publish',
                  value: _noticeDateLabel(item['publishDate']),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Expiry',
                  value: _noticeDateLabel(item['expiryDate']),
                ),
              ),
            ],
          ),
          if (showActions) ...[
            const SizedBox(height: 14),
            ElevatedButton.icon(
              onPressed:
                  canPublish &&
                      readText(item, const ['status'], fallback: '') == 'Draft'
                  ? onPublish
                  : null,
              icon: const Icon(Icons.send_rounded, size: 18),
              label: const Text('Publish'),
            ),
          ],
        ],
      ),
    );
  }
}

Color _noticePriorityColor(Map<String, dynamic> notice) {
  final priority = readText(notice, const ['priority'], fallback: 'Normal');
  if (priority == 'Urgent') return AppColors.danger;
  if (priority == 'Important') return AppColors.warning;
  return AppColors.primary;
}

String _communicationNoticeDisplayStatus(Map<String, dynamic> notice) {
  final status = readText(notice, const ['status'], fallback: '');
  if (status == 'Archived') return 'Archived';
  if (status == 'Draft') return 'Draft';
  final expiry = readDate(notice['expiryDate']);
  if (expiry != null) {
    final expiresAt = DateTime(
      expiry.year,
      expiry.month,
      expiry.day,
      23,
      59,
      59,
    );
    if (expiresAt.isBefore(DateTime.now())) return 'Expired';
  }
  if (status == 'Published') {
    final publish = readDate(notice['publishDate']);
    if (publish == null) return 'Published';
    final publishAt = DateTime(publish.year, publish.month, publish.day);
    final now = DateTime.now();
    return publishAt.isAfter(DateTime(now.year, now.month, now.day))
        ? 'Scheduled'
        : 'Published';
  }
  return 'Scheduled';
}

String _noticeDateLabel(Object? value) {
  if (value == null) return '-';
  final date = readDate(value);
  if (date != null) return DateFormat('d MMM yyyy').format(date);
  final text = value.toString().trim();
  return text.isEmpty ? '-' : text;
}

String _noticeDateInputText(Object? value) {
  final date = readDate(value);
  if (date != null) return DateFormat('yyyy-MM-dd').format(date);
  final text = value?.toString().trim() ?? '';
  return text;
}

class _CommunicationNoticeFormSheet extends StatefulWidget {
  const _CommunicationNoticeFormSheet({
    required this.task,
    required this.academicYear,
    required this.onSave,
    this.notice,
  });

  final String task;
  final String academicYear;
  final Map<String, dynamic>? notice;
  final Future<void> Function(Map<String, dynamic> values) onSave;

  @override
  State<_CommunicationNoticeFormSheet> createState() =>
      _CommunicationNoticeFormSheetState();
}

class _CommunicationNoticeFormSheetState
    extends State<_CommunicationNoticeFormSheet> {
  late final TextEditingController _titleController;
  late final TextEditingController _referenceController;
  late final TextEditingController _bodyController;
  late final TextEditingController _publishDateController;
  late final TextEditingController _expiryDateController;
  late String _type;
  late String _audience;
  late String _priority;
  late String _status;
  var _saving = false;
  var _error = '';

  @override
  void initState() {
    super.initState();
    final notice = widget.notice ?? const <String, dynamic>{};
    _type = readText(
      notice,
      const ['type'],
      fallback: widget.task == 'alerts'
          ? 'SMS/WhatsApp Alert'
          : widget.task == 'parents'
          ? 'Parent Communication'
          : 'Digital Notice',
    );
    _audience = readText(notice, const [
      'audience',
    ], fallback: widget.task == 'parents' ? 'Parents' : 'All');
    _priority = readText(notice, const ['priority'], fallback: 'Normal');
    _status = readText(notice, const ['status'], fallback: 'Draft');
    _titleController = TextEditingController(
      text: readText(notice, const ['title'], fallback: ''),
    );
    _referenceController = TextEditingController(
      text: readText(notice, const ['referenceNo'], fallback: ''),
    );
    _bodyController = TextEditingController(
      text: readText(notice, const ['body', 'message'], fallback: ''),
    );
    _publishDateController = TextEditingController(
      text: _noticeDateInputText(
        notice['publishDate'] ?? DateTime.now().toIso8601String(),
      ),
    );
    _expiryDateController = TextEditingController(
      text: _noticeDateInputText(notice['expiryDate']),
    );
  }

  @override
  void dispose() {
    _titleController.dispose();
    _referenceController.dispose();
    _bodyController.dispose();
    _publishDateController.dispose();
    _expiryDateController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final title = _titleController.text.trim();
    final body = _bodyController.text.trim();
    final publishDate = _publishDateController.text.trim();
    final expiryDate = _expiryDateController.text.trim();
    if (title.isEmpty) {
      setState(() => _error = 'Title is required.');
      return;
    }
    if (!_noticeTypes.contains(_type)) {
      setState(() => _error = 'Notice type is required.');
      return;
    }
    if (!_noticeAudiences.contains(_audience)) {
      setState(() => _error = 'Audience is required.');
      return;
    }
    if (body.isEmpty) {
      setState(() => _error = 'Notice content is required.');
      return;
    }
    if (publishDate.isEmpty) {
      setState(() => _error = 'Publish date is required.');
      return;
    }
    final publishDateValue = DateTime.tryParse(publishDate);
    final expiryDateValue = DateTime.tryParse(expiryDate);
    if (publishDateValue == null) {
      setState(() => _error = 'Publish date must be YYYY-MM-DD.');
      return;
    }
    if (expiryDate.isNotEmpty && expiryDateValue == null) {
      setState(() => _error = 'Expiry date must be YYYY-MM-DD.');
      return;
    }
    if (expiryDateValue != null && expiryDateValue.isBefore(publishDateValue)) {
      setState(() => _error = 'Expiry date cannot be before publish date.');
      return;
    }
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await widget.onSave({
        'type': _type,
        'title': title,
        'referenceNo': _referenceController.text.trim(),
        'audience': _audience,
        'priority': _priority,
        'body': body,
        'publishDate': publishDate,
        'expiryDate': expiryDate,
        'status': _status,
        if (widget.academicYear.isNotEmpty) 'academicYear': widget.academicYear,
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _FeeSheetChrome(
      title: widget.notice == null
          ? 'Create Announcement'
          : 'Edit Announcement',
      helper: 'Publish announcements, circulars, and event communication.',
      saving: _saving,
      error: _error,
      saveLabel: widget.notice == null ? 'Create' : 'Save Changes',
      onSave: _save,
      children: [
        DropdownButtonFormField<String>(
          initialValue: _type,
          items: _noticeTypes
              .map((item) => DropdownMenuItem(value: item, child: Text(item)))
              .toList(),
          decoration: const InputDecoration(labelText: 'Type *'),
          onChanged: (value) => setState(() => _type = value ?? _type),
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          initialValue: _audience,
          items: _noticeAudiences
              .map((item) => DropdownMenuItem(value: item, child: Text(item)))
              .toList(),
          decoration: const InputDecoration(labelText: 'Audience *'),
          onChanged: (value) => setState(() => _audience = value ?? _audience),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _titleController,
          decoration: const InputDecoration(labelText: 'Title *'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _referenceController,
          decoration: const InputDecoration(labelText: 'Reference No.'),
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          initialValue: _priority,
          items: _noticePriorities
              .map((item) => DropdownMenuItem(value: item, child: Text(item)))
              .toList(),
          decoration: const InputDecoration(labelText: 'Priority'),
          onChanged: (value) => setState(() => _priority = value ?? _priority),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _publishDateController,
          keyboardType: TextInputType.datetime,
          decoration: const InputDecoration(
            labelText: 'Publish Date *',
            hintText: 'YYYY-MM-DD',
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _expiryDateController,
          keyboardType: TextInputType.datetime,
          decoration: const InputDecoration(
            labelText: 'Expiry Date',
            hintText: 'YYYY-MM-DD',
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _bodyController,
          maxLines: 5,
          decoration: const InputDecoration(labelText: 'Content *'),
        ),
      ],
    );
  }
}

class _FeeComponentField {
  const _FeeComponentField(this.key, this.label, this.shortLabel);

  final String key;
  final String label;
  final String shortLabel;
}

const _feeComponentFields = <_FeeComponentField>[
  _FeeComponentField('admissionFee', 'Admission Fee', 'Admission'),
  _FeeComponentField('applicationFee', 'Application Fee', 'Application'),
  _FeeComponentField('pocketArticleFee', 'Pocket Article Fee', 'Pocket'),
  _FeeComponentField('tuitionFee', 'Year Fee', 'Year Fee'),
  _FeeComponentField('libraryFee', 'Library Fee', 'Library'),
  _FeeComponentField('labFee', 'Lab Fee', 'Lab'),
  _FeeComponentField('transportFee', 'Transport Fee', 'Transport'),
];

class _FeeAssignmentSnapshot {
  const _FeeAssignmentSnapshot({
    required this.assignment,
    required this.title,
    required this.total,
    required this.paid,
    required this.adjusted,
    required this.due,
    required this.status,
    required this.dueBucket,
  });

  final Map<String, dynamic> assignment;
  final String title;
  final num total;
  final num paid;
  final num adjusted;
  final num due;
  final String status;
  final String dueBucket;

  String get id => readText(assignment, const ['id'], fallback: '');
}

class _FeeTaskOption {
  const _FeeTaskOption({
    required this.id,
    required this.title,
    required this.description,
    required this.icon,
    this.meta = const [],
    this.disabled = false,
  });

  final String id;
  final String title;
  final String description;
  final IconData icon;
  final List<String> meta;
  final bool disabled;
}

class _FeeBackButton extends StatelessWidget {
  const _FeeBackButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(top: 12, bottom: 6),
        child: TextButton.icon(
          onPressed: onPressed,
          icon: const Icon(Icons.arrow_back_rounded, size: 18),
          label: const Text('Back'),
        ),
      ),
    );
  }
}

class _FeeTaskCard extends StatelessWidget {
  const _FeeTaskCard({
    required this.option,
    required this.onTap,
    this.disabled = false,
  });

  final _FeeTaskOption option;
  final VoidCallback? onTap;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final card = InfoCard(
      onTap: disabled ? null : onTap,
      child: Row(
        children: [
          Container(
            height: 48,
            width: 48,
            decoration: BoxDecoration(
              color: AppColors.primaryDark.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(option.icon, color: AppColors.primaryDark),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  option.title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  disabled ? 'Not available right now.' : option.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
                if (option.meta.isNotEmpty) ...[
                  const SizedBox(height: 9),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: option.meta
                        .map(
                          (item) => Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.page,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              item,
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
        ],
      ),
    );
    return Opacity(opacity: disabled ? 0.55 : 1, child: card);
  }
}

class _FeeStructureCard extends StatelessWidget {
  const _FeeStructureCard({
    required this.structure,
    required this.canEdit,
    required this.canAssign,
    required this.onEdit,
    required this.onAssign,
  });

  final Map<String, dynamic> structure;
  final bool canEdit;
  final bool canAssign;
  final VoidCallback onEdit;
  final VoidCallback onAssign;

  @override
  Widget build(BuildContext context) {
    final visibleComponents = _feeComponentFields
        .where((field) => readNumber(structure, [field.key]) > 0)
        .toList();
    final total = readNumber(
      structure,
      const ['totalAmount', 'amount', 'feeAmount'],
      fallback: visibleComponents.fold<num>(
        0,
        (total, field) => total + readNumber(structure, [field.key]),
      ),
    );
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      readText(structure, const [
                        'name',
                      ], fallback: 'Fee Structure'),
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${readText(structure, const ['classKey'], fallback: 'Class')} | ${readText(structure, const ['academicYear'], fallback: 'Academic year')}',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              StatusPill(
                label: readText(structure, const [
                  'status',
                ], fallback: 'Active'),
              ),
            ],
          ),
          if (visibleComponents.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: visibleComponents
                  .map(
                    (field) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.page,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${field.shortLabel}: ${formatMoney(readNumber(structure, [field.key]))}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: LabelValue(label: 'Total', value: formatMoney(total)),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Due Date',
                  value: readText(structure, const ['dueDate'], fallback: '-'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: canAssign ? onAssign : null,
                  icon: const Icon(Icons.assignment_rounded, size: 18),
                  label: const Text('Assign'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: canEdit ? onEdit : null,
                  icon: const Icon(Icons.edit_rounded, size: 18),
                  label: const Text('Edit'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FeeAssignmentCard extends StatelessWidget {
  const _FeeAssignmentCard({
    required this.row,
    required this.selected,
    required this.onTap,
    this.onCollect,
    this.onAdjust,
    this.onNotify,
  });

  final _FeeAssignmentSnapshot row;
  final bool selected;
  final VoidCallback onTap;
  final VoidCallback? onCollect;
  final VoidCallback? onAdjust;
  final VoidCallback? onNotify;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      readText(row.assignment, const [
                        'studentName',
                        'studentId',
                      ], fallback: 'Student'),
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${row.title} | ${readText(row.assignment, const ['classKey'], fallback: 'Class')}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              StatusPill(label: row.status),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Total',
                  value: formatMoney(row.total),
                ),
              ),
              Expanded(
                child: LabelValue(label: 'Paid', value: formatMoney(row.paid)),
              ),
              Expanded(
                child: LabelValue(label: 'Due', value: formatMoney(row.due)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: LabelValue(label: 'Aging', value: row.dueBucket),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Due Date',
                  value: readText(row.assignment, const [
                    'dueDate',
                  ], fallback: '-'),
                ),
              ),
            ],
          ),
          if (selected ||
              onCollect != null ||
              onAdjust != null ||
              onNotify != null) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (onCollect != null)
                  ElevatedButton.icon(
                    onPressed: onCollect,
                    icon: const Icon(Icons.payments_rounded, size: 18),
                    label: const Text('Collect'),
                  ),
                if (onAdjust != null)
                  OutlinedButton.icon(
                    onPressed: onAdjust,
                    icon: const Icon(Icons.tune_rounded, size: 18),
                    label: const Text('Adjust'),
                  ),
                if (onNotify != null)
                  OutlinedButton.icon(
                    onPressed: onNotify,
                    icon: const Icon(Icons.message_rounded, size: 18),
                    label: const Text('Notify'),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _FeeAssignmentDetail extends StatelessWidget {
  const _FeeAssignmentDetail({required this.row});

  final _FeeAssignmentSnapshot row;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Student ID',
                  value: readText(row.assignment, const ['studentId']),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Academic Year',
                  value: readText(row.assignment, const ['academicYear']),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Assigned',
                  value: formatMoney(row.total),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Adjusted',
                  value: formatMoney(row.adjusted),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: LabelValue(label: 'Paid', value: formatMoney(row.paid)),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Outstanding',
                  value: formatMoney(row.due),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FeeCollectionCard extends StatelessWidget {
  const _FeeCollectionCard({
    required this.collection,
    required this.canEdit,
    required this.onEdit,
  });

  final Map<String, dynamic> collection;
  final bool canEdit;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  readText(collection, const ['studentName', 'studentId']),
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  '${readText(collection, const ['paymentMode'], fallback: 'Mode')} | ${readText(collection, const ['paymentDate', 'createdAtText'], fallback: '-')}',
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
                const SizedBox(height: 6),
                Text(
                  readText(collection, const [
                    'referenceNo',
                    'receiptNo',
                    'feeStructureName',
                  ], fallback: 'No reference'),
                  style: const TextStyle(color: AppColors.muted, fontSize: 11),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                formatMoney(
                  readNumber(collection, const ['amount', 'paidAmount']),
                ),
                style: const TextStyle(
                  color: AppColors.accent,
                  fontWeight: FontWeight.w900,
                ),
              ),
              if (canEdit) ...[
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_rounded, size: 16),
                  label: const Text('Edit'),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _FeeAdjustmentCard extends StatelessWidget {
  const _FeeAdjustmentCard({required this.adjustment});

  final Map<String, dynamic> adjustment;

  @override
  Widget build(BuildContext context) {
    return _CompactRow(
      title: readText(adjustment, const ['studentName', 'studentId']),
      subtitle: readText(adjustment, const ['reason'], fallback: 'Adjustment'),
      trailing: Text(
        formatMoney(
          readNumber(adjustment, const ['amount', 'adjustmentAmount']),
        ),
        style: const TextStyle(
          color: AppColors.primary,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _FeeStructureFormSheet extends StatefulWidget {
  const _FeeStructureFormSheet({
    required this.classOptions,
    required this.academicYear,
    required this.onSave,
    this.structure,
  });

  final List<String> classOptions;
  final String academicYear;
  final Map<String, dynamic>? structure;
  final Future<void> Function(Map<String, dynamic> values) onSave;

  @override
  State<_FeeStructureFormSheet> createState() => _FeeStructureFormSheetState();
}

class _FeeStructureFormSheetState extends State<_FeeStructureFormSheet> {
  late final TextEditingController _nameController;
  late final TextEditingController _classController;
  late final TextEditingController _academicYearController;
  late final TextEditingController _dueDateController;
  late final TextEditingController _noteController;
  late final Map<String, TextEditingController> _componentControllers;
  late String _classKey;
  late String _status;
  var _saving = false;
  var _error = '';

  @override
  void initState() {
    super.initState();
    final structure = widget.structure ?? const <String, dynamic>{};
    final initialClass = readText(structure, const ['classKey'], fallback: '');
    _classKey = initialClass.isNotEmpty
        ? initialClass
        : widget.classOptions.isEmpty
        ? ''
        : widget.classOptions.first;
    _status = readText(structure, const ['status'], fallback: 'Active');
    _nameController = TextEditingController(
      text: readText(structure, const ['name'], fallback: ''),
    );
    _classController = TextEditingController(text: _classKey);
    _academicYearController = TextEditingController(
      text: readText(structure, const [
        'academicYear',
      ], fallback: widget.academicYear),
    );
    _dueDateController = TextEditingController(
      text: readText(structure, const ['dueDate'], fallback: ''),
    );
    _noteController = TextEditingController(
      text: readText(structure, const ['extraChargesNote'], fallback: ''),
    );
    _componentControllers = {
      for (final field in _feeComponentFields)
        field.key: TextEditingController(
          text: _numberText(readNumber(structure, [field.key])),
        ),
    };
  }

  @override
  void dispose() {
    _nameController.dispose();
    _classController.dispose();
    _academicYearController.dispose();
    _dueDateController.dispose();
    _noteController.dispose();
    for (final controller in _componentControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  num get _totalAmount => _feeComponentFields.fold<num>(
    0,
    (total, field) =>
        total + (num.tryParse(_componentControllers[field.key]!.text) ?? 0),
  );

  String _numberText(num value) => value == 0 ? '' : value.toString();

  Future<void> _save() async {
    final name = _nameController.text.trim();
    final classKey = widget.classOptions.isEmpty
        ? _classController.text.trim()
        : _classKey.trim();
    final academicYear = _academicYearController.text.trim();
    final dueDate = _dueDateController.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Fee structure name is required.');
      return;
    }
    if (classKey.isEmpty) {
      setState(() => _error = 'Class is required.');
      return;
    }
    if (academicYear.isEmpty) {
      setState(() => _error = 'Academic year is required.');
      return;
    }
    if (_totalAmount <= 0) {
      setState(() => _error = 'Total amount must be greater than zero.');
      return;
    }
    if (dueDate.isEmpty) {
      setState(() => _error = 'Due date is required.');
      return;
    }
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await widget.onSave({
        'name': name,
        'classKey': classKey,
        'academicYear': academicYear,
        'dueDate': dueDate,
        'status': _status,
        'extraChargesNote': _noteController.text.trim(),
        for (final field in _feeComponentFields)
          field.key: num.tryParse(_componentControllers[field.key]!.text) ?? 0,
        'totalAmount': _totalAmount,
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final classOptions = <String>{
      if (_classKey.isNotEmpty) _classKey,
      ...widget.classOptions,
    }.toList();
    return _FeeSheetChrome(
      title: widget.structure == null
          ? 'Create Fee Structure'
          : 'Edit Fee Structure',
      helper: 'Define class-wise fee components and due date.',
      saving: _saving,
      error: _error,
      saveLabel: widget.structure == null ? 'Create Structure' : 'Save Changes',
      onSave: _save,
      children: [
        TextField(
          controller: _nameController,
          decoration: const InputDecoration(labelText: 'Structure Name *'),
        ),
        const SizedBox(height: 10),
        if (classOptions.isEmpty)
          TextField(
            controller: _classController,
            decoration: const InputDecoration(labelText: 'Class *'),
          )
        else
          DropdownButtonFormField<String>(
            initialValue: _classKey,
            items: classOptions
                .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                .toList(),
            decoration: const InputDecoration(labelText: 'Class *'),
            onChanged: (value) =>
                setState(() => _classKey = value ?? _classKey),
          ),
        const SizedBox(height: 10),
        TextField(
          controller: _academicYearController,
          decoration: const InputDecoration(labelText: 'Academic Year *'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _dueDateController,
          keyboardType: TextInputType.datetime,
          decoration: const InputDecoration(
            labelText: 'Due Date *',
            hintText: 'YYYY-MM-DD',
          ),
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          initialValue: _status,
          items: const ['Active', 'Inactive']
              .map((item) => DropdownMenuItem(value: item, child: Text(item)))
              .toList(),
          decoration: const InputDecoration(labelText: 'Status'),
          onChanged: (value) => setState(() => _status = value ?? _status),
        ),
        const SizedBox(height: 14),
        ..._feeComponentFields.map(
          (field) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: TextField(
              controller: _componentControllers[field.key],
              keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: field.label),
              onChanged: (_) => setState(() {}),
            ),
          ),
        ),
        InfoCard(
          padding: const EdgeInsets.all(12),
          child: LabelValue(
            label: 'Total Amount',
            value: formatMoney(_totalAmount),
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _noteController,
          maxLines: 2,
          decoration: const InputDecoration(labelText: 'Extra charges note'),
        ),
      ],
    );
  }
}

class _FeeAssignmentFormSheet extends StatefulWidget {
  const _FeeAssignmentFormSheet({
    required this.students,
    required this.structures,
    required this.classKeyForStudent,
    required this.onSave,
  });

  final List<Map<String, dynamic>> students;
  final List<Map<String, dynamic>> structures;
  final String Function(Map<String, dynamic> student) classKeyForStudent;
  final Future<int> Function(Map<String, dynamic> values) onSave;

  @override
  State<_FeeAssignmentFormSheet> createState() =>
      _FeeAssignmentFormSheetState();
}

class _FeeAssignmentFormSheetState extends State<_FeeAssignmentFormSheet> {
  late String _structureId;
  var _assignMode = 'class';
  var _studentRecordId = '';
  var _saving = false;
  var _error = '';

  @override
  void initState() {
    super.initState();
    _structureId = readText(widget.structures.first, const [
      'id',
    ], fallback: '');
    _studentRecordId = widget.students.isEmpty
        ? ''
        : readText(widget.students.first, const ['id'], fallback: '');
  }

  Map<String, dynamic> get _selectedStructure {
    for (final structure in widget.structures) {
      if (readText(structure, const ['id'], fallback: '') == _structureId) {
        return structure;
      }
    }
    return widget.structures.first;
  }

  List<Map<String, dynamic>> get _matchingStudents {
    if (_assignMode == 'student') return widget.students;
    final classKey = readText(_selectedStructure, const [
      'classKey',
    ], fallback: '');
    return widget.students
        .where((student) => widget.classKeyForStudent(student) == classKey)
        .toList();
  }

  Future<void> _save() async {
    if (_structureId.isEmpty) {
      setState(() => _error = 'Fee structure is required.');
      return;
    }
    if (_assignMode == 'student' && _studentRecordId.isEmpty) {
      setState(() => _error = 'Student is required.');
      return;
    }
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      final count = await widget.onSave({
        'feeStructureId': _structureId,
        'assignMode': _assignMode,
        'studentRecordId': _studentRecordId,
      });
      if (mounted) Navigator.of(context).pop(count);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final matchingStudents = _matchingStudents;
    final studentOptions = _assignMode == 'student'
        ? widget.students
        : matchingStudents;
    if (studentOptions.isNotEmpty &&
        !studentOptions.any(
          (student) =>
              readText(student, const ['id'], fallback: '') == _studentRecordId,
        )) {
      _studentRecordId = readText(studentOptions.first, const [
        'id',
      ], fallback: '');
    }
    return _FeeSheetChrome(
      title: 'Assign Fee',
      helper: 'Assign a structure to all matching students or one student.',
      saving: _saving,
      error: _error,
      saveLabel: 'Assign',
      onSave: _save,
      children: [
        DropdownButtonFormField<String>(
          initialValue: _structureId,
          items: widget.structures
              .map(
                (item) => DropdownMenuItem(
                  value: readText(item, const ['id'], fallback: ''),
                  child: Text(
                    '${readText(item, const ['name'])} - ${readText(item, const ['classKey'])}',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          decoration: const InputDecoration(labelText: 'Fee Structure *'),
          onChanged: (value) =>
              setState(() => _structureId = value ?? _structureId),
        ),
        const SizedBox(height: 10),
        _SegmentedFilter(
          value: _assignMode,
          options: const {'class': 'Class', 'student': 'Student'},
          onChanged: (value) => setState(() => _assignMode = value),
        ),
        const SizedBox(height: 10),
        if (_assignMode == 'student')
          DropdownButtonFormField<String>(
            initialValue: _studentRecordId,
            items: widget.students
                .map(
                  (student) => DropdownMenuItem(
                    value: readText(student, const ['id'], fallback: ''),
                    child: Text(
                      '${readText(student, const ['name', 'studentName'])} - ${readText(student, const ['studentId'])}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                )
                .toList(),
            decoration: const InputDecoration(labelText: 'Student *'),
            onChanged: (value) =>
                setState(() => _studentRecordId = value ?? _studentRecordId),
          )
        else
          InfoCard(
            padding: const EdgeInsets.all(12),
            child: LabelValue(
              label: 'Matching students',
              value:
                  '${matchingStudents.length} students in ${readText(_selectedStructure, const ['classKey'], fallback: 'selected class')}',
            ),
          ),
        const SizedBox(height: 10),
        InfoCard(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Total',
                  value: formatMoney(
                    readNumber(_selectedStructure, const ['totalAmount']),
                  ),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Due Date',
                  value: readText(_selectedStructure, const ['dueDate']),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _FeeCollectionFormSheet extends StatefulWidget {
  const _FeeCollectionFormSheet({
    required this.rows,
    required this.initialAssignmentId,
    required this.onSave,
    this.collection,
  });

  final List<_FeeAssignmentSnapshot> rows;
  final String initialAssignmentId;
  final Map<String, dynamic>? collection;
  final Future<void> Function(Map<String, dynamic> values) onSave;

  @override
  State<_FeeCollectionFormSheet> createState() =>
      _FeeCollectionFormSheetState();
}

class _FeeCollectionFormSheetState extends State<_FeeCollectionFormSheet> {
  late String _assignmentId;
  late final TextEditingController _amountController;
  late final TextEditingController _referenceController;
  late final TextEditingController _receiptController;
  late final TextEditingController _dateController;
  late final TextEditingController _collectedByController;
  var _paymentMode = 'Cash';
  var _saving = false;
  var _error = '';

  @override
  void initState() {
    super.initState();
    final collection = widget.collection;
    final initial = widget.initialAssignmentId.isNotEmpty
        ? widget.initialAssignmentId
        : collection == null
        ? ''
        : readText(collection, const ['assignmentId'], fallback: '');
    _assignmentId = widget.rows.any((row) => row.id == initial)
        ? initial
        : widget.rows.first.id;
    _amountController = TextEditingController(
      text: collection == null
          ? ''
          : _numberText(readNumber(collection, const ['amount', 'paidAmount'])),
    );
    _referenceController = TextEditingController(
      text: readText(collection ?? const <String, dynamic>{}, const [
        'referenceNo',
      ], fallback: ''),
    );
    _receiptController = TextEditingController(
      text: readText(collection ?? const <String, dynamic>{}, const [
        'receiptNo',
      ], fallback: ''),
    );
    _dateController = TextEditingController(
      text: readText(
        collection ?? const <String, dynamic>{},
        const ['paymentDate'],
        fallback: DateFormat('yyyy-MM-dd').format(DateTime.now()),
      ),
    );
    _collectedByController = TextEditingController(
      text: readText(collection ?? const <String, dynamic>{}, const [
        'collectedBy',
      ], fallback: 'Admin Office'),
    );
    _paymentMode = readText(collection ?? const <String, dynamic>{}, const [
      'paymentMode',
    ], fallback: 'Cash');
  }

  @override
  void dispose() {
    _amountController.dispose();
    _referenceController.dispose();
    _receiptController.dispose();
    _dateController.dispose();
    _collectedByController.dispose();
    super.dispose();
  }

  String _numberText(num value) => value == 0 ? '' : value.toString();

  _FeeAssignmentSnapshot get _selectedRow {
    for (final row in widget.rows) {
      if (row.id == _assignmentId) return row;
    }
    return widget.rows.first;
  }

  num get _oldAmount => widget.collection == null
      ? 0
      : readNumber(widget.collection!, const ['amount', 'paidAmount']);

  num get _amount => num.tryParse(_amountController.text.trim()) ?? 0;

  num get _dueBefore => _selectedRow.due + _oldAmount;

  num get _dueAfter {
    final next = _dueBefore - _amount;
    return next < 0 ? 0 : next;
  }

  Future<void> _save() async {
    if (_assignmentId.isEmpty) {
      setState(() => _error = 'Fee assignment is required.');
      return;
    }
    if (_amount <= 0) {
      setState(() => _error = 'Collection amount is required.');
      return;
    }
    if (_amount > _dueBefore) {
      setState(
        () => _error = 'Collection amount cannot exceed outstanding due.',
      );
      return;
    }
    if (_dateController.text.trim().isEmpty) {
      setState(() => _error = 'Payment date is required.');
      return;
    }
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await widget.onSave({
        'assignmentId': _assignmentId,
        'amount': _amount,
        'paymentMode': _paymentMode,
        'referenceNo': _referenceController.text.trim(),
        'receiptNo': _receiptController.text.trim(),
        'paymentDate': _dateController.text.trim(),
        'collectedBy': _collectedByController.text.trim(),
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _FeeSheetChrome(
      title: widget.collection == null
          ? 'Record Fee Collection'
          : 'Edit Fee Collection',
      helper: 'Post an offline payment against a student fee assignment.',
      saving: _saving,
      error: _error,
      saveLabel: widget.collection == null ? 'Post Collection' : 'Save Changes',
      onSave: _save,
      children: [
        DropdownButtonFormField<String>(
          initialValue: _assignmentId,
          items: widget.rows
              .map(
                (row) => DropdownMenuItem(
                  value: row.id,
                  child: Text(
                    '${readText(row.assignment, const ['studentName'])} - ${row.title}',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          decoration: const InputDecoration(labelText: 'Fee Assignment *'),
          onChanged: widget.collection == null
              ? (value) =>
                    setState(() => _assignmentId = value ?? _assignmentId)
              : null,
        ),
        const SizedBox(height: 10),
        InfoCard(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Due Before',
                  value: formatMoney(_dueBefore),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Due After',
                  value: formatMoney(_dueAfter),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _amountController,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Payment Amount *'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          initialValue: _paymentMode,
          items:
              const [
                    'Cash',
                    'Cheque',
                    'Bank Transfer',
                    'UPI Manual Entry',
                    'Card Swipe Offline',
                  ]
                  .map(
                    (item) => DropdownMenuItem(value: item, child: Text(item)),
                  )
                  .toList(),
          decoration: const InputDecoration(labelText: 'Payment Mode *'),
          onChanged: (value) =>
              setState(() => _paymentMode = value ?? _paymentMode),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _dateController,
          keyboardType: TextInputType.datetime,
          decoration: const InputDecoration(labelText: 'Payment Date *'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _referenceController,
          decoration: const InputDecoration(labelText: 'Reference No.'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _receiptController,
          decoration: const InputDecoration(labelText: 'Receipt No.'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _collectedByController,
          decoration: const InputDecoration(labelText: 'Collected By'),
        ),
      ],
    );
  }
}

class _FeeAdjustmentFormSheet extends StatefulWidget {
  const _FeeAdjustmentFormSheet({
    required this.rows,
    required this.initialAssignmentId,
    required this.onSave,
  });

  final List<_FeeAssignmentSnapshot> rows;
  final String initialAssignmentId;
  final Future<void> Function(Map<String, dynamic> values) onSave;

  @override
  State<_FeeAdjustmentFormSheet> createState() =>
      _FeeAdjustmentFormSheetState();
}

class _FeeAdjustmentFormSheetState extends State<_FeeAdjustmentFormSheet> {
  late String _assignmentId;
  late final TextEditingController _amountController;
  late final TextEditingController _reasonController;
  var _saving = false;
  var _error = '';

  @override
  void initState() {
    super.initState();
    _assignmentId =
        widget.rows.any((row) => row.id == widget.initialAssignmentId)
        ? widget.initialAssignmentId
        : widget.rows.first.id;
    _amountController = TextEditingController();
    _reasonController = TextEditingController();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  _FeeAssignmentSnapshot get _selectedRow {
    for (final row in widget.rows) {
      if (row.id == _assignmentId) return row;
    }
    return widget.rows.first;
  }

  num get _amount => num.tryParse(_amountController.text.trim()) ?? 0;

  Future<void> _save() async {
    if (_amount <= 0) {
      setState(() => _error = 'Adjustment amount is required.');
      return;
    }
    if (_amount > _selectedRow.due) {
      setState(
        () => _error = 'Adjustment amount cannot exceed outstanding due.',
      );
      return;
    }
    if (_reasonController.text.trim().isEmpty) {
      setState(() => _error = 'Adjustment reason is required.');
      return;
    }
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await widget.onSave({
        'assignmentId': _assignmentId,
        'amount': _amount,
        'reason': _reasonController.text.trim(),
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _FeeSheetChrome(
      title: 'Approve Adjustment',
      helper: 'Approve a waiver or correction against an outstanding fee.',
      saving: _saving,
      error: _error,
      saveLabel: 'Approve',
      onSave: _save,
      children: [
        DropdownButtonFormField<String>(
          initialValue: _assignmentId,
          items: widget.rows
              .map(
                (row) => DropdownMenuItem(
                  value: row.id,
                  child: Text(
                    '${readText(row.assignment, const ['studentName'])} - ${formatMoney(row.due)} due',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          decoration: const InputDecoration(labelText: 'Fee Assignment *'),
          onChanged: (value) =>
              setState(() => _assignmentId = value ?? _assignmentId),
        ),
        const SizedBox(height: 10),
        InfoCard(
          padding: const EdgeInsets.all(12),
          child: LabelValue(
            label: 'Outstanding Due',
            value: formatMoney(_selectedRow.due),
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _amountController,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Adjustment Amount *'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _reasonController,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Reason *'),
        ),
      ],
    );
  }
}

class _FeeSheetChrome extends StatelessWidget {
  const _FeeSheetChrome({
    required this.title,
    required this.helper,
    required this.children,
    required this.saving,
    required this.error,
    required this.saveLabel,
    required this.onSave,
  });

  final String title;
  final String helper;
  final List<Widget> children;
  final bool saving;
  final String error;
  final String saveLabel;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        18,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.line,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                helper,
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              const SizedBox(height: 14),
              ...children,
              if (error.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  error,
                  style: const TextStyle(
                    color: AppColors.danger,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: saving
                          ? null
                          : () => Navigator.of(context).pop(false),
                      icon: const Icon(Icons.close_rounded, size: 18),
                      label: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: saving ? null : onSave,
                      icon: Icon(
                        saving
                            ? Icons.hourglass_top_rounded
                            : Icons.save_rounded,
                        size: 18,
                      ),
                      label: Text(saving ? 'Saving...' : saveLabel),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FieldSpec {
  const _FieldSpec(
    this.key,
    this.label, {
    this.isRequired = false,
    this.numeric = false,
  });

  final String key;
  final String label;
  final bool isRequired;
  final bool numeric;
}

class _HealthNamedField {
  const _HealthNamedField(this.key, this.label);

  final String key;
  final String label;
}

const healthVaccineStatus = <_HealthNamedField>[
  _HealthNamedField('hepatitisA', 'Hepatitis A'),
  _HealthNamedField('hepatitisB', 'Hepatitis B'),
  _HealthNamedField('tt', 'T.T'),
  _HealthNamedField('varicella', 'Varicella'),
  _HealthNamedField('influenza', 'Influenza'),
  _HealthNamedField('pneumococcal', 'Pneumococcal'),
];

const _healthImmunizations = <List<String>>[
  ['BCG', 'Birth'],
  ['Hep B', 'Birth'],
  ['Polio', 'Birth'],
  ['DPT', '6 weeks'],
  ['Hib', '6 weeks'],
  ['PCV', '6 weeks'],
  ['Typhoid', '9 months'],
  ['MMR', '9 months'],
  ['Varicella', '1 years'],
  ['HepA', '1 years'],
  ['Tdap', '7 years'],
  ['HPV', '9 years'],
];

const _healthFamilyRelations = ['Father', 'Mother', 'Brothers', 'Sisters'];

const _healthMonths = [
  'October',
  'November',
  'December',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
];

const _healthYears = <_HealthNamedField>[
  _HealthNamedField('year1', '1st Year'),
  _HealthNamedField('year2', '2nd Year'),
  _HealthNamedField('year3', '3rd Year'),
  _HealthNamedField('year4', '4th Year'),
];

const _healthMedicalExamFindings = [
  'Height',
  'Weight',
  'Pulse',
  'Respiration',
  'BP',
  'Skin',
  'Hair',
  'Chest',
  'High Vision',
  'Ear',
  'Nose',
  'Mouth',
  'Neck & Throat',
  'Dental Examination',
  'Lung Examination',
  'Heart Examination',
  'Chest X-ray',
  'Neurological',
  'Extremities movement',
  'Abdomen Examination',
  'Hb',
  'ESR',
  'TLC',
  'DLC',
  'Urine',
  'Cholesterol',
  'Any other',
  "Physician's Signature & Date",
];

const healthRecordFieldSpecs = <_FieldSpec>[
  _FieldSpec('studentName', 'Name of the Student', isRequired: true),
  _FieldSpec('fatherName', "Father's Name"),
  _FieldSpec('academicYear', 'Academic Year', isRequired: true),
  _FieldSpec('rollNo', 'Roll No'),
  _FieldSpec('courseYear', 'Course & Year'),
  _FieldSpec('dateOfBirth', 'Date of Birth'),
  _FieldSpec('age', 'Age', numeric: true),
  _FieldSpec('gender', 'Gender'),
  _FieldSpec('dateOfAdmission', 'Date of Admission'),
  _FieldSpec('dateOfCompletion', 'Date of Completion'),
  _FieldSpec('permanentAddress', 'Permanent Address'),
  _FieldSpec('emergencyContact', 'Emergency Contact'),
  _FieldSpec('emergencyPhone', 'Emergency Phone No'),
  _FieldSpec('medicalConditions', 'Medical Conditions (comma separated)'),
  _FieldSpec('conditionExplanation', 'Condition explanation'),
  _FieldSpec(
    'seriousIllnessInjurySurgery',
    'Serious illness, injury or surgery',
  ),
  _FieldSpec('currentMedications', 'Current medications'),
  _FieldSpec('confinementTreatment', 'Bed confinement / treatment'),
  _FieldSpec('bloodGroupType', 'Blood group & type'),
  _FieldSpec('physicalAbnormalities', 'Physical abnormalities or defect'),
  _FieldSpec('allergies', 'Allergies'),
  _FieldSpec('allergyMedicines', 'Medicine for allergies'),
  _FieldSpec('menstrualHistory', 'Menstrual history'),
  _FieldSpec('ageOfMenarche', 'Age of Menarche'),
  _FieldSpec('cycleDuration', 'Cycle Duration'),
  _FieldSpec('frequency', 'Frequency'),
  _FieldSpec('painOrDiscomfort', 'Pain or Discomfort'),
  _FieldSpec('sleepSchedule', 'Schedule of sleep'),
  _FieldSpec('sleepNormal', 'Normal sleep'),
  _FieldSpec('sleepDisturbed', 'Disturbed sleep'),
  _FieldSpec('sleepDisturbanceDetails', 'Sleep disturbance details'),
  _FieldSpec('hepatitisA', 'Last vaccinated for Hepatitis A'),
  _FieldSpec('hepatitisB', 'Last vaccinated for Hepatitis B'),
  _FieldSpec('tt', 'Last vaccinated for T.T'),
  _FieldSpec('varicella', 'Last vaccinated for Varicella'),
  _FieldSpec('influenza', 'Last vaccinated for Influenza'),
  _FieldSpec('pneumococcal', 'Last vaccinated for Pneumococcal'),
  _FieldSpec('finalRemarks', 'Final Remarks and Recommendations'),
  _FieldSpec('semester1And2', '1st & 2nd Semester Coordinator'),
  _FieldSpec('semester3And4', '3rd & 4th Semester Coordinator'),
  _FieldSpec('semester5And6', '5th & 6th Semester Coordinator'),
  _FieldSpec('semester7And8', '7th & 8th Semester Coordinator'),
  _FieldSpec('principal', 'Principal'),
  _FieldSpec('sicknessDate', 'Sickness date'),
  _FieldSpec('sicknessDiagnosis', 'Sickness diagnosis'),
  _FieldSpec('sicknessTreatment', 'Sickness treatment'),
  _FieldSpec('sicknessInvestigation', 'Sickness investigation'),
  _FieldSpec('sicknessDays', 'No. of Sick Days', numeric: true),
  _FieldSpec('sicknessSignature', 'Sickness signature'),
];

Map<String, dynamic> _asMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, value) => MapEntry(key.toString(), value));
  }
  return <String, dynamic>{};
}

List<Map<String, dynamic>> _asMapList(Object? value) {
  if (value is Iterable) {
    return value.map(_asMap).where((item) => item.isNotEmpty).toList();
  }
  return <Map<String, dynamic>>[];
}

List<Map<String, dynamic>> _mergeRowLists(
  List<Map<String, dynamic>> base,
  List<Map<String, dynamic>> existing,
) {
  final length = base.length > existing.length ? base.length : existing.length;
  return List.generate(length, (index) {
    return {
      if (index < base.length) ...base[index],
      if (index < existing.length) ...existing[index],
    };
  });
}

List<String> _csvToList(String value) => value
    .split(',')
    .map((item) => item.trim())
    .where((item) => item.isNotEmpty)
    .toList();

String _listToCsv(Object? value) {
  if (value is Iterable) return value.map((item) => item.toString()).join(', ');
  return value?.toString() ?? '';
}

Map<String, dynamic> _emptyHealthRecord(
  Map<String, dynamic> student,
  String academicYear,
) {
  Map<String, dynamic> yearCells() => {
    for (final year in _healthYears) year.key: {'wt': '', 'bp': '', 'lmp': ''},
  };
  Map<String, dynamic> textYearCells() => {
    for (final year in _healthYears) year.key: '',
  };

  return {
    'identification': {
      'studentName': readText(student, const ['name'], fallback: ''),
      'fatherName': readText(student, const [
        'fatherName',
        'guardianName',
      ], fallback: ''),
      'academicYear': academicYear.isNotEmpty
          ? academicYear
          : readText(student, const ['academicYear'], fallback: ''),
      'rollNo': readText(student, const ['rollNo', 'studentId'], fallback: ''),
      'courseYear': readText(student, const [
        'courseYear',
        'className',
      ], fallback: ''),
      'dateOfBirth': readText(student, const [
        'dateOfBirth',
        'dob',
      ], fallback: ''),
      'age': readText(student, const ['age'], fallback: ''),
      'gender': readText(student, const ['gender'], fallback: ''),
      'dateOfAdmission': readText(student, const [
        'admissionDate',
      ], fallback: ''),
      'dateOfCompletion': '',
      'permanentAddress': readText(student, const ['address'], fallback: ''),
      'emergencyContact': readText(student, const [
        'guardianName',
        'fatherName',
      ], fallback: ''),
      'emergencyPhone': readText(student, const [
        'phone',
        'mobileNo',
      ], fallback: ''),
    },
    'personalHistory': {
      'medicalConditions': <String>[],
      'conditionExplanation': '',
      'seriousIllnessInjurySurgery': '',
      'currentMedications': '',
      'confinementTreatment': '',
      'bloodGroupType': readText(student, const ['bloodGroup'], fallback: ''),
      'physicalAbnormalities': '',
      'allergies': '',
      'allergyMedicines': '',
      'menstrualHistory': '',
      'ageOfMenarche': '',
      'cycleDuration': '',
      'frequency': '',
      'painOrDiscomfort': '',
      'vaccinations': {for (final item in healthVaccineStatus) item.key: ''},
      'sleepSchedule': '',
      'sleepNormal': '',
      'sleepDisturbed': '',
      'sleepDisturbanceDetails': '',
    },
    'immunizations': _healthImmunizations
        .map(
          (item) => {
            'vaccine': item[0],
            'minimumAge': item[1],
            'ageReceived': '',
            'notReceived': false,
            'remarks': '',
          },
        )
        .toList(),
    'familyHistory': _healthFamilyRelations
        .map(
          (relation) => {
            'relation': relation,
            'ageIfLiving': '',
            'disease': '',
            'ageAtDeath': '',
            'causeOfDeath': '',
            'remarks': '',
          },
        )
        .toList(),
    'finalRemarks': '',
    'coordinatorSignatures': {
      'semester1And2': '',
      'semester3And4': '',
      'semester5And6': '',
      'semester7And8': '',
      'principal': '',
    },
    'sicknessDetails': [
      {
        'date': '',
        'diagnosis': '',
        'treatment': '',
        'investigation': '',
        'sickDays': '',
        'signature': '',
      },
    ],
    'monthlyRecords': _healthMonths
        .map((month) => {'month': month, ...yearCells()})
        .toList(),
    'medicalExaminations': _healthMedicalExamFindings
        .map((finding) => {'finding': finding, ...textYearCells()})
        .toList(),
  };
}

Map<String, dynamic> healthRecordFormValues({
  required Map<String, dynamic> student,
  required Map<String, dynamic>? record,
  required String academicYear,
}) {
  final base = _emptyHealthRecord(student, academicYear);
  final identification = {
    ..._asMap(base['identification']),
    ..._asMap(record?['identification']),
  };
  final personalHistory = {
    ..._asMap(base['personalHistory']),
    ..._asMap(record?['personalHistory']),
  };
  final vaccinations = {
    ..._asMap(_asMap(base['personalHistory'])['vaccinations']),
    ..._asMap(personalHistory['vaccinations']),
  };
  final signatures = {
    ..._asMap(base['coordinatorSignatures']),
    ..._asMap(record?['coordinatorSignatures']),
  };
  final sickness =
      record?['sicknessDetails'] is List &&
          (record?['sicknessDetails'] as List).isNotEmpty
      ? _asMap((record?['sicknessDetails'] as List).first)
      : _asMap((_asMap(base)['sicknessDetails'] as List).first);

  return {
    for (final key in [
      'studentName',
      'fatherName',
      'academicYear',
      'rollNo',
      'courseYear',
      'dateOfBirth',
      'age',
      'gender',
      'dateOfAdmission',
      'dateOfCompletion',
      'permanentAddress',
      'emergencyContact',
      'emergencyPhone',
    ])
      key: identification[key] ?? '',
    'medicalConditions': _listToCsv(personalHistory['medicalConditions']),
    for (final key in [
      'conditionExplanation',
      'seriousIllnessInjurySurgery',
      'currentMedications',
      'confinementTreatment',
      'bloodGroupType',
      'physicalAbnormalities',
      'allergies',
      'allergyMedicines',
      'menstrualHistory',
      'ageOfMenarche',
      'cycleDuration',
      'frequency',
      'painOrDiscomfort',
      'sleepSchedule',
      'sleepNormal',
      'sleepDisturbed',
      'sleepDisturbanceDetails',
    ])
      key: personalHistory[key] ?? '',
    for (final field in healthVaccineStatus)
      field.key: vaccinations[field.key] ?? '',
    'finalRemarks': record?['finalRemarks'] ?? '',
    for (final key in [
      'semester1And2',
      'semester3And4',
      'semester5And6',
      'semester7And8',
      'principal',
    ])
      key: signatures[key] ?? '',
    'sicknessDate': sickness['date'] ?? '',
    'sicknessDiagnosis': sickness['diagnosis'] ?? '',
    'sicknessTreatment': sickness['treatment'] ?? '',
    'sicknessInvestigation': sickness['investigation'] ?? '',
    'sicknessDays': sickness['sickDays'] ?? '',
    'sicknessSignature': sickness['signature'] ?? '',
  };
}

Map<String, dynamic> healthRecordPayloadFromForm({
  required Map<String, dynamic> values,
  required Map<String, dynamic> student,
  required Map<String, dynamic>? existingRecord,
  required String academicYear,
  required String savedAtText,
  required String userName,
}) {
  final base = _emptyHealthRecord(student, academicYear);
  final existing = {...?existingRecord}..remove('id');
  final identification = {
    ..._asMap(base['identification']),
    ..._asMap(existingRecord?['identification']),
    for (final key in [
      'studentName',
      'fatherName',
      'academicYear',
      'rollNo',
      'courseYear',
      'dateOfBirth',
      'age',
      'gender',
      'dateOfAdmission',
      'dateOfCompletion',
      'permanentAddress',
      'emergencyContact',
      'emergencyPhone',
    ])
      key: values[key] ?? '',
  };
  final personalHistory = {
    ..._asMap(base['personalHistory']),
    ..._asMap(existingRecord?['personalHistory']),
    for (final key in [
      'conditionExplanation',
      'seriousIllnessInjurySurgery',
      'currentMedications',
      'confinementTreatment',
      'bloodGroupType',
      'physicalAbnormalities',
      'allergies',
      'allergyMedicines',
      'menstrualHistory',
      'ageOfMenarche',
      'cycleDuration',
      'frequency',
      'painOrDiscomfort',
      'sleepSchedule',
      'sleepNormal',
      'sleepDisturbed',
      'sleepDisturbanceDetails',
    ])
      key: values[key] ?? '',
    'medicalConditions': _csvToList(
      (values['medicalConditions'] ?? '').toString(),
    ),
    'vaccinations': {
      ..._asMap(_asMap(base['personalHistory'])['vaccinations']),
      ..._asMap(_asMap(existingRecord?['personalHistory'])['vaccinations']),
      for (final field in healthVaccineStatus)
        field.key: values[field.key] ?? '',
    },
  };
  final sicknessDetails = [
    {
      'date': values['sicknessDate'] ?? '',
      'diagnosis': values['sicknessDiagnosis'] ?? '',
      'treatment': values['sicknessTreatment'] ?? '',
      'investigation': values['sicknessInvestigation'] ?? '',
      'sickDays': values['sicknessDays'] ?? '',
      'signature': values['sicknessSignature'] ?? '',
    },
  ];
  final recordAcademicYear = (identification['academicYear'] ?? '').toString();

  return {
    ...base,
    ...existing,
    'identification': identification,
    'personalHistory': personalHistory,
    'finalRemarks': values['finalRemarks'] ?? '',
    'coordinatorSignatures': {
      'semester1And2': values['semester1And2'] ?? '',
      'semester3And4': values['semester3And4'] ?? '',
      'semester5And6': values['semester5And6'] ?? '',
      'semester7And8': values['semester7And8'] ?? '',
      'principal': values['principal'] ?? '',
    },
    'sicknessDetails': sicknessDetails,
    'studentRecordId': readText(student, const ['id'], fallback: ''),
    'studentId': readText(student, const ['studentId'], fallback: ''),
    'studentName': readText(student, const ['name'], fallback: ''),
    'academicYear': recordAcademicYear,
    'courseCode': readText(student, const ['courseCode'], fallback: ''),
    'courseName': readText(student, const [
      'courseName',
      'program',
    ], fallback: ''),
    'bloodGroup': personalHistory['bloodGroupType'],
    'allergies': personalHistory['allergies'],
    'notes': values['finalRemarks'] ?? '',
    'updatedBy': userName.isEmpty ? 'Admin' : userName,
    'updatedAtText': savedAtText,
    if (existingRecord == null)
      'uploadedBy': userName.isEmpty ? 'Admin' : userName,
    if (existingRecord == null) 'uploadedAtText': savedAtText,
  };
}

class _HealthRecordFormSheet extends StatefulWidget {
  const _HealthRecordFormSheet({
    required this.title,
    required this.helper,
    required this.saveLabel,
    required this.student,
    required this.existingRecord,
    required this.academicYear,
    required this.savedAtText,
    required this.userName,
    required this.onSave,
  });

  final String title;
  final String helper;
  final String saveLabel;
  final Map<String, dynamic> student;
  final Map<String, dynamic>? existingRecord;
  final String academicYear;
  final String savedAtText;
  final String userName;
  final Future<void> Function(Map<String, dynamic> payload) onSave;

  @override
  State<_HealthRecordFormSheet> createState() => _HealthRecordFormSheetState();
}

class _HealthRecordFormSheetState extends State<_HealthRecordFormSheet> {
  static const _identificationKeys = [
    'studentName',
    'fatherName',
    'academicYear',
    'rollNo',
    'courseYear',
    'dateOfBirth',
    'age',
    'gender',
    'dateOfAdmission',
    'dateOfCompletion',
    'permanentAddress',
    'emergencyContact',
    'emergencyPhone',
  ];
  static const _personalHistoryKeys = [
    'medicalConditions',
    'conditionExplanation',
    'seriousIllnessInjurySurgery',
    'currentMedications',
    'confinementTreatment',
    'bloodGroupType',
    'physicalAbnormalities',
    'allergies',
    'allergyMedicines',
    'menstrualHistory',
    'ageOfMenarche',
    'cycleDuration',
    'frequency',
    'painOrDiscomfort',
    'sleepSchedule',
    'sleepNormal',
    'sleepDisturbed',
    'sleepDisturbanceDetails',
  ];
  static const _signatureKeys = [
    'semester1And2',
    'semester3And4',
    'semester5And6',
    'semester7And8',
    'principal',
  ];

  late final Map<String, TextEditingController> _controllers;
  late List<Map<String, dynamic>> _immunizations;
  late List<Map<String, dynamic>> _familyHistory;
  late List<Map<String, dynamic>> _sicknessDetails;
  late List<Map<String, dynamic>> _monthlyRecords;
  late List<Map<String, dynamic>> _medicalExaminations;
  var _saving = false;
  var _error = '';

  @override
  void initState() {
    super.initState();
    final initialValues = healthRecordFormValues(
      student: widget.student,
      record: widget.existingRecord,
      academicYear: widget.academicYear,
    );
    _controllers = {
      for (final field in healthRecordFieldSpecs)
        field.key: TextEditingController(
          text: (initialValues[field.key] ?? '').toString(),
        ),
    };
    final base = _emptyHealthRecord(widget.student, widget.academicYear);
    _immunizations = _mergeRowLists(
      _asMapList(base['immunizations']),
      _asMapList(widget.existingRecord?['immunizations']),
    );
    _familyHistory = _mergeRowLists(
      _asMapList(base['familyHistory']),
      _asMapList(widget.existingRecord?['familyHistory']),
    );
    final existingSickness = _asMapList(
      widget.existingRecord?['sicknessDetails'],
    );
    _sicknessDetails = existingSickness.isEmpty
        ? _asMapList(base['sicknessDetails'])
        : existingSickness;
    _monthlyRecords = _mergeRowLists(
      _asMapList(base['monthlyRecords']),
      _asMapList(widget.existingRecord?['monthlyRecords']),
    );
    _medicalExaminations = _mergeRowLists(
      _asMapList(base['medicalExaminations']),
      _asMapList(widget.existingRecord?['medicalExaminations']),
    );
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final values = <String, dynamic>{};
    for (final field in healthRecordFieldSpecs) {
      final text = _controllers[field.key]?.text.trim() ?? '';
      if (field.isRequired && text.isEmpty) {
        setState(() => _error = '${field.label} is required.');
        return;
      }
      values[field.key] = field.numeric ? (num.tryParse(text) ?? text) : text;
    }

    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      final payload = healthRecordPayloadFromForm(
        values: values,
        student: widget.student,
        existingRecord: widget.existingRecord,
        academicYear: widget.academicYear,
        savedAtText: widget.savedAtText,
        userName: widget.userName,
      );
      payload['immunizations'] = _immunizations;
      payload['familyHistory'] = _familyHistory;
      payload['sicknessDetails'] = _sicknessDetails;
      payload['monthlyRecords'] = _monthlyRecords;
      payload['medicalExaminations'] = _medicalExaminations;
      await widget.onSave(payload);
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  List<_FieldSpec> _fieldsFor(List<String> keys) => [
    for (final key in keys)
      healthRecordFieldSpecs.firstWhere((field) => field.key == key),
  ];

  Widget _field(_FieldSpec field) {
    final multiline = const {
      'permanentAddress',
      'medicalConditions',
      'conditionExplanation',
      'seriousIllnessInjurySurgery',
      'currentMedications',
      'confinementTreatment',
      'physicalAbnormalities',
      'allergies',
      'allergyMedicines',
      'menstrualHistory',
      'sleepDisturbanceDetails',
      'finalRemarks',
    }.contains(field.key);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: _controllers[field.key],
        minLines: multiline ? 2 : 1,
        maxLines: multiline ? 4 : 1,
        decoration: InputDecoration(
          labelText: field.isRequired ? '${field.label} *' : field.label,
        ),
      ),
    );
  }

  Widget _mapField(
    Map<String, dynamic> row,
    String key,
    String label, {
    int maxLines = 1,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TextFormField(
        initialValue: (row[key] ?? '').toString(),
        maxLines: maxLines,
        decoration: InputDecoration(labelText: label),
        onChanged: (value) => row[key] = value.trim(),
      ),
    );
  }

  Widget _yearCellField(
    Map<String, dynamic> row,
    String yearKey,
    String cellKey,
    String label,
  ) {
    final cells = _asMap(row[yearKey]);
    row[yearKey] = cells;
    return Expanded(
      child: TextFormField(
        initialValue: (cells[cellKey] ?? '').toString(),
        decoration: InputDecoration(labelText: label),
        onChanged: (value) => cells[cellKey] = value.trim(),
      ),
    );
  }

  Widget _section({
    required String title,
    required List<Widget> children,
    String helper = '',
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InfoCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
            ),
            if (helper.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                helper,
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
            ],
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _immunizationEditor() {
    return _section(
      title: 'Immunization History',
      helper: 'Every vaccine row from the website health-record table.',
      children: _immunizations.map((row) {
        return ExpansionTile(
          tilePadding: EdgeInsets.zero,
          title: Text(readText(row, const ['vaccine'], fallback: 'Vaccine')),
          subtitle: Text(
            'Minimum age: ${readText(row, const ['minimumAge'], fallback: '-')}',
          ),
          children: [
            _mapField(row, 'ageReceived', 'Age received'),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: row['notReceived'] == true,
              onChanged: (value) {
                setState(() => row['notReceived'] = value ?? false);
              },
              title: const Text('Not received'),
            ),
            _mapField(row, 'remarks', 'Remarks', maxLines: 2),
          ],
        );
      }).toList(),
    );
  }

  Widget _familyHistoryEditor() {
    return _section(
      title: 'Family History',
      children: _familyHistory.map((row) {
        return ExpansionTile(
          tilePadding: EdgeInsets.zero,
          title: Text(readText(row, const ['relation'], fallback: 'Relation')),
          children: [
            _mapField(row, 'ageIfLiving', 'Age if living'),
            _mapField(row, 'disease', 'Disease if any'),
            _mapField(row, 'ageAtDeath', 'Age at death'),
            _mapField(row, 'causeOfDeath', 'Cause of death'),
            _mapField(row, 'remarks', 'Remarks', maxLines: 2),
          ],
        );
      }).toList(),
    );
  }

  Widget _sicknessEditor() {
    return _section(
      title: 'Sickness Details',
      helper: 'Add as many sickness rows as needed.',
      children: [
        ...List.generate(_sicknessDetails.length, (index) {
          final row = _sicknessDetails[index];
          return ExpansionTile(
            tilePadding: EdgeInsets.zero,
            initiallyExpanded: index == 0,
            title: Text('Sickness row ${index + 1}'),
            subtitle: Text(readText(row, const ['date'], fallback: 'No date')),
            children: [
              _mapField(row, 'date', 'Date'),
              _mapField(row, 'diagnosis', 'Diagnosis'),
              _mapField(row, 'treatment', 'Treatment'),
              _mapField(row, 'investigation', 'Investigation if any'),
              _mapField(row, 'sickDays', 'No. of Sick Days'),
              _mapField(row, 'signature', 'Signature'),
              if (_sicknessDetails.length > 1)
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () {
                      setState(() => _sicknessDetails.removeAt(index));
                    },
                    icon: const Icon(Icons.delete_rounded, size: 18),
                    label: const Text('Remove Row'),
                  ),
                ),
            ],
          );
        }),
        Align(
          alignment: Alignment.centerLeft,
          child: OutlinedButton.icon(
            onPressed: () {
              setState(() {
                _sicknessDetails.add({
                  'date': '',
                  'diagnosis': '',
                  'treatment': '',
                  'investigation': '',
                  'sickDays': '',
                  'signature': '',
                });
              });
            },
            icon: const Icon(Icons.add_rounded, size: 18),
            label: const Text('Add Sickness Row'),
          ),
        ),
      ],
    );
  }

  Widget _monthlyRecordEditor() {
    return _section(
      title: 'Monthly Record',
      helper: 'WT, BP, and LMP for each month and year.',
      children: _monthlyRecords.map((row) {
        return ExpansionTile(
          tilePadding: EdgeInsets.zero,
          title: Text(readText(row, const ['month'], fallback: 'Month')),
          children: _healthYears.map((year) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    year.label,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _yearCellField(row, year.key, 'wt', 'WT'),
                      const SizedBox(width: 8),
                      _yearCellField(row, year.key, 'bp', 'BP'),
                      const SizedBox(width: 8),
                      _yearCellField(row, year.key, 'lmp', 'LMP'),
                    ],
                  ),
                ],
              ),
            );
          }).toList(),
        );
      }).toList(),
    );
  }

  Widget _medicalExamEditor() {
    return _section(
      title: 'Medical Examination - Investigation',
      children: _medicalExaminations.map((row) {
        return ExpansionTile(
          tilePadding: EdgeInsets.zero,
          title: Text(readText(row, const ['finding'], fallback: 'Finding')),
          children: _healthYears.map((year) {
            return _mapField(row, year.key, year.label);
          }).toList(),
        );
      }).toList(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        18,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.line,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                widget.title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                widget.helper,
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              const SizedBox(height: 14),
              _section(
                title: 'Identification Data',
                children: _fieldsFor(_identificationKeys).map(_field).toList(),
              ),
              _section(
                title: 'Personal History',
                helper: 'Use comma-separated values for medical conditions.',
                children: _fieldsFor(_personalHistoryKeys).map(_field).toList(),
              ),
              _section(
                title: 'Vaccination Status',
                children: healthVaccineStatus
                    .map(
                      (field) => _field(
                        healthRecordFieldSpecs.firstWhere(
                          (spec) => spec.key == field.key,
                        ),
                      ),
                    )
                    .toList(),
              ),
              _immunizationEditor(),
              _familyHistoryEditor(),
              _sicknessEditor(),
              _monthlyRecordEditor(),
              _medicalExamEditor(),
              _section(
                title: 'Final Remarks and Recommendations',
                children: [
                  _field(
                    healthRecordFieldSpecs.firstWhere(
                      (field) => field.key == 'finalRemarks',
                    ),
                  ),
                  ..._fieldsFor(_signatureKeys).map(_field),
                ],
              ),
              if (_error.isNotEmpty) ...[
                Text(
                  _error,
                  style: const TextStyle(
                    color: AppColors.danger,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
              ],
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _saving
                          ? null
                          : () => Navigator.of(context).pop(false),
                      icon: const Icon(Icons.close_rounded, size: 18),
                      label: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: Icon(
                        _saving
                            ? Icons.hourglass_top_rounded
                            : Icons.save_rounded,
                        size: 18,
                      ),
                      label: Text(_saving ? 'Saving...' : widget.saveLabel),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DocumentUploadSheet extends StatefulWidget {
  const _DocumentUploadSheet({
    required this.students,
    required this.staff,
    required this.onSave,
  });

  final List<Map<String, dynamic>> students;
  final List<Map<String, dynamic>> staff;
  final Future<void> Function({
    required Uint8List? bytes,
    required String fileName,
    required Map<String, dynamic> metadata,
  })
  onSave;

  @override
  State<_DocumentUploadSheet> createState() => _DocumentUploadSheetState();
}

class _DocumentUploadSheetState extends State<_DocumentUploadSheet> {
  static const _maxUploadBytes = 10 * 1024 * 1024;
  static const _allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
  final _ownerNameController = TextEditingController();
  final _noteController = TextEditingController();
  final _notesController = TextEditingController();
  var _ownerType = 'Student';
  var _ownerRecordId = '';
  var _documentType = '';
  var _category = 'Identity';
  XFile? _file;
  var _fileSize = 0;
  var _saving = false;
  var _error = '';

  @override
  void dispose() {
    _ownerNameController.dispose();
    _noteController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _ownerOptions {
    if (_ownerType == 'Student') return widget.students;
    if (_ownerType == 'Staff') return widget.staff;
    return const [];
  }

  bool get _needsKnownOwner => _ownerType == 'Student' || _ownerType == 'Staff';

  Future<void> _pickFile() async {
    final picked = await openFile(
      acceptedTypeGroups: const [
        XTypeGroup(label: 'Documents', extensions: _allowedExtensions),
      ],
    );
    if (picked == null) return;
    final size = await picked.length();
    if (size > _maxUploadBytes) {
      setState(() => _error = 'Document uploads must be 10 MB or smaller.');
      return;
    }
    final extension = picked.name.split('.').last.toLowerCase();
    if (!_allowedExtensions.contains(extension)) {
      setState(
        () =>
            _error = 'Only PDF, JPEG, PNG, and WebP documents can be uploaded.',
      );
      return;
    }
    setState(() {
      _file = picked;
      _fileSize = size;
      _error = '';
    });
  }

  Future<void> _save() async {
    if (!_documentOwnerTypes.contains(_ownerType)) {
      setState(() => _error = 'Owner type is required.');
      return;
    }
    if (_needsKnownOwner && _ownerRecordId.isEmpty) {
      setState(() => _error = 'Name is required.');
      return;
    }
    if (_ownerType == 'Other' && _ownerNameController.text.trim().isEmpty) {
      setState(() => _error = 'Name is required.');
      return;
    }
    if (_documentType.trim().isEmpty) {
      setState(() => _error = 'Document type is required.');
      return;
    }
    if (_documentType == 'Other' && _noteController.text.trim().isEmpty) {
      setState(() => _error = 'Note is required when document type is Other.');
      return;
    }
    if (!_documentCategories.contains(_category)) {
      setState(() => _error = 'Category is required.');
      return;
    }

    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      final file = _file;
      Uint8List? bytes;
      var fileName = '';
      if (file != null) {
        bytes = await file.readAsBytes();
        if (bytes.isEmpty) {
          setState(() => _error = 'The selected file is empty.');
          return;
        }
        fileName = file.name;
      }
      final owner = _selectedOwner();
      final ownerId = _ownerType == 'Student'
          ? readText(owner ?? const {}, const [
              'studentId',
              'admissionNo',
            ], fallback: '')
          : _ownerType == 'Staff'
          ? readText(owner ?? const {}, const ['employeeId'], fallback: '')
          : 'OTHER-${DateTime.now().millisecondsSinceEpoch}';
      final ownerName = _ownerType == 'Other'
          ? _ownerNameController.text.trim()
          : readText(owner ?? const {}, const [
              'name',
              'studentName',
            ], fallback: '');
      await widget.onSave(
        bytes: bytes,
        fileName: fileName,
        metadata: {
          'title': _documentType.trim(),
          'ownerType': _ownerType,
          'ownerRecordId': _ownerType == 'Other' ? '' : _ownerRecordId,
          'ownerId': ownerId,
          'ownerName': ownerName,
          'archiveTitle': _ownerType == 'Other' ? ownerName : '',
          'documentType': _documentType.trim(),
          'note': _noteController.text.trim(),
          'category': _category,
          'notes': _notesController.text.trim(),
          'tags': _notesController.text.trim(),
          'courseCode': readText(owner ?? const {}, const [
            'courseCode',
          ], fallback: ''),
          'courseName': readText(owner ?? const {}, const [
            'courseName',
            'program',
          ], fallback: ''),
          'verificationStatus': 'Pending Review',
          'verifiedAtText': '',
        },
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Map<String, dynamic>? _selectedOwner() {
    for (final owner in _ownerOptions) {
      if (readText(owner, const ['id'], fallback: '') == _ownerRecordId) {
        return owner;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final file = _file;
    final ownerOptions = _ownerOptions;
    final ownerRecordValue =
        ownerOptions.any(
          (owner) =>
              readText(owner, const ['id'], fallback: '') == _ownerRecordId,
        )
        ? _ownerRecordId
        : '';
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        18,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.line,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Upload Document',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 6),
              const Text(
                'Store student, staff, and academic archive documents.',
                style: TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: _saving ? null : _pickFile,
                icon: const Icon(Icons.attach_file_rounded, size: 18),
                label: Text(
                  file == null ? 'Choose file (optional)' : file.name,
                ),
              ),
              if (file != null) ...[
                const SizedBox(height: 8),
                Text(
                  _formatDocumentFileSize(_fileSize),
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _ownerType,
                decoration: const InputDecoration(labelText: 'Owner Type *'),
                items: _documentOwnerTypes
                    .map(
                      (item) =>
                          DropdownMenuItem(value: item, child: Text(item)),
                    )
                    .toList(),
                onChanged: _saving
                    ? null
                    : (value) => setState(() {
                        _ownerType = value ?? 'Student';
                        _ownerRecordId = '';
                        _ownerNameController.clear();
                      }),
              ),
              const SizedBox(height: 10),
              if (_needsKnownOwner)
                DropdownButtonFormField<String>(
                  initialValue: ownerRecordValue,
                  decoration: InputDecoration(
                    labelText: ownerOptions.isEmpty
                        ? 'No owners available'
                        : 'Name *',
                  ),
                  items: [
                    const DropdownMenuItem(
                      value: '',
                      child: Text('Select owner'),
                    ),
                    ...ownerOptions.map(
                      (owner) => DropdownMenuItem(
                        value: readText(owner, const ['id'], fallback: ''),
                        child: Text(
                          [
                            readText(owner, const [
                              'name',
                              'studentName',
                            ], fallback: ''),
                            readText(owner, const [
                              'studentId',
                              'employeeId',
                              'admissionNo',
                            ], fallback: ''),
                          ].where((value) => value.isNotEmpty).join(' - '),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ],
                  onChanged: _saving || ownerOptions.isEmpty
                      ? null
                      : (value) => setState(() => _ownerRecordId = value ?? ''),
                )
              else
                TextField(
                  controller: _ownerNameController,
                  enabled: !_saving,
                  decoration: const InputDecoration(labelText: 'Name *'),
                ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: _documentType,
                decoration: const InputDecoration(labelText: 'Document Type *'),
                items: [
                  const DropdownMenuItem(
                    value: '',
                    child: Text('Select document type'),
                  ),
                  ..._documentTypes.map(
                    (item) => DropdownMenuItem(value: item, child: Text(item)),
                  ),
                ],
                onChanged: _saving
                    ? null
                    : (value) => setState(() {
                        _documentType = value ?? '';
                        if (_documentType != 'Other') _noteController.clear();
                      }),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: _category,
                decoration: const InputDecoration(labelText: 'Category *'),
                items: _documentCategories
                    .map(
                      (item) =>
                          DropdownMenuItem(value: item, child: Text(item)),
                    )
                    .toList(),
                onChanged: _saving
                    ? null
                    : (value) =>
                          setState(() => _category = value ?? 'Identity'),
              ),
              if (_documentType == 'Other') ...[
                const SizedBox(height: 10),
                TextField(
                  controller: _noteController,
                  enabled: !_saving,
                  decoration: const InputDecoration(labelText: 'Note *'),
                ),
              ],
              const SizedBox(height: 10),
              TextField(
                controller: _notesController,
                enabled: !_saving,
                decoration: const InputDecoration(labelText: 'Notes'),
              ),
              if (_error.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  _error,
                  style: const TextStyle(
                    color: AppColors.danger,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _saving
                          ? null
                          : () => Navigator.of(context).pop(false),
                      icon: const Icon(Icons.close_rounded, size: 18),
                      label: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: Icon(
                        _saving
                            ? Icons.cloud_upload_rounded
                            : Icons.upload_file_rounded,
                        size: 18,
                      ),
                      label: Text(_saving ? 'Saving...' : 'Save Document'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RecordFormSheet extends StatefulWidget {
  const _RecordFormSheet({
    required this.title,
    required this.fields,
    required this.onSave,
    this.helper = '',
    this.initialValues = const {},
    this.saveLabel = 'Save',
  });

  final String title;
  final String helper;
  final List<_FieldSpec> fields;
  final Map<String, dynamic> initialValues;
  final String saveLabel;
  final Future<void> Function(Map<String, dynamic> values) onSave;

  @override
  State<_RecordFormSheet> createState() => _RecordFormSheetState();
}

class _RecordFormSheetState extends State<_RecordFormSheet> {
  late final Map<String, TextEditingController> _controllers;
  var _saving = false;
  var _error = '';

  @override
  void initState() {
    super.initState();
    _controllers = {
      for (final field in widget.fields)
        field.key: TextEditingController(
          text: (widget.initialValues[field.key] ?? '').toString(),
        ),
    };
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final values = <String, dynamic>{};
    for (final field in widget.fields) {
      final text = _controllers[field.key]?.text.trim() ?? '';
      if (field.isRequired && text.isEmpty) {
        setState(() => _error = '${field.label} is required.');
        return;
      }
      if (text.isEmpty && !widget.initialValues.containsKey(field.key)) {
        continue;
      }
      values[field.key] = field.numeric ? (num.tryParse(text) ?? text) : text;
    }

    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await widget.onSave(values);
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) {
        setState(() => _error = error.toString());
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        18,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.line,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                widget.title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              if (widget.helper.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  widget.helper,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
              const SizedBox(height: 14),
              ...widget.fields.map(
                (field) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: TextField(
                    controller: _controllers[field.key],
                    keyboardType: field.numeric
                        ? TextInputType.number
                        : TextInputType.text,
                    textInputAction: TextInputAction.next,
                    decoration: InputDecoration(
                      labelText: field.isRequired
                          ? '${field.label} *'
                          : field.label,
                    ),
                  ),
                ),
              ),
              if (_error.isNotEmpty) ...[
                Text(
                  _error,
                  style: const TextStyle(
                    color: AppColors.danger,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
              ],
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _saving
                          ? null
                          : () => Navigator.of(context).pop(false),
                      icon: const Icon(Icons.close_rounded, size: 18),
                      label: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: Icon(
                        _saving
                            ? Icons.hourglass_top_rounded
                            : Icons.save_rounded,
                        size: 18,
                      ),
                      label: Text(_saving ? 'Saving...' : widget.saveLabel),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UserRoleUserSheet extends StatefulWidget {
  const _UserRoleUserSheet({
    required this.roles,
    required this.students,
    required this.onSave,
    this.initialUser,
  });

  final Map<String, dynamic>? initialUser;
  final List<ErpRole> roles;
  final List<Map<String, dynamic>> students;
  final Future<void> Function(Map<String, dynamic> values) onSave;

  @override
  State<_UserRoleUserSheet> createState() => _UserRoleUserSheetState();
}

class _UserRoleUserSheetState extends State<_UserRoleUserSheet> {
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  late final TextEditingController _passwordController;
  late String _roleId;
  late String _status;
  late final Set<String> _linkedStudentRecordIds;
  var _saving = false;
  var _error = '';

  bool get _editing => widget.initialUser != null;

  @override
  void initState() {
    super.initState();
    final user = widget.initialUser ?? const <String, dynamic>{};
    _nameController = TextEditingController(
      text: readText(user, const ['name'], fallback: ''),
    );
    _emailController = TextEditingController(
      text: readText(user, const ['email'], fallback: ''),
    );
    _passwordController = TextEditingController();
    _roleId = readText(user, const [
      'roleId',
    ], fallback: widget.roles.isEmpty ? '' : widget.roles.first.id);
    _status = readText(user, const ['status'], fallback: 'Active');
    _linkedStudentRecordIds = _initialLinkedStudentRecordIds(user);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Set<String> _initialLinkedStudentRecordIds(Map<String, dynamic> user) {
    final recordIds = <String>{..._stringList(user['linkedStudentRecordIds'])};
    final studentIds = _stringList(user['linkedStudentIds']).toSet();
    for (final student in widget.students) {
      final studentId = readText(student, const ['studentId'], fallback: '');
      final recordId = readText(student, const ['id'], fallback: '');
      if (studentIds.contains(studentId) && recordId.isNotEmpty) {
        recordIds.add(recordId);
      }
    }
    return recordIds;
  }

  List<String> _stringList(Object? value) {
    if (value is Iterable) {
      return value
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList();
    }
    return const [];
  }

  void _toggleStudent(String recordId) {
    setState(() {
      if (_linkedStudentRecordIds.contains(recordId)) {
        _linkedStudentRecordIds.remove(recordId);
      } else {
        _linkedStudentRecordIds.add(recordId);
      }
    });
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      final linkedStudents = widget.students.where((student) {
        final id = readText(student, const ['id'], fallback: '');
        return _linkedStudentRecordIds.contains(id);
      }).toList();
      await widget.onSave({
        'name': _nameController.text.trim(),
        'email': _emailController.text.trim(),
        'password': _passwordController.text,
        'roleId': _roleId,
        'status': _status,
        'linkedStudentRecordIds': linkedStudents
            .map((student) => readText(student, const ['id'], fallback: ''))
            .where((id) => id.isNotEmpty)
            .toList(),
        'linkedStudentIds': linkedStudents
            .map(
              (student) => readText(student, const [
                'studentId',
                'admissionNo',
              ], fallback: ''),
            )
            .where((id) => id.isNotEmpty)
            .toList(),
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final roleValue = widget.roles.any((role) => role.id == _roleId)
        ? _roleId
        : null;
    final isParentRole = _roleId == 'parent';
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        18,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.line,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                _editing ? 'Edit User' : 'Create User',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                _editing
                    ? 'Update role, access status, and parent links.'
                    : 'Creates Firebase Auth login and ERP profile.',
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _nameController,
                enabled: !_saving,
                decoration: const InputDecoration(labelText: 'Name *'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _emailController,
                enabled: !_saving && !_editing,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email *'),
              ),
              if (!_editing) ...[
                const SizedBox(height: 10),
                TextField(
                  controller: _passwordController,
                  enabled: !_saving,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Password *',
                    helperText: 'Minimum 12 characters',
                  ),
                ),
              ],
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: roleValue,
                decoration: const InputDecoration(labelText: 'Role *'),
                items: widget.roles
                    .map(
                      (role) => DropdownMenuItem(
                        value: role.id,
                        child: Text(role.name),
                      ),
                    )
                    .toList(),
                onChanged: _saving
                    ? null
                    : (value) => setState(() {
                        _roleId = value ?? '';
                        if (_roleId != 'parent') {
                          _linkedStudentRecordIds.clear();
                        }
                      }),
              ),
              if (_editing) ...[
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: _status == 'Suspended' ? 'Suspended' : 'Active',
                  decoration: const InputDecoration(labelText: 'Status *'),
                  items: const [
                    DropdownMenuItem(value: 'Active', child: Text('Active')),
                    DropdownMenuItem(
                      value: 'Suspended',
                      child: Text('Suspended'),
                    ),
                  ],
                  onChanged: _saving
                      ? null
                      : (value) => setState(() => _status = value ?? 'Active'),
                ),
              ],
              if (isParentRole) ...[
                const SizedBox(height: 14),
                Text(
                  'Linked students',
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                if (widget.students.isEmpty)
                  const Text(
                    'No active students are available to link.',
                    style: TextStyle(color: AppColors.muted, fontSize: 12),
                  )
                else
                  Container(
                    constraints: const BoxConstraints(maxHeight: 220),
                    decoration: BoxDecoration(
                      color: AppColors.page,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: SingleChildScrollView(
                      child: Column(
                        children: widget.students.map((student) {
                          final recordId = readText(student, const [
                            'id',
                          ], fallback: '');
                          final studentName = readText(student, const [
                            'name',
                            'studentName',
                          ], fallback: 'Student');
                          final studentId = readText(student, const [
                            'studentId',
                            'admissionNo',
                          ], fallback: recordId);
                          return CheckboxListTile(
                            value: _linkedStudentRecordIds.contains(recordId),
                            onChanged: _saving || recordId.isEmpty
                                ? null
                                : (_) => _toggleStudent(recordId),
                            dense: true,
                            title: Text(studentName),
                            subtitle: Text(studentId),
                            controlAffinity: ListTileControlAffinity.leading,
                          );
                        }).toList(),
                      ),
                    ),
                  ),
              ],
              if (_error.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  _error,
                  style: const TextStyle(
                    color: AppColors.danger,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _saving
                          ? null
                          : () => Navigator.of(context).pop(false),
                      icon: const Icon(Icons.close_rounded, size: 18),
                      label: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: Icon(
                        _saving
                            ? Icons.hourglass_top_rounded
                            : Icons.save_rounded,
                        size: 18,
                      ),
                      label: Text(
                        _saving
                            ? 'Saving...'
                            : _editing
                            ? 'Save Changes'
                            : 'Create User',
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AcademicYearField extends StatelessWidget {
  const _AcademicYearField({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final controller = TextEditingController(text: value);
    return SizedBox(
      height: 46,
      child: TextField(
        controller: controller,
        onSubmitted: onChanged,
        decoration: const InputDecoration(
          prefixIcon: Icon(
            Icons.calendar_today_rounded,
            size: 18,
            color: AppColors.muted,
          ),
          hintText: 'Academic year filter, e.g. 2026-2027',
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.stats});

  final List<_Stat> stats;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: GridView.count(
        crossAxisCount: 3,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 0.95,
        children: stats
            .map(
              (stat) => InfoCard(
                padding: const EdgeInsets.all(10),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(stat.icon, color: stat.color, size: 24),
                    const SizedBox(height: 8),
                    Text(
                      stat.value,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      stat.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 10,
                        color: AppColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _Stat {
  const _Stat(this.label, this.value, this.icon, this.color);

  final String label;
  final String value;
  final IconData icon;
  final Color color;
}

class _ReportCategoryOption {
  const _ReportCategoryOption({
    required this.id,
    required this.label,
    required this.description,
    required this.icon,
    required this.color,
  });

  final String id;
  final String label;
  final String description;
  final IconData icon;
  final Color color;
}

class _ReportCategoryCard extends StatelessWidget {
  const _ReportCategoryCard({
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final _ReportCategoryOption option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            height: 42,
            width: 42,
            decoration: BoxDecoration(
              color: option.color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(option.icon, color: option.color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  option.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  option.description,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
          Icon(
            selected
                ? Icons.radio_button_checked_rounded
                : Icons.radio_button_off_rounded,
            color: selected ? option.color : AppColors.muted,
          ),
        ],
      ),
    );
  }
}

class _ReportBreakdownCard extends StatelessWidget {
  const _ReportBreakdownCard({required this.rows});

  final Iterable<MapEntry<String, Object?>> rows;

  @override
  Widget build(BuildContext context) {
    final entries = rows.toList();
    if (entries.isEmpty) {
      return const InfoCard(
        child: Text(
          'No report rows available.',
          style: TextStyle(color: AppColors.muted, fontSize: 13),
        ),
      );
    }
    return InfoCard(
      child: Column(
        children: entries
            .map(
              (row) => Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        row.key,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      row.value.toString(),
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _ReportDataCard extends StatelessWidget {
  const _ReportDataCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.meta,
    required this.trailing,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final List<String> meta;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 42,
            width: 42,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
                if (meta.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: meta
                        .where((item) => item.trim().isNotEmpty)
                        .map(
                          (item) => Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.page,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              item,
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          trailing,
        ],
      ),
    );
  }
}

class _AttendanceReportSummary {
  const _AttendanceReportSummary(
    this.label, {
    this.present = 0,
    this.absent = 0,
    this.late = 0,
    this.leave = 0,
  });

  final String label;
  final int present;
  final int absent;
  final int late;
  final int leave;

  int get total => present + absent + late + leave;

  _AttendanceReportSummary add(String status) {
    return _AttendanceReportSummary(
      label,
      present: present + (status == 'Present' ? 1 : 0),
      absent: absent + (status == 'Absent' ? 1 : 0),
      late: late + (status == 'Late' ? 1 : 0),
      leave: leave + (status == 'Leave' ? 1 : 0),
    );
  }
}

class _FinancialClassSummary {
  const _FinancialClassSummary({
    required this.label,
    this.assigned = 0,
    this.collected = 0,
    this.adjusted = 0,
    this.outstanding = 0,
    this.students = 0,
  });

  final String label;
  final num assigned;
  final num collected;
  final num adjusted;
  final num outstanding;
  final int students;

  int get rate => assigned <= 0 ? 0 : ((collected / assigned) * 100).round();

  _FinancialClassSummary add(_FeeAssignmentSnapshot row) {
    return _FinancialClassSummary(
      label: label,
      assigned: assigned + row.total,
      collected: collected + row.paid,
      adjusted: adjusted + row.adjusted,
      outstanding: outstanding + row.due,
      students: students + 1,
    );
  }
}

class _CurriculumEventCard extends StatelessWidget {
  const _CurriculumEventCard({
    required this.event,
    required this.selected,
    required this.onTap,
  });

  final Map<String, dynamic> event;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final type = readText(event, const ['eventType'], fallback: 'Academic');
    final color = _curriculumColor(type);
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: selected ? color : AppColors.line),
          boxShadow: [
            BoxShadow(
              color: (selected ? color : AppColors.primaryDark).withValues(
                alpha: selected ? 0.13 : 0.04,
              ),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              height: 44,
              width: 44,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(_curriculumIcon(type), color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    readText(event, const ['title', 'eventName']),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    [
                      type,
                      readText(event, const ['audience'], fallback: 'All'),
                      formatDateValue(
                        event['eventDate'] ??
                            event['date'] ??
                            event['startsOn'],
                      ),
                    ].join(' / '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            StatusPill(
              label: readText(event, const ['status'], fallback: 'Draft'),
            ),
          ],
        ),
      ),
    );
  }
}

class _CurriculumEventDetails extends StatelessWidget {
  const _CurriculumEventDetails({required this.event});

  final Map<String, dynamic>? event;

  @override
  Widget build(BuildContext context) {
    if (event == null) {
      return const InfoCard(
        child: Text(
          'Select an event to inspect it.',
          style: TextStyle(color: AppColors.muted, fontSize: 13),
        ),
      );
    }
    final item = event!;
    final type = readText(item, const ['eventType'], fallback: 'Academic');
    final color = _curriculumColor(type);
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  type,
                  style: TextStyle(
                    color: color,
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  readText(item, const ['title', 'eventName']),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Date',
                  value: formatDateValue(
                    item['eventDate'] ?? item['date'] ?? item['startsOn'],
                  ),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Audience',
                  value: readText(item, const ['audience'], fallback: 'All'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Created',
                  value: readText(item, const [
                    'createdAtText',
                  ], fallback: formatDateValue(item['createdAt'])),
                ),
              ),
              Expanded(
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: StatusPill(
                    label: readText(item, const ['status'], fallback: 'Draft'),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CurriculumEventSheet extends StatefulWidget {
  const _CurriculumEventSheet({
    required this.academicYear,
    required this.onSave,
  });

  final String academicYear;
  final Future<void> Function(Map<String, dynamic> values) onSave;

  @override
  State<_CurriculumEventSheet> createState() => _CurriculumEventSheetState();
}

class _CurriculumEventSheetState extends State<_CurriculumEventSheet> {
  final _titleController = TextEditingController();
  var _eventType = _curriculumEventTypes.first;
  var _audience = _curriculumAudiences.first;
  var _status = 'Draft';
  late var _eventDate = DateFormat('yyyy-MM-dd').format(DateTime.now());
  var _saving = false;
  var _error = '';

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final initialDate = DateTime.tryParse(_eventDate) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked == null) return;
    setState(() => _eventDate = DateFormat('yyyy-MM-dd').format(picked));
  }

  Future<void> _save() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      setState(() => _error = 'Event title is required.');
      return;
    }
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await widget.onSave({
        'title': title,
        'eventType': _eventType,
        'eventDate': _eventDate,
        'audience': _audience,
        'status': _status,
        if (widget.academicYear.trim().isNotEmpty)
          'academicYear': widget.academicYear.trim(),
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error.toString().replaceFirst('Bad state: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 18,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Add Curriculum Event',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Create a calendar item for this academic year.',
                          style: TextStyle(
                            color: AppColors.muted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Close',
                    icon: const Icon(Icons.close_rounded),
                    onPressed: _saving
                        ? null
                        : () => Navigator.of(context).pop(false),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              TextField(
                controller: _titleController,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Title',
                  prefixIcon: Icon(Icons.title_rounded),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _SheetDropdown(
                      label: 'Type',
                      value: _eventType,
                      values: _curriculumEventTypes,
                      icon: Icons.category_rounded,
                      onChanged: (value) => setState(() => _eventType = value),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _SheetDropdown(
                      label: 'Audience',
                      value: _audience,
                      values: _curriculumAudiences,
                      icon: Icons.groups_rounded,
                      onChanged: (value) => setState(() => _audience = value),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _SheetDropdown(
                      label: 'Status',
                      value: _status,
                      values: _curriculumStatuses,
                      icon: Icons.verified_rounded,
                      onChanged: (value) => setState(() => _status = value),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(8),
                      onTap: _saving ? null : _pickDate,
                      child: InputDecorator(
                        decoration: const InputDecoration(
                          labelText: 'Date',
                          prefixIcon: Icon(Icons.calendar_today_rounded),
                        ),
                        child: Text(
                          _eventDate,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              if (_error.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  _error,
                  style: const TextStyle(
                    color: AppColors.danger,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
              const SizedBox(height: 18),
              ElevatedButton.icon(
                onPressed: _saving ? null : _save,
                icon: Icon(
                  _saving ? Icons.hourglass_top_rounded : Icons.save_rounded,
                  size: 18,
                ),
                label: Text(_saving ? 'Saving...' : 'Save Event'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SheetDropdown extends StatelessWidget {
  const _SheetDropdown({
    required this.label,
    required this.value,
    required this.values,
    required this.icon,
    required this.onChanged,
  });

  final String label;
  final String value;
  final List<String> values;
  final IconData icon;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      isExpanded: true,
      decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
      items: values
          .map((item) => DropdownMenuItem(value: item, child: Text(item)))
          .toList(),
      onChanged: (next) {
        if (next != null) onChanged(next);
      },
    );
  }
}

IconData _curriculumIcon(String type) {
  switch (type.toLowerCase()) {
    case 'exam':
      return Icons.assignment_turned_in_rounded;
    case 'holiday':
      return Icons.beach_access_rounded;
    case 'admission':
      return Icons.person_add_alt_1_rounded;
    case 'activity':
      return Icons.emoji_events_rounded;
    default:
      return Icons.menu_book_rounded;
  }
}

Color _curriculumColor(String type) {
  switch (type.toLowerCase()) {
    case 'exam':
      return AppColors.danger;
    case 'holiday':
      return AppColors.accent;
    case 'admission':
      return AppColors.warning;
    case 'activity':
      return AppColors.early;
    default:
      return const Color(0xFF6E8FC7);
  }
}

class _DashboardMetricCard extends StatelessWidget {
  const _DashboardMetricCard({
    required this.label,
    required this.value,
    required this.helper,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String label;
  final String value;
  final String helper;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      padding: const EdgeInsets.all(12),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                height: 38,
                width: 38,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 21),
              ),
              const Spacer(),
              const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.muted,
              ),
            ],
          ),
          const Spacer(),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 3),
          Text(
            helper,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11, color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}

class _DashboardWorkCard extends StatelessWidget {
  const _DashboardWorkCard({
    required this.title,
    required this.helper,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String title;
  final String helper;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            height: 42,
            width: 42,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  helper,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
        ],
      ),
    );
  }
}

class _DashboardTrendChart extends StatelessWidget {
  const _DashboardTrendChart({required this.months});

  final List<_DashboardTrendMonth> months;

  @override
  Widget build(BuildContext context) {
    final maxValue = months.fold<num>(
      0,
      (total, month) => month.value > total ? month.value : total,
    );
    if (maxValue <= 0) {
      return Container(
        height: 148,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.page,
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text(
          'No payment collections yet.',
          style: TextStyle(color: AppColors.muted, fontSize: 13),
        ),
      );
    }
    return SizedBox(
      height: 172,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: months
            .map(
              (month) => Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: Column(
                    children: [
                      Expanded(
                        child: Align(
                          alignment: Alignment.bottomCenter,
                          child: Tooltip(
                            message: formatMoney(month.value),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 260),
                              curve: Curves.easeOutCubic,
                              height: 22 + ((month.value / maxValue) * 104),
                              width: 24,
                              decoration: BoxDecoration(
                                color: AppColors.early,
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        month.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _DashboardProgressRow extends StatelessWidget {
  const _DashboardProgressRow({
    required this.label,
    required this.value,
    required this.percent,
    required this.color,
  });

  final String label;
  final String value;
  final num percent;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final normalized = percent.isNaN ? 0.0 : percent.clamp(0, 1).toDouble();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: normalized,
            minHeight: 8,
            backgroundColor: AppColors.page,
            color: color,
          ),
        ),
      ],
    );
  }
}

class _DashboardTrendMonth {
  const _DashboardTrendMonth({
    required this.key,
    required this.label,
    required this.value,
    required this.year,
    required this.month,
  });

  final String key;
  final String label;
  final num value;
  final int year;
  final int month;

  _DashboardTrendMonth copyWith({num? value}) {
    return _DashboardTrendMonth(
      key: key,
      label: label,
      value: value ?? this.value,
      year: year,
      month: month,
    );
  }
}

class _DashboardValueShare {
  const _DashboardValueShare({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final num value;
  final Color color;
}

class _StudentCourseOption {
  const _StudentCourseOption(
    this.courseCode,
    this.label, {
    this.courseName = '',
    this.courseYear = '',
    this.admissionType = '',
    this.collegeName = '',
    this.collegeCode = '',
  });

  final String courseCode;
  final String label;
  final String courseName;
  final String courseYear;
  final String admissionType;
  final String collegeName;
  final String collegeCode;
}

class _AttendanceSubjectOption {
  const _AttendanceSubjectOption(this.code, this.name);

  final String code;
  final String name;
}

class _AttendanceSummary {
  const _AttendanceSummary({
    required this.total,
    required this.present,
    required this.absent,
    required this.leave,
    required this.percentage,
  });

  final int total;
  final int present;
  final int absent;
  final int leave;
  final int percentage;
}

class _TimetableSlotOption {
  const _TimetableSlotOption({
    required this.label,
    required this.startTime,
    required this.endTime,
  });

  final String label;
  final String startTime;
  final String endTime;
}

class _TimetableSlotParts {
  const _TimetableSlotParts({required this.startTime, required this.endTime});

  final String startTime;
  final String endTime;
}

class _ExamMarkSummary {
  const _ExamMarkSummary({
    required this.totalObtained,
    required this.totalMax,
    required this.percentage,
    required this.grade,
    required this.status,
  });

  final num totalObtained;
  final num totalMax;
  final int percentage;
  final String grade;
  final String status;
}

class _SegmentedFilter extends StatelessWidget {
  const _SegmentedFilter({
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final String value;
  final Map<String, String> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final entries = options.entries.toList();
    return Row(
      children: List.generate(entries.length, (index) {
        final entry = entries[index];
        final active = value == entry.key;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(
              right: index == entries.length - 1 ? 0 : 8,
            ),
            child: OutlinedButton(
              onPressed: () => onChanged(entry.key),
              style: OutlinedButton.styleFrom(
                backgroundColor: active ? AppColors.primaryDark : Colors.white,
                foregroundColor: active ? Colors.white : AppColors.ink,
                side: BorderSide(
                  color: active ? AppColors.primaryDark : AppColors.line,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: Text(
                entry.value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        );
      }),
    );
  }
}

class _AttendanceDateButton extends StatelessWidget {
  const _AttendanceDateButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: const Icon(Icons.event_rounded, size: 18),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }
}

class _BackActionButton extends StatelessWidget {
  const _BackActionButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: const Icon(Icons.arrow_back_rounded, size: 18),
        label: const Text('Back'),
      ),
    );
  }
}

class _AttendanceTaskCard extends StatelessWidget {
  const _AttendanceTaskCard({
    required this.title,
    required this.description,
    required this.icon,
    required this.meta,
    required this.enabled,
    required this.onTap,
  });

  final String title;
  final String description;
  final IconData icon;
  final String meta;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.58,
      child: InfoCard(
        onTap: enabled ? onTap : null,
        child: Row(
          children: [
            Container(
              height: 46,
              width: 46,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: AppColors.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    meta,
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(
              Icons.arrow_forward_ios_rounded,
              size: 15,
              color: AppColors.muted,
            ),
          ],
        ),
      ),
    );
  }
}

class _AttendanceSheetChoice extends StatelessWidget {
  const _AttendanceSheetChoice({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      onTap: onTap,
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
          const Icon(
            Icons.arrow_forward_ios_rounded,
            size: 15,
            color: AppColors.muted,
          ),
        ],
      ),
    );
  }
}

class _AttendanceRosterCard extends StatelessWidget {
  const _AttendanceRosterCard({
    required this.entity,
    required this.mode,
    required this.record,
    required this.selected,
    required this.canMark,
    required this.editable,
    required this.onTap,
    required this.onMark,
  });

  final Map<String, dynamic> entity;
  final String mode;
  final Map<String, dynamic>? record;
  final bool selected;
  final bool canMark;
  final bool editable;
  final VoidCallback onTap;
  final ValueChanged<String> onMark;

  @override
  Widget build(BuildContext context) {
    final status = readText(record ?? const {}, const ['status'], fallback: '');
    final canEditStatus = canMark && editable;
    final entityId = readText(entity, const [
      'studentId',
      'employeeId',
    ], fallback: readText(entity, const ['id'], fallback: '-'));
    final subtitle = mode == 'students'
        ? '${readText(entity, const ['className', 'courseName'], fallback: 'Class')} / ${readText(entity, const ['section', 'courseCode'], fallback: entityId)}'
        : '${readText(entity, const ['department'], fallback: 'Department')} / ${readText(entity, const ['designation'], fallback: 'Designation')}';

    Widget statusButton(String label, IconData icon, Color color) {
      final active = status == label;
      return Expanded(
        child: OutlinedButton.icon(
          onPressed: canEditStatus ? () => onMark(label) : null,
          icon: Icon(icon, size: 17),
          label: Text(label),
          style: OutlinedButton.styleFrom(
            backgroundColor: active ? color : Colors.white,
            foregroundColor: active ? Colors.white : AppColors.ink,
            side: BorderSide(color: active ? color : AppColors.line),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),
      );
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: selected ? AppColors.primary : Colors.transparent,
          width: selected ? 1.5 : 0,
        ),
      ),
      child: InfoCard(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                _Avatar(
                  label: readText(entity, const ['name'], fallback: '?'),
                  color: mode == 'students'
                      ? AppColors.accent
                      : const Color(0xFFE5835A),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        readText(entity, const ['name'], fallback: entityId),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$entityId / $subtitle',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                StatusPill(label: status.isEmpty ? 'Not Marked' : status),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                statusButton(
                  'Present',
                  Icons.check_circle_rounded,
                  AppColors.accent,
                ),
                const SizedBox(width: 8),
                statusButton('Absent', Icons.cancel_rounded, AppColors.danger),
              ],
            ),
            const SizedBox(height: 7),
            Text(
              status.isEmpty
                  ? 'Not marked'
                  : editable
                  ? 'Marked record can still be updated.'
                  : 'Edit window closed',
              style: const TextStyle(color: AppColors.muted, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

class _TimetableBoard extends StatelessWidget {
  const _TimetableBoard({
    required this.entries,
    required this.slots,
    required this.statusView,
    required this.canCreate,
    required this.canEdit,
    required this.canArchive,
    required this.onCreate,
    required this.onEdit,
    required this.onArchive,
    required this.onRestore,
  });

  static const _days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  final List<Map<String, dynamic>> entries;
  final List<_TimetableSlotOption> slots;
  final String statusView;
  final bool canCreate;
  final bool canEdit;
  final bool canArchive;
  final ValueChanged<Map<String, dynamic>> onCreate;
  final ValueChanged<Map<String, dynamic>> onEdit;
  final ValueChanged<Map<String, dynamic>> onArchive;
  final ValueChanged<Map<String, dynamic>> onRestore;

  @override
  Widget build(BuildContext context) {
    if (slots.isEmpty) {
      return const EmptyState(
        title: 'No time slots',
        message: 'Create a timetable entry to start the timetable grid.',
      );
    }
    return Column(
      children: _days.map((day) {
        final dayEntries = entries
            .where(
              (entry) =>
                  readText(entry, const ['day', 'weekday'], fallback: '') ==
                  day,
            )
            .toList();
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: InfoCard(
            padding: const EdgeInsets.all(0),
            child: ExpansionTile(
              tilePadding: const EdgeInsets.symmetric(horizontal: 14),
              childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              initiallyExpanded: dayEntries.isNotEmpty,
              title: Text(
                day,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              subtitle: Text(
                '${dayEntries.length} entries',
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              children: slots.map((slot) {
                final slotEntries = dayEntries
                    .where((entry) => _slotLabel(entry) == slot.label)
                    .toList();
                return Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.page,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.line),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          slot.label,
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 12,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (slotEntries.isEmpty &&
                            canCreate &&
                            statusView != 'archived')
                          OutlinedButton.icon(
                            onPressed: () => onCreate({
                              'day': day,
                              'timeSlot': slot.label,
                              'startTime': slot.startTime,
                              'endTime': slot.endTime,
                            }),
                            icon: const Icon(Icons.add_rounded, size: 18),
                            label: const Text('Add class'),
                          )
                        else if (slotEntries.isEmpty)
                          const Text(
                            'No class scheduled.',
                            style: TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          )
                        else
                          ...slotEntries.map(
                            (entry) => Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: _TimetableEntryCard(
                                entry: entry,
                                isArchiveView: statusView == 'archived',
                                canEdit: canEdit,
                                canArchive: canArchive,
                                onEdit: () => onEdit(entry),
                                onArchive: () => onArchive(entry),
                                onRestore: () => onRestore(entry),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        );
      }).toList(),
    );
  }

  String _slotLabel(Map<String, dynamic> entry) {
    final slot = readText(entry, const ['timeSlot'], fallback: '');
    if (slot.isNotEmpty) return slot;
    final start = readText(entry, const ['startTime'], fallback: '');
    final end = readText(entry, const ['endTime'], fallback: '');
    if (start.isNotEmpty && end.isNotEmpty) return '$start - $end';
    return '';
  }
}

enum _TimetableEntryAction { edit, archive, restore }

class _TimetableEntryCard extends StatelessWidget {
  const _TimetableEntryCard({
    required this.entry,
    required this.isArchiveView,
    required this.canEdit,
    required this.canArchive,
    required this.onEdit,
    required this.onArchive,
    required this.onRestore,
  });

  final Map<String, dynamic> entry;
  final bool isArchiveView;
  final bool canEdit;
  final bool canArchive;
  final VoidCallback onEdit;
  final VoidCallback onArchive;
  final VoidCallback onRestore;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  readText(entry, const ['subject', 'subjectName']),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  readText(entry, const ['classKey', 'className']),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
                const SizedBox(height: 2),
                Text(
                  '${readText(entry, const ['facultyName', 'teacherName'], fallback: 'Faculty')} / ${readText(entry, const ['classroomName', 'roomNo'], fallback: 'Classroom')}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          StatusPill(
            label: readText(entry, const ['status'], fallback: 'Draft'),
          ),
          if (canEdit || canArchive)
            PopupMenuButton<_TimetableEntryAction>(
              tooltip: 'Timetable actions',
              onSelected: (action) {
                switch (action) {
                  case _TimetableEntryAction.edit:
                    onEdit();
                    break;
                  case _TimetableEntryAction.archive:
                    onArchive();
                    break;
                  case _TimetableEntryAction.restore:
                    onRestore();
                    break;
                }
              },
              itemBuilder: (context) => [
                if (canEdit && !isArchiveView)
                  const PopupMenuItem(
                    value: _TimetableEntryAction.edit,
                    child: ListTile(
                      leading: Icon(Icons.edit_rounded),
                      title: Text('Edit'),
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                if (canArchive && !isArchiveView)
                  const PopupMenuItem(
                    value: _TimetableEntryAction.archive,
                    child: ListTile(
                      leading: Icon(Icons.archive_rounded),
                      title: Text('Archive'),
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                if (canArchive && isArchiveView)
                  const PopupMenuItem(
                    value: _TimetableEntryAction.restore,
                    child: ListTile(
                      leading: Icon(Icons.unarchive_rounded),
                      title: Text('Restore'),
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

class _TimetableEntrySheet extends StatefulWidget {
  const _TimetableEntrySheet({
    required this.initialValues,
    required this.classOptions,
    required this.faculty,
    required this.classrooms,
    required this.timeSlotOptions,
    required this.isEdit,
    required this.onSave,
  });

  final Map<String, dynamic> initialValues;
  final List<String> classOptions;
  final List<Map<String, dynamic>> faculty;
  final List<Map<String, dynamic>> classrooms;
  final List<_TimetableSlotOption> timeSlotOptions;
  final bool isEdit;
  final Future<void> Function(Map<String, dynamic> form) onSave;

  @override
  State<_TimetableEntrySheet> createState() => _TimetableEntrySheetState();
}

class _TimetableEntrySheetState extends State<_TimetableEntrySheet> {
  static const _days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  late final TextEditingController _classController;
  late final TextEditingController _subjectController;
  late final TextEditingController _facultyController;
  late final TextEditingController _classroomController;
  late final TextEditingController _slotController;
  late final TextEditingController _startController;
  late final TextEditingController _endController;
  late String _classKey;
  late String _facultyId;
  late String _classroomId;
  late String _day;
  var _saving = false;
  var _error = '';

  @override
  void initState() {
    super.initState();
    final initial = widget.initialValues;
    _classKey = _initialFromOptions(
      widget.classOptions,
      readText(initial, const ['classKey'], fallback: ''),
    );
    _facultyId = _initialRecordId(
      widget.faculty,
      readText(initial, const ['facultyId'], fallback: ''),
    );
    _classroomId = _initialRecordId(
      widget.classrooms,
      readText(initial, const ['classroomId'], fallback: ''),
    );
    _day = _days.contains(readText(initial, const ['day'], fallback: ''))
        ? readText(initial, const ['day'], fallback: '')
        : _days.first;
    _classController = TextEditingController(
      text: readText(initial, const ['classKey'], fallback: _classKey),
    );
    _subjectController = TextEditingController(
      text: readText(initial, const ['subject', 'subjectName'], fallback: ''),
    );
    _facultyController = TextEditingController(
      text: readText(initial, const ['facultyId'], fallback: _facultyId),
    );
    _classroomController = TextEditingController(
      text: readText(initial, const ['classroomId'], fallback: _classroomId),
    );
    _slotController = TextEditingController(
      text: readText(initial, const ['timeSlot'], fallback: ''),
    );
    _startController = TextEditingController(
      text: readText(initial, const ['startTime'], fallback: ''),
    );
    _endController = TextEditingController(
      text: readText(initial, const ['endTime'], fallback: ''),
    );
  }

  @override
  void dispose() {
    _classController.dispose();
    _subjectController.dispose();
    _facultyController.dispose();
    _classroomController.dispose();
    _slotController.dispose();
    _startController.dispose();
    _endController.dispose();
    super.dispose();
  }

  String _initialFromOptions(List<String> options, String value) {
    if (options.isEmpty) return value;
    return options.contains(value) ? value : options.first;
  }

  String _initialRecordId(List<Map<String, dynamic>> items, String value) {
    if (items.isEmpty) return value;
    final ids = items
        .map((item) => readText(item, const ['id'], fallback: ''))
        .toList();
    return ids.contains(value) ? value : ids.first;
  }

  Future<void> _save() async {
    final form = {
      'classKey': widget.classOptions.isEmpty
          ? _classController.text.trim()
          : _classKey,
      'subject': _subjectController.text.trim(),
      'facultyId': widget.faculty.isEmpty
          ? _facultyController.text.trim()
          : _facultyId,
      'classroomId': widget.classrooms.isEmpty
          ? _classroomController.text.trim()
          : _classroomId,
      'day': _day,
      'timeSlot': _slotController.text.trim(),
      'startTime': _startController.text.trim(),
      'endTime': _endController.text.trim(),
    };
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await widget.onSave(form);
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        18,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.line,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                widget.isEdit
                    ? 'Edit Timetable Entry'
                    : 'Create Timetable Entry',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Assign subject, faculty, classroom, day, and time slot.',
                style: TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              const SizedBox(height: 14),
              _classField(),
              const SizedBox(height: 10),
              TextField(
                controller: _subjectController,
                decoration: const InputDecoration(labelText: 'Subject *'),
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 10),
              _facultyField(),
              const SizedBox(height: 10),
              _classroomField(),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: _day,
                decoration: const InputDecoration(labelText: 'Day *'),
                items: _days
                    .map(
                      (day) => DropdownMenuItem(value: day, child: Text(day)),
                    )
                    .toList(),
                onChanged: (value) => setState(() => _day = value ?? _day),
              ),
              const SizedBox(height: 10),
              if (widget.timeSlotOptions.isNotEmpty) ...[
                DropdownButtonFormField<String>(
                  initialValue:
                      widget.timeSlotOptions.any(
                        (slot) => slot.label == _slotController.text,
                      )
                      ? _slotController.text
                      : null,
                  decoration: const InputDecoration(
                    labelText: 'Time Slot Preset',
                  ),
                  items: widget.timeSlotOptions
                      .map(
                        (slot) => DropdownMenuItem(
                          value: slot.label,
                          child: Text(slot.label),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    final selected = widget.timeSlotOptions.firstWhere(
                      (slot) => slot.label == value,
                      orElse: () => const _TimetableSlotOption(
                        label: '',
                        startTime: '',
                        endTime: '',
                      ),
                    );
                    setState(() {
                      _slotController.text = selected.label;
                      if (selected.startTime.isNotEmpty) {
                        _startController.text = selected.startTime;
                      }
                      if (selected.endTime.isNotEmpty) {
                        _endController.text = selected.endTime;
                      }
                    });
                  },
                ),
                const SizedBox(height: 10),
              ],
              TextField(
                controller: _slotController,
                decoration: const InputDecoration(
                  labelText: 'Time Slot *',
                  hintText: '09:00 - 10:00',
                ),
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _startController,
                      decoration: const InputDecoration(
                        labelText: 'Start Time',
                        hintText: '09:00',
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _endController,
                      decoration: const InputDecoration(
                        labelText: 'End Time',
                        hintText: '10:00',
                      ),
                    ),
                  ),
                ],
              ),
              if (_error.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  _error,
                  style: const TextStyle(
                    color: AppColors.danger,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _saving
                          ? null
                          : () => Navigator.of(context).pop(false),
                      icon: const Icon(Icons.close_rounded, size: 18),
                      label: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: Icon(
                        _saving
                            ? Icons.hourglass_top_rounded
                            : Icons.save_rounded,
                        size: 18,
                      ),
                      label: Text(_saving ? 'Saving...' : 'Save Entry'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _classField() {
    if (widget.classOptions.isEmpty) {
      return TextField(
        controller: _classController,
        decoration: const InputDecoration(labelText: 'Class *'),
        textInputAction: TextInputAction.next,
      );
    }
    return DropdownButtonFormField<String>(
      initialValue: _classKey,
      decoration: const InputDecoration(labelText: 'Class *'),
      items: widget.classOptions
          .map((item) => DropdownMenuItem(value: item, child: Text(item)))
          .toList(),
      onChanged: (value) => setState(() => _classKey = value ?? _classKey),
    );
  }

  Widget _facultyField() {
    if (widget.faculty.isEmpty) {
      return TextField(
        controller: _facultyController,
        decoration: const InputDecoration(labelText: 'Faculty ID *'),
        textInputAction: TextInputAction.next,
      );
    }
    return DropdownButtonFormField<String>(
      initialValue: _facultyId,
      decoration: const InputDecoration(labelText: 'Faculty *'),
      items: widget.faculty
          .map(
            (member) => DropdownMenuItem(
              value: readText(member, const ['id'], fallback: ''),
              child: Text(
                readText(member, const ['name'], fallback: 'Faculty'),
              ),
            ),
          )
          .toList(),
      onChanged: (value) => setState(() => _facultyId = value ?? _facultyId),
    );
  }

  Widget _classroomField() {
    if (widget.classrooms.isEmpty) {
      return TextField(
        controller: _classroomController,
        decoration: const InputDecoration(labelText: 'Classroom ID *'),
        textInputAction: TextInputAction.next,
      );
    }
    return DropdownButtonFormField<String>(
      initialValue: _classroomId,
      decoration: const InputDecoration(labelText: 'Classroom *'),
      items: widget.classrooms
          .map(
            (room) => DropdownMenuItem(
              value: readText(room, const ['id'], fallback: ''),
              child: Text(
                readText(room, const [
                  'roomNo',
                  'roomNumber',
                  'name',
                ], fallback: 'Classroom'),
              ),
            ),
          )
          .toList(),
      onChanged: (value) =>
          setState(() => _classroomId = value ?? _classroomId),
    );
  }
}

class _ExamScheduleCard extends StatelessWidget {
  const _ExamScheduleCard({
    required this.schedule,
    required this.selected,
    required this.onTap,
    required this.canEdit,
    required this.onEdit,
  });

  final Map<String, dynamic> schedule;
  final bool selected;
  final VoidCallback onTap;
  final bool canEdit;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: selected ? AppColors.primary : Colors.transparent,
          width: selected ? 1.5 : 0,
        ),
      ),
      child: InfoCard(
        onTap: onTap,
        child: Row(
          children: [
            _Avatar(
              label: readText(schedule, const ['examName'], fallback: 'E'),
              color: const Color(0xFF8357C5),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    readText(schedule, const ['examName'], fallback: 'Exam'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${readText(schedule, const ['classKey', 'className'], fallback: 'Class')} / ${readText(schedule, const ['subject'], fallback: 'Subject')}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${readText(schedule, const ['examDate'], fallback: '-')} / Max ${readText(schedule, const ['maxMarks'], fallback: '-')}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            StatusPill(
              label: readText(schedule, const [
                'status',
              ], fallback: 'Scheduled'),
            ),
            if (canEdit)
              IconButton(
                tooltip: 'Edit schedule',
                icon: const Icon(Icons.edit_rounded, size: 19),
                onPressed: onEdit,
              ),
          ],
        ),
      ),
    );
  }
}

class _ExamScheduleDetail extends StatelessWidget {
  const _ExamScheduleDetail({
    required this.schedule,
    required this.markCount,
    required this.canEdit,
    required this.canEnterMarks,
    required this.onEdit,
    required this.onMarks,
  });

  final Map<String, dynamic> schedule;
  final int markCount;
  final bool canEdit;
  final bool canEnterMarks;
  final VoidCallback onEdit;
  final VoidCallback onMarks;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            readText(schedule, const ['examName'], fallback: 'Exam'),
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
          ),
          const SizedBox(height: 4),
          Text(
            '${readText(schedule, const ['classKey', 'className'], fallback: 'Class')} / ${readText(schedule, const ['subject'], fallback: 'Subject')}',
            style: const TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Date',
                  value: readText(schedule, const ['examDate'], fallback: '-'),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Max Marks',
                  value: readText(schedule, const ['maxMarks'], fallback: '-'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Faculty',
                  value: readText(schedule, const [
                    'facultyName',
                  ], fallback: '-'),
                ),
              ),
              Expanded(
                child: LabelValue(label: 'Marks', value: markCount.toString()),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: canEdit ? onEdit : null,
                  icon: const Icon(Icons.edit_rounded, size: 18),
                  label: const Text('Edit'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: canEnterMarks ? onMarks : null,
                  icon: const Icon(
                    Icons.assignment_turned_in_rounded,
                    size: 18,
                  ),
                  label: const Text('Marks'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ExamResultsPanel extends StatelessWidget {
  const _ExamResultsPanel({
    required this.marks,
    required this.results,
    required this.reportCards,
    required this.assessments,
  });

  final List<Map<String, dynamic>> marks;
  final List<Map<String, dynamic>> results;
  final List<Map<String, dynamic>> reportCards;
  final List<Map<String, dynamic>> assessments;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _panel('Recent Marks', marks, (item) {
          return _CompactRow(
            title: readText(item, const ['studentName'], fallback: 'Student'),
            subtitle:
                '${readText(item, const ['subject'], fallback: 'Subject')}: ${readText(item, const ['marksObtained', 'marks'], fallback: '-')}/${readText(item, const ['maxMarks'], fallback: '-')}',
            trailing: StatusPill(
              label: readText(item, const ['grade'], fallback: '-'),
            ),
          );
        }, 'No marks entered.'),
        _panel('Generated Results', results, (item) {
          return _CompactRow(
            title: readText(item, const ['studentName'], fallback: 'Student'),
            subtitle:
                '${readText(item, const ['percentage'], fallback: '0')}% / ${readText(item, const ['grade'], fallback: '-')}',
            trailing: StatusPill(
              label: readText(item, const ['status'], fallback: 'Result'),
            ),
          );
        }, 'No results generated.'),
        _panel('Report Cards', reportCards, (item) {
          return _CompactRow(
            title: readText(item, const ['studentId'], fallback: 'Student'),
            subtitle: readText(item, const [
              'examName',
            ], fallback: 'Report card'),
            trailing: StatusPill(
              label: readText(item, const ['status'], fallback: 'Generated'),
            ),
          );
        }, 'No report cards generated.'),
        _panel('Internal Assessments', assessments, (item) {
          return _CompactRow(
            title: readText(item, const ['title'], fallback: 'Assessment'),
            subtitle:
                '${readText(item, const ['subject'], fallback: 'Subject')} / Max ${readText(item, const ['maxMarks'], fallback: '-')}',
            trailing: StatusPill(
              label: readText(item, const ['status'], fallback: 'Active'),
            ),
          );
        }, 'No assessments created.'),
      ],
    );
  }

  Widget _panel(
    String title,
    List<Map<String, dynamic>> items,
    Widget Function(Map<String, dynamic> item) builder,
    String empty,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InfoCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            if (items.isEmpty)
              Text(
                empty,
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              )
            else
              ...items
                  .take(5)
                  .map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: builder(item),
                    ),
                  ),
          ],
        ),
      ),
    );
  }
}

class _ExamScheduleSheet extends StatefulWidget {
  const _ExamScheduleSheet({
    required this.initialValues,
    required this.classOptions,
    required this.faculty,
    required this.isEdit,
    required this.onSave,
  });

  final Map<String, dynamic>? initialValues;
  final List<String> classOptions;
  final List<Map<String, dynamic>> faculty;
  final bool isEdit;
  final Future<void> Function(Map<String, dynamic> form) onSave;

  @override
  State<_ExamScheduleSheet> createState() => _ExamScheduleSheetState();
}

class _ExamScheduleSheetState extends State<_ExamScheduleSheet> {
  late final TextEditingController _examNameController;
  late final TextEditingController _classController;
  late final TextEditingController _subjectController;
  late final TextEditingController _examDateController;
  late final TextEditingController _startTimeController;
  late final TextEditingController _durationController;
  late final TextEditingController _roomController;
  late final TextEditingController _maxMarksController;
  late final TextEditingController _facultyController;
  late String _classKey;
  late String _facultyId;
  late String _examType;
  late String _status;
  var _saving = false;
  var _error = '';

  @override
  void initState() {
    super.initState();
    final initial = widget.initialValues ?? const <String, dynamic>{};
    _classKey = _initialString(
      widget.classOptions,
      readText(initial, const ['classKey'], fallback: ''),
    );
    _facultyId = _initialRecordId(
      widget.faculty,
      readText(initial, const ['facultyId'], fallback: ''),
    );
    _examType = readText(initial, const ['examType'], fallback: 'Written');
    _status = readText(initial, const ['status'], fallback: 'Scheduled');
    _examNameController = TextEditingController(
      text: readText(initial, const [
        'examName',
      ], fallback: 'Mid Term Examination'),
    );
    _classController = TextEditingController(text: _classKey);
    _subjectController = TextEditingController(
      text: readText(initial, const ['subject'], fallback: ''),
    );
    _examDateController = TextEditingController(
      text: readText(initial, const ['examDate'], fallback: ''),
    );
    _startTimeController = TextEditingController(
      text: readText(initial, const ['startTime'], fallback: ''),
    );
    _durationController = TextEditingController(
      text: readText(initial, const ['durationMinutes'], fallback: '180'),
    );
    _roomController = TextEditingController(
      text: readText(initial, const ['roomNo'], fallback: ''),
    );
    _maxMarksController = TextEditingController(
      text: readText(initial, const ['maxMarks'], fallback: '100'),
    );
    _facultyController = TextEditingController(text: _facultyId);
  }

  @override
  void dispose() {
    _examNameController.dispose();
    _classController.dispose();
    _subjectController.dispose();
    _examDateController.dispose();
    _startTimeController.dispose();
    _durationController.dispose();
    _roomController.dispose();
    _maxMarksController.dispose();
    _facultyController.dispose();
    super.dispose();
  }

  String _initialString(List<String> options, String value) {
    if (options.isEmpty) return value;
    return options.contains(value) ? value : options.first;
  }

  String _initialRecordId(List<Map<String, dynamic>> items, String value) {
    if (items.isEmpty) return value;
    final ids = items
        .map((item) => readText(item, const ['id'], fallback: ''))
        .toList();
    return ids.contains(value) ? value : ids.first;
  }

  Future<void> _save() async {
    final form = {
      'examName': _examNameController.text.trim(),
      'classKey': widget.classOptions.isEmpty
          ? _classController.text.trim()
          : _classKey,
      'subject': _subjectController.text.trim(),
      'examType': _examType,
      'examDate': _examDateController.text.trim(),
      'startTime': _startTimeController.text.trim(),
      'durationMinutes': _durationController.text.trim(),
      'roomNo': _roomController.text.trim(),
      'maxMarks': _maxMarksController.text.trim(),
      'facultyId': widget.faculty.isEmpty
          ? _facultyController.text.trim()
          : _facultyId,
      'status': _status,
    };
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await widget.onSave(form);
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _ExamSheetChrome(
      title: widget.isEdit ? 'Edit Exam Schedule' : 'Schedule Exam',
      helper: 'Create subject-wise exam schedules for a class.',
      saving: _saving,
      error: _error,
      saveLabel: widget.isEdit ? 'Save Changes' : 'Schedule Exam',
      onSave: _save,
      children: [
        TextField(
          controller: _examNameController,
          decoration: const InputDecoration(labelText: 'Exam Name *'),
        ),
        const SizedBox(height: 10),
        _classField(),
        const SizedBox(height: 10),
        TextField(
          controller: _subjectController,
          decoration: const InputDecoration(labelText: 'Subject *'),
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          initialValue: _examType,
          decoration: const InputDecoration(labelText: 'Exam Type'),
          items: const ['Written', 'Practical', 'Internal', 'Viva']
              .map((item) => DropdownMenuItem(value: item, child: Text(item)))
              .toList(),
          onChanged: (value) => setState(() => _examType = value ?? _examType),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _examDateController,
          decoration: const InputDecoration(labelText: 'Exam Date *'),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _startTimeController,
                decoration: const InputDecoration(labelText: 'Start Time'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: _durationController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Duration Min'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _roomController,
                decoration: const InputDecoration(labelText: 'Room / Hall'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: _maxMarksController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Max Marks *'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _facultyField(),
      ],
    );
  }

  Widget _classField() {
    if (widget.classOptions.isEmpty) {
      return TextField(
        controller: _classController,
        decoration: const InputDecoration(labelText: 'Class *'),
      );
    }
    return DropdownButtonFormField<String>(
      initialValue: _classKey,
      decoration: const InputDecoration(labelText: 'Class *'),
      items: widget.classOptions
          .map((item) => DropdownMenuItem(value: item, child: Text(item)))
          .toList(),
      onChanged: (value) => setState(() => _classKey = value ?? _classKey),
    );
  }

  Widget _facultyField() {
    if (widget.faculty.isEmpty) {
      return TextField(
        controller: _facultyController,
        decoration: const InputDecoration(labelText: 'Faculty ID'),
      );
    }
    return DropdownButtonFormField<String>(
      initialValue: _facultyId,
      decoration: const InputDecoration(labelText: 'Faculty'),
      items: widget.faculty
          .map(
            (member) => DropdownMenuItem(
              value: readText(member, const ['id'], fallback: ''),
              child: Text(
                readText(member, const ['name'], fallback: 'Faculty'),
              ),
            ),
          )
          .toList(),
      onChanged: (value) => setState(() => _facultyId = value ?? _facultyId),
    );
  }
}

class _MarksEntrySheet extends StatefulWidget {
  const _MarksEntrySheet({
    required this.schedules,
    required this.students,
    required this.initialScheduleId,
    required this.onSave,
  });

  final List<Map<String, dynamic>> schedules;
  final List<Map<String, dynamic>> students;
  final String initialScheduleId;
  final Future<void> Function(Map<String, dynamic> form) onSave;

  @override
  State<_MarksEntrySheet> createState() => _MarksEntrySheetState();
}

class _MarksEntrySheetState extends State<_MarksEntrySheet> {
  late String _scheduleId;
  late String _studentRecordId;
  final _marksController = TextEditingController();
  var _saving = false;
  var _error = '';

  @override
  void initState() {
    super.initState();
    final scheduleIds = widget.schedules
        .map((item) => readText(item, const ['id'], fallback: ''))
        .toList();
    _scheduleId = scheduleIds.contains(widget.initialScheduleId)
        ? widget.initialScheduleId
        : scheduleIds.first;
    _studentRecordId = readText(widget.students.first, const ['id']);
  }

  @override
  void dispose() {
    _marksController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await widget.onSave({
        'examScheduleId': _scheduleId,
        'studentRecordId': _studentRecordId,
        'marksObtained': _marksController.text.trim(),
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedSchedule = widget.schedules.firstWhere(
      (item) => readText(item, const ['id'], fallback: '') == _scheduleId,
    );
    return _ExamSheetChrome(
      title: 'Marks Entry',
      helper: 'Enter student marks for scheduled exams.',
      saving: _saving,
      error: _error,
      saveLabel: 'Save Marks',
      onSave: _save,
      children: [
        DropdownButtonFormField<String>(
          initialValue: _scheduleId,
          decoration: const InputDecoration(labelText: 'Exam *'),
          items: widget.schedules
              .map(
                (item) => DropdownMenuItem(
                  value: readText(item, const ['id'], fallback: ''),
                  child: Text(
                    '${readText(item, const ['examName'])} / ${readText(item, const ['classKey'])} / ${readText(item, const ['subject'])}',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          onChanged: (value) =>
              setState(() => _scheduleId = value ?? _scheduleId),
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          initialValue: _studentRecordId,
          decoration: const InputDecoration(labelText: 'Student *'),
          items: widget.students
              .map(
                (item) => DropdownMenuItem(
                  value: readText(item, const ['id'], fallback: ''),
                  child: Text(
                    '${readText(item, const ['name'])} / ${readText(item, const ['studentId'])}',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          onChanged: (value) =>
              setState(() => _studentRecordId = value ?? _studentRecordId),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _marksController,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText:
                'Marks Obtained / ${readText(selectedSchedule, const ['maxMarks'], fallback: '0')}',
          ),
        ),
      ],
    );
  }
}

class _AssessmentSheet extends StatefulWidget {
  const _AssessmentSheet({required this.schedules, required this.onSave});

  final List<Map<String, dynamic>> schedules;
  final Future<void> Function(Map<String, dynamic> form) onSave;

  @override
  State<_AssessmentSheet> createState() => _AssessmentSheetState();
}

class _AssessmentSheetState extends State<_AssessmentSheet> {
  late String _scheduleId;
  final _titleController = TextEditingController();
  final _maxMarksController = TextEditingController();
  var _status = 'Active';
  var _saving = false;
  var _error = '';

  @override
  void initState() {
    super.initState();
    _scheduleId = readText(widget.schedules.first, const ['id']);
  }

  @override
  void dispose() {
    _titleController.dispose();
    _maxMarksController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await widget.onSave({
        'examScheduleId': _scheduleId,
        'title': _titleController.text.trim(),
        'maxMarks': _maxMarksController.text.trim(),
        'status': _status,
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _ExamSheetChrome(
      title: 'Create Assessment',
      helper: 'Create an assessment from a live exam schedule.',
      saving: _saving,
      error: _error,
      saveLabel: 'Save Assessment',
      onSave: _save,
      children: [
        DropdownButtonFormField<String>(
          initialValue: _scheduleId,
          decoration: const InputDecoration(labelText: 'Exam Schedule *'),
          items: widget.schedules
              .map(
                (item) => DropdownMenuItem(
                  value: readText(item, const ['id'], fallback: ''),
                  child: Text(
                    '${readText(item, const ['examName'])} - ${readText(item, const ['subject'])}',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          onChanged: (value) =>
              setState(() => _scheduleId = value ?? _scheduleId),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _titleController,
          decoration: const InputDecoration(labelText: 'Assessment Title *'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _maxMarksController,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Max Marks *'),
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          initialValue: _status,
          decoration: const InputDecoration(labelText: 'Status'),
          items: const ['Active', 'Draft', 'Archived']
              .map((item) => DropdownMenuItem(value: item, child: Text(item)))
              .toList(),
          onChanged: (value) => setState(() => _status = value ?? _status),
        ),
      ],
    );
  }
}

class _ResultNameSheet extends StatefulWidget {
  const _ResultNameSheet({required this.onSave});

  final Future<void> Function(String resultName) onSave;

  @override
  State<_ResultNameSheet> createState() => _ResultNameSheetState();
}

class _ResultNameSheetState extends State<_ResultNameSheet> {
  final _nameController = TextEditingController();
  var _saving = false;
  var _error = '';

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await widget.onSave(_nameController.text.trim());
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _ExamSheetChrome(
      title: 'Generate Results',
      helper: 'Name this result set before saving it to live data.',
      saving: _saving,
      error: _error,
      saveLabel: 'Generate',
      onSave: _save,
      children: [
        TextField(
          controller: _nameController,
          decoration: const InputDecoration(labelText: 'Result Name *'),
          autofocus: true,
        ),
      ],
    );
  }
}

class _ExamSheetChrome extends StatelessWidget {
  const _ExamSheetChrome({
    required this.title,
    required this.helper,
    required this.children,
    required this.saving,
    required this.error,
    required this.saveLabel,
    required this.onSave,
  });

  final String title;
  final String helper;
  final List<Widget> children;
  final bool saving;
  final String error;
  final String saveLabel;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        18,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.line,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                helper,
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              const SizedBox(height: 14),
              ...children,
              if (error.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  error,
                  style: const TextStyle(
                    color: AppColors.danger,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: saving
                          ? null
                          : () => Navigator.of(context).pop(false),
                      icon: const Icon(Icons.close_rounded, size: 18),
                      label: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: saving ? null : onSave,
                      icon: Icon(
                        saving
                            ? Icons.hourglass_top_rounded
                            : Icons.save_rounded,
                        size: 18,
                      ),
                      label: Text(saving ? 'Saving...' : saveLabel),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StudentCollectionSummary extends StatelessWidget {
  const _StudentCollectionSummary({
    required this.admissions,
    required this.documents,
    required this.health,
  });

  final int admissions;
  final int documents;
  final int health;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Row(
        children: [
          Expanded(
            child: LabelValue(
              label: 'Admissions',
              value: admissions.toString(),
            ),
          ),
          Expanded(
            child: LabelValue(label: 'Documents', value: documents.toString()),
          ),
          Expanded(
            child: LabelValue(label: 'Health', value: health.toString()),
          ),
        ],
      ),
    );
  }
}

enum _StudentCardAction { view, edit, approve, archive, restore }

class _StudentParityCard extends StatelessWidget {
  const _StudentParityCard({
    required this.student,
    required this.onTap,
    required this.canEdit,
    required this.canArchive,
    required this.showApprove,
    required this.onEdit,
    required this.onApprove,
    required this.onArchive,
    required this.onRestore,
  });

  final Map<String, dynamic> student;
  final VoidCallback onTap;
  final bool canEdit;
  final bool canArchive;
  final bool showApprove;
  final VoidCallback onEdit;
  final VoidCallback onApprove;
  final VoidCallback onArchive;
  final VoidCallback onRestore;

  @override
  Widget build(BuildContext context) {
    final archived =
        readText(student, const ['status'], fallback: '').toLowerCase() ==
        'archived';
    return InfoCard(
      onTap: onTap,
      child: Row(
        children: [
          _Avatar(
            label: readText(student, const ['name'], fallback: '?'),
            color: AppColors.accent,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  readText(student, const ['name']),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  '${readText(student, const ['admissionNo'], fallback: 'Admission')} / ${readText(student, const ['studentId'], fallback: 'ID')}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
                const SizedBox(height: 3),
                Text(
                  '${readText(student, const ['className', 'courseYear'], fallback: '-')} - ${readText(student, const ['section', 'admissionType'], fallback: '-')}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          StatusPill(
            label: readText(student, const ['status'], fallback: 'Active'),
          ),
          PopupMenuButton<_StudentCardAction>(
            tooltip: 'Student actions',
            onSelected: (action) {
              switch (action) {
                case _StudentCardAction.view:
                  onTap();
                  break;
                case _StudentCardAction.edit:
                  onEdit();
                  break;
                case _StudentCardAction.approve:
                  onApprove();
                  break;
                case _StudentCardAction.archive:
                  onArchive();
                  break;
                case _StudentCardAction.restore:
                  onRestore();
                  break;
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: _StudentCardAction.view,
                child: ListTile(
                  leading: Icon(Icons.visibility_rounded),
                  title: Text('View'),
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              if (canEdit)
                const PopupMenuItem(
                  value: _StudentCardAction.edit,
                  child: ListTile(
                    leading: Icon(Icons.edit_rounded),
                    title: Text('Edit profile'),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              if (showApprove)
                const PopupMenuItem(
                  value: _StudentCardAction.approve,
                  child: ListTile(
                    leading: Icon(Icons.verified_rounded),
                    title: Text('Approve admission'),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              if (canArchive && !archived)
                const PopupMenuItem(
                  value: _StudentCardAction.archive,
                  child: ListTile(
                    leading: Icon(Icons.archive_rounded),
                    title: Text('Archive student'),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              if (canArchive && archived)
                const PopupMenuItem(
                  value: _StudentCardAction.restore,
                  child: ListTile(
                    leading: Icon(Icons.unarchive_rounded),
                    title: Text('Restore student'),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StudentCard extends StatelessWidget {
  const _StudentCard({required this.student, required this.onTap});

  final Map<String, dynamic> student;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      onTap: onTap,
      child: Row(
        children: [
          _Avatar(
            label: readText(student, const ['name'], fallback: '?'),
            color: AppColors.accent,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  readText(student, const ['name']),
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  '${readText(student, const ['className', 'courseName'], fallback: 'Class')} · ${readText(student, const ['studentId', 'admissionNo'], fallback: 'ID')}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
          StatusPill(
            label: readText(student, const ['status'], fallback: 'Active'),
          ),
        ],
      ),
    );
  }
}

enum _StaffCardAction { view, edit, leave, archive, restore }

class _StaffCard extends StatelessWidget {
  const _StaffCard({
    required this.member,
    required this.onTap,
    required this.canEdit,
    required this.canManageLeave,
    required this.canArchive,
    required this.onEdit,
    required this.onLeave,
    required this.onArchive,
    required this.onRestore,
  });

  final Map<String, dynamic> member;
  final VoidCallback onTap;
  final bool canEdit;
  final bool canManageLeave;
  final bool canArchive;
  final VoidCallback onEdit;
  final VoidCallback onLeave;
  final VoidCallback onArchive;
  final VoidCallback onRestore;

  @override
  Widget build(BuildContext context) {
    final archived =
        readText(member, const ['status'], fallback: '').toLowerCase() ==
        'archived';
    return InfoCard(
      onTap: onTap,
      child: Row(
        children: [
          _Avatar(
            label: readText(member, const ['name'], fallback: '?'),
            color: const Color(0xFFE5835A),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  readText(member, const ['name']),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  '${readText(member, const ['employeeId'], fallback: 'Employee ID')} / ${readText(member, const ['staffType'], fallback: 'Staff')}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
                const SizedBox(height: 3),
                Text(
                  '${readText(member, const ['department'], fallback: 'Department')} - ${readText(member, const ['designation'], fallback: 'Designation')}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          StatusPill(
            label: readText(member, const ['status'], fallback: 'Active'),
          ),
          PopupMenuButton<_StaffCardAction>(
            tooltip: 'Staff actions',
            onSelected: (action) {
              switch (action) {
                case _StaffCardAction.view:
                  onTap();
                  break;
                case _StaffCardAction.edit:
                  onEdit();
                  break;
                case _StaffCardAction.leave:
                  onLeave();
                  break;
                case _StaffCardAction.archive:
                  onArchive();
                  break;
                case _StaffCardAction.restore:
                  onRestore();
                  break;
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: _StaffCardAction.view,
                child: ListTile(
                  leading: Icon(Icons.visibility_rounded),
                  title: Text('View'),
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              if (canEdit)
                const PopupMenuItem(
                  value: _StaffCardAction.edit,
                  child: ListTile(
                    leading: Icon(Icons.edit_rounded),
                    title: Text('Edit record'),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              if (canManageLeave)
                const PopupMenuItem(
                  value: _StaffCardAction.leave,
                  child: ListTile(
                    leading: Icon(Icons.event_busy_rounded),
                    title: Text('Leave request'),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              if (canArchive && !archived)
                const PopupMenuItem(
                  value: _StaffCardAction.archive,
                  child: ListTile(
                    leading: Icon(Icons.archive_rounded),
                    title: Text('Archive record'),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              if (canArchive && archived)
                const PopupMenuItem(
                  value: _StaffCardAction.restore,
                  child: ListTile(
                    leading: Icon(Icons.unarchive_rounded),
                    title: Text('Restore record'),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final initial = label.trim().isEmpty ? '?' : label.trim()[0].toUpperCase();
    return Container(
      height: 44,
      width: 44,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Center(
        child: Text(
          initial,
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.w900,
            fontSize: 18,
          ),
        ),
      ),
    );
  }
}

class _CompactRow extends StatelessWidget {
  const _CompactRow({
    required this.title,
    required this.subtitle,
    required this.trailing,
  });

  final String title;
  final String subtitle;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 11),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          trailing,
        ],
      ),
    );
  }
}

class _AttendanceCalendar extends StatelessWidget {
  const _AttendanceCalendar({required this.records});

  final List<Map<String, dynamic>> records;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final first = DateTime(now.year, now.month);
    final daysInMonth = DateTime(now.year, now.month + 1, 0).day;
    final statuses = <int, String>{};
    for (final record in records) {
      final date = _attendanceRecordDate(record);
      if (date != null && date.year == now.year && date.month == now.month) {
        statuses[date.day] = readText(record, const [
          'status',
        ], fallback: 'Present');
      }
    }

    final cells = <Widget>[];
    for (var i = 1; i < first.weekday; i++) {
      cells.add(const SizedBox.square(dimension: 34));
    }
    for (var day = 1; day <= daysInMonth; day++) {
      final status = statuses[day] ?? '';
      cells.add(_DayDot(day: day, status: status));
    }

    return InfoCard(
      child: Column(
        children: [
          Text(
            DateFormat('MMMM yyyy').format(now),
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 14),
          Wrap(spacing: 8, runSpacing: 8, children: cells),
          const SizedBox(height: 16),
          const Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              _Legend(color: AppColors.accent, label: 'Present'),
              _Legend(color: AppColors.danger, label: 'Absent'),
              _Legend(color: AppColors.festival, label: 'Festival'),
              _Legend(color: AppColors.warning, label: 'Late'),
            ],
          ),
        ],
      ),
    );
  }
}

class _DayDot extends StatelessWidget {
  const _DayDot({required this.day, required this.status});

  final int day;
  final String status;

  @override
  Widget build(BuildContext context) {
    final normalized = status.toLowerCase();
    final color = normalized.contains('absent')
        ? AppColors.danger
        : normalized.contains('festival')
        ? AppColors.festival
        : normalized.contains('late')
        ? AppColors.warning
        : status.isEmpty
        ? AppColors.line
        : AppColors.accent;
    return Container(
      height: 34,
      width: 34,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: status.isEmpty ? Colors.transparent : color,
        border: Border.all(color: status.isEmpty ? AppColors.line : color),
      ),
      child: Center(
        child: Text(
          day.toString(),
          style: TextStyle(
            color: status.isEmpty ? AppColors.muted : Colors.white,
            fontSize: 11,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 8, height: 8, color: color),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: AppColors.muted),
        ),
      ],
    );
  }
}

class _DayPanel extends StatefulWidget {
  const _DayPanel({required this.day, required this.entries});

  final String day;
  final List<Map<String, dynamic>> entries;

  @override
  State<_DayPanel> createState() => _DayPanelState();
}

class _DayPanelState extends State<_DayPanel> {
  var _open = false;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InfoCard(
        padding: const EdgeInsets.all(0),
        child: Column(
          children: [
            InkWell(
              onTap: () => setState(() => _open = !_open),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 13,
                  vertical: 12,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        widget.day,
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                    Text(
                      widget.entries.length.toString(),
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Icon(
                      _open
                          ? Icons.remove_circle_outline_rounded
                          : Icons.add_circle_outline_rounded,
                      size: 19,
                    ),
                  ],
                ),
              ),
            ),
            if (_open)
              Padding(
                padding: const EdgeInsets.fromLTRB(13, 0, 13, 12),
                child: widget.entries.isEmpty
                    ? const Text(
                        'No classes scheduled.',
                        style: TextStyle(color: AppColors.muted, fontSize: 12),
                      )
                    : Column(
                        children: widget.entries
                            .map(
                              (entry) => Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Row(
                                  children: [
                                    SizedBox(
                                      width: 72,
                                      child: Text(
                                        readText(entry, const [
                                          'time',
                                          'startTime',
                                        ], fallback: '-'),
                                        style: const TextStyle(fontSize: 11),
                                      ),
                                    ),
                                    Expanded(
                                      child: Text(
                                        readText(entry, const [
                                          'subject',
                                          'subjectName',
                                        ], fallback: 'Subject'),
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                    Expanded(
                                      child: Text(
                                        readText(entry, const [
                                          'teacherName',
                                          'staffName',
                                        ], fallback: '-'),
                                        textAlign: TextAlign.end,
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: AppColors.muted,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            )
                            .toList(),
                      ),
              ),
          ],
        ),
      ),
    );
  }
}

class _MarksTable extends StatelessWidget {
  const _MarksTable({required this.marks});

  final List<Map<String, dynamic>> marks;

  @override
  Widget build(BuildContext context) {
    if (marks.isEmpty) {
      return const EmptyState(
        title: 'No marks found',
        message: 'Marks entries and results will appear here.',
      );
    }
    return InfoCard(
      padding: const EdgeInsets.all(0),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columnSpacing: 22,
          headingRowHeight: 42,
          dataRowMinHeight: 38,
          dataRowMaxHeight: 42,
          columns: const [
            DataColumn(label: Text('Subject')),
            DataColumn(label: Text('Test 1')),
            DataColumn(label: Text('Test 2')),
            DataColumn(label: Text('Total')),
          ],
          rows: marks.take(12).map((mark) {
            final score = readNumber(mark, const [
              'marksObtained',
              'marks',
              'score',
              'securedMarks',
            ]);
            final max = readNumber(mark, const [
              'maxMarks',
              'totalMarks',
            ], fallback: 100);
            return DataRow(
              cells: [
                DataCell(
                  Text(
                    readText(mark, const [
                      'subject',
                      'subjectName',
                    ], fallback: 'Subject'),
                  ),
                ),
                DataCell(
                  Text('${score.toStringAsFixed(0)}/${max.toStringAsFixed(0)}'),
                ),
                DataCell(
                  Text(
                    readText(mark, const [
                      'test2',
                      'internalMarks',
                    ], fallback: '-'),
                  ),
                ),
                DataCell(
                  Text(
                    readText(mark, const [
                      'grade',
                      'result',
                    ], fallback: score.toStringAsFixed(0)),
                  ),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _MonthStrip extends StatelessWidget {
  const _MonthStrip({required this.items});

  final List<Map<String, dynamic>> items;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    return InfoCard(
      child: Column(
        children: [
          Text(
            DateFormat('MMMM yyyy').format(now),
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: List.generate(30, (index) {
              final day = index + 1;
              final hasItem = items.any((item) {
                final date = readDate(
                  item['publishDate'] ?? item['eventDate'] ?? item['createdAt'],
                );
                return date != null &&
                    date.year == now.year &&
                    date.month == now.month &&
                    date.day == day;
              });
              return Container(
                height: 30,
                width: 30,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: hasItem ? AppColors.festival : Colors.transparent,
                  border: Border.all(
                    color: hasItem ? AppColors.festival : AppColors.line,
                  ),
                ),
                child: Center(
                  child: Text(
                    day.toString(),
                    style: TextStyle(
                      color: hasItem ? Colors.white : AppColors.ink,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _StaffDetailSheet extends StatelessWidget {
  const _StaffDetailSheet({
    required this.member,
    required this.data,
    required this.controller,
    required this.canEdit,
    required this.canManageLeave,
    required this.canMarkAttendance,
    required this.onEdit,
    required this.onLeave,
    required this.onAttendance,
    required this.onLeaveDecision,
  });

  final Map<String, dynamic> member;
  final Map<String, List<Map<String, dynamic>>> data;
  final ScrollController controller;
  final bool canEdit;
  final bool canManageLeave;
  final bool canMarkAttendance;
  final VoidCallback onEdit;
  final VoidCallback onLeave;
  final ValueChanged<String> onAttendance;
  final void Function(Map<String, dynamic> leave, String status)
  onLeaveDecision;

  @override
  Widget build(BuildContext context) {
    final attendance = _relatedStaff(data['attendance'] ?? const []);
    final leave = _relatedStaff(data['leave'] ?? const []);
    final timetable = _relatedTimetable(data['timetable'] ?? const []);
    final present = attendance
        .where((item) => readText(item, const ['status']) == 'Present')
        .length;
    final absent = attendance
        .where((item) => readText(item, const ['status']) == 'Absent')
        .length;
    final rate = attendance.isEmpty ? 0 : (present / attendance.length * 100);

    return Material(
      color: AppColors.page,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
      child: ListView(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        children: [
          Center(
            child: Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.line,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _Avatar(
                label: readText(member, const ['name'], fallback: '?'),
                color: const Color(0xFFE5835A),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      readText(member, const ['name']),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${readText(member, const ['employeeId'], fallback: '-')} / ${readText(member, const ['staffType'], fallback: '-')}',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              StatusPill(
                label: readText(member, const ['status'], fallback: 'Active'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (canEdit)
                OutlinedButton.icon(
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_rounded, size: 18),
                  label: const Text('Edit'),
                ),
              if (canManageLeave)
                OutlinedButton.icon(
                  onPressed: onLeave,
                  icon: const Icon(Icons.event_busy_rounded, size: 18),
                  label: const Text('Leave'),
                ),
            ],
          ),
          const SizedBox(height: 14),
          InfoCard(
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: LabelValue(
                        label: 'Department',
                        value: readText(member, const ['department']),
                      ),
                    ),
                    Expanded(
                      child: LabelValue(
                        label: 'Designation',
                        value: readText(member, const ['designation']),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: LabelValue(
                        label: 'Phone',
                        value: readText(member, const ['phone']),
                      ),
                    ),
                    Expanded(
                      child: LabelValue(
                        label: 'Email',
                        value: readText(member, const ['email']),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                LabelValue(
                  label: 'Qualification',
                  value: readText(member, const ['qualification']),
                ),
              ],
            ),
          ),
          if (canMarkAttendance) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => onAttendance('Present'),
                    icon: const Icon(Icons.check_circle_rounded, size: 18),
                    label: const Text('Mark Present'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => onAttendance('Absent'),
                    icon: const Icon(Icons.cancel_rounded, size: 18),
                    label: const Text('Mark Absent'),
                  ),
                ),
              ],
            ),
          ],
          const SectionTitle('Extracted Information'),
          InfoCard(
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: LabelValue(
                        label: 'Institution',
                        value: readText(member, const ['institution']),
                      ),
                    ),
                    Expanded(
                      child: LabelValue(
                        label: 'Specialization',
                        value: readText(member, const ['specialization']),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: LabelValue(
                        label: 'Joining Date',
                        value: readText(member, const ['joiningDate']),
                      ),
                    ),
                    Expanded(
                      child: LabelValue(
                        label: 'Appointment',
                        value: readText(member, const ['appointmentType']),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                LabelValue(
                  label: 'Previous Experience',
                  value: readText(member, const ['previousExperience']),
                ),
              ],
            ),
          ),
          const SectionTitle('Attendance Graph'),
          InfoCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                LabelValue(label: 'Attendance Rate', value: '${rate.round()}%'),
                const SizedBox(height: 10),
                LinearProgressIndicator(
                  value: attendance.isEmpty ? 0 : rate / 100,
                  backgroundColor: AppColors.line,
                  color: AppColors.accent,
                  minHeight: 8,
                  borderRadius: BorderRadius.circular(999),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: LabelValue(
                        label: 'Present',
                        value: present.toString(),
                      ),
                    ),
                    Expanded(
                      child: LabelValue(
                        label: 'Absent',
                        value: absent.toString(),
                      ),
                    ),
                    Expanded(
                      child: LabelValue(
                        label: 'Records',
                        value: attendance.length.toString(),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SectionTitle('Timetable'),
          if (timetable.isEmpty)
            const EmptyState(
              title: 'No timetable entries',
              message: 'No timetable entries assigned.',
            )
          else
            ...timetable
                .take(8)
                .map(
                  (entry) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _CompactRow(
                      title: readText(entry, const [
                        'subject',
                        'subjectName',
                      ], fallback: 'Class'),
                      subtitle:
                          '${readText(entry, const ['day'], fallback: '-')} | ${readText(entry, const ['timeSlot', 'time'], fallback: '-')} | ${readText(entry, const ['classKey', 'className'], fallback: '-')}',
                      trailing: const Icon(
                        Icons.calendar_month_rounded,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ),
          const SectionTitle('Leave Management'),
          if (leave.isEmpty)
            const EmptyState(
              title: 'No leave records',
              message: 'No leave records.',
            )
          else
            ...leave
                .take(8)
                .map(
                  (record) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: InfoCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  readText(record, const ['leaveType']),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ),
                              StatusPill(
                                label: readText(record, const ['status']),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${readText(record, const ['fromDate'])} to ${readText(record, const ['toDate'])}',
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(readText(record, const ['reason'])),
                          if (canManageLeave &&
                              readText(record, const ['status']) ==
                                  'Pending Review') ...[
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () =>
                                        onLeaveDecision(record, 'Approved'),
                                    icon: const Icon(
                                      Icons.check_circle_rounded,
                                      size: 18,
                                    ),
                                    label: const Text('Approve'),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () =>
                                        onLeaveDecision(record, 'Rejected'),
                                    icon: const Icon(
                                      Icons.cancel_rounded,
                                      size: 18,
                                    ),
                                    label: const Text('Reject'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
          const SectionTitle('Attendance'),
          _RelatedList(items: attendance, empty: 'No attendance marked.'),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _relatedStaff(List<Map<String, dynamic>> records) {
    final recordId = readText(member, const ['id'], fallback: '');
    final employeeId = readText(member, const ['employeeId'], fallback: '');
    return records.where((record) {
      return readText(record, const ['staffRecordId'], fallback: '') ==
              recordId ||
          readText(record, const ['employeeId'], fallback: '') == employeeId;
    }).toList();
  }

  List<Map<String, dynamic>> _relatedTimetable(
    List<Map<String, dynamic>> records,
  ) {
    final recordId = readText(member, const ['id'], fallback: '');
    final name = readText(member, const ['name'], fallback: '');
    return records.where((entry) {
      return readText(entry, const [
                'facultyId',
                'staffRecordId',
              ], fallback: '') ==
              recordId ||
          readText(entry, const [
                'facultyName',
                'teacherName',
                'staffName',
              ], fallback: '') ==
              name;
    }).toList();
  }
}

class _StudentDetailSheet extends StatefulWidget {
  const _StudentDetailSheet({
    required this.student,
    required this.data,
    required this.controller,
    required this.canEdit,
    required this.canArchive,
    required this.showApprove,
    required this.canManageHealthRecord,
    required this.onEdit,
    required this.onApprove,
    required this.onArchive,
    required this.onRestore,
    required this.onEditHealthRecord,
    required this.onDeleteHealthRecord,
  });

  final Map<String, dynamic> student;
  final Map<String, List<Map<String, dynamic>>> data;
  final ScrollController controller;
  final bool canEdit;
  final bool canArchive;
  final bool showApprove;
  final bool canManageHealthRecord;
  final VoidCallback onEdit;
  final VoidCallback onApprove;
  final VoidCallback onArchive;
  final VoidCallback onRestore;
  final ValueChanged<Map<String, dynamic>?> onEditHealthRecord;
  final ValueChanged<Map<String, dynamic>> onDeleteHealthRecord;

  @override
  State<_StudentDetailSheet> createState() => _StudentDetailSheetState();
}

class _StudentDetailSheetState extends State<_StudentDetailSheet> {
  var _tab = 0;
  var _showAllDetails = false;

  @override
  Widget build(BuildContext context) {
    final student = widget.student;
    final studentId = readText(student, const ['studentId'], fallback: '');
    final recordId = readText(student, const ['id'], fallback: '');
    final attendance = _related(
      widget.data['attendance'] ?? widget.data['studentAttendance'] ?? const [],
      studentId,
      recordId,
    );
    final marks = _related(
      widget.data['marks'] ?? const [],
      studentId,
      recordId,
    );
    final fees = _related(widget.data['fees'] ?? const [], studentId, recordId);
    final collections = _related(
      widget.data['collections'] ?? const [],
      studentId,
      recordId,
    );
    final results = _related(
      widget.data['results'] ?? const [],
      studentId,
      recordId,
    );
    final documents = _related(
      widget.data['documents'] ?? const [],
      studentId,
      recordId,
    );
    final promotions = _related(
      widget.data['promotions'] ?? const [],
      studentId,
      recordId,
    );
    final transfers = _related(
      widget.data['transfers'] ?? const [],
      studentId,
      recordId,
    );
    final health = _related(
      widget.data['health'] ?? const [],
      studentId,
      recordId,
    );
    final admissions = _related(
      widget.data['admissions'] ?? const [],
      studentId,
      recordId,
    );
    final latestAdmission = admissions.isEmpty ? null : admissions.last;
    final archived =
        readText(student, const ['status'], fallback: '').toLowerCase() ==
        'archived';

    return Material(
      color: AppColors.page,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
      child: ListView(
        controller: widget.controller,
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        children: [
          Center(
            child: Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.line,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _Avatar(
                label: readText(student, const ['name'], fallback: '?'),
                color: AppColors.accent,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      readText(student, const ['name']),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${readText(student, const ['className', 'courseName'], fallback: 'Class')} · Roll no: ${readText(student, const ['rollNo', 'studentId'], fallback: '-')}',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (widget.canEdit)
                OutlinedButton.icon(
                  onPressed: widget.onEdit,
                  icon: const Icon(Icons.edit_rounded, size: 18),
                  label: const Text('Edit'),
                ),
              if (widget.showApprove)
                FilledButton.icon(
                  onPressed: widget.onApprove,
                  icon: const Icon(Icons.verified_rounded, size: 18),
                  label: const Text('Approve'),
                ),
              if (widget.canArchive && !archived)
                OutlinedButton.icon(
                  onPressed: widget.onArchive,
                  icon: const Icon(Icons.archive_rounded, size: 18),
                  label: const Text('Archive'),
                ),
              if (widget.canArchive && archived)
                OutlinedButton.icon(
                  onPressed: widget.onRestore,
                  icon: const Icon(Icons.unarchive_rounded, size: 18),
                  label: const Text('Restore'),
                ),
            ],
          ),
          const SizedBox(height: 16),
          InfoCard(
            child: Row(
              children: [
                Expanded(
                  child: LabelValue(
                    label: 'Registration number',
                    value: readText(student, const [
                      'registrationNo',
                      'admissionNo',
                      'studentId',
                    ]),
                  ),
                ),
                Expanded(
                  child: LabelValue(
                    label: 'Academic year',
                    value: readText(student, const ['academicYear']),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _Tabs(
            labels: _studentDetailTabLabels(
              attendance: attendance,
              marks: marks,
              results: results,
              fees: fees,
              documents: documents,
              health: health,
            ),
            selected: _tab,
            onChanged: (index) => setState(() => _tab = index),
          ),
          const SizedBox(height: 14),
          if (_tab == 0)
            _StudentInfo(
              student: student,
              documents: documents,
              promotions: promotions,
              transfers: transfers,
              latestAdmission: latestAdmission,
              showAllDetails: _showAllDetails,
              onToggleAllDetails: () =>
                  setState(() => _showAllDetails = !_showAllDetails),
            ),
          if (_tab == 1) _StudentAttendanceTab(records: attendance),
          if (_tab == 2) _StudentExamTab(marks: marks, results: results),
          if (_tab == 3)
            _StudentPaymentTab(assignments: fees, collections: collections),
          if (_tab == 4)
            _RelatedList(
              items: documents,
              empty: 'No student document records available.',
            ),
          if (_tab == 5)
            _StudentHealthRecordView(
              record: health.isEmpty ? null : health.last,
              canManage: widget.canManageHealthRecord,
              onEdit: () => widget.onEditHealthRecord(
                health.isEmpty ? null : health.last,
              ),
              onDelete: health.isEmpty
                  ? null
                  : () => widget.onDeleteHealthRecord(health.last),
            ),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _related(
    List<Map<String, dynamic>> items,
    String studentId,
    String recordId,
  ) {
    return items.where((item) {
      final values = [
        readText(item, const ['studentId'], fallback: ''),
        readText(item, const ['entityId'], fallback: ''),
        readText(item, const ['ownerId'], fallback: ''),
        readText(item, const ['studentRecordId'], fallback: ''),
        readText(item, const ['entityRecordId'], fallback: ''),
        readText(item, const ['ownerRecordId'], fallback: ''),
      ];
      return values.contains(studentId) || values.contains(recordId);
    }).toList();
  }
}

List<String> _studentDetailTabLabels({
  required List<Map<String, dynamic>> attendance,
  required List<Map<String, dynamic>> marks,
  required List<Map<String, dynamic>> results,
  required List<Map<String, dynamic>> fees,
  required List<Map<String, dynamic>> documents,
  required List<Map<String, dynamic>> health,
}) {
  final generalAttendance = attendance
      .where(
        (record) => readText(record, const [
          'subjectName',
          'subject',
        ], fallback: '').isEmpty,
      )
      .toList();
  final present = generalAttendance
      .where((record) => readText(record, const ['status']) == 'Present')
      .length;
  final attendancePercentage = generalAttendance.isEmpty
      ? 0
      : (present / generalAttendance.length * 100).round();
  final due = fees.fold<num>(0, (total, item) => total + _studentFeeDue(item));
  return [
    'Profile',
    'Attendance $attendancePercentage%',
    'Exams ${marks.length + results.length}',
    due > 0 ? 'Payment ${formatMoney(due)}' : 'Payment Clear',
    'Docs ${documents.length}',
    health.isEmpty ? 'Health Empty' : 'Health Uploaded',
  ];
}

num _studentFeeDue(Map<String, dynamic> assignment) {
  final explicit = readNumber(assignment, const [
    'dueAmount',
    'balanceAmount',
    'amountDue',
  ], fallback: -1);
  if (explicit >= 0) return explicit;
  final total = readNumber(assignment, const ['totalAmount'], fallback: 0);
  final paid = readNumber(assignment, const ['paidAmount'], fallback: 0);
  final adjusted = readNumber(assignment, const [
    'adjustmentAmount',
    'adjustedAmount',
  ], fallback: 0);
  final due = total - paid - adjusted;
  return due > 0 ? due : 0;
}

class _Tabs extends StatelessWidget {
  const _Tabs({
    required this.labels,
    required this.selected,
    required this.onChanged,
  });

  final List<String> labels;
  final int selected;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(labels.length, (index) {
          final active = selected == index;
          return InkWell(
            onTap: () => onChanged(index),
            child: Container(
              width: 112,
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: active ? AppColors.ink : AppColors.line,
                    width: active ? 2 : 1,
                  ),
                ),
              ),
              child: Text(
                labels[index],
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: active ? FontWeight.w900 : FontWeight.w600,
                  color: active ? AppColors.ink : AppColors.muted,
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _StudentDetailGroupData {
  const _StudentDetailGroupData({required this.title, required this.fields});

  final String title;
  final List<(String, String)> fields;
}

List<_StudentDetailGroupData> _studentDetailGroups(
  Map<String, dynamic> student,
) {
  List<(String, String)> visible(List<List<String>> fields) {
    return fields
        .map((field) {
          final value = readText(student, [field.first], fallback: '');
          return (field.last, value);
        })
        .where((field) => field.$2.isNotEmpty)
        .toList();
  }

  return [
    _StudentDetailGroupData(
      title: 'RGUHS Admission Details',
      fields: visible(const [
        ['nameAsInAadhaar', 'Name as in Aadhaar'],
        ['fatherName', 'Father name'],
        ['motherName', 'Mother name'],
        ['nationality', 'Nationality'],
        ['state', 'State'],
        ['ruralUrban', 'Rural / Urban'],
        ['religion', 'Religion'],
        ['seatType', 'Admission seat type'],
        ['govtSeatType', 'Govt seat type'],
        ['actualCategory', 'Actual category'],
        ['seatSelectCategory', 'Seat select category'],
        ['admissionDate', 'Date of admission'],
      ]),
    ),
    _StudentDetailGroupData(
      title: 'Entrance & Qualifying Exam',
      fields: visible(const [
        ['keaCetNumber', 'KEA CET Number'],
        ['sspId', 'SSP ID'],
        ['neetRegNo', 'NEET Reg No'],
        ['neetRank', 'NEET Rank'],
        ['cetRegNo', 'CET Reg No'],
        ['cetRank', 'CET Rank'],
        ['qualifyingExamName', 'Qualifying Exam'],
        ['qualifyingExamRegNo', 'Qualifying Exam Reg No'],
        ['qualifyingMaxMarks', 'Qualifying Max Marks'],
        ['qualifyingSecuredMarks', 'Qualifying Secured Marks'],
        ['qualifyingPassDate', 'Qualifying Pass Date'],
        ['qualifyingBoard', 'University / Board'],
        ['optionalSubject', 'Optional Subject'],
        ['optionalMaxMarks', 'Optional Max Marks'],
        ['optionalSecuredMarks', 'Optional Secured Marks'],
      ]),
    ),
    _StudentDetailGroupData(
      title: 'Lateral Entry Diploma Details',
      fields: visible(const [
        ['diplomaCourse', 'Diploma Course'],
        ['diplomaCourseDuration', 'Diploma Duration'],
        ['diplomaPassedDate', 'Diploma Passed Date'],
        ['diplomaBoard', 'Diploma University / Board'],
        ['diplomaMaxMarks', 'Diploma Max Marks'],
        ['diplomaSecuredMarks', 'Diploma Secured Marks'],
      ]),
    ),
    _StudentDetailGroupData(
      title: 'Caste & Income Certificate Details',
      fields: visible(const [
        ['casteRdNumber', 'Caste RD Number'],
        ['casteCategory', 'Caste Category'],
        ['casteName', 'Caste Name'],
        ['casteCertificateStudentName', 'Student Name in Caste Certificate'],
        ['casteCertificateFatherName', 'Father Name in Caste Certificate'],
        ['incomeRdNumber', 'Income RD Number'],
        ['incomeCategory', 'Income Category'],
        ['incomeCasteName', 'Caste Name in Income Certificate'],
        ['annualIncome', 'Annual Income'],
        ['incomeCertificateStudentName', 'Student Name in Income Certificate'],
        ['incomeCertificateFatherName', 'Father Name in Income Certificate'],
      ]),
    ),
  ].where((group) => group.fields.isNotEmpty).toList();
}

class _StudentMiniMetric extends StatelessWidget {
  const _StudentMiniMetric({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: AppColors.muted, fontSize: 11),
          ),
          const SizedBox(height: 5),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: color,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _StudentDetailGroup extends StatelessWidget {
  const _StudentDetailGroup({required this.title, required this.fields});

  final String title;
  final List<(String, String)> fields;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          ...fields.map(
            (field) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: LabelValue(label: field.$1, value: field.$2),
            ),
          ),
        ],
      ),
    );
  }
}

class _StudentInfo extends StatelessWidget {
  const _StudentInfo({
    required this.student,
    required this.documents,
    required this.promotions,
    required this.transfers,
    required this.latestAdmission,
    required this.showAllDetails,
    required this.onToggleAllDetails,
  });

  final Map<String, dynamic> student;
  final List<Map<String, dynamic>> documents;
  final List<Map<String, dynamic>> promotions;
  final List<Map<String, dynamic>> transfers;
  final Map<String, dynamic>? latestAdmission;
  final bool showAllDetails;
  final VoidCallback onToggleAllDetails;

  @override
  Widget build(BuildContext context) {
    final verifiedDocs = documents
        .where(
          (item) => ['Verified', 'Source PDF'].contains(
            readText(item, const ['verificationStatus'], fallback: ''),
          ),
        )
        .length;
    final pendingDocs = documents
        .where(
          (item) =>
              readText(item, const ['verificationStatus'], fallback: '') ==
              'Pending Review',
        )
        .length;
    return Column(
      children: [
        InfoCard(
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: LabelValue(
                      label: 'Father name',
                      value: readText(student, const [
                        'fatherName',
                        'guardianName',
                      ]),
                    ),
                  ),
                  Expanded(
                    child: LabelValue(
                      label: 'Mother name',
                      value: readText(student, const ['motherName']),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: LabelValue(
                      label: 'Phone no.',
                      value: readText(student, const [
                        'phone',
                        'mobileNo',
                        'alternatePhoneNo',
                      ]),
                    ),
                  ),
                  Expanded(
                    child: LabelValue(
                      label: 'Email',
                      value: readText(student, const [
                        'email',
                        'guardianEmail',
                      ]),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              LabelValue(
                label: 'Address',
                value: readText(student, const ['address']),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: LabelValue(
                      label: 'Date of birth',
                      value: formatDateValue(
                        student['dob'] ?? student['dateOfBirth'],
                      ),
                    ),
                  ),
                  Expanded(
                    child: LabelValue(
                      label: 'Gender',
                      value: readText(student, const ['gender']),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _StudentMiniMetric(
                label: 'Verified Docs',
                value: verifiedDocs.toString(),
                color: AppColors.accent,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _StudentMiniMetric(
                label: 'Pending Docs',
                value: pendingDocs.toString(),
                color: AppColors.warning,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _StudentMiniMetric(
                label: 'Promotions',
                value: promotions.length.toString(),
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _StudentMiniMetric(
                label: 'Transfers',
                value: transfers.length.toString(),
                color: AppColors.danger,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        InfoCard(
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: LabelValue(
                      label: 'Guardian',
                      value: readText(student, const ['guardianName']),
                    ),
                  ),
                  Expanded(
                    child: LabelValue(
                      label: 'Course',
                      value: readText(student, const ['courseName', 'program']),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: LabelValue(
                      label: 'Admission status',
                      value: readText(latestAdmission ?? student, const [
                        'status',
                      ], fallback: 'Pending Approval'),
                    ),
                  ),
                  Expanded(
                    child: LabelValue(
                      label: 'Created on',
                      value: readText(
                        student,
                        const ['createdAtText'],
                        fallback: readText(latestAdmission ?? const {}, const [
                          'submittedAtText',
                        ], fallback: 'today'),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        InfoCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Parent Portal View',
                      style: TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ),
                  StatusPill(label: 'View only'),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: LabelValue(
                      label: 'Guardian',
                      value: readText(student, const ['guardianName']),
                    ),
                  ),
                  Expanded(
                    child: LabelValue(
                      label: 'ID Holder',
                      value: readText(student, const ['idHolder']),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: LabelValue(
                      label: 'Class',
                      value:
                          '${readText(student, const ['className'], fallback: '-')} - ${readText(student, const ['section'], fallback: '-')}',
                    ),
                  ),
                  Expanded(
                    child: LabelValue(
                      label: 'Academic Year',
                      value: readText(student, const ['academicYear']),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: onToggleAllDetails,
            icon: Icon(
              showAllDetails
                  ? Icons.visibility_off_rounded
                  : Icons.visibility_rounded,
              size: 18,
            ),
            label: Text(
              showAllDetails ? 'Hide all details' : 'View all details',
            ),
          ),
        ),
        if (showAllDetails) ...[
          const SizedBox(height: 10),
          ..._studentDetailGroups(student).map(
            (group) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _StudentDetailGroup(
                title: group.title,
                fields: group.fields,
              ),
            ),
          ),
        ],
        if (documents.isNotEmpty) ...[
          const SectionTitle('Documents'),
          ...documents
              .take(8)
              .map(
                (doc) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _CompactRow(
                    title: readText(doc, const [
                      'title',
                      'documentType',
                      'fileName',
                    ]),
                    subtitle: readText(doc, const [
                      'verificationStatus',
                      'status',
                    ], fallback: 'Document'),
                    trailing: const Icon(
                      Icons.folder_rounded,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ),
        ],
      ],
    );
  }
}

class _StudentAttendanceTab extends StatelessWidget {
  const _StudentAttendanceTab({required this.records});

  final List<Map<String, dynamic>> records;

  @override
  Widget build(BuildContext context) {
    final general = records
        .where(
          (record) => readText(record, const [
            'subjectName',
            'subject',
          ], fallback: '').isEmpty,
        )
        .toList();
    final present = general
        .where((record) => readText(record, const ['status']) == 'Present')
        .length;
    final absent = general
        .where((record) => readText(record, const ['status']) == 'Absent')
        .length;
    final leave = general
        .where(
          (record) => [
            'Leave',
            'On Leave',
          ].contains(readText(record, const ['status'], fallback: '')),
        )
        .length;
    final percentage = general.isEmpty ? 0 : (present / general.length * 100);
    return Column(
      children: [
        InfoCard(
          child: Column(
            children: [
              LabelValue(
                label: 'General Attendance',
                value: '${percentage.round()}% Present',
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: LabelValue(
                      label: 'Present',
                      value: present.toString(),
                    ),
                  ),
                  Expanded(
                    child: LabelValue(
                      label: 'Absent',
                      value: absent.toString(),
                    ),
                  ),
                  Expanded(
                    child: LabelValue(label: 'Leave', value: leave.toString()),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SectionTitle('Subject-wise Attendance'),
        _RelatedList(
          items: records
              .where(
                (record) => readText(record, const [
                  'subjectName',
                  'subject',
                ], fallback: '').isNotEmpty,
              )
              .toList(),
          empty: 'No subject-wise attendance records available.',
        ),
      ],
    );
  }
}

class _StudentExamTab extends StatelessWidget {
  const _StudentExamTab({required this.marks, required this.results});

  final List<Map<String, dynamic>> marks;
  final List<Map<String, dynamic>> results;

  @override
  Widget build(BuildContext context) {
    final allRows = [...marks, ...results];
    final percentages = allRows
        .map((item) => readNumber(item, const ['percentage']))
        .where((value) => value > 0)
        .toList();
    final average = percentages.isEmpty
        ? 0
        : percentages.reduce((a, b) => a + b) / percentages.length;
    return Column(
      children: [
        InfoCard(
          child: Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Marks Entries',
                  value: marks.length.toString(),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Results',
                  value: results.length.toString(),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Average',
                  value: '${average.round()}%',
                ),
              ),
            ],
          ),
        ),
        const SectionTitle('Subject-wise Exam Performance'),
        _RelatedList(
          items: allRows,
          empty: 'No exam marks or result records available.',
        ),
      ],
    );
  }
}

class _StudentPaymentTab extends StatelessWidget {
  const _StudentPaymentTab({
    required this.assignments,
    required this.collections,
  });

  final List<Map<String, dynamic>> assignments;
  final List<Map<String, dynamic>> collections;

  @override
  Widget build(BuildContext context) {
    final assigned = assignments.fold<num>(
      0,
      (total, item) => total + readNumber(item, const ['totalAmount']),
    );
    final paid = assignments.fold<num>(
      0,
      (total, item) => total + readNumber(item, const ['paidAmount']),
    );
    final adjusted = assignments.fold<num>(
      0,
      (total, item) => total + readNumber(item, const ['adjustmentAmount']),
    );
    final due = assignments.fold<num>(
      0,
      (total, item) => total + _studentFeeDue(item),
    );
    final collected = collections.fold<num>(
      0,
      (total, item) => total + readNumber(item, const ['amount', 'paidAmount']),
    );
    return Column(
      children: [
        InfoCard(
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: LabelValue(
                      label: 'Assigned',
                      value: formatMoney(assigned),
                    ),
                  ),
                  Expanded(
                    child: LabelValue(label: 'Paid', value: formatMoney(paid)),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: LabelValue(
                      label: 'Adjusted',
                      value: formatMoney(adjusted),
                    ),
                  ),
                  Expanded(
                    child: LabelValue(
                      label: 'Collected',
                      value: formatMoney(collected),
                    ),
                  ),
                  Expanded(
                    child: LabelValue(label: 'Due', value: formatMoney(due)),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SectionTitle('Fee Assignments'),
        _RelatedList(
          items: assignments,
          empty: 'No fee assignment records available.',
        ),
        const SectionTitle('Payment Records'),
        _RelatedList(
          items: collections,
          empty: 'No payment records available.',
        ),
      ],
    );
  }
}

class _StudentHealthRecordView extends StatelessWidget {
  const _StudentHealthRecordView({
    required this.record,
    required this.canManage,
    required this.onEdit,
    required this.onDelete,
  });

  final Map<String, dynamic>? record;
  final bool canManage;
  final VoidCallback onEdit;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final health = record;
    if (health == null) {
      return Column(
        children: [
          if (canManage)
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton.icon(
                onPressed: onEdit,
                icon: const Icon(Icons.upload_file_rounded, size: 18),
                label: const Text('Upload Health Record'),
              ),
            ),
          const EmptyState(
            title: 'No health record',
            message: 'No student health record is uploaded yet.',
          ),
        ],
      );
    }
    final identification = _asMap(health['identification']);
    final personalHistory = _asMap(health['personalHistory']);
    final vaccinations = _asMap(personalHistory['vaccinations']);
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (canManage) ...[
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_rounded, size: 18),
                  label: const Text('Edit'),
                ),
                if (onDelete != null)
                  OutlinedButton.icon(
                    onPressed: onDelete,
                    icon: const Icon(Icons.delete_rounded, size: 18),
                    label: const Text('Delete'),
                  ),
              ],
            ),
            const SizedBox(height: 14),
          ],
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Student',
                  value: readText(
                    identification,
                    const ['studentName'],
                    fallback: readText(health, const ['studentName']),
                  ),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Academic year',
                  value: readText(
                    identification,
                    const ['academicYear'],
                    fallback: readText(health, const ['academicYear']),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: LabelValue(
                  label: 'Blood group',
                  value: readText(
                    personalHistory,
                    const ['bloodGroupType'],
                    fallback: readText(health, const ['bloodGroup']),
                  ),
                ),
              ),
              Expanded(
                child: LabelValue(
                  label: 'Emergency phone',
                  value: readText(identification, const ['emergencyPhone']),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          LabelValue(
            label: 'Allergies',
            value: readText(personalHistory, const ['allergies']),
          ),
          const SizedBox(height: 14),
          LabelValue(
            label: 'Current medications',
            value: readText(personalHistory, const ['currentMedications']),
          ),
          const SizedBox(height: 14),
          LabelValue(
            label: 'Final remarks',
            value: readText(health, const ['finalRemarks']),
          ),
          const SizedBox(height: 14),
          LabelValue(
            label: 'Vaccination status',
            value: healthVaccineStatus
                .map(
                  (field) =>
                      '${field.label}: ${readText(vaccinations, [field.key])}',
                )
                .join('\n'),
          ),
        ],
      ),
    );
  }
}

class _RelatedList extends StatelessWidget {
  const _RelatedList({required this.items, required this.empty});

  final List<Map<String, dynamic>> items;
  final String empty;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return EmptyState(title: 'No records', message: empty);
    return Column(
      children: items.take(20).map((item) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: _CompactRow(
            title: readText(item, const [
              'title',
              'subject',
              'feeName',
              'status',
              'documentType',
            ], fallback: 'Record'),
            subtitle: readText(item, const [
              'examName',
              'academicYear',
              'message',
            ], fallback: formatDateValue(item['date'] ?? item['createdAt'])),
            trailing: StatusPill(
              label: readText(item, const [
                'status',
                'verificationStatus',
                'result',
              ], fallback: 'Open'),
            ),
          ),
        );
      }).toList(),
    );
  }
}
