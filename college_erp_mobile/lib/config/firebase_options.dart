import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

class CollegeFirebaseOptions {
  static const apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const authDomain = String.fromEnvironment('FIREBASE_AUTH_DOMAIN');
  static const projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const storageBucket = String.fromEnvironment(
    'FIREBASE_STORAGE_BUCKET',
  );
  static const messagingSenderId = String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
  );
  static const appId = String.fromEnvironment('FIREBASE_APP_ID');
  static const measurementId = String.fromEnvironment(
    'FIREBASE_MEASUREMENT_ID',
  );
  static const iosBundleId = String.fromEnvironment(
    'FIREBASE_IOS_BUNDLE_ID',
    defaultValue: 'com.devlofttech.collegesoft',
  );

  static bool get isConfigured {
    return apiKey.isNotEmpty &&
        projectId.isNotEmpty &&
        storageBucket.isNotEmpty &&
        messagingSenderId.isNotEmpty &&
        appId.isNotEmpty;
  }

  static FirebaseOptions get currentPlatform {
    return FirebaseOptions(
      apiKey: apiKey,
      appId: appId,
      messagingSenderId: messagingSenderId,
      projectId: projectId,
      authDomain: authDomain.isEmpty ? null : authDomain,
      storageBucket: storageBucket,
      measurementId: measurementId.isEmpty ? null : measurementId,
      iosBundleId: defaultTargetPlatform == TargetPlatform.iOS
          ? iosBundleId
          : null,
    );
  }
}
