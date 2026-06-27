import assert from 'node:assert/strict';
import { getEnabledModules, getModuleById, moduleRegistry } from '../src/modules/moduleRegistry.js';
import { canAccess, defaultRoles } from '../src/modules/userRoles/rolePermissions.js';

const enabled = getEnabledModules();
assert.equal(enabled.every((module) => module.status !== 'disabled'), true);
assert.equal(getModuleById('dashboard').label, 'Dashboard');
assert.equal(getModuleById('students').permission, 'students.view');
assert.equal(getModuleById('fees').permission, 'fees.view');
assert.equal(getModuleById('fees').label, 'Payment');
assert.equal(getModuleById('parent-portal').permission, 'parentPortal.view');
assert.equal(getModuleById('missing-module'), null);

const modulesWithoutPermission = moduleRegistry.filter((module) => !module.permission);
assert.deepEqual(modulesWithoutPermission, []);

const adminSidebarVisible = enabled
  .filter((module) => canAccess(defaultRoles, 'admin', module.permission))
  .filter((module) => !module.footer)
  .filter((module) => !module.hideFromSidebar || module.id === 'parent-portal')
  .map((module) => module.id);
assert.deepEqual(adminSidebarVisible, [
  'dashboard',
  'students',
  'faculty-staff',
  'attendance',
  'timetable',
  'examination-results',
  'document-management',
  'fees',
  'financial-reports',
  'parent-portal',
]);

const footerVisible = enabled.filter((module) => module.footer).map((module) => module.id);
assert.deepEqual(footerVisible, ['settings']);

const superAdminVisible = enabled
  .filter((module) => canAccess(defaultRoles, 'super-admin', module.permission))
  .map((module) => module.id);
assert.deepEqual(superAdminVisible, [
  'dashboard',
  'students',
  'calendar',
  'academics',
  'faculty-staff',
  'attendance',
  'timetable',
  'examination-results',
  'user-roles',
  'notice-board',
  'document-management',
  'fees',
  'financial-reports',
  'parent-portal',
  'settings',
]);

const parentVisible = enabled.filter((module) => canAccess(defaultRoles, 'parent', module.permission)).map((module) => module.id);
assert.deepEqual(parentVisible, ['calendar', 'timetable', 'notice-board', 'document-management', 'parent-portal']);

const facultyVisible = enabled.filter((module) => canAccess(defaultRoles, 'faculty', module.permission)).map((module) => module.id);
assert.equal(facultyVisible.includes('calendar'), true);
assert.equal(facultyVisible.includes('academics'), false);
assert.equal(facultyVisible.includes('attendance'), true);
assert.equal(facultyVisible.includes('notice-board'), true);
assert.equal(facultyVisible.includes('document-management'), false);
assert.equal(facultyVisible.includes('fees'), false);
assert.equal(facultyVisible.includes('financial-reports'), false);
assert.equal(facultyVisible.includes('parent-portal'), false);

const adminVisible = enabled.filter((module) => canAccess(defaultRoles, 'admin', module.permission)).map((module) => module.id);
assert.deepEqual(adminVisible, [
  'dashboard',
  'students',
  'faculty-staff',
  'attendance',
  'timetable',
  'examination-results',
  'document-management',
  'fees',
  'financial-reports',
  'parent-portal',
  'settings',
]);

const remainingDemo = enabled.filter((module) => module.status === 'demo').map((module) => module.id);
assert.deepEqual(remainingDemo, []);

console.log('Module registry tests passed.');
