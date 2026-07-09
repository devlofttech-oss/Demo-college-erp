import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/role_permissions.dart';
import '../models/app_user.dart';
import '../models/erp_module.dart';
import '../models/erp_role.dart';
import '../navigation/app_routes.dart';
import '../services/erp_repository.dart';
import '../theme/app_theme.dart';
import '../utils/field_reader.dart';
import '../widgets/mobile_chrome.dart';

String _attendanceDisplayDate(DateTime date) =>
    DateFormat('dd MMM yyyy').format(date);

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
  });

  final ErpModule module;
  final AppUser user;
  final List<ErpRole> roles;
  final ErpRepository repository;

  @override
  State<ModuleScreen> createState() => _ModuleScreenState();
}

class _ModuleScreenState extends State<ModuleScreen> {
  static const _pendingAdmissionStatus = 'Pending Approval';
  static const _approvedAdmissionStatus = 'Approved';
  static const _activeStudentStatus = 'Active';
  static const _defaultAcademicYear = '2025-2026';

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
  late Future<Map<String, List<Map<String, dynamic>>>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
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
        return _results(data);
      case 'fees':
        return _fees(data);
      case 'communication':
        return _events(data);
      case 'document-management':
        return _documents(data);
      case 'hostel-management':
        return _hostel(data);
      case 'parent-portal':
        return _parentPortal(data);
      case 'academics':
      case 'calendar':
        return _academics(data);
      case 'user-roles':
        return _usersAndRoles(data);
      case 'settings':
        return _settings(data);
      case 'reports':
      case 'dashboard':
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
              label: 'Add Class',
              icon: Icons.calendar_month_rounded,
              onTap: () => _showCreateRecordSheet(
                title: 'Add Timetable Class',
                collectionName: 'timetableEntries',
                fields: const [
                  _FieldSpec('day', 'Day', isRequired: true),
                  _FieldSpec('subject', 'Subject', isRequired: true),
                  _FieldSpec('teacherName', 'Teacher'),
                  _FieldSpec('className', 'Class / Standard'),
                  _FieldSpec('division', 'Division'),
                  _FieldSpec('startTime', 'Start time'),
                  _FieldSpec('endTime', 'End time'),
                ],
                defaults: {'status': 'Draft'},
              ),
            ),
        ];
      case 'examination-results':
        return [
          if (_can('exams.schedule'))
            _ModuleAction(
              label: 'Schedule',
              icon: Icons.event_note_rounded,
              onTap: () => _showCreateRecordSheet(
                title: 'Schedule Exam',
                collectionName: 'examSchedules',
                fields: const [
                  _FieldSpec('examName', 'Exam name', isRequired: true),
                  _FieldSpec('subject', 'Subject', isRequired: true),
                  _FieldSpec('className', 'Class / Standard'),
                  _FieldSpec('examDate', 'Exam date YYYY-MM-DD'),
                  _FieldSpec('maxMarks', 'Max marks', numeric: true),
                ],
                defaults: {'status': 'Scheduled'},
              ),
            ),
          if (_can('exams.marks'))
            _ModuleAction(
              label: 'Marks',
              icon: Icons.assignment_turned_in_rounded,
              onTap: () => _showCreateRecordSheet(
                title: 'Enter Marks',
                collectionName: 'marksEntries',
                fields: const [
                  _FieldSpec('studentId', 'Student ID', isRequired: true),
                  _FieldSpec('studentName', 'Student name'),
                  _FieldSpec('examName', 'Exam name'),
                  _FieldSpec('subject', 'Subject', isRequired: true),
                  _FieldSpec('marks', 'Marks', isRequired: true, numeric: true),
                  _FieldSpec('maxMarks', 'Max marks', numeric: true),
                ],
              ),
            ),
        ];
      case 'fees':
        return [
          if (_can('fees.assign'))
            _ModuleAction(
              label: 'Assign',
              icon: Icons.receipt_long_rounded,
              onTap: () => _showCreateRecordSheet(
                title: 'Assign Fee',
                collectionName: 'feeAssignments',
                fields: const [
                  _FieldSpec('studentId', 'Student ID', isRequired: true),
                  _FieldSpec('studentName', 'Student name'),
                  _FieldSpec('feeName', 'Fee name', isRequired: true),
                  _FieldSpec(
                    'amount',
                    'Amount',
                    isRequired: true,
                    numeric: true,
                  ),
                  _FieldSpec('balanceAmount', 'Unpaid amount', numeric: true),
                ],
                defaults: {'status': 'Assigned'},
              ),
            ),
          if (_can('fees.collect'))
            _ModuleAction(
              label: 'Collect',
              icon: Icons.payments_rounded,
              onTap: () => _showCreateRecordSheet(
                title: 'Record Fee Collection',
                collectionName: 'feeCollections',
                fields: const [
                  _FieldSpec('studentId', 'Student ID', isRequired: true),
                  _FieldSpec('studentName', 'Student name'),
                  _FieldSpec('receiptNo', 'Receipt number'),
                  _FieldSpec(
                    'amount',
                    'Amount',
                    isRequired: true,
                    numeric: true,
                  ),
                  _FieldSpec('paymentMode', 'Payment mode'),
                ],
                defaults: {'status': 'Paid'},
              ),
            ),
        ];
      case 'communication':
        return [
          if (_can('notices.create'))
            _ModuleAction(
              label: 'Notice',
              icon: Icons.campaign_rounded,
              onTap: _showNoticeSheet,
            ),
        ];
      case 'document-management':
        return [
          if (_can('documents.upload'))
            _ModuleAction(
              label: 'Upload',
              icon: Icons.upload_file_rounded,
              onTap: _showDocumentUploadSheet,
            ),
        ];
      case 'hostel-management':
        return [
          if (_can('hostel.manage'))
            _ModuleAction(
              label: 'Add Room',
              icon: Icons.bed_rounded,
              onTap: () => _showCreateRecordSheet(
                title: 'Add Hostel Room',
                collectionName: 'hostelRooms',
                fields: const [
                  _FieldSpec('roomNumber', 'Room number', isRequired: true),
                  _FieldSpec('block', 'Block'),
                  _FieldSpec('capacity', 'Capacity', numeric: true),
                  _FieldSpec('roomType', 'Room type'),
                ],
                defaults: {'status': 'Available'},
              ),
            ),
        ];
      case 'academics':
      case 'calendar':
        return [
          if (_can('academics.manage'))
            _ModuleAction(
              label: 'Subject',
              icon: Icons.menu_book_rounded,
              onTap: () => _showCreateRecordSheet(
                title: 'Add Academic Subject',
                collectionName: 'academicSubjects',
                fields: const [
                  _FieldSpec('subjectName', 'Subject name', isRequired: true),
                  _FieldSpec('code', 'Subject code'),
                  _FieldSpec('program', 'Program'),
                  _FieldSpec('className', 'Class / Standard'),
                ],
                defaults: {'status': 'Active'},
              ),
            ),
          if (_can('academics.manage'))
            _ModuleAction(
              label: 'Event',
              icon: Icons.event_available_rounded,
              onTap: () => _showCreateRecordSheet(
                title: 'Add Academic Event',
                collectionName: 'academicCalendarEvents',
                fields: const [
                  _FieldSpec('title', 'Event title', isRequired: true),
                  _FieldSpec('date', 'Date YYYY-MM-DD'),
                  _FieldSpec('description', 'Description'),
                ],
                defaults: {'status': 'Active'},
              ),
            ),
        ];
      case 'reports':
      case 'dashboard':
        return [
          if (_can('financialReports.snapshots'))
            _ModuleAction(
              label: 'Snapshot',
              icon: Icons.save_alt_rounded,
              onTap: () => _showCreateRecordSheet(
                title: 'Save Report Snapshot',
                collectionName: 'financialReportSnapshots',
                fields: const [
                  _FieldSpec('title', 'Snapshot title', isRequired: true),
                  _FieldSpec('notes', 'Notes'),
                ],
                defaults: {'status': 'Saved'},
              ),
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
    final entries = _items(data, 'entries')
        .where(
          (item) => containsQuery(item, _query, const [
            'subject',
            'subjectName',
            'teacherName',
            'day',
            'className',
            'division',
          ]),
        )
        .toList();
    final days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return Column(
      children: [
        _SummaryRow(
          stats: [
            _Stat(
              'Entries',
              entries.length.toString(),
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
              'Published',
              _items(data, 'publications').length.toString(),
              Icons.publish_rounded,
              AppColors.accent,
            ),
          ],
        ),
        const SectionTitle('Time Table'),
        if (entries.isEmpty)
          const EmptyState(
            title: 'No timetable entries',
            message: 'Published and draft timetable records will appear here.',
          )
        else
          ...days.map((day) {
            final dayEntries = entries
                .where(
                  (entry) =>
                      readText(entry, const [
                        'day',
                        'weekday',
                      ], fallback: '').toLowerCase() ==
                      day.toLowerCase(),
                )
                .toList();
            return _DayPanel(day: day, entries: dayEntries);
          }),
      ],
    );
  }

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

  Widget _fees(Map<String, List<Map<String, dynamic>>> data) {
    final assignments = _items(data, 'assignments')
        .where(
          (item) => containsQuery(item, _query, const [
            'studentName',
            'studentId',
            'feeName',
            'className',
          ]),
        )
        .toList();
    final paid = _items(data, 'collections').fold<num>(
      0,
      (total, item) =>
          total +
          readNumber(item, const [
            'paidAmount',
            'amount',
            'totalPaid',
            'collectedAmount',
          ]),
    );
    final due = assignments.fold<num>(
      0,
      (total, item) =>
          total +
          readNumber(item, const [
            'balanceAmount',
            'unpaid',
            'dueAmount',
            'amountDue',
          ]),
    );
    return Column(
      children: [
        _SummaryRow(
          stats: [
            _Stat(
              'Assigned',
              assignments.length.toString(),
              Icons.receipt_long_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Collected',
              formatMoney(paid),
              Icons.payments_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Due',
              formatMoney(due),
              Icons.warning_rounded,
              AppColors.danger,
            ),
          ],
        ),
        const SectionTitle('Fee Status'),
        if (assignments.isEmpty)
          const EmptyState(
            title: 'No fee assignments',
            message: 'Fee records from the ERP will appear here.',
          )
        else
          ...assignments.map((fee) {
            final balance = readNumber(fee, const [
              'balanceAmount',
              'unpaid',
              'dueAmount',
              'amountDue',
            ]);
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InfoCard(
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            readText(fee, const [
                              'studentName',
                              'studentId',
                              'name',
                            ]),
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                        ),
                        StatusPill(label: balance <= 0 ? 'Paid' : 'Unpaid'),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: LabelValue(
                            label: 'Amount',
                            value: formatMoney(
                              readNumber(fee, const [
                                'amount',
                                'totalAmount',
                                'assignedAmount',
                              ]),
                            ),
                          ),
                        ),
                        Expanded(
                          child: LabelValue(
                            label: 'Paid',
                            value: formatMoney(
                              readNumber(fee, const [
                                'paidAmount',
                                'paid',
                                'totalPaid',
                              ]),
                            ),
                          ),
                        ),
                        Expanded(
                          child: LabelValue(
                            label: 'Unpaid',
                            value: formatMoney(balance),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          }),
      ],
    );
  }

  Widget _events(Map<String, List<Map<String, dynamic>>> data) {
    final notices = _items(data, 'notices')
        .where(
          (item) => containsQuery(item, _query, const [
            'title',
            'message',
            'audience',
            'type',
          ]),
        )
        .toList();
    return Column(
      children: [
        if (_can('notices.create')) ...[
          PrimaryActionButton(
            label: 'Create Announcement',
            icon: Icons.campaign_rounded,
            onPressed: _showNoticeSheet,
          ),
          const SizedBox(height: 10),
        ],
        _MonthStrip(items: notices),
        const SectionTitle('Events & Notices'),
        if (notices.isEmpty)
          const EmptyState(
            title: 'No communication items',
            message: 'Published notices and events will appear here.',
          )
        else
          ...notices.map(
            (notice) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InfoCard(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 4,
                      height: 60,
                      decoration: BoxDecoration(
                        color: widget.module.color,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            readText(notice, const ['title', 'subject']),
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            readText(notice, const [
                              'message',
                              'body',
                              'description',
                            ]),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            formatDateValue(
                              notice['publishDate'] ??
                                  notice['eventDate'] ??
                                  notice['createdAt'],
                            ),
                            style: const TextStyle(
                              color: AppColors.accent,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _documents(Map<String, List<Map<String, dynamic>>> data) {
    final documents =
        [..._items(data, 'documents'), ..._items(data, 'studentDocuments')]
            .where(
              (item) => containsQuery(item, _query, const [
                'title',
                'documentType',
                'ownerName',
                'fileName',
                'verificationStatus',
              ]),
            )
            .toList();
    return Column(
      children: [
        _SummaryRow(
          stats: [
            _Stat(
              'Documents',
              documents.length.toString(),
              Icons.folder_rounded,
              const Color(0xFF12A6A6),
            ),
            _Stat(
              'Students',
              _items(data, 'students').length.toString(),
              Icons.school_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Staff',
              _items(data, 'staff').length.toString(),
              Icons.groups_rounded,
              AppColors.primary,
            ),
          ],
        ),
        const SectionTitle('Documents'),
        if (documents.isEmpty)
          const EmptyState(
            title: 'No documents',
            message: 'Uploaded ERP documents will appear here.',
          )
        else
          ...documents.map(
            (doc) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _CompactRow(
                title: readText(doc, const [
                  'title',
                  'documentType',
                  'fileName',
                  'documentFileName',
                ]),
                subtitle: readText(doc, const [
                  'ownerName',
                  'studentName',
                  'staffName',
                  'ownerId',
                ], fallback: 'ERP document'),
                trailing: _DocumentTrailing(
                  document: doc,
                  onOpen: () => _openDocument(doc),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _hostel(Map<String, List<Map<String, dynamic>>> data) {
    final rooms = _items(data, 'rooms')
        .where(
          (item) => containsQuery(item, _query, const [
            'roomNo',
            'roomNumber',
            'block',
            'status',
          ]),
        )
        .toList();
    final allocations = _items(data, 'allocations');
    return Column(
      children: [
        _SummaryRow(
          stats: [
            _Stat(
              'Rooms',
              rooms.length.toString(),
              Icons.bed_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Allocations',
              allocations.length.toString(),
              Icons.person_pin_circle_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Records',
              _items(data, 'records').length.toString(),
              Icons.fact_check_rounded,
              const Color(0xFF6B8B4E),
            ),
          ],
        ),
        const SectionTitle('Hostel Rooms'),
        if (rooms.isEmpty)
          const EmptyState(
            title: 'No hostel rooms',
            message: 'Hostel rooms and allocations will appear here.',
          )
        else
          ...rooms.map(
            (room) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _CompactRow(
                title:
                    'Room ${readText(room, const ['roomNo', 'roomNumber', 'name'])}',
                subtitle:
                    '${readText(room, const ['block', 'building'], fallback: 'Block')} · ${readText(room, const ['capacity'], fallback: 'Capacity')}',
                trailing: StatusPill(
                  label: readText(room, const [
                    'status',
                  ], fallback: 'Available'),
                ),
              ),
            ),
          ),
      ],
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

  Widget _academics(Map<String, List<Map<String, dynamic>>> data) {
    final subjects = _items(data, 'subjects')
        .where(
          (item) => containsQuery(item, _query, const [
            'name',
            'subjectName',
            'code',
            'program',
          ]),
        )
        .toList();
    final events = _items(data, 'events')
        .where(
          (item) => containsQuery(item, _query, const [
            'title',
            'eventName',
            'description',
          ]),
        )
        .toList();
    return Column(
      children: [
        _SummaryRow(
          stats: [
            _Stat(
              'Programs',
              _items(data, 'programs').length.toString(),
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
              'Events',
              events.length.toString(),
              Icons.event_rounded,
              AppColors.danger,
            ),
          ],
        ),
        const SectionTitle('Subjects'),
        if (subjects.isEmpty)
          const EmptyState(
            title: 'No academic subjects',
            message: 'Academic setup records will appear here.',
          )
        else
          ...subjects
              .take(30)
              .map(
                (subject) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _CompactRow(
                    title: readText(subject, const [
                      'name',
                      'subjectName',
                      'code',
                    ]),
                    subtitle: readText(subject, const [
                      'program',
                      'courseName',
                      'className',
                    ], fallback: 'Academic subject'),
                    trailing: StatusPill(
                      label: readText(subject, const [
                        'status',
                      ], fallback: 'Active'),
                    ),
                  ),
                ),
              ),
        const SectionTitle('Academic Calendar'),
        ...events
            .take(20)
            .map(
              (event) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _CompactRow(
                  title: readText(event, const ['title', 'eventName']),
                  subtitle: formatDateValue(
                    event['date'] ?? event['startsOn'] ?? event['createdAt'],
                  ),
                  trailing: const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.muted,
                  ),
                ),
              ),
            ),
      ],
    );
  }

  Widget _usersAndRoles(Map<String, List<Map<String, dynamic>>> data) {
    final users = _items(data, 'users')
        .where(
          (item) => containsQuery(item, _query, const [
            'name',
            'email',
            'roleId',
            'status',
          ]),
        )
        .toList();
    final roles = _items(data, 'roles');
    return Column(
      children: [
        _SummaryRow(
          stats: [
            _Stat(
              'Users',
              users.length.toString(),
              Icons.people_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Roles',
              roles.length.toString(),
              Icons.admin_panel_settings_rounded,
              const Color(0xFF8357C5),
            ),
            _Stat(
              'Active',
              users
                  .where(
                    (user) =>
                        readText(user, const ['status'], fallback: '') ==
                        'Active',
                  )
                  .length
                  .toString(),
              Icons.verified_user_rounded,
              AppColors.accent,
            ),
          ],
        ),
        const SectionTitle('Users'),
        if (users.isEmpty)
          const EmptyState(
            title: 'No users',
            message: 'ERP users will appear here.',
          )
        else
          ...users.map(
            (user) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _CompactRow(
                title: readText(user, const ['name', 'email']),
                subtitle: readText(user, const [
                  'email',
                ], fallback: readText(user, const ['uid'])),
                trailing: StatusPill(
                  label: readText(user, const ['roleId'], fallback: 'role'),
                ),
              ),
            ),
          ),
      ],
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

  Widget _reports(Map<String, List<Map<String, dynamic>>> data) {
    final fees = _items(data, 'fees');
    final collections = _items(data, 'collections');
    final due = fees.fold<num>(
      0,
      (total, item) =>
          total +
          readNumber(item, const [
            'balanceAmount',
            'unpaid',
            'dueAmount',
            'amountDue',
          ]),
    );
    final collected = collections.fold<num>(
      0,
      (total, item) =>
          total +
          readNumber(item, const [
            'paidAmount',
            'amount',
            'totalPaid',
            'collectedAmount',
          ]),
    );
    return Column(
      children: [
        _SummaryRow(
          stats: [
            _Stat(
              'Students',
              _items(data, 'students').length.toString(),
              Icons.school_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Staff',
              _items(data, 'staff').length.toString(),
              Icons.groups_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Due',
              formatMoney(due),
              Icons.warning_rounded,
              AppColors.danger,
            ),
          ],
        ),
        const SectionTitle('Financial Snapshot'),
        InfoCard(
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: LabelValue(
                      label: 'Collected',
                      value: formatMoney(collected),
                    ),
                  ),
                  Expanded(
                    child: LabelValue(
                      label: 'Outstanding',
                      value: formatMoney(due),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: LabelValue(
                      label: 'Documents',
                      value: _items(data, 'documents').length.toString(),
                    ),
                  ),
                  Expanded(
                    child: LabelValue(
                      label: 'Notices',
                      value: _items(data, 'notices').length.toString(),
                    ),
                  ),
                  Expanded(
                    child: LabelValue(
                      label: 'Exams',
                      value: _items(data, 'exams').length.toString(),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SectionTitle('Recent Notices'),
        ..._items(data, 'notices')
            .take(8)
            .map(
              (notice) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _CompactRow(
                  title: readText(notice, const ['title', 'subject']),
                  subtitle: formatDateValue(
                    notice['publishDate'] ?? notice['createdAt'],
                  ),
                  trailing: const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.muted,
                  ),
                ),
              ),
            ),
      ],
    );
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
          if (selectedCourse != null) 'courseCode': selectedCourse.courseCode,
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
          final updates = {
            ..._normalizedStudentProfile(values),
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

  Future<void> _showDocumentUploadSheet() async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _DocumentUploadSheet(
        onSave: ({required bytes, required fileName, required metadata}) {
          return widget.repository.uploadManagedDocument(
            bytes: bytes,
            fileName: fileName,
            uploadedBy: widget.user.uid,
            metadata: {
              ...metadata,
              if (_academicYear.trim().isNotEmpty)
                'academicYear': _academicYear.trim(),
            },
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

  Future<void> _showNoticeSheet() async {
    final titleController = TextEditingController();
    final messageController = TextEditingController();
    var audience = 'All';
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) {
          return Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              20,
              20,
              MediaQuery.of(context).viewInsets.bottom + 20,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Create Announcement',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: titleController,
                  decoration: const InputDecoration(labelText: 'Title'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: messageController,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Message'),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: audience,
                  decoration: const InputDecoration(labelText: 'Audience'),
                  items: const ['All', 'Students', 'Parents', 'Faculty']
                      .map(
                        (item) =>
                            DropdownMenuItem(value: item, child: Text(item)),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setSheetState(() => audience = value ?? 'All'),
                ),
                const SizedBox(height: 16),
                PrimaryActionButton(
                  label: 'Publish',
                  icon: Icons.send_rounded,
                  onPressed: () async {
                    await widget.repository.createDocument('noticeItems', {
                      'title': titleController.text.trim(),
                      'message': messageController.text.trim(),
                      'audience': audience,
                      'status': 'Published',
                      'publishDate': Timestamp.now(),
                      'academicYear': _academicYear,
                      'createdBy': widget.user.uid,
                    });
                    if (context.mounted) Navigator.of(context).pop(true);
                  },
                ),
              ],
            ),
          );
        },
      ),
    );
    titleController.dispose();
    messageController.dispose();
    if (saved == true) await _refresh();
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

class _DocumentTrailing extends StatelessWidget {
  const _DocumentTrailing({required this.document, required this.onOpen});

  final Map<String, dynamic> document;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final hasUrl = readText(document, const [
      'downloadUrl',
      'fileUrl',
      'url',
    ], fallback: '').isNotEmpty;
    if (hasUrl) {
      return IconButton(
        tooltip: 'Open document',
        onPressed: onOpen,
        icon: const Icon(Icons.open_in_new_rounded, color: AppColors.primary),
      );
    }
    return StatusPill(
      label: readText(document, const [
        'verificationStatus',
        'documentStatus',
        'status',
      ], fallback: 'Uploaded'),
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
  _FieldSpec('age', 'Age'),
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
  _FieldSpec('sicknessDays', 'No. of Sick Days'),
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
  const _DocumentUploadSheet({required this.onSave});

  final Future<void> Function({
    required Uint8List bytes,
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
  final _titleController = TextEditingController();
  final _ownerController = TextEditingController();
  final _ownerIdController = TextEditingController();
  final _ownerTypeController = TextEditingController(text: 'Student');
  final _documentTypeController = TextEditingController();
  XFile? _file;
  var _fileSize = 0;
  var _saving = false;
  var _error = '';

  @override
  void dispose() {
    _titleController.dispose();
    _ownerController.dispose();
    _ownerIdController.dispose();
    _ownerTypeController.dispose();
    _documentTypeController.dispose();
    super.dispose();
  }

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
      if (_titleController.text.trim().isEmpty) {
        _titleController.text = picked.name;
      }
    });
  }

  Future<void> _save() async {
    final file = _file;
    if (file == null) {
      setState(() => _error = 'Choose a file to upload.');
      return;
    }
    final bytes = await file.readAsBytes();
    if (bytes.isEmpty) {
      setState(() => _error = 'The selected file is empty.');
      return;
    }
    if (_titleController.text.trim().isEmpty) {
      setState(() => _error = 'Title is required.');
      return;
    }

    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await widget.onSave(
        bytes: bytes,
        fileName: file.name,
        metadata: {
          'title': _titleController.text.trim(),
          'ownerName': _ownerController.text.trim(),
          'ownerId': _ownerIdController.text.trim(),
          'ownerType': _ownerTypeController.text.trim(),
          'documentType': _documentTypeController.text.trim(),
          'verificationStatus': 'Uploaded',
        },
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final file = _file;
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
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: _saving ? null : _pickFile,
                icon: const Icon(Icons.attach_file_rounded, size: 18),
                label: Text(file == null ? 'Choose file' : file.name),
              ),
              if (file != null) ...[
                const SizedBox(height: 8),
                Text(
                  '${(_fileSize / 1024).toStringAsFixed(1)} KB',
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
              const SizedBox(height: 12),
              TextField(
                controller: _titleController,
                decoration: const InputDecoration(labelText: 'Title *'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _documentTypeController,
                decoration: const InputDecoration(labelText: 'Document type'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _ownerController,
                decoration: const InputDecoration(labelText: 'Owner name'),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _ownerIdController,
                      decoration: const InputDecoration(labelText: 'Owner ID'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _ownerTypeController,
                      decoration: const InputDecoration(
                        labelText: 'Owner type',
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
                            ? Icons.cloud_upload_rounded
                            : Icons.upload_file_rounded,
                        size: 18,
                      ),
                      label: Text(_saving ? 'Uploading...' : 'Upload'),
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

class _StudentCourseOption {
  const _StudentCourseOption(this.courseCode, this.label);

  final String courseCode;
  final String label;
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
            labels: const [
              'Profile',
              'Attendance',
              'Exams',
              'Payment',
              'Docs',
              'Health',
            ],
            selected: _tab,
            onChanged: (index) => setState(() => _tab = index),
          ),
          const SizedBox(height: 14),
          if (_tab == 0)
            _StudentInfo(
              student: student,
              documents: documents,
              latestAdmission: latestAdmission,
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
              width: 92,
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
                maxLines: 1,
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

class _StudentInfo extends StatelessWidget {
  const _StudentInfo({
    required this.student,
    required this.documents,
    required this.latestAdmission,
  });

  final Map<String, dynamic> student;
  final List<Map<String, dynamic>> documents;
  final Map<String, dynamic>? latestAdmission;

  @override
  Widget build(BuildContext context) {
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
      (total, item) =>
          total +
          readNumber(item, const ['dueAmount', 'balanceAmount', 'amountDue']),
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
