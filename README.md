# College ERP

React/Vite based College ERP demo. The current implementation contains a working Student Information Management prototype with optional Firebase Firestore persistence.

## Current Implementation

- Firebase email/password login and registration.
- Student Information Management dashboard.
- Student admissions.
- Student profile management.
- Student document metadata repository.
- Student ID metadata generation.
- Student promotion and transfer metadata.
- Optional Firestore persistence for student-related collections.
- Demo screens for academics, batch section, reports, payments, settings, and academic calendar.

## Student Information Management Status

The Student Information Management module is the reference module structure for future ERP modules.

Implemented workflows:

- Firebase-backed student admission creation.
- Student profile editing.
- Student profile validation.
- Soft archive and restore for student records.
- Active and archived record views.
- Student document upload to Firebase Storage.
- Student document metadata in Firestore.
- Document verification and rejection.
- Student ID metadata creation.
- Promotion and internal transfer records with editable target class and reason.
- Demo fallback data when Firebase is not configured.

Remaining before marking the module complete:

- Deploy Firebase rules to the connected Firebase project.
- Configure Firebase indexes if production data queries become more advanced.

Security rule templates:

- `firestore.rules` includes authenticated read/create/update access for student module collections and blocks hard deletes.
- `storage.rules` includes authenticated read/write access for student document uploads and blocks deletes.

Verification:

- `npm run lint`
- `npm run build`
- `npm run test`

## User & Role Management Status

Implemented workflows:

- Default ERP roles: Super Admin, Admin, Faculty, Parent.
- Admin-created Firebase Auth users using a secondary Firebase app instance.
- Firestore user profiles linked to Firebase Auth UID.
- Role assignment and user status management.
- Permission groups for student workflows, users/roles, and future module access.
- Permission-aware controls for creating users, editing users, syncing roles, and editing role permissions.
- Demo fallback data when Firebase is not configured.
- Stable role IDs for `super-admin`, `admin`, `faculty`, and `parent`.
- Signed-in admin/super-admin access rules for users and roles.

Firebase setup note:

- For a fresh Firebase project, create or seed the first admin profile before deploying strict user/role write rules.

Current structure:

- `src/modules/userRoles/UserRoleManagement.jsx`
- `src/modules/userRoles/rolePermissions.js`
- `src/modules/userRoles/demoUserRoles.js`
- `src/modules/userRoles/components/RolePermissionEditor.jsx`
- `src/modules/userRoles/components/UserModal.jsx`
- `src/modules/userRoles/components/UserTable.jsx`

## Faculty & Staff Management Status

Implemented workflows:

- Faculty records.
- Staff records.
- Department allocation.
- Department sync from default setup.
- Staff profile editing.
- Soft archive and restore for staff records.
- Leave request creation.
- Leave approval and rejection.
- Attendance marking for present/absent.
- Faculty/staff search and filters.
- Permission-aware controls for staff creation, editing, archive/restore, leave, and attendance.
- Demo fallback data when Firebase is not configured.

Current structure:

- `src/modules/facultyStaff/FacultyStaffManagement.jsx`
- `src/modules/facultyStaff/facultyStaffUtils.js`
- `src/modules/facultyStaff/demoFacultyStaff.js`
- `src/modules/facultyStaff/components/LeaveModal.jsx`
- `src/modules/facultyStaff/components/StaffModal.jsx`
- `src/modules/facultyStaff/components/StaffProfilePanel.jsx`
- `src/modules/facultyStaff/components/StaffTable.jsx`

Firebase collections:

- `staffMembers`
- `departments`
- `staffLeaveRecords`
- `staffAttendanceRecords`

Role permissions:

- `staff.view`
- `staff.create`
- `staff.edit`
- `staff.archive`
- `staff.leave`
- `staff.attendance`

## Attendance Management Status

Implemented workflows:

- Student attendance tracking.
- Faculty/staff attendance tracking.
- Present/absent marking with duplicate same-day guard.
- Daily, monthly, and yearly report views.
- Parent notification queue metadata for absent students.
- Permission-aware controls for student attendance, staff attendance, reports, and parent notification.
- Demo fallback data when Firebase is not configured.

