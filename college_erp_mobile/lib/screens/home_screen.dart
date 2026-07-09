import 'package:flutter/material.dart';

import '../data/module_registry.dart';
import '../data/role_permissions.dart';
import '../models/app_user.dart';
import '../models/dashboard_snapshot.dart';
import '../models/erp_module.dart';
import '../models/erp_role.dart';
import '../navigation/app_routes.dart';
import '../services/erp_repository.dart';
import '../theme/app_theme.dart';
import '../utils/field_reader.dart';
import '../widgets/mobile_chrome.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.user,
    required this.roles,
    required this.repository,
    required this.onLogout,
    required this.onRefreshSession,
  });

  final AppUser user;
  final List<ErpRole> roles;
  final ErpRepository repository;
  final Future<void> Function() onLogout;
  final Future<void> Function() onRefreshSession;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _searchController = TextEditingController();
  var _query = '';
  var _loggingOut = false;
  late Future<DashboardSnapshot> _dashboardFuture;

  @override
  void initState() {
    super.initState();
    _dashboardFuture = widget.repository.dashboard();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    setState(() => _dashboardFuture = widget.repository.dashboard());
    await widget.onRefreshSession();
  }

  Future<void> _logout() async {
    setState(() => _loggingOut = true);
    try {
      await widget.onLogout();
    } finally {
      if (mounted) setState(() => _loggingOut = false);
    }
  }

  Future<void> _refreshDashboardShortcut() async {
    await _refresh();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Dashboard refreshed'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _clearSearch() {
    _searchController.clear();
    setState(() => _query = '');
  }

  bool _canOpenModule(ErpModule module) {
    return canAccess(widget.roles, widget.user.roleId, module.permission);
  }

  void _openModule(ErpModule module) {
    if (module.id == 'dashboard') {
      _refreshDashboardShortcut();
      return;
    }
    if (!_canOpenModule(module)) {
      _showModuleUnavailable(module);
      return;
    }
    AppRoutes.openModule<void>(
      context: context,
      module: module,
      user: widget.user,
      roles: widget.roles,
      repository: widget.repository,
    );
  }

  void _openModuleById(String id) {
    _openModule(moduleById(id));
  }

  void _showModuleUnavailable(ErpModule module) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${module.label} is not available for your role.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final accessibleModules = mobileModules.where(_canOpenModule).toList();
    final hasSearch = _query.trim().isNotEmpty;
    final modules = accessibleModules
        .where(
          (module) =>
              module.label.toLowerCase().contains(_query.toLowerCase()) ||
              module.group.toLowerCase().contains(_query.toLowerCase()),
        )
        .toList();
    final grouped = <String, List<ErpModule>>{};
    for (final module in modules) {
      grouped.putIfAbsent(module.group, () => []).add(module);
    }

    return MobileScaffold(
      title: '',
      showBack: false,
      actions: [
        IconButton(
          tooltip: 'Logout',
          icon: Icon(
            _loggingOut ? Icons.hourglass_top_rounded : Icons.logout_rounded,
          ),
          onPressed: _loggingOut ? null : () => _logout(),
        ),
      ],
      onRefresh: _refresh,
      body: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Hello',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      widget.user.name.isEmpty
                          ? widget.user.email
                          : widget.user.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                height: 42,
                width: 42,
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: IconButton(
                  tooltip: 'Notices and events',
                  onPressed: () => _openModuleById('communication'),
                  icon: const Icon(
                    Icons.notifications_none_rounded,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          SearchBox(
            controller: _searchController,
            hint: 'Search modules',
            onChanged: (value) => setState(() => _query = value),
          ),
          FutureBuilder<DashboardSnapshot>(
            future: _dashboardFuture,
            builder: (context, snapshot) {
              final data = snapshot.data;
              if (data == null) return const SizedBox(height: 18);
              return Column(
                children: [
                  const SectionTitle('Today'),
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 2.1,
                    children: [
                      StatTile(
                        label: 'Students',
                        value: data.students.toString(),
                        icon: Icons.school_rounded,
                        color: AppColors.accent,
                        onTap: () => _openModuleById('students'),
                      ),
                      StatTile(
                        label: 'Staff',
                        value: data.staff.toString(),
                        icon: Icons.groups_rounded,
                        color: const Color(0xFFE5835A),
                        onTap: () => _openModuleById('faculty-staff'),
                      ),
                      StatTile(
                        label: 'Collected',
                        value: formatMoney(data.feeCollected),
                        icon: Icons.payments_rounded,
                        color: const Color(0xFFF0A93B),
                        onTap: () => _openModuleById('fees'),
                      ),
                      StatTile(
                        label: 'Documents',
                        value: data.documents.toString(),
                        icon: Icons.folder_rounded,
                        color: const Color(0xFF12A6A6),
                        onTap: () => _openModuleById('document-management'),
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
          if (grouped.isEmpty)
            EmptyState(
              title: hasSearch ? 'No matching modules' : 'No modules',
              message: hasSearch
                  ? 'No modules match your search.'
                  : 'No mobile modules are available for your current role.',
              icon: Icons.apps_rounded,
              actionLabel: hasSearch ? 'Clear search' : null,
              actionIcon: Icons.close_rounded,
              onAction: hasSearch ? _clearSearch : null,
            )
          else
            ...grouped.entries.expand((entry) {
              return [
                SectionTitle(entry.key),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: entry.value.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.95,
                  ),
                  itemBuilder: (context, index) => _ModuleTile(
                    module: entry.value[index],
                    onTap: () => _openModule(entry.value[index]),
                  ),
                ),
              ];
            }),
          const SizedBox(height: 20),
          _ProfileCard(user: widget.user),
        ],
      ),
    );
  }
}

class _ModuleTile extends StatelessWidget {
  const _ModuleTile({required this.module, required this.onTap});

  final ErpModule module;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.line),
          boxShadow: [
            BoxShadow(
              color: AppColors.primaryDark.withValues(alpha: 0.05),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              height: 42,
              width: 42,
              decoration: BoxDecoration(
                color: module.color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(module.icon, color: module.color, size: 24),
            ),
            const SizedBox(height: 9),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Text(
                module.label,
                maxLines: 2,
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.person_rounded, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user.roleId,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  user.displayId.isEmpty ? user.email : user.displayId,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
            ),
          ),
          StatusPill(label: user.status),
        ],
      ),
    );
  }
}
