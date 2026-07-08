import 'package:flutter/material.dart';

import '../models/app_user.dart';
import '../theme/app_theme.dart';
import '../widgets/mobile_chrome.dart';

class AccessPendingScreen extends StatelessWidget {
  const AccessPendingScreen({
    super.key,
    required this.user,
    required this.onLogout,
  });

  final AppUser user;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return MobileScaffold(
      title: 'Access',
      showBack: false,
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SizedBox(height: 80),
          const Icon(
            Icons.lock_clock_rounded,
            size: 54,
            color: AppColors.primary,
          ),
          const SizedBox(height: 18),
          const Text(
            'Access pending',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          const Text(
            'This login does not have an active ERP profile yet. Ask an administrator to activate the account.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: 20),
          InfoCard(
            child: Column(
              children: [
                LabelValue(
                  label: 'Email',
                  value: user.email.isEmpty ? '-' : user.email,
                ),
                const SizedBox(height: 14),
                LabelValue(label: 'Status', value: user.status),
              ],
            ),
          ),
          const SizedBox(height: 20),
          PrimaryActionButton(
            label: 'Logout',
            icon: Icons.logout_rounded,
            onPressed: () => onLogout(),
          ),
        ],
      ),
    );
  }
}
