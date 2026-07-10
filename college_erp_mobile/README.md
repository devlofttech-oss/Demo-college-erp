# Devloft College ERP Mobile

This folder contains the Flutter phone application for the existing CollegeERP project. It is intentionally isolated from the current React/Vite web ERP so mobile work can move forward without changing or breaking the web application.

The mobile app uses the same Firebase backend, same users, same Firestore collections, and same permission keys as the web ERP. The app is designed from the supplied mobile references: light blue-gray app background, compact white cards, dark blue-gray primary buttons, colorful academic module icons, search-first module pages, calendar/status views, and phone-sized student/fees/timetable/result layouts.

## Goals

1. Keep the existing ERP untouched.
   - Status: implemented by placing all mobile code under `college_erp_mobile/`.
   - The web source in `../src`, the root `package.json`, Firebase rules, and existing deploy files are not required by the Flutter app.

2. Use the same backend.
   - Status: implemented through Flutter Firebase client SDKs.
   - The app reads and writes the same Firebase Auth users, `users` profiles, `roles`, and ERP collections.

3. Use the same user and role model.
   - Status: implemented.
   - Login resolves email/phone aliases from `assets/login_aliases.json`, generated from the existing web alias map.
   - After Firebase Auth login, the app loads `users/{uid}` and checks `status`, `roleId`, linked parent/student fields, display ids, and permissions.

4. Use the same permissions.
   - Status: implemented.
   - Permission keys are mirrored from `src/modules/userRoles/rolePermissions.js`.
   - Live roles are loaded from Firestore `roles`; default roles are used only as fallback.

5. Bring the ERP modules to phone.
   - Status: first mobile implementation complete.
   - Implemented modules include dashboard, students, faculty/staff, attendance, timetable, exams/results, fees, communication/events, documents, hostel, parent portal, academics/syllabus, users/roles, reports, and settings.

6. Keep secrets out of GitHub.
   - Status: implemented.
   - The app accepts Firebase values through `--dart-define`.
   - Helper scripts read the existing ignored root `.env` locally, but `.env` is not committed.

7. Document everything.
   - Status: this README.

## Folder Safety

All app code lives here:

```text
college_erp_mobile/
```

The mobile app has its own:

```text
android/
ios/
web/
lib/
assets/
test/
tool/
pubspec.yaml
```

This keeps the current web ERP safe. When committing, stage only this folder unless you deliberately want to include other changes.

## App Identity

Android application id:

```text
com.devloft.collegeerp
```

iOS bundle identifier:

```text
com.devloft.collegeerp
```

Visible app name:

```text
Devloft ERP
```

## Design Direction

The supplied references are used as visual and structural direction, not as a separate product:

- White splash screen with centered brand mark.
- Soft blue-gray app background.
- Compact top bars with centered titles, back button, and notification/refresh actions.
- Search box near the top of major screens.
- Three-column academic module grid.
- White 8px cards for modules, records, filters, and summaries.
- Dark blue-gray primary action buttons.
- Green/red/yellow/blue status markers for attendance and fees.
- Student detail bottom sheet with tabs for information, attendance, results, and fees.
- Fees, timetable, result, and events pages arranged for single-hand phone use.

## Backend Parity

The app uses these Firebase products:

- Firebase Auth
- Cloud Firestore
- Firebase Storage is used for managed document upload/download workflows.

The app talks to the same collections used by the web ERP:

```text
users
roles
students
studentAdmissions
studentDocuments
studentHealthRecords
studentAttendanceRecords
studentPromotions
studentTransfers
staffMembers
departments
staffLeaveRecords
staffAttendanceRecords
classrooms
timetableEntries
timetablePublications
examSchedules
internalAssessments
marksEntries
studentResults
reportCards
feeStructures
feeAssignments
feeCollections
feeAdjustments
hostelRooms
hostelAllocations
hostelRecords
noticeItems
managedDocuments
academicPrograms
academicSubjects
academicBatches
academicCalendarEvents
systemSettings
colleges
```

## Auth Flow

The mobile login matches the web flow:

