import assert from 'node:assert/strict';
import { getEnabledModules, getModuleById, moduleRegistry } from '../src/modules/moduleRegistry.js';
import { canAccess, defaultRoles } from '../src/modules/userRoles/rolePermissions.js';

const enabled = getEnabledModules();
assert.equal(enabled.every((module) => module.status !== 'disabled'), true);
assert.equal(getModuleById('fees').permission, 'fees.view');
assert.equal(getModuleById('parent-portal').permission, 'parentPortal.view');
assert.equal(getModuleById('missing-module'), null);

const modulesWithoutPermission = moduleRegistry.filter((module) => !module.permission);
assert.deepEqual(modulesWithoutPermission, []);

const parentVisible = enabled.filter((module) => canAccess(defaultRoles, 'parent', module.permission)).map((module) => module.id);
assert.deepEqual(parentVisible, ['calendar', 'timetable', 'parent-portal']);

const facultyVisible = enabled.filter((module) => canAccess(defaultRoles, 'faculty', module.permission)).map((module) => module.id);
assert.equal(facultyVisible.includes('calendar'), true);
assert.equal(facultyVisible.includes('academics'), false);
assert.equal(facultyVisible.includes('attendance'), true);
assert.equal(facultyVisible.includes('notice-board'), true);
assert.equal(facultyVisible.includes('document-management'), false);
assert.equal(facultyVisible.includes('fees'), false);
assert.equal(facultyVisible.includes('financial-reports'), false);

const remainingDemo = enabled.filter((module) => module.status === 'demo').map((module) => module.id);
assert.deepEqual(remainingDemo, []);

console.log('Module registry tests passed.');
