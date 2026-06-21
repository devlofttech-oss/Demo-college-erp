# Security deployment notes

These changes harden the ERP around Firebase Security Rules instead of trusting
React-side permission checks.

## What changed

- Firestore now denies unknown collections by default.
- Users must have an active `/users/{uid}` profile before they can read or write
  ERP data. A Firebase Auth account without a profile is not enough.
- Staff/admin writes are checked against the live `/roles/{roleId}.permissions`
  document, with `super-admin` treated as the break-glass role.
- Parent reads are scoped to explicit links on the parent profile:
  - `linkedStudentRecordIds`: Firestore document IDs such as
    `seed-student-vivek`.
  - `linkedStudentIds`: ERP student IDs such as `STU-4449`.
- Storage now checks the same active user profile through cross-service rules,
  limits uploads to PDF/JPEG/PNG/WebP, and caps uploads at 10 MB.
- Public `/register` is removed from the app routes. Users should be created by
  an admin workflow, and long term by a Cloud Function.

## Before deploying

1. Rotate any account that ever used the old demo password
   `CollegeERP@2026`.
2. Seed role users with a strong temporary password:

   ```bash
   $env:SEED_USER_PASSWORD = "use-a-long-one-time-password"
   npm run firebase:seed-users
   ```

3. Make sure parent users have `linkedStudentRecordIds` and `linkedStudentIds`.
   The user modal now writes those fields when a parent account is created or
   edited.
4. Deploy both rule sets:

   ```bash
   firebase deploy --only firestore:rules,storage:rules
   ```

The Storage rules use Firebase cross-service rules with `firestore.get()` and
`firestore.exists()`. Firebase documents this for Cloud Storage rules, but the
first CLI/console deploy may ask you to grant the Storage service account access
to read Firestore documents.

## Still required for production

- Move `createManagedAuthUser` behind a callable Cloud Function that checks the
  caller server-side before creating Firebase Auth users.
- Enable MFA for `super-admin` and `admin` accounts.
- Enable Firebase App Check for Auth, Firestore, and Storage.
- Add Cloud Function audit logs for writes to users, roles, marks, results,
  fees, documents, and settings.
- Add scheduled Firestore exports to an access-restricted backup bucket.
- Add security-rules emulator tests for parent access, inactive users,
  unprofiled Auth users, and fee/grade write permissions.
