export function formatDisplayDate(date = new Date()) {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function relationMatchesStaff(record, staffMember) {
  if (!record || !staffMember) return false;
  return record.staffRecordId === staffMember.id || record.employeeId === staffMember.employeeId;
}

export function validateStaffForm(form) {
  const requiredFields = [
    ['name', 'Name'],
    ['employeeId', 'Employee ID'],
    ['staffType', 'Staff type'],
    ['department', 'Department'],
    ['designation', 'Designation'],
    ['phone', 'Phone'],
  ];

  const missing = requiredFields.find(([key]) => !String(form[key] || '').trim());
  if (missing) return `${missing[1]} is required.`;
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Enter a valid email address.';
  if (!/^[0-9+\-\s()]{7,20}$/.test(form.phone)) return 'Enter a valid phone number.';
  return '';
}

export function validateLeaveForm(form) {
  if (!form.leaveType) return 'Leave type is required.';
  if (!form.fromDate) return 'From date is required.';
  if (!form.toDate) return 'To date is required.';
  if (!form.reason?.trim()) return 'Leave reason is required.';
  return '';
}

export function buildAttendanceKey(staffMember, dateText) {
  return `${staffMember.employeeId}-${dateText}`;
}