1. User selects Parent, Staff, or Admin.
2. User enters email or phone.
3. The app resolves phone aliases using `assets/login_aliases.json`.
4. Firebase Auth signs in with email/password.
5. The app loads `users/{uid}`.
6. It checks:
   - `status == Active`
   - valid `roleId`
   - selected login role matches the profile role
7. The app loads live `roles` from Firestore.
8. The home grid shows only modules allowed by the role permissions.

If the user exists in Firebase Auth but has no active profile, the app shows the same pending-access concept as the web ERP.

## Permission Model

The permission keys mirror the existing ERP:

```text
students.view
students.create
students.edit
students.archive
students.documents
students.verifyDocuments
students.promote
staff.view
staff.create
staff.edit
staff.archive
staff.leave
staff.attendance
users.view
users.create
users.edit
roles.view
roles.edit
dashboard.view
attendance.view
attendance.markStudents
attendance.markStaff
attendance.reports
attendance.notifyParents
timetable.view
timetable.create
timetable.edit
timetable.publish
exams.view
exams.schedule
exams.assessments
exams.marks
exams.results
fees.view
fees.setup
fees.assign
fees.collect
fees.adjust
fees.reports
hostel.view
hostel.manage
reports.view
notices.view
notices.create
notices.edit
notices.archive
documents.view
documents.upload
documents.verify
documents.archive
parentPortal.view
parentPortal.viewAll
settings.view
settings.manage
```

The source of truth remains Firestore `roles`. The Dart defaults exist so the app can still render predictable access if role documents are unavailable during development.

## Mobile Module Map

| Mobile module | Permission | Main collections |
| --- | --- | --- |
| Dashboard | `dashboard.view` | students, staffMembers, feeAssignments, feeCollections, managedDocuments, noticeItems, examSchedules |
| Students | `students.view` | students, studentAdmissions, studentAttendanceRecords, marksEntries, studentResults, feeAssignments, managedDocuments |
| Teachers | `staff.view` | staffMembers, departments, staffLeaveRecords, staffAttendanceRecords |
| Attendance | `attendance.view` | students, staffMembers, studentAttendanceRecords, staffAttendanceRecords |
| Time Table | `timetable.view` | timetableEntries, classrooms, timetablePublications |
| Results | `exams.view` | examSchedules, marksEntries, studentResults, reportCards |
| Fees | `fees.view` | feeStructures, feeAssignments, feeCollections, feeAdjustments |
| Events | `notices.view` | noticeItems |
| Documents | `documents.view` | managedDocuments, studentDocuments |
| Hostel | `hostel.view` | hostelRooms, hostelAllocations, hostelRecords |
| Parent | `parentPortal.view` | linked students plus attendance, marks, fees, documents, notices |
| Academics/Syllabus | `academicCurriculum.view` or `academics.view` | academicPrograms, academicSubjects, academicBatches, academicCalendarEvents |
| Users | `users.view` | users, roles |
| Settings | `settings.view` | systemSettings, colleges |

## Current Mobile Features

- Splash screen.
- Firebase configured/unconfigured guard.
- Same email/phone login behavior.
- Same role selection behavior: Parent, Staff, Admin.
- Pending-access screen.
- Permission-filtered home module grid.
- Dashboard statistics.
- Student list and student detail sheet.
- Parent-linked student display.
- Staff list.
- Attendance calendar and recent attendance.
- Quick attendance creation for roles with mark permissions.
- Timetable grouped by weekday.
- Marks/result table.
- Fee assignment summary and paid/unpaid state.
- Events/notices calendar strip.
- Notice creation for roles with `notices.create`.
- Document list with Storage-backed upload/open actions.
- Hostel room/allocation summaries.
- Academic subjects and calendar events.
- Users and roles list.
- Institute/settings view.
- Pull to refresh on mobile screens.
- Named module routes with smooth slide/fade transitions.
- Home action on module screens so every module can return to the dashboard without depending on back-stack history.
- Firestore-backed quick action forms for common operations such as adding students/staff, marking attendance, scheduling exams, entering marks, assigning/collecting fees, creating notices, uploading managed documents, adding hostel rooms, and saving academic records.

