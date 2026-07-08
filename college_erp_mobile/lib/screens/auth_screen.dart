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
  var _submitting = false;
  var _message = '';

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    setState(() {
      _submitting = true;
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
      setState(() => _message = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _resetPassword() async {
    setState(() {
      _submitting = true;
      _message = '';
    });
    try {
      await widget.authRepository.sendPasswordReset(
        _identifierController.text.trim(),
      );
      setState(() => _message = 'Password reset email sent.');
    } catch (error) {
      setState(() => _message = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
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
    return text.replaceFirst('Exception: ', '').replaceFirst('Bad state: ', '');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.page,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(22, 34, 22, 24),
          children: [
            const SizedBox(height: 30),
            Center(
              child: Container(
                width: 86,
                height: 86,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.line),
                ),
                child: Image.asset('assets/devloft_logo.png'),
              ),
            ),
            const SizedBox(height: 22),
            const Text(
              'Devloft College ERP',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 25,
                fontWeight: FontWeight.w900,
                color: AppColors.primaryDark,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Login with the same ERP account',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.muted,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 26),
            InfoCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _RolePicker(
                    value: _roleId,
                    onChanged: (value) => setState(() => _roleId = value),
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: _identifierController,
                    keyboardType: TextInputType.emailAddress,
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
                    obscureText: !_showPassword,
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
                              ? Icons.visibility_off_rounded
                              : Icons.visibility_rounded,
                        ),
                        onPressed: () =>
                            setState(() => _showPassword = !_showPassword),
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
                    label: _submitting ? 'Please wait...' : 'Login',
                    icon: Icons.login_rounded,
                    onPressed: widget.firebaseReady && !_submitting
                        ? _signIn
                        : null,
                  ),
                  const SizedBox(height: 6),
                  TextButton.icon(
                    onPressed: widget.firebaseReady && !_submitting
                        ? _resetPassword
                        : null,
                    icon: const Icon(Icons.mark_email_read_rounded, size: 18),
                    label: const Text('Forgot password?'),
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
  const _RolePicker({required this.value, required this.onChanged});

  final String value;
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
              onTap: () => onChanged(role.$1),
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
                      color: selected ? Colors.white : AppColors.primary,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      role.$2,
                      style: TextStyle(
                        color: selected ? Colors.white : AppColors.ink,
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
