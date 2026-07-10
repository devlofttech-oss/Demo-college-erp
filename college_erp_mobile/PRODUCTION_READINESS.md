# Mobile Production Readiness

This checklist tracks what is ready for a store-deployable Android build and what still requires private release assets.

## Ready In This Branch

- Firebase Auth login is wired to the existing backend.
- Firestore user profiles and live roles are loaded from the existing collections.
- Module visibility uses the existing permission keys.
- Managed documents can be uploaded from mobile to Firebase Storage.
- Uploaded document metadata is written to `managedDocuments`.
- Uploaded documents can be opened through their Storage download URL.
- Mobile module routes have smooth transitions and a Home action.
- GitHub Actions verifies Flutter format, analysis, tests, and Android debug build.
- Android release signing reads `android/key.properties` without committing secrets.
- Release build helper supports Android App Bundle generation.

## Required Private Release Steps

1. Create an Android upload keystore:

   ```powershell
   keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```

2. Store the keystore outside Git or under a local ignored folder such as:

   ```text
   college_erp_mobile/release/upload-keystore.jks
   ```

3. Create:

   ```text
   college_erp_mobile/android/key.properties
   ```

   Use `android/key.properties.example` as the template.

4. Confirm Firebase Console has Android app id:

   ```text
   com.devloft.collegeerp
   ```

5. Confirm Firebase Auth sign-in method is enabled.

6. Confirm Firestore and Storage rules are deployed.

7. Build the Play Store artifact:

   ```powershell
   cd C:\STORAGE\Code\ERP\Demo\CollegeERP
   .\college_erp_mobile\tool\build_android_release_from_root_env.ps1
   ```

8. Upload the generated `.aab` from:

   ```text
   college_erp_mobile/build/app/outputs/bundle/release/
   ```

## Firebase Rules Notes

The mobile upload path matches the existing web app and Storage rules:

```text
managed-documents/{ownerType}/{ownerId}/{timestamp}-{fileName}
```

The current Storage rules allow uploads for:

- PDF
- JPEG
- PNG
- WebP

The mobile app enforces the same file type and 10 MB size limit before upload.

## Still Not Store-Complete Without Follow-Up

- App icons and native splash are still generated defaults.
- Privacy policy and Play Store data safety form are not included in this repo.
- Push notifications are not implemented.
- App Check is not configured in Flutter yet.
- Offline-first behavior is not implemented.
- Full edit/archive/delete parity with every web module is still module-by-module work.