## Firebase Configuration

The web app uses root `.env` variables named like:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

The Flutter app expects the same values passed as Dart defines:

```text
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
FIREBASE_MEASUREMENT_ID
```

Do not commit `.env`, service account keys, or admin SDK credentials into this app.

## Run Locally

From the mobile folder:

```powershell
cd C:\STORAGE\Code\ERP\Demo\CollegeERP\college_erp_mobile
flutter pub get
.\tool\run_from_root_env.ps1
```

To target a specific device:

```powershell
.\tool\run_from_root_env.ps1 -Device chrome
.\tool\run_from_root_env.ps1 -Device emulator-5554
```

The helper reads the root ignored `.env` file and converts `VITE_FIREBASE_*` values into Flutter `--dart-define` values.

## Build Android

Debug APK:

```powershell
cd C:\STORAGE\Code\ERP\Demo\CollegeERP\college_erp_mobile
.\tool\build_android_debug_from_root_env.ps1
```

Release APK with the current release-signing config or debug fallback:

```powershell
.\tool\build_android_debug_from_root_env.ps1 -Release
```

Production Android App Bundle:

```powershell
cd C:\STORAGE\Code\ERP\Demo\CollegeERP
.\college_erp_mobile\tool\build_android_release_from_root_env.ps1
```

Before a production release, create a private upload keystore and local `android/key.properties` from `android/key.properties.example`. See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md).

## Sync Login Aliases

The current `assets/login_aliases.json` was generated from:

```text
../src/firebase/loginAliases.generated.js
```

If the web ERP regenerates aliases later, regenerate this mobile asset from the same source before releasing a mobile build.

## Tests And Verification

Run:

```powershell
flutter analyze
flutter test
```

Current tests cover:

- Super admin permission completeness.
- Default admin/faculty/parent access expectations.
- Email and phone alias resolution.

To verify a real Firebase Auth login without committing credentials:

```powershell
cd C:\STORAGE\Code\ERP\Demo\CollegeERP
.\college_erp_mobile\tool\verify_firebase_auth.ps1 -Email "user@example.com" -Password "password"
```

The helper checks Firebase Auth through the public identity endpoint, then confirms the matching Firestore `users/{uid}` profile through the local ignored service account. It prints only success/failure, role, and status.

## Important Safety Notes

- The app uses client Firebase SDKs only.
- Do not add `serviceAccountKey.json`.
- Do not add Firebase Admin SDK flows to the phone app.
- Firestore and Storage security rules remain the enforcement layer for production access.
- The mobile app hides actions by permission, but backend rules must continue to protect data.
- The app should be committed from the repo root by staging `college_erp_mobile/` only.

## Development Notes

Primary code paths:

```text
lib/main.dart
lib/config/firebase_options.dart
lib/data/role_permissions.dart
lib/data/module_registry.dart
lib/services/auth_repository.dart
lib/services/erp_repository.dart
lib/screens/auth_screen.dart
lib/screens/home_screen.dart
lib/screens/module_screen.dart
lib/widgets/mobile_chrome.dart
```

The app intentionally keeps state management simple for the first mobile implementation. Repositories isolate Firebase access, while screens handle mobile presentation and refresh.

## Next Goals

These are the best follow-up goals after the first pushed version:

1. Add full create/edit forms for students, staff, fees, timetable, exams, documents, and hostel.
2. Add Firebase Storage upload/download UI for profile photos.
3. Add offline caching and optimistic updates for attendance.
4. Add push notifications for notices, attendance alerts, and fee reminders.
5. Add role-aware bottom navigation for the most-used modules by user type.
6. Add app icons and native splash assets.
7. Replace generated app icons and splash assets with production branding.
8. Add widget/golden tests for the reference-style UI.

## Git Workflow

Recommended branch:

```text
codex/flutter-mobile-app
```

Recommended commit scope:

```powershell
git add college_erp_mobile
git commit -m "Add Flutter mobile ERP app"
git push -u origin codex/flutter-mobile-app
```

This keeps mobile development reviewable and separate from `master`.
