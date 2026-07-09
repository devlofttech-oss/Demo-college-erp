import 'package:flutter/material.dart';

import '../models/app_user.dart';
import '../models/erp_module.dart';
import '../models/erp_role.dart';
import '../screens/module_screen.dart';
import '../services/erp_repository.dart';

class AppRoutes {
  static const login = '/login';
  static const home = '/home';
  static const accessPending = '/access-pending';

  static String module(String id) => '/modules/$id';

  static Future<T?> openModule<T>({
    required BuildContext context,
    required ErpModule module,
    required AppUser user,
    required List<ErpRole> roles,
    required ErpRepository repository,
  }) {
    return Navigator.of(context).push<T>(
      _SmoothPageRoute<T>(
        settings: RouteSettings(name: AppRoutes.module(module.id)),
        child: ModuleScreen(
          module: module,
          user: user,
          roles: roles,
          repository: repository,
        ),
      ),
    );
  }

  static void goHome(BuildContext context) {
    Navigator.of(context).popUntil((route) => route.isFirst);
  }
}

class _SmoothPageRoute<T> extends PageRouteBuilder<T> {
  _SmoothPageRoute({required Widget child, super.settings})
    : super(
        transitionDuration: const Duration(milliseconds: 320),
        reverseTransitionDuration: const Duration(milliseconds: 240),
        pageBuilder: (context, animation, secondaryAnimation) => child,
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          final curve = CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
            reverseCurve: Curves.easeInCubic,
          );
          return FadeTransition(
            opacity: curve,
            child: SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0.08, 0),
                end: Offset.zero,
              ).animate(curve),
              child: child,
            ),
          );
        },
      );
}
