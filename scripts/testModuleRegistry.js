import assert from 'node:assert/strict';
import { getCanonicalModulePath, getEnabledModules, getModuleById, getModuleByPath, moduleRegistry, sortModulesByDisplayOrder } from '../src/modules/moduleRegistry.js';
import { canAccess, defaultRoles } from '../src/modules/userRoles/rolePermissions.js';

const enabled = getEnabledModules();
assert.equal(enabled.every((module) => module.status !== 'disabled'), true);
assert.equal(getModuleById('dashboard').label, 'Dashboard');
assert.equal(getModuleById('students').permission, 'students.view');
assert.equal(getModuleById('fees').permission, 'fees.view');
assert.equal(getModuleById('fees').label, 'Payment');
assert.equal(getModuleById('communication').label, 'Communication');
assert.equal(getModuleById('notice-board').id, 'communication');
assert.equal(getModuleById('financial-reports').id, 'reports');
assert.equal(getModuleByPath('/modules/notice-board').id, 'communication');
assert.equal(getModuleByPath('/modules/financial-reports').id, 'reports');
assert.equal(getCanonicalModulePath('notice-board'), '/modules/communication');
assert.equal(getCanonicalModulePath('financial-reports'), '/modules/reports');
assert.equal(getCanonicalModulePath('students'), '/students');
assert.equal(getCanonicalModulePath('missing-module'), null);
assert.equal(getModuleById('parent-portal').permission, 'parentPortal.view');
assert.equal(getModuleById('missing-module'), null);

const modulesWithoutPermission = moduleRegistry.filter((module) => !module.permission);
assert.deepEqual(modulesWithoutPermission, []);

const visibleSidebarIds = (roleId) => sortModulesByDisplayOrder(enabled
  .filter((module) => canAccess(defaultRoles, roleId, module.permission))
  .filter((module) => !module.hideFromSidebar || (module.id === 'dashboard' && ['admin', 'super-admin'].includes(roleId)) || (module.id === 'parent-portal' && roleId === 'parent') || (module.id !== 'dashboard' && roleId === 'super-admin')))
  .map((module) => module.id);

const adminSidebarVisible = visibleSidebarIds('admin');
assert.deepEqual(adminSidebarVisible, [
  'attendance',
  'communication',
  'calendar',
  'dashboard',
  'document-management',
  'examination-results',
  'faculty-staff',
  'hostel-management',
  'fees',
  'reports',
  'settings',
  'students',
  'subject-notes',
  'timetable',
]);
assert.deepEqual(visibleSidebarIds('super-admin'), [
  'academics',
  'attendance',
  'communication',
  'calendar',
  'dashboard',
  'document-management',
  'examination-results',
  'faculty-staff',
  'hostel-management',
  'parent-portal',
  'fees',
  'reports',
  'settings',
  'students',
  'subject-notes',
  'timetable',
  'user-roles',
]);

const footerVisible = enabled.filter((module) => module.footer).map((module) => module.id);
assert.deepEqual(footerVisible, ['settings']);

const superAdminVisible = enabled
  .filter((module) => canAccess(defaultRoles, 'super-admin', module.permission))
  .map((module) => module.id);
assert.deepEqual(superAdminVisible, [
  'dashboard',
  'students',
  'faculty-staff',
  'attendance',
  'timetable',
  'subject-notes',
  'examination-results',
  'communication',
  'calendar',
  'hostel-management',
  'document-management',
  'fees',
  'reports',
  'academics',
  'user-roles',
  'parent-portal',
  'settings',
]);

const parentVisible = enabled.filter((module) => canAccess(defaultRoles, 'parent', module.permission)).map((module) => module.id);
assert.deepEqual(parentVisible, ['timetable', 'communication', 'calendar', 'document-management', 'parent-portal']);
assert.deepEqual(visibleSidebarIds('parent'), ['communication', 'calendar', 'document-management', 'parent-portal', 'timetable']);

const facultyVisible = enabled.filter((module) => canAccess(defaultRoles, 'faculty', module.permission)).map((module) => module.id);
assert.equal(facultyVisible.includes('students'), true);
assert.equal(facultyVisible.includes('calendar'), true);
assert.equal(facultyVisible.includes('academics'), false);
assert.equal(facultyVisible.includes('attendance'), true);
assert.equal(facultyVisible.includes('subject-notes'), true);
assert.equal(facultyVisible.includes('communication'), true);
assert.equal(facultyVisible.includes('document-management'), true);
assert.equal(facultyVisible.includes('fees'), false);
assert.equal(facultyVisible.includes('reports'), true);
assert.equal(facultyVisible.includes('parent-portal'), false);

const adminVisible = enabled.filter((module) => canAccess(defaultRoles, 'admin', module.permission)).map((module) => module.id);
assert.deepEqual(adminVisible, [
  'dashboard',
  'students',
  'faculty-staff',
  'attendance',
  'timetable',
  'subject-notes',
  'examination-results',
  'communication',
  'calendar',
  'hostel-management',
  'document-management',
  'fees',
  'reports',
  'academics',
  'settings',
]);

const remainingDemo = enabled.filter((module) => module.status === 'demo').map((module) => module.id);
assert.deepEqual(remainingDemo, []);

console.log('Module registry tests passed.');
