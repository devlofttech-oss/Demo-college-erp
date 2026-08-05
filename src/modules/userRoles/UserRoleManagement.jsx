import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, ShieldCheck, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createRole,
  createUserProfile,
  getStudentInformationData,
  getUserRoleData,
  updateRole,
  updateUserProfile,
} from '../../firebase/db';
import { createManagedAuthUser } from '../../firebase/auth';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles, validateUserForm, validateUserUpdate } from './rolePermissions';
import { applyStudentActivityOverrides, isActiveStudentRecord } from '../shared/studentActivityPolicy';
import RolePermissionEditor from './components/RolePermissionEditor';
import UserModal from './components/UserModal';
import UserTable from './components/UserTable';

function mergeRoles(firestoreRoles) {
  const byId = new Map(defaultRoles.map((role) => [role.id, role]));
  firestoreRoles.forEach((role) => byId.set(role.id, { ...byId.get(role.id), ...role }));
  return [...byId.values()];
}

export default function UserRoleManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(defaultRoles);
  const [selectedRoleId, setSelectedRoleId] = useState('admin');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [savingRole, setSavingRole] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [studentOptions, setStudentOptions] = useState([]);

  useEffect(() => {
    const loadUsersAndRoles = async () => {
      if (!isFirebaseConfigured) {
        setLoadError('Live Firebase data is not configured.');
        setLoading(false);
        return;
      }
      try {
        const data = await getUserRoleData();
        setRoles(mergeRoles(data.roles));
        setUsers(data.users || []);
        const studentData = await getStudentInformationData().catch(() => ({ students: [] }));
        setStudentOptions(applyStudentActivityOverrides(studentData.students || []).filter(isActiveStudentRecord));
        setLoadError('');
      } catch (error) {
        console.error('Unable to load live users/roles.', error);
        setLoadError('Unable to load live users/roles.');
      } finally {
        setLoading(false);
      }
    };

    loadUsersAndRoles();
  }, []);

  const rolesById = useMemo(() => Object.fromEntries(roles.map((role) => [role.id, role])), [roles]);
  const selectedRole = rolesById[selectedRoleId] || roles[0];
  const canCreateUsers = canAccess(roles, currentUser?.roleId || 'admin', 'users.create');
  const canEditUsers = canAccess(roles, currentUser?.roleId || 'admin', 'users.edit');
  const canEditRoles = canAccess(roles, currentUser?.roleId || 'admin', 'roles.edit');
  const sortedRoles = useMemo(() => [...roles].sort((first, second) => first.name.localeCompare(second.name)), [roles]);
  const sortedStudentOptions = useMemo(() => [...studentOptions].sort((first, second) => (
    String(first.name || first.studentId || first.id).localeCompare(String(second.name || second.studentId || second.id), undefined, { numeric: true })
  )), [studentOptions]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = term
      ? users.filter((user) =>
        [user.name, user.email, rolesById[user.roleId]?.name, user.status]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term))
      )
      : users;
    return [...matches].sort((first, second) => (
      String(first.name || first.email || first.uid).localeCompare(String(second.name || second.email || second.uid), undefined, { numeric: true })
    ));
  }, [rolesById, search, users]);

  const getLinkedStudentPayload = (form) => {
    if (form.roleId !== 'parent') {
      return {
        linkedStudentRecordIds: [],
        linkedStudentIds: [],
      };
    }

    const selected = studentOptions.filter((student) => form.linkedStudentRecordIds?.includes(student.id));
    return {
      linkedStudentRecordIds: selected.map((student) => student.id),
      linkedStudentIds: selected.map((student) => student.studentId).filter(Boolean),
    };
  };

  const stats = [
    { label: 'Users', value: users.length, icon: <UserRound size={22} /> },
    { label: 'Active Users', value: users.filter((user) => user.status !== 'Suspended').length, icon: <UserRound size={22} /> },
    { label: 'Roles', value: roles.length, icon: <ShieldCheck size={22} /> },
    { label: 'Permissions', value: selectedRole?.permissions?.length || 0, icon: <ShieldCheck size={22} /> },
  ];

  const seedDefaultRoles = async () => {
    if (!canEditRoles) {
      toast.error('You do not have permission to edit roles.');
      return;
    }
    if (!isFirebaseConfigured) {
      toast.error('Live Firebase data is not configured.');
      return;
    }
    setSavingRole(true);
    try {
      const missingRoles = defaultRoles.filter((role) => !roles.some((item) => item.id === role.id));
      await Promise.all(missingRoles.map((role) => createRole(role)));
      setRoles(mergeRoles([...roles, ...missingRoles]));
      toast.success(missingRoles.length ? 'Default roles seeded' : 'Default roles already available');
    } catch {
      toast.error('Default roles were not synced to live data.');
    } finally {
      setSavingRole(false);
    }
  };

  const saveRole = async (nextRole) => {
    if (!canEditRoles) {
      toast.error('You do not have permission to edit roles.');
      return;
    }
    if (nextRole.locked) return;
    if (!isFirebaseConfigured) {
      toast.error('Live Firebase data is not configured.');
      return;
    }
    setSavingRole(true);
    try {
      await updateRole(nextRole.id, nextRole);
      setRoles((prev) => prev.map((role) => (role.id === nextRole.id ? nextRole : role)));
      toast.success('Role permissions updated');
    } catch {
      toast.error('Role permissions were not saved to live data.');
    } finally {
      setSavingRole(false);
    }
  };

  const createUser = async (form) => {
    if (!canCreateUsers) {
      toast.error('You do not have permission to create users.');
      return;
    }

    const validationMessage = validateUserForm(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    if (!isFirebaseConfigured) {
      toast.error('Live Firebase data is not configured.');
      return;
    }

    const createdAtText = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    try {
      const authUser = await createManagedAuthUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      const profile = {
        uid: authUser.uid,
        name: form.name.trim(),
        email: authUser.email,
        roleId: form.roleId,
        status: 'Active',
        createdBy: currentUser?.uid || '',
        createdAtText,
        ...getLinkedStudentPayload(form),
      };
      await createUserProfile(authUser.uid, profile);
      setUsers((prev) => [profile, ...prev]);
      toast.success('User created');
      setShowUserModal(false);
    } catch {
      toast.error('User was not created in live data.');
    }
  };

  const updateUser = async (form) => {
    if (!editingUser) return;
    if (!canEditUsers) {
      toast.error('You do not have permission to edit users.');
      return;
    }

    const validationMessage = validateUserUpdate(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    if (!isFirebaseConfigured) {
      toast.error('Live Firebase data is not configured.');
      return;
    }

    const updates = {
      name: form.name.trim(),
      roleId: form.roleId,
      status: form.status,
      updatedAtText: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      ...getLinkedStudentPayload(form),
    };

    try {
      await updateUserProfile(editingUser.uid, updates);
      setUsers((prev) => prev.map((user) => (user.uid === editingUser.uid ? { ...user, ...updates } : user)));
      toast.success('User updated');
      setEditingUser(null);
    } catch {
      toast.error('User was not updated in live data.');
    }
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Administration / <span className="text-[#f39a5f]">User & Role Management</span></div>
          <h1 className="text-2xl font-bold text-slate-900">User & Role Management</h1>
          <p className="text-sm text-slate-500 mt-1">Create ERP users, assign roles, and manage module permissions.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Live Firebase data is not configured.</p>}
          {isFirebaseConfigured && <p className="text-xs text-slate-500 mt-2">For a fresh Firebase project, create the first admin profile before tightening deployed rules.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={seedDefaultRoles}
            disabled={savingRole || !canEditRoles}
            className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm disabled:bg-slate-300"
          >
            Sync Default Roles
          </button>
          <button
            onClick={() => setShowUserModal(true)}
            disabled={!canCreateUsers}
            className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            <Plus size={16} /> New User
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 py-5">
        {stats.map(({ label, value, icon }) => (
          <div key={label} className="bg-[#f5f5f6] rounded-lg p-4 flex items-center gap-4">
            <div className="h-12 w-12 bg-white rounded-lg flex items-center justify-center text-[#34363d] shadow-sm">
              {icon}
            </div>
            <div>
              <div className="text-xs text-slate-500">{label}</div>
              <div className="text-xl font-bold text-slate-900">{loading ? '...' : value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-5">
        <div className="xl:w-[64%] min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {sortedRoles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className={`h-10 px-4 rounded-md border text-sm flex items-center gap-2 ${
                  selectedRole?.id === role.id
                    ? 'bg-[#33373e] text-white border-[#33373e]'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                <ShieldCheck size={15} /> {role.name}
              </button>
            ))}
          </div>

          <div className="relative mb-4">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by user, email, role, status..."
              className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <UserTable users={filteredUsers} rolesById={rolesById} canEdit={canEditUsers} onEdit={setEditingUser} />
        </div>

        <RolePermissionEditor role={selectedRole} canEdit={canEditRoles} saving={savingRole} onChange={saveRole} />
      </div>

      {showUserModal && (
        <UserModal
          roles={sortedRoles}
          students={sortedStudentOptions}
          onClose={() => setShowUserModal(false)}
          onSave={createUser}
        />
      )}
      {editingUser && (
        <UserModal
          mode="edit"
          initialUser={editingUser}
          roles={sortedRoles}
          students={sortedStudentOptions}
          onClose={() => setEditingUser(null)}
          onSave={updateUser}
        />
      )}
    </div>
  );
}
