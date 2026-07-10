import 'dart:convert';

import 'package:flutter/services.dart';

class LoginAliasResolver {
  LoginAliasResolver(this._aliases);

  final Map<String, String> _aliases;

  static Future<LoginAliasResolver> load() async {
    try {
      final text = await rootBundle.loadString('assets/login_aliases.json');
      final decoded = jsonDecode(text) as Map<String, dynamic>;
      return LoginAliasResolver(
        decoded.map(
          (key, value) =>
              MapEntry(normalize(key), value.toString().trim().toLowerCase()),
        ),
      );
    } catch (_) {
      return LoginAliasResolver(const {});
    }
  }

  static String normalize(String value) => value.trim().toLowerCase();

  static String phoneDigits(String value) =>
      value.replaceAll(RegExp(r'\D'), '');

  static bool isEmail(String value) {
    return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value.trim());
  }

  String resolve(String identifier) {
    final normalized = normalize(identifier);
    final digits = phoneDigits(identifier);
    if (normalized.isEmpty) return '';
    return _aliases[normalized] ??
        (digits.isEmpty ? null : _aliases[digits]) ??
        normalized;
  }

  bool canResolve(String identifier) {
    final normalized = normalize(identifier);
    final digits = phoneDigits(identifier);
    if (normalized.isEmpty) return false;
    return isEmail(normalized) ||
        _aliases.containsKey(normalized) ||
        (digits.isNotEmpty && _aliases.containsKey(digits));
  }
}
