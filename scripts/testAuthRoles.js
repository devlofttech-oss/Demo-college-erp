import assert from 'node:assert/strict';
import {
  clearStoredSuperAdminAccessMode,
  getStoredSuperAdminAccessMode,
  normalizeSuperAdminAccessMode,
  setStoredSuperAdminAccessMode,
  SUPER_ADMIN_ACCESS_MODE_KEY,
} from '../src/firebase/accessMode.js';
import { getFallbackRoleId } from '../src/firebase/demoRoles.js';

function createMemoryStorage() {
  const state = new Map();
  return {
    getItem: (key) => state.get(key) || null,
    removeItem: (key) => state.delete(key),
    setItem: (key, value) => state.set(key, String(value)),
  };
}

assert.equal(getFallbackRoleId('superadmin@college.edu'), 'super-admin');
assert.equal(getFallbackRoleId('admin@college.edu'), 'admin');
assert.equal(getFallbackRoleId('faculty@college.edu'), 'faculty');
assert.equal(getFallbackRoleId('parent.vivek@example.com'), 'parent');
assert.equal(getFallbackRoleId('unknown@example.com'), 'parent');

assert.equal(normalizeSuperAdminAccessMode('faculty'), 'faculty');
assert.equal(normalizeSuperAdminAccessMode('unknown'), 'super-admin');
const storage = createMemoryStorage();
assert.equal(getStoredSuperAdminAccessMode(storage), 'super-admin');
setStoredSuperAdminAccessMode('admin', storage);
assert.equal(storage.getItem(SUPER_ADMIN_ACCESS_MODE_KEY), 'admin');
assert.equal(getStoredSuperAdminAccessMode(storage), 'admin');
setStoredSuperAdminAccessMode('bad-mode', storage);
assert.equal(getStoredSuperAdminAccessMode(storage), 'super-admin');
clearStoredSuperAdminAccessMode(storage);
assert.equal(storage.getItem(SUPER_ADMIN_ACCESS_MODE_KEY), null);

console.log('Auth role fallback tests passed.');
