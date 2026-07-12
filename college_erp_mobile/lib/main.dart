import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';

import 'config/firebase_options.dart';
import 'models/app_user.dart';
import 'models/erp_role.dart';
import 'screens/access_pending_screen.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'screens/splash_screen.dart';
import 'services/auth_repository.dart';
import 'services/erp_repository.dart';
import 'services/login_alias_resolver.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final aliases = await LoginAliasResolver.load();
  var firebaseReady = false;

  if (CollegeFirebaseOptions.isConfigured) {
    await Firebase.initializeApp(
      options: CollegeFirebaseOptions.currentPlatform,
    );
    firebaseReady = true;
  }

  runApp(CollegeErpMobileApp(aliases: aliases, firebaseReady: firebaseReady));
}

class CollegeErpMobileApp extends StatefulWidget {
  const CollegeErpMobileApp({
    super.key,
    required this.aliases,
    required this.firebaseReady,
  });

  final LoginAliasResolver aliases;
  final bool firebaseReady;

  @override
  State<CollegeErpMobileApp> createState() => _CollegeErpMobileAppState();
}

class _CollegeErpMobileAppState extends State<CollegeErpMobileApp> {
  late final ErpRepository _erpRepository;
  late final AuthRepository _authRepository;
  AppUser? _user;
  List<ErpRole> _roles = const [];
  var _loading = true;

  @override
  void initState() {
    super.initState();
    _erpRepository = ErpRepository(
      firestore: widget.firebaseReady ? FirebaseFirestore.instance : null,
      storage: widget.firebaseReady ? FirebaseStorage.instance : null,
    );
    _authRepository = AuthRepository(
      auth: widget.firebaseReady ? FirebaseAuth.instance : null,
      erpRepository: _erpRepository,
      aliases: widget.aliases,
    );
    _loadSession();
  }

  Future<void> _loadSession() async {
    setState(() => _loading = true);
    final user = await _authRepository.currentAppUser().catchError((_) => null);
    final roles = await _erpRepository.roles();
    if (!mounted) return;
    setState(() {
      _user = user;
      _roles = roles;
      _loading = false;
    });
  }

  Future<void> _onSignedIn(AppUser user) async {
    final roles = await _erpRepository.roles();
    if (!mounted) return;
    setState(() {
      _user = user;
      _roles = roles;
    });
  }

  Future<void> _logout() async {
    await _authRepository.signOut();
    if (!mounted) return;
    setState(() {
      _user = null;
      _roles = const [];
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Devloft College ERP',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: AnimatedSwitcher(
        duration: const Duration(milliseconds: 250),
        child: _buildHome(),
      ),
    );
  }

  Widget _buildHome() {
    if (_loading) {
      return const SplashScreen();
    }

    if (_user == null) {
      return AuthScreen(
        authRepository: _authRepository,
        firebaseReady: widget.firebaseReady,
        onSignedIn: _onSignedIn,
      );
    }

    final user = _user!;
    if (!user.hasActiveProfile) {
      return AccessPendingScreen(
        user: user,
        onLogout: _logout,
        onRefresh: _loadSession,
      );
    }

    return HomeScreen(
      user: user,
      roles: _roles,
      repository: _erpRepository,
      authRepository: _authRepository,
      onLogout: _logout,
      onRefreshSession: _loadSession,
    );
  }
}