Current structure:

- `src/modules/attendance/AttendanceManagement.jsx`
- `src/modules/attendance/attendanceUtils.js`
- `src/modules/attendance/demoAttendance.js`
- `src/modules/attendance/components/AttendanceReports.jsx`
- `src/modules/attendance/components/AttendanceTable.jsx`

Firebase collections:

- `studentAttendanceRecords`
- `staffAttendanceRecords`
- `attendanceNotifications`

Role permissions:

- `attendance.view`
- `attendance.markStudents`
- `attendance.markStaff`
- `attendance.reports`
- `attendance.notifyParents`

## Build Approach

We will build the ERP one module at a time and keep every module organized so it can be added, removed, or replaced without disturbing unrelated modules.

Preferred organization:

- Each major module should have its own page/component folder.
- Each module should keep its own data helpers, constants, demo data, and UI components close together.
- Shared layout, navigation, auth/session, Firebase setup, and common UI should be reusable across modules.
- Modules should be registered from a central module list so enabling or removing a module is controlled from one place.

Confirmed technical direction:

- Firebase will remain the backend for all modules.
- Real Firebase Authentication should be implemented instead of the current demo-only login.
- Fee collection means manual/offline payment record keeping for now.
- The current UI style can continue while we build a working ERP. A redesign can happen later after the workflows are functional.

## Target Modules

### 1. Academic Management

#### Student Information Management

- Student admissions.
- Student profile management.
- Student document repository.
- Student ID generation.
- Student promotion and transfer management.

#### Faculty & Staff Management

- Faculty records.
- Staff records.
- Department allocation.
- Leave management.
- Attendance management.

#### Attendance Management

- Student attendance tracking.
- Faculty attendance tracking.
- Daily, monthly, and yearly reports.
- Parent notification support.

#### Timetable Management

- Class timetable creation.
- Faculty timetable.
- Classroom allocation.
- Timetable publishing.

#### Examination & Result Management

- Examination scheduling.
- Internal assessment management.
- Marks entry.
- Grade calculation.
- Result generation.
- Report card generation.

### 2. Administration & Operations

#### User & Role Management

- Role-based access control.
- User permissions.
- Multi-level administration.

#### Notice Board & Announcements

- Digital notices.
- Circular management.
- Event announcements.

#### Document Management

- Student documents.
- Staff documents.
- Academic records archive.

### 3. Finance Management

#### Fees Management

- Fee structure setup.
- Fee collection.
- Due tracking.

#### Financial Reports

- Collection reports.
- Outstanding reports.
- Fee analytics.
- Financial summaries.

### 4. Parent Portal

- Student attendance monitoring.
- Academic performance tracking.
- Fee status monitoring.
- Communication access.

## Explicitly Not Required

The following items are excluded from the scope for now:

- Communication module.
- Online payment support.
- Receipt generation.

## Recommended Build Order

1. Shared module architecture and navigation registry.
   - This should come first because every later module will plug into it.

2. Complete Student Information Management.
   - It already exists, so we should stabilize its structure before adding more modules.

3. User & Role Management.
   - Needed before serious admin workflows, permissions, and module access control.

4. Faculty & Staff Management.
   - Builds the staff/faculty master data needed by timetable, attendance, and exams.

5. Attendance Management.
   - Depends on student and faculty data.

6. Timetable Management.
   - Depends on classes, faculty, and classroom allocation.

7. Examination & Result Management.
   - Depends on students, classes, subjects/timetable, and faculty responsibilities.

8. Fees Management.
   - Can be built without online payment or receipts, focused on fee setup, manual collection records, and dues.

9. Financial Reports.
   - Should follow Fees Management because it needs fee and due data.

10. Notice Board & Announcements.
    - Useful operationally, but independent enough to build after core academic and finance flows.

11. Document Management.
    - Should consolidate student, staff, and academic documents after those domains exist.

12. Parent Portal.
    - Should come later because it depends on attendance, performance, fees, and published academic data.

## Open Questions

No open questions right now.

## Timetable Management Status

