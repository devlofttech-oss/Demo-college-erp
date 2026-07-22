export const SUPER_ADMIN_ACCESS_MODE_KEY = 'superAdminAccessMode';

export const superAdminAccessModes = ['parent', 'faculty', 'admin', 'super-admin'];

export function normalizeSuperAdminAccessMode(mode = '') {
  return superAdminAccessModes.includes(mode) ? mode : 'super-admin';
}

export function getStoredSuperAdminAccessMode(storage = sessionStorage) {
  return normalizeSuperAdminAccessMode(storage.getItem(SUPER_ADMIN_ACCESS_MODE_KEY) || '');
}

export function setStoredSuperAdminAccessMode(mode = '', storage = sessionStorage) {
  storage.setItem(SUPER_ADMIN_ACCESS_MODE_KEY, normalizeSuperAdminAccessMode(mode));
}

export function clearStoredSuperAdminAccessMode(storage = sessionStorage) {
  storage.removeItem(SUPER_ADMIN_ACCESS_MODE_KEY);
}
