import 'package:college_erp_mobile/data/role_permissions.dart';
import 'package:college_erp_mobile/services/login_alias_resolver.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('super admin has every declared permission', () {
    final superAdmin = getRoleById(defaultRoles, 'super-admin');

    expect(superAdmin, isNotNull);
    expect(superAdmin!.permissions.toSet(), containsAll(allPermissions));
  });

  test('default roles preserve key ERP access rules', () {
    expect(canAccess(defaultRoles, 'admin', 'fees.collect'), isTrue);
    expect(
      canAccess(defaultRoles, 'faculty', 'attendance.markStudents'),
      isTrue,
    );
    expect(canAccess(defaultRoles, 'parent', 'parentPortal.view'), isTrue);
    expect(canAccess(defaultRoles, 'parent', 'fees.collect'), isFalse);
  });

  test('login alias resolver accepts email and phone aliases', () {
    final resolver = LoginAliasResolver({
      '9876543210': 'parent@example.com',
      'admin@example.com': 'admin@example.com',
    });

    expect(resolver.canResolve('admin@example.com'), isTrue);
    expect(resolver.resolve('98765 43210'), 'parent@example.com');
    expect(resolver.canResolve('not-a-login'), isFalse);
  });
}