Implemented workflows:

- Class timetable creation.
- Faculty timetable visibility.
- Classroom allocation.
- Conflict detection for class, faculty, and classroom in the same slot.
- Timetable publishing metadata.
- Classroom sync from default setup.
- Permission-aware controls for creation, editing, publishing, and classroom management.
- Demo fallback data when Firebase is not configured.

Current structure:

- `src/modules/timetable/TimetableManagement.jsx`
- `src/modules/timetable/timetableUtils.js`
- `src/modules/timetable/demoTimetable.js`
- `src/modules/timetable/components/TimetableEntryModal.jsx`
- `src/modules/timetable/components/TimetableGrid.jsx`
- `src/modules/timetable/components/TimetableSidePanel.jsx`

Firebase collections:

- `classrooms`
- `timetableEntries`
- `timetablePublications`

Role permissions:

- `timetable.view`
- `timetable.create`
- `timetable.edit`
- `timetable.publish`
- `timetable.classrooms`

## Examination & Result Management Status

Implemented workflows:

- Examination scheduling.
- Internal assessment creation.
- Marks entry.
- Grade calculation.
- Result generation.
- Report card generation metadata.
- Permission-aware controls for schedules, assessments, marks, results, and report cards.
- Demo fallback data when Firebase is not configured.

Current structure:

- `src/modules/exams/ExaminationResultManagement.jsx`
- `src/modules/exams/examUtils.js`
- `src/modules/exams/demoExams.js`
- `src/modules/exams/components/ExamScheduleModal.jsx`
- `src/modules/exams/components/ExamScheduleTable.jsx`
- `src/modules/exams/components/MarksEntryModal.jsx`
- `src/modules/exams/components/ResultsPanel.jsx`

Firebase collections:

- `examSchedules`
- `internalAssessments`
- `marksEntries`
- `studentResults`
- `reportCards`

Role permissions:

- `exams.view`
- `exams.schedule`
- `exams.assessments`
- `exams.marks`
- `exams.results`
- `exams.reportCards`

## Fees Management Status

Implemented workflows:

- Fee structure setup by class and academic year.
- Student fee assignment from active class-wise structures.
- Manual/offline fee collection records.
- Due tracking with paid, partially paid, due, overdue, due soon, and upcoming states.
- Fee adjustment and waiver logging.
- Collection, outstanding, adjustment, and due-student summaries.
- Permission-aware controls for setup, assignment, collection, adjustment, and reports.
- Demo fallback data when Firebase is not configured.

Excluded for now:

- Online payment support.
- Receipt generation.

Current structure:

- `src/modules/fees/FeesManagement.jsx`
- `src/modules/fees/feeUtils.js`
- `src/modules/fees/demoFees.js`
- `src/modules/fees/components/FeeAdjustmentModal.jsx`
- `src/modules/fees/components/FeeAssignmentTable.jsx`
- `src/modules/fees/components/FeeCollectionModal.jsx`
- `src/modules/fees/components/FeeReportsPanel.jsx`
- `src/modules/fees/components/FeeStructureModal.jsx`
- `src/modules/fees/components/FeeStructurePanel.jsx`

Firebase collections:

- `feeStructures`
- `feeAssignments`
- `feeCollections`
- `feeAdjustments`

Role permissions:

- `fees.view`
- `fees.setup`
- `fees.assign`
- `fees.collect`
- `fees.adjust`
- `fees.reports`

## Financial Reports Status

Implemented workflows:

- Collection reports with date, class, and payment-mode filters.
- Outstanding reports with overdue and due-soon aging.
- Class-wise fee analytics with collection rate.
- Financial summaries for assigned, collected, adjusted, outstanding, overdue, and due-soon amounts.
- Saved financial report summary snapshots.
- Permission-aware controls for viewing, exporting, and saving summaries.
- Demo fallback data when Firebase is not configured.

Current structure:

- `src/modules/financialReports/FinancialReports.jsx`
- `src/modules/financialReports/financialReportUtils.js`
- `src/modules/financialReports/demoFinancialReports.js`
- `src/modules/financialReports/components/AnalyticsPanel.jsx`
- `src/modules/financialReports/components/CollectionReportTable.jsx`
- `src/modules/financialReports/components/OutstandingReportTable.jsx`
- `src/modules/financialReports/components/ReportFilters.jsx`

