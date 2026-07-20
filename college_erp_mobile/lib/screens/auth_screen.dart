import 'package:flutter/material.dart';

import '../models/app_user.dart';
import '../services/auth_repository.dart';
import '../theme/app_theme.dart';
import '../widgets/mobile_chrome.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({
    super.key,
    required this.authRepository,
    required this.firebaseReady,
    required this.onSignedIn,
  });

  final AuthRepository authRepository;
  final bool firebaseReady;
  final ValueChanged<AppUser> onSignedIn;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  var _roleId = 'parent';
  var _showPassword = false;
  var _signingIn = false;
  var _resetting = false;
  var _message = '';

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    final validation = _validateSignIn();
    if (validation != null) {
      setState(() => _message = validation);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _signingIn = true;
      _message = '';
    });
    try {
      final user = await widget.authRepository.signIn(
        roleId: _roleId,
        identifier: _identifierController.text.trim(),
        password: _passwordController.text,
      );
      widget.onSignedIn(user);
    } catch (error) {
      if (mounted) setState(() => _message = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _signingIn = false);
    }
  }

  Future<void> _resetPassword() async {
    final validation = _validateIdentifier();
    if (validation != null) {
      setState(() => _message = validation);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _resetting = true;
      _message = '';
    });
    try {
      await widget.authRepository.sendPasswordReset(
        _identifierController.text.trim(),
      );
      if (mounted) setState(() => _message = 'Password reset email sent.');
    } catch (error) {
      if (mounted) setState(() => _message = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _resetting = false);
    }
  }

  String? _validateIdentifier() {
    if (_identifierController.text.trim().isEmpty) {
      return 'Enter your email or phone first.';
    }
    return null;
  }

  String? _validateSignIn() {
    final identifierError = _validateIdentifier();
    if (identifierError != null) return identifierError;
    if (_passwordController.text.isEmpty) return 'Enter your password.';
    if (_passwordController.text.length < 6) {
      return 'Password should be at least 6 characters.';
    }
    return null;
  }

  String _friendlyError(Object error) {
    final text = error.toString();
    if (text.contains('invalid-credential')) {
      return 'Invalid email/phone or password.';
    }
    if (text.contains('network-request-failed')) {
      return 'Network error while contacting Firebase.';
    }
    if (text.contains('missing-email')) {
      return 'Enter your email or phone first.';
    }
    if (text.contains('user-not-found')) {
      return 'No account exists for that email or phone.';
    }
    if (text.contains('weak-password')) {
      return 'Password should be at least 6 characters.';
    }
    return text.replaceFirst('Exception: ', '').replaceFirst('Bad state: ', '');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7FBFF),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(22, 34, 22, 24),
          children: [
            const SizedBox(height: 30),
            Center(
              child: Container(
                width: 86,
                height: 86,
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: const Color(0xFFD8E8FF)),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF155EEF).withValues(alpha: 0.1),
                      blurRadius: 22,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(17),
                  child: Image.asset(
                    'assets/collegesoft.png',
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 22),
            const Text(
              'Collegesoft',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w900,
                color: Color(0xFF102A5C),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'College Management App',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.primary,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 24),
            InfoCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _RolePicker(
                    value: _roleId,
                    enabled: !_signingIn && !_resetting,
                    onChanged: (value) => setState(() {
                      _roleId = value;
                      _message = '';
                    }),
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: _identifierController,
                    enabled: !_signingIn && !_resetting,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [
                      AutofillHints.email,
                      AutofillHints.telephoneNumber,
                    ],
                    onChanged: (_) {
                      if (_message.isNotEmpty) setState(() => _message = '');
                    },
                    decoration: const InputDecoration(
                      prefixIcon: Icon(
                        Icons.mail_outline_rounded,
                        color: AppColors.muted,
                      ),
                      hintText: 'Email or Phone',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _passwordController,
                    enabled: !_signingIn && !_resetting,
                    obscureText: !_showPassword,
                    textInputAction: TextInputAction.done,
                    autofillHints: const [AutofillHints.password],
                    onChanged: (_) {
                      if (_message.isNotEmpty) setState(() => _message = '');
                    },
                    onSubmitted: (_) {
                      if (widget.firebaseReady && !_signingIn && !_resetting) {
                        _signIn();
                      }
                    },
                    decoration: InputDecoration(
                      prefixIcon: const Icon(
                        Icons.lock_outline_rounded,
                        color: AppColors.muted,
                      ),
                      hintText: 'Password',
                      suffixIcon: IconButton(
                        tooltip: _showPassword
                            ? 'Hide password'
                            : 'Show password',
                        icon: Icon(
                          _showPassword
                              ? Icons.visibility_rounded
                              : Icons.visibility_off_rounded,
                        ),
                        onPressed: _signingIn || _resetting
                            ? null
                            : () => setState(
                                () => _showPassword = !_showPassword,
                              ),
                      ),
                    ),
                  ),
                  if (_message.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      _message,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: _message.contains('sent')
                            ? AppColors.accent
                            : AppColors.danger,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                  if (!widget.firebaseReady) ...[
                    const SizedBox(height: 12),
                    const Text(
                      'Firebase values are not configured. Use the mobile env script or pass --dart-define values.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.danger,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  PrimaryActionButton(
                    label: _signingIn ? 'Please wait...' : 'Login',
                    icon: Icons.login_rounded,
                    onPressed:
                        widget.firebaseReady && !_signingIn && !_resetting
                        ? _signIn
                        : null,
                  ),
                  const SizedBox(height: 6),
                  TextButton.icon(
                    onPressed:
                        widget.firebaseReady && !_signingIn && !_resetting
                        ? _resetPassword
                        : null,
                    icon: const Icon(Icons.mark_email_read_rounded, size: 18),
                    label: Text(_resetting ? 'Sending...' : 'Forgot password?'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RolePicker extends StatelessWidget {
  const _RolePicker({
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final String value;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    const roles = [
      ('parent', 'Parent', Icons.family_restroom_rounded),
      ('faculty', 'Staff', Icons.groups_rounded),
      ('admin', 'Admin', Icons.admin_panel_settings_rounded),
    ];

    return Row(
      children: roles.map((role) {
        final selected = role.$1 == value;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: role.$1 == 'admin' ? 0 : 8),
            child: InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: enabled ? () => onChanged(role.$1) : null,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                height: 44,
                decoration: BoxDecoration(
                  color: selected ? AppColors.primary : AppColors.page,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: selected ? AppColors.primary : AppColors.line,
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      role.$3,
                      size: 16,
                      color: !enabled
                          ? AppColors.muted
                          : selected
                          ? Colors.white
                          : AppColors.primary,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      role.$2,
                      style: TextStyle(
                        color: !enabled
                            ? AppColors.muted
                            : selected
                            ? Colors.white
                            : AppColors.ink,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
