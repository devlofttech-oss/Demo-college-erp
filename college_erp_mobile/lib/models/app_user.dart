import 'package:firebase_auth/firebase_auth.dart';

class AppUser {
  const AppUser({
    required this.uid,
    required this.name,
    required this.email,
    required this.roleId,
    required this.status,
    required this.permissions,
    required this.displayId,
    required this.collegeIds,
    required this.linkedStudentIds,
    required this.linkedStudentRecordIds,
  });

  final String uid;
  final String name;
  final String email;
  final String roleId;
  final String status;
  final List<String> permissions;
  final String displayId;
  final List<String> collegeIds;
  final List<String> linkedStudentIds;
  final List<String> linkedStudentRecordIds;

  bool get hasActiveProfile =>
      status == 'Active' && roleId.isNotEmpty && roleId != 'pending';
  bool get isParent => roleId == 'parent';

  factory AppUser.pending(User user) {
    return AppUser(
      uid: user.uid,
      name: user.displayName ?? '',
      email: user.email ?? '',
      roleId: 'pending',
      status: 'Pending Approval',
      permissions: const [],
      displayId: '',
      collegeIds: const ['main-campus'],
      linkedStudentIds: const [],
      linkedStudentRecordIds: const [],
    );
  }

  factory AppUser.fromFirebaseUser(User user, Map<String, dynamic>? profile) {
    final data = profile ?? const <String, dynamic>{};
    return AppUser(
      uid: user.uid,
      name: _text(data['name']).isNotEmpty
          ? _text(data['name'])
          : user.displayName ?? '',
      email: _text(data['email']).isNotEmpty
          ? _text(data['email'])
          : user.email ?? '',
      roleId: _text(data['roleId']).isNotEmpty
          ? _text(data['roleId'])
          : 'pending',
      status: _text(data['status']).isNotEmpty
          ? _text(data['status'])
          : 'Pending Approval',
      permissions: _stringList(data['permissions']),
      displayId: _firstText(data, const ['displayId', 'adminId', 'employeeId']),
      collegeIds: _stringList(
        data['collegeIds'],
        fallback: const ['main-campus'],
      ),
      linkedStudentIds: _stringList(data['linkedStudentIds']),
      linkedStudentRecordIds: _stringList(data['linkedStudentRecordIds']),
    );
  }

  static String _firstText(Map<String, dynamic> data, List<String> keys) {
    for (final key in keys) {
      final value = _text(data[key]);
      if (value.isNotEmpty) return value;
    }
    return '';
  }

  static String _text(Object? value) => value == null ? '' : value.toString();

  static List<String> _stringList(
    Object? value, {
    List<String> fallback = const [],
  }) {
    if (value is Iterable) {
      final list = value
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList();
      return list.isEmpty ? fallback : list;
    }
    return fallback;
  }
}
