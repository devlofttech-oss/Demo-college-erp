import 'package:flutter/material.dart';

class ErpModule {
  const ErpModule({
    required this.id,
    required this.label,
    required this.group,
    required this.permission,
    required this.icon,
    required this.color,
  });

  final String id;
  final String label;
  final String group;
  final String permission;
  final IconData icon;
  final Color color;
}
