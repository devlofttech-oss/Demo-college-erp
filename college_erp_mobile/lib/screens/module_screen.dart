import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../data/role_permissions.dart';
import '../models/app_user.dart';
import '../models/erp_module.dart';
import '../models/erp_role.dart';
import '../navigation/app_routes.dart';
import '../services/erp_repository.dart';
import '../theme/app_theme.dart';
import '../utils/field_reader.dart';
import '../widgets/mobile_chrome.dart';

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
  var _query = '';
  var _academicYear = '';
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
        return _staff(data);
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
              label: 'Add Student',
              icon: Icons.person_add_alt_1_rounded,
              onTap: () => _showCreateRecordSheet(
                title: 'Add Student',
                collectionName: 'students',
                fields: const [
                  _FieldSpec('name', 'Student name', isRequired: true),
                  _FieldSpec('studentId', 'Student ID', isRequired: true),
                  _FieldSpec('className', 'Class / Standard'),
                  _FieldSpec('courseName', 'Course'),
                  _FieldSpec('phone', 'Phone'),
                  _FieldSpec('email', 'Email'),
                ],
                defaults: {'status': 'Active'},
              ),
            ),
          if (_can('students.documents'))
            _ModuleAction(
              label: 'Student Doc',
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
              label: 'Add Staff',
              icon: Icons.group_add_rounded,
              onTap: () => _showCreateRecordSheet(
                title: 'Add Faculty / Staff',
                collectionName: 'staffMembers',
                fields: const [
                  _FieldSpec('name', 'Staff name', isRequired: true),
                  _FieldSpec('employeeId', 'Employee ID', isRequired: true),
                  _FieldSpec('staffType', 'Staff type'),
                  _FieldSpec('department', 'Department'),
                  _FieldSpec('designation', 'Designation'),
                  _FieldSpec('phone', 'Phone'),
                  _FieldSpec('email', 'Email'),
                ],
                defaults: {'status': 'Active'},
              ),
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
              label: 'Add Doc',
              icon: Icons.upload_file_rounded,
              onTap: () => _showCreateRecordSheet(
                title: 'Add Document Record',
                collectionName: 'managedDocuments',
                fields: const [
                  _FieldSpec('title', 'Title', isRequired: true),
                  _FieldSpec('ownerName', 'Owner name'),
                  _FieldSpec('ownerId', 'Owner ID'),
                  _FieldSpec('ownerType', 'Owner type'),
                  _FieldSpec('documentType', 'Document type'),
                  _FieldSpec('fileName', 'File name / reference'),
                ],
                defaults: {'verificationStatus': 'Pending'},
              ),
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
    final students = _items(data, 'students')
        .where(
          (item) => containsQuery(item, _query, const [
            'name',
            'studentId',
            'admissionNo',
            'className',
            'courseName',
            'phone',
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
              Icons.school_rounded,
              AppColors.accent,
            ),
            _Stat(
              'Admissions',
              _items(data, 'admissions').length.toString(),
              Icons.how_to_reg_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Documents',
              _items(data, 'documents').length.toString(),
              Icons.folder_rounded,
              const Color(0xFF12A6A6),
            ),
          ],
        ),
        const SectionTitle('Student Profiles'),
        if (students.isEmpty)
          const EmptyState(
            title: 'No students found',
            message: 'Try a different search or academic year.',
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
    final records = _items(data, 'studentAttendance')
        .where(
          (item) => containsQuery(item, _query, const [
            'entityName',
            'entityId',
            'status',
            'className',
          ]),
        )
        .toList();
    final staffRecords = _items(data, 'staffAttendance');
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
              'Student Logs',
              records.length.toString(),
              Icons.fact_check_rounded,
              AppColors.primary,
            ),
            _Stat(
              'Staff Logs',
              staffRecords.length.toString(),
              Icons.badge_rounded,
              const Color(0xFFE5835A),
            ),
          ],
        ),
        if (_can('attendance.markStudents') ||
            _can('attendance.markStaff')) ...[
          const SizedBox(height: 12),
          PrimaryActionButton(
            label: 'Mark Attendance',
            icon: Icons.add_task_rounded,
            onPressed: () => _showAttendanceSheet(data),
          ),
        ],
        const SectionTitle('Month View'),
        _AttendanceCalendar(records: records),
        const SectionTitle('Recent Attendance'),
        if (records.isEmpty)
          const EmptyState(
            title: 'No attendance records',
            message: 'Attendance records from Firestore will appear here.',
          )
        else
          ...records
              .take(30)
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
                      ]),
                    ),
                    subtitle: formatDateValue(
                      record['date'] ??
                          record['attendanceDate'] ??
                          record['createdAt'],
                    ),
                    trailing: StatusPill(
                      label: readText(record, const [
                        'status',
                      ], fallback: 'Present'),
                    ),
                  ),
                ),
              ),
      ],
    );
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
                trailing: StatusPill(
                  label: readText(doc, const [
                    'verificationStatus',
                    'documentStatus',
                    'status',
                  ], fallback: 'Uploaded'),
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

  Future<void> _showAttendanceSheet(
    Map<String, List<Map<String, dynamic>>> data,
  ) async {
    final people = _items(data, 'students');
    final entityController = TextEditingController(
      text: people.isNotEmpty
          ? readText(people.first, const ['studentId', 'id'], fallback: '')
          : '',
    );
    final nameController = TextEditingController(
      text: people.isNotEmpty
          ? readText(people.first, const ['name'], fallback: '')
          : '',
    );
    var status = 'Present';
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
                  'Mark Attendance',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: entityController,
                  decoration: const InputDecoration(
                    labelText: 'Student ID / Employee ID',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'Name'),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: status,
                  decoration: const InputDecoration(labelText: 'Status'),
                  items: const ['Present', 'Absent', 'Late', 'Early Off']
                      .map(
                        (item) =>
                            DropdownMenuItem(value: item, child: Text(item)),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setSheetState(() => status = value ?? 'Present'),
                ),
                const SizedBox(height: 16),
                PrimaryActionButton(
                  label: 'Save',
                  icon: Icons.save_rounded,
                  onPressed: () async {
                    await widget.repository
                        .createDocument('studentAttendanceRecords', {
                          'entityId': entityController.text.trim(),
                          'entityName': nameController.text.trim(),
                          'status': status,
                          'date': Timestamp.now(),
                          'academicYear': _academicYear,
                          'markedBy': widget.user.uid,
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
    entityController.dispose();
    nameController.dispose();
    if (saved == true) await _refresh();
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

class _RecordFormSheet extends StatefulWidget {
  const _RecordFormSheet({
    required this.title,
    required this.fields,
    required this.onSave,
  });

  final String title;
  final List<_FieldSpec> fields;
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
      for (final field in widget.fields) field.key: TextEditingController(),
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
      if (text.isEmpty) continue;
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
                      label: Text(_saving ? 'Saving...' : 'Save'),
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
      final date = readDate(
        record['date'] ?? record['attendanceDate'] ?? record['createdAt'],
      );
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

class _StudentDetailSheet extends StatefulWidget {
  const _StudentDetailSheet({
    required this.student,
    required this.data,
    required this.controller,
  });

  final Map<String, dynamic> student;
  final Map<String, List<Map<String, dynamic>>> data;
  final ScrollController controller;

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
    final documents = _related(
      widget.data['documents'] ?? const [],
      studentId,
      recordId,
    );

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
            labels: const ['Information', 'Attendance', 'Result', 'Fees'],
            selected: _tab,
            onChanged: (index) => setState(() => _tab = index),
          ),
          const SizedBox(height: 14),
          if (_tab == 0) _StudentInfo(student: student, documents: documents),
          if (_tab == 1)
            _RelatedList(
              items: attendance,
              empty: 'No attendance for this student.',
            ),
          if (_tab == 2)
            _RelatedList(
              items: marks,
              empty: 'No marks or results for this student.',
            ),
          if (_tab == 3)
            _RelatedList(
              items: fees,
              empty: 'No fee assignments for this student.',
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
    return Row(
      children: List.generate(labels.length, (index) {
        final active = selected == index;
        return Expanded(
          child: InkWell(
            onTap: () => onChanged(index),
            child: Container(
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
          ),
        );
      }),
    );
  }
}

class _StudentInfo extends StatelessWidget {
  const _StudentInfo({required this.student, required this.documents});

  final Map<String, dynamic> student;
  final List<Map<String, dynamic>> documents;

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
