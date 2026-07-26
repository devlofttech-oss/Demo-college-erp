import { ShieldCheck } from 'lucide-react';
import { permissionGroups, togglePermission } from '../rolePermissions';

const sortByLabel = (first, second) => first.label.localeCompare(second.label);
const sortPermissionByLabel = (first, second) => first[1].localeCompare(second[1]);

export default function RolePermissionEditor({ role, canEdit, saving, onChange }) {
  if (!role) return null;
  const sortedPermissionGroups = [...permissionGroups].sort(sortByLabel);

  return (
    <aside className="xl:w-[36%] erp-sticky-inspector">
      <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
        <div className="flex items-start gap-3 mb-5">
          <div className="h-11 w-11 bg-[#33373e] text-white rounded-lg flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{role.name}</h3>
            <p className="text-xs text-slate-500 mt-1">{role.description}</p>
            {saving && <p className="text-xs text-orange-600 mt-2">Saving role permissions...</p>}
            {!canEdit && <p className="text-xs text-slate-500 mt-2">You can view permissions but cannot edit this role.</p>}
          </div>
        </div>

        <div className="space-y-5">
          {sortedPermissionGroups.map((group) => (
            <div key={group.id}>
              <div className="text-xs font-bold uppercase text-slate-500 mb-2">{group.label}</div>
              <div className="space-y-2">
                {[...group.permissions].sort(sortPermissionByLabel).map(([permission, label]) => (
                  <label key={permission} className="flex items-center justify-between gap-3 rounded-lg bg-[#f5f5f6] px-3 py-2 text-sm">
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      disabled={role.locked || !canEdit}
                      checked={role.permissions?.includes(permission)}
                      onChange={() => onChange({ ...role, permissions: togglePermission(role, permission) })}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
