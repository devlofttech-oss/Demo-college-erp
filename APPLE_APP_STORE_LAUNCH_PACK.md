# Collegesoft Apple App Store Launch Pack

Apple can be prepared in parallel with Google Play, but the final iOS archive requires macOS with Xcode. This Windows machine can update the Flutter/iOS project files and prepare App Store Connect metadata, but it cannot produce or upload the final `.ipa`.

## Verified Public URLs

- Marketing website: `https://collegesoftapp.devlofttech.com`
- Privacy Policy: `https://collegesoftapp.devlofttech.com/privacy-policy`
- Terms And Conditions: `https://collegesoftapp.devlofttech.com/terms-and-conditions`
- Support: `https://collegesoftapp.devlofttech.com/support`

## iOS App Identity

- App name: `Collegesoft`
- Bundle ID: `com.devlofttech.collegesoft`
- Version: `1.0.0`
- Build number: `1`
- SKU: `COLLEGESOFT-IOS`
- Primary language: `English`
- Category: `Education`
- Price: `Free`
- Support email: `devlofttech@gmail.com`

## App Store Listing

Subtitle:

```text
College ERP for parents and staff
```

Promotional text:

```text
Collegesoft brings college ERP workflows to mobile with secure access for parents, staff, and administrators.
```

Description:

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

Keywords:

```text
college ERP,school management,parent portal,attendance,fees,notices,reports,education
```

Review notes:

```text
This app is for authorized users of participating institutions. Please use the supplied reviewer credentials. Parent accounts are view-only for linked student information and notices. Staff/admin accounts expose role-based ERP modules for review.
```

Reviewer account placeholders:

```text
Parent reviewer login: TODO
Staff reviewer login: TODO
Admin reviewer login: TODO
Password: TODO
```

## App Privacy Draft

Use this as the starting point for App Store Connect's App Privacy questionnaire. Match final answers to the real production behavior.

Data collected:

- Contact Info: name, email address, phone number
- Identifiers: user ID, Firebase authentication ID
- User Content: uploaded documents or document metadata, notices, messages where enabled
- Other Data: student profile, admission records, attendance, marks/results, fee status, academic records
- Diagnostics: crash or performance data only if enabled

Data linked to the user:

- Name
- Email address
- Phone number
- User ID
- Student and academic records tied to the account or linked student

Tracking:

- No third-party advertising tracking.
- No data sold to third parties.

Data use:

- App functionality
- Account management
- Authentication/security
- Institution administration
- Support/troubleshooting

## Required App Store Assets

- App icon: iOS icon set is now generated from `assets/collegesoft.png`.
- iPhone screenshots: required for current supported iPhone display sizes in App Store Connect.
- iPad screenshots: required if iPad is supported.

Recommended screenshot set:

- Login screen
- Parent portal
- Notices and announcements
- Attendance
- Reports or financial graphs
- Documents

## Mac Build And Upload Steps

On a Mac with Xcode installed:

```bash
cd /path/to/CollegeERP/college_erp_mobile
flutter clean
flutter pub get
chmod +x tool/build_ios_release_from_root_env.sh
./tool/build_ios_release_from_root_env.sh
```

Expected output:

```text
build/ios/ipa/*.ipa
```

Upload using Apple's Transporter app, Xcode Organizer, or command-line upload with App Store Connect API credentials.

## App Store Connect Steps

1. Enroll or sign in to the Apple Developer Program.
2. Open App Store Connect.
3. Create a new app.
4. Platform: `iOS`.
5. Name: `Collegesoft`.
6. Primary language: `English`.
7. Bundle ID: select `com.devlofttech.collegesoft`.
8. SKU: `COLLEGESOFT-IOS`.
9. Add pricing as `Free`.
10. Add privacy policy, support URL, description, keywords, screenshots, and reviewer notes.
11. Upload the `.ipa` build from Mac/Xcode.
12. Submit first to TestFlight for smoke testing.
13. Submit to App Review after the build and metadata are complete.

## Blockers To Clear

- Apple Developer Program membership must be active. Apple lists it as 99 USD per membership year or local currency where available.
- A Mac with Xcode is required for the final archive/sign/upload path.
- The iOS bundle ID `com.devlofttech.collegesoft` should be registered in Apple Developer and Firebase.
- Real reviewer credentials must be created and tested before submission.
