# Collegesoft Google Play Launch Pack

Google Play is the easiest store to do first from this Windows machine because the Android build path is already working. Apple App Store publishing is next, but it needs Apple Developer membership, App Store Connect, and a Mac/Xcode step for the final iOS archive.

## Public Pages For Store Review

These pages should live on the public Collegesoft website, not inside the logged-in mobile app. Reviewers and users must be able to open them in a browser without signing in.

- Privacy Policy: `https://collegesoftapp.devlofttech.com/privacy-policy`
- Terms And Conditions: `https://collegesoftapp.devlofttech.com/terms-and-conditions`
- Support: `https://collegesoftapp.devlofttech.com/support`

The live website returns HTTP 200 for all three routes.

Important before publishing:

- Support email is set to `hello@devlofttech.com`.
- Have the privacy policy reviewed for your actual company name, country, institution agreements, and student data handling.
- Keep the privacy policy URL stable after submission. Changing it later is allowed, but it should not break.

## Store Listing

App name:

```text
Collegesoft
```

Short description:

```text
College ERP for parents, staff, notices, attendance, fees, and reports.
```

Full description:

```text
Collegesoft is a secure college management app for institutions, staff, parents, and administrators.

Parents can view linked student updates, notices, attendance, academic progress, documents, and fee status. Staff and administrators can access role-based ERP modules for daily operations, communication, reports, documents, and academic workflows.

Key features:
- Parent portal for linked student records
- Notices and announcements
- Attendance and academic progress
- Fee status and financial reports
- Document access and verification workflows
- Role-based access for parents, staff, and administrators
- Firebase-backed secure login

Collegesoft is intended for authorized users of participating institutions. Login credentials are provided by the institution.
```

Category:

```text
Education
```

Tags and keywords:

```text
college ERP, school management, parent portal, attendance, fees, notices, academic reports, college management
```

Contact details:

```text
Support email: hello@devlofttech.com
Website: https://collegesoftapp.devlofttech.com
Privacy policy: https://collegesoftapp.devlofttech.com/privacy-policy
```

## Data Safety Draft

Use this as the starting point for Google Play's Data safety form. Match the final answers to the real production behavior.

Data collected:

- Name
- Email address
- Phone number
- User IDs
- Student profile and admission records
- Attendance
- Marks, results, and exam information
- Fee records and payment status
- Documents and document metadata
- Notices and communication records
- App diagnostics or crash data if enabled

Purpose:

- App functionality
- Account management
- Authentication and security
- Institution administration
- Support and troubleshooting
- Analytics or diagnostics only if enabled

Data sharing:

- Shared with Firebase/Google Cloud as service providers for authentication, database, storage, and infrastructure.
- Shared with institution-authorized users according to role permissions.
- Not sold to third parties.

Security:

- Data is encrypted in transit through HTTPS/Firebase services.
- Access is controlled through Firebase Authentication and role-based permissions.
- Users can request correction or deletion through the institution administrator or support email.

## Reviewer Access

Google Play review needs a working login if any screen is gated.

Create and verify these test accounts before submission:

```text
Parent reviewer login: TODO
Staff reviewer login: TODO
Admin reviewer login: TODO
Password: TODO
```

Reviewer notes:

```text
This app is for authorized users of participating institutions. Please use the supplied reviewer credentials. Parent accounts are view-only for linked student information and notices. Staff/admin accounts expose role-based ERP modules for review.
```

## Required Assets

- App icon: already using `collegesoft.png` in the Android app.
- Feature graphic: 1024 x 500 px.
- Phone screenshots: at least 2, recommended 6 to 8.
- Optional tablet screenshots if tablet support is enabled.

Recommended screenshot set:

- Login screen
- Parent portal
- Notices and announcements
- Attendance
- Reports or financial graphs
- Documents

## Android Build Checklist

Verified production values:

- Android package ID: `com.devlofttech.collegesoft`
- App label: `Collegesoft`
- Version name: `1.0.0`
- Version code: `1`
- Target SDK: `36`
- Upload key: generated locally and ignored by git
- Upload key backup: `C:\Users\Snghosh kulkarni\Downloads\Collegesoft-Play-upload-key-backup.txt`

After the first Play Store upload, changing package ID means publishing a separate app.

Build command from `college_erp_mobile`:

```powershell
powershell -ExecutionPolicy Bypass -File .\tool\build_android_release_from_root_env.ps1
```

Expected Play upload artifact:

```text
C:\Users\Snghosh kulkarni\Downloads\Collegesoft-1.0.0-build-1-play-upload.aab
```

Build output copy:

```text
C:\STORAGE\Code\ERP\Demo\CollegeERP\college_erp_mobile\build\app\outputs\bundle\release\app-release.aab
```

Direct-install APK location from the latest local build:

```text
C:\Users\Snghosh kulkarni\Downloads\Collegesoft-login-ready.apk
```

## Google Play Console Steps

1. Create or open the Google Play Developer account.
2. Create a new app named `Collegesoft`.
3. Select app type `App`, category `Education`, and pricing as needed.
4. Complete App content sections: Privacy Policy, Data safety, Ads, App access, Target audience, Content rating, and Government apps.
5. Upload the release `.aab`.
6. Add store listing text, screenshots, app icon, and feature graphic.
7. Add reviewer credentials in App access.
8. Use internal testing first.
9. Move to closed testing or production when Play Console allows it.

Note: New personal Play Console accounts may need closed testing with at least 12 testers for at least 14 days before production access. Organization accounts have a different review path.