Firebase collections:

- `feeStructures`
- `feeAssignments`
- `feeCollections`
- `feeAdjustments`
- `financialReportSnapshots`

Role permissions:

- `financialReports.view`
- `financialReports.export`
- `financialReports.snapshots`

## Notice Board & Announcements Status

Implemented workflows:

- Digital notices.
- Circular management.
- Event announcements.
- Audience targeting for all, students, faculty, parents, and administration.
- Draft, scheduled, published, expired, and archived states.
- Priority tagging for normal, important, and urgent announcements.
- Preview panel for announcement review.
- Permission-aware controls for viewing, creating, editing, and archiving.
- Demo fallback data when Firebase is not configured.

Excluded for now:

- SMS integration.
- Email notifications.
- Parent communication system.

Current structure:

- `src/modules/notices/NoticeBoardManagement.jsx`
- `src/modules/notices/noticeUtils.js`
- `src/modules/notices/demoNotices.js`
- `src/modules/notices/components/NoticeModal.jsx`
- `src/modules/notices/components/NoticePreviewPanel.jsx`
- `src/modules/notices/components/NoticeTable.jsx`

Firebase collections:

- `noticeItems`

Role permissions:

- `notices.view`
- `notices.create`
- `notices.edit`
- `notices.archive`

## Document Management Status

Implemented workflows:

- Student document management.
- Staff document management.
- Academic records archive.
- Firebase Storage-backed uploads for managed documents.
- Metadata-only document records when a file is not selected or Storage is unavailable.
- Document verification and rejection workflow.
- Document archive workflow.
- Filters by owner type, category, status, and search text.
- Preview panel with file metadata and verification details.
- Permission-aware controls for viewing, uploading, verifying, and archiving.
- Demo fallback data when Firebase is not configured.

Current structure:

- `src/modules/documents/DocumentManagement.jsx`
- `src/modules/documents/documentUtils.js`
- `src/modules/documents/demoDocuments.js`
- `src/modules/documents/components/DocumentArchivePanel.jsx`
- `src/modules/documents/components/DocumentPreviewPanel.jsx`
- `src/modules/documents/components/DocumentTable.jsx`
- `src/modules/documents/components/DocumentUploadModal.jsx`

Firebase collections:

- `managedDocuments`
- `students`
- `staffMembers`

Firebase Storage paths:

- `managed-documents/{ownerType}/{ownerId}/{fileName}`

Role permissions:

- `documents.view`
- `documents.upload`
- `documents.verify`
- `documents.archive`

## Parent Portal Status

Implemented workflows:

- Linked student overview for parent accounts.
- Student attendance monitoring.
- Academic performance tracking from marks and generated results.
- Fee status monitoring from fee assignments.
- Published parent/student notice visibility.
- Verified student document visibility.
- Read-only parent-facing dashboard with role-aware access.
- Demo fallback data when Firebase is not configured.

Excluded for now:

- Parent communication system.
- SMS integration.
- Email notifications.

Current structure:

- `src/modules/parentPortal/ParentPortal.jsx`
- `src/modules/parentPortal/parentPortalUtils.js`
- `src/modules/parentPortal/demoParentPortal.js`
- `src/modules/parentPortal/components/AttendanceCard.jsx`
- `src/modules/parentPortal/components/FeeStatusCard.jsx`
- `src/modules/parentPortal/components/ParentDocumentsPanel.jsx`
- `src/modules/parentPortal/components/ParentNoticePanel.jsx`
- `src/modules/parentPortal/components/PerformanceCard.jsx`
- `src/modules/parentPortal/components/StudentSwitcher.jsx`

Firebase collections read:

- `students`
- `studentAttendanceRecords`
- `marksEntries`
- `studentResults`
- `feeAssignments`
- `noticeItems`
- `managedDocuments`
- `parentPortalLinks`

Role permissions:

- `parentPortal.view`
