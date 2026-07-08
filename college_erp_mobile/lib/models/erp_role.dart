class ErpRole {
  const ErpRole({
    required this.id,
    required this.name,
    required this.description,
    required this.permissions,
    this.locked = false,
  });

  final String id;
  final String name;
  final String description;
  final List<String> permissions;
  final bool locked;

  factory ErpRole.fromMap(String id, Map<String, dynamic> data) {
    return ErpRole(
      id: (data['id'] ?? id).toString(),
      name: (data['name'] ?? id).toString(),
      description: (data['description'] ?? '').toString(),
      permissions: data['permissions'] is Iterable
          ? (data['permissions'] as Iterable)
                .map((item) => item.toString())
                .toList()
          : const [],
      locked: data['locked'] == true,
    );
  }
}
