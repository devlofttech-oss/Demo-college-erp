import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

import '../config/firebase_options.dart';
import '../models/app_user.dart';
import 'erp_repository.dart';
import 'login_alias_resolver.dart';

class ManagedAuthUser {
  const ManagedAuthUser({
    required this.uid,
    required this.name,
    required this.email,
  });

  final String uid;
  final String name;
  final String email;
}

class AuthRepository {
  AuthRepository({
    required FirebaseAuth? auth,
    required ErpRepository erpRepository,
    required LoginAliasResolver aliases,
  }) : this._(auth, erpRepository, aliases);

  AuthRepository._(this._auth, this._erpRepository, this._aliases);

  final FirebaseAuth? _auth;
  final ErpRepository _erpRepository;
  final LoginAliasResolver _aliases;

  bool get isReady => _auth != null && _erpRepository.isReady;

  Stream<User?> authStateChanges() {
    final auth = _auth;
    if (auth == null) return const Stream.empty();
    return auth.authStateChanges();
  }

  Future<AppUser?> currentAppUser() async {
    final user = _auth?.currentUser;
    if (user == null) return null;
    final profile = await _erpRepository
        .userProfile(user.uid)
        .catchError((_) => null);
    return AppUser.fromFirebaseUser(user, profile);
  }

  Future<AppUser> signIn({
    required String roleId,
    required String identifier,
    required String password,
  }) async {
    final auth = _auth;
    if (auth == null || !_erpRepository.isReady) {
      throw StateError('Firebase is not configured for the mobile app.');
    }
    if (identifier.trim().isEmpty) {
      throw StateError('Enter your email or phone first.');
    }
    if (password.isEmpty) {
      throw StateError('Enter your password.');
    }
    if (password.length < 6) {
      throw StateError('Password should be at least 6 characters.');
    }
    if (!_aliases.canResolve(identifier)) {
      throw StateError('No account exists for that email or phone.');
    }
    final email = _aliases.resolve(identifier);
    final credential = await auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
    final firebaseUser = credential.user;
    if (firebaseUser == null) {
      throw StateError('Authentication failed.');
    }
    final profile = await _erpRepository
        .userProfile(firebaseUser.uid)
        .catchError((_) => null);
    final appUser = AppUser.fromFirebaseUser(firebaseUser, profile);
    final allowedAliases = _roleAliases(roleId);
    if (appUser.roleId != 'pending' &&
        !allowedAliases.contains(appUser.roleId)) {
      await auth.signOut();
      throw StateError('This account does not match the selected login role.');
    }
    return appUser;
  }

  Future<void> sendPasswordReset(String identifier) async {
    final auth = _auth;
    if (auth == null) {
      throw StateError('Firebase is not configured for the mobile app.');
    }
    if (identifier.trim().isEmpty) {
      throw StateError('Enter your email or phone first.');
    }
    if (!_aliases.canResolve(identifier)) {
      throw StateError('No account exists for that email or phone.');
    }
    await auth.sendPasswordResetEmail(email: _aliases.resolve(identifier));
  }

  Future<ManagedAuthUser> createManagedAuthUser({
    required String name,
    required String email,
    required String password,
  }) async {
    if (_auth == null || !CollegeFirebaseOptions.isConfigured) {
      throw StateError('Firebase is not configured for user creation.');
    }
    final app = await Firebase.initializeApp(
      name: 'managed-user-${DateTime.now().millisecondsSinceEpoch}',
      options: CollegeFirebaseOptions.currentPlatform,
    );
    final secondaryAuth = FirebaseAuth.instanceFor(app: app);
    try {
      final credential = await secondaryAuth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );
      final user = credential.user;
      if (user == null) throw StateError('Managed user was not created.');
      if (name.trim().isNotEmpty) {
        await user.updateDisplayName(name.trim());
      }
      return ManagedAuthUser(
        uid: user.uid,
        name: name.trim().isEmpty ? user.displayName ?? '' : name.trim(),
        email: user.email ?? email,
      );
    } finally {
      await secondaryAuth.signOut().catchError((_) {});
      await app.delete().catchError((_) {});
    }
  }

  Future<void> signOut() async {
    await _auth?.signOut();
  }

  List<String> _roleAliases(String roleId) {
    switch (roleId) {
      case 'admin':
        return const ['admin', 'super-admin'];
      case 'faculty':
        return const ['faculty'];
      case 'parent':
      default:
        return const ['parent'];
    }
  }
}
