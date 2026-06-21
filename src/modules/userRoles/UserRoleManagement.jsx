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
import { demoRoles, demoUsers } from './demoUserRoles';
import { canAccess, defaultRoles, validateUserForm, validateUserUpdate } from './rolePermissions';
import RolePermissionEditor from './components/RolePermissionEditor';
import UserModal from './components/UserModal';
import UserTable from './components/UserTable';

function mergeRoles(firestoreRoles) {
  const byId = new Map(defaultRoles.map((role) => [role.id, role]));
  firestoreRoles.forEach((role) => byId.set(role.id, { ...byId.get(role.id), ...role }));
  return [...byId.values()];
}

export default function UserRoleManagement({ currentUser }) {
  const [users, setUsers] = useState(demoUsers);
  const [roles, setRoles] = useState(demoRoles);
  const [selectedRoleId, setSelectedRoleId] = useState('admin');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [studentOptions, setStudentOptions] = useState([]);

  useEffect(() => {
    const loadUsersAndRoles = async () => {
      try {
        const data = await getUserRoleData();
        setRoles(mergeRoles(data.roles));
        if (data.users.length) setUsers(data.users);
        const studentData = await getStudentInformationData().catch(() => ({ students: [] }));
        setStudentOptions(studentData.students.filter((student) => student.status !== 'Archived'));
      } catch (error) {
        console.warn('Using demo users and roles because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore users/roles. Showing demo/local records.');
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

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [user.name, user.email, rolesById[user.roleId]?.name, user.status]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
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
    setSavingRole(true);
    try {
      const missingRoles = defaultRoles.filter((role) => !roles.some((item) => item.id === role.id));
      await Promise.all(missingRoles.map((role) => createRole(role)));
      setRoles(mergeRoles([...roles, ...missingRoles]));
      toast.success(missingRoles.length ? 'Default roles seeded' : 'Default roles already available');
    } catch {
      setRoles(mergeRoles(roles));
      toast.success('Default roles available locally. Check Firebase setup to persist them.');
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
    setRoles((prev) => prev.map((role) => (role.id === nextRole.id ? nextRole : role)));
    setSavingRole(true);
    try {
      if (nextRole.id.startsWith('local-') || nextRole.id.startsWith('demo-')) {
        const id = await createRole(nextRole);
        if (id) {
          setRoles((prev) => prev.map((role) => (role.id === nextRole.id ? { ...nextRole, id } : role)));
          setSelectedRoleId(id);
        }
      } else {
        await updateRole(nextRole.id, nextRole);
      }
      toast.success('Role permissions updated');
    } catch {
      toast.success('Role permissions updated locally. Check Firebase setup to persist them.');
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
    } catch {
      const localUser = {
        uid: `local-user-${Date.now()}`,
        name: form.name.trim(),
        email: form.email.trim(),
        roleId: form.roleId,
        status: 'Active',
        createdBy: currentUser?.uid || '',
        createdAtText,
        ...getLinkedStudentPayload(form),
      };
      setUsers((prev) => [localUser, ...prev]);
      toast.success(isFirebaseConfigured ? 'User saved locally. Check Firebase Auth permissions.' : 'User saved locally. Add Firebase keys to persist.');
    } finally {
      setShowUserModal(false);
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
    } catch {
      setUsers((prev) => prev.map((user) => (user.uid === editingUser.uid ? { ...user, ...updates } : user)));
      toast.success('User updated locally. Check Firebase setup to persist it.');
    } finally {
      setEditingUser(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Administration / <span className="text-[#f39a5f]">User & Role Management</span></div>
          <h1 className="text-2xl font-bold text-slate-900">User & Role Management</h1>
          <p className="text-sm text-slate-500 mt-1">Create ERP users, assign roles, and manage module permissions.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist users and roles.</p>}
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
            {roles.map((role) => (
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
          roles={roles}
          students={studentOptions}
          onClose={() => setShowUserModal(false)}
          onSave={createUser}
        />
      )}
      {editingUser && (
        <UserModal
          mode="edit"
          initialUser={editingUser}
          roles={roles}
          students={studentOptions}
          onClose={() => setEditingUser(null)}
          onSave={updateUser}
        />
      )}
    </div>
  );
}
