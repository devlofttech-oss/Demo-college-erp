import { demoStudents } from '../students/demoStudents';
import { demoStaffMembers } from '../facultyStaff/demoFacultyStaff';

export const demoAttendanceStudents = demoStudents;
export const demoAttendanceStaff = demoStaffMembers;

export const demoStudentAttendance = [
  {
    id: 'demo-student-att-1',
    entityType: 'Student',
    entityRecordId: 'demo-4449',
    entityId: 'STU-4449',
    entityName: 'Vivek Sharma',
    className: 'Class XII',
    section: 'A',
    courseCode: 'SCI-XII',
    courseName: 'CBSE Science',
    subjectCode: 'PHY-12',
    subjectName: 'Physics',
    dateText: '18 Jun 2026',
    status: 'Present',
    markedAtText: '18 Jun 2026',
    parentNotified: false,
  },
  {
    id: 'demo-student-att-2',
    entityType: 'Student',
    entityRecordId: 'demo-4450',
    entityId: 'STU-4450',
    entityName: 'Vaibhavi Aggarwal',
    className: 'Class XI',
    section: 'B',
    courseCode: 'COM-XI',
    courseName: 'PU Commerce',
    subjectCode: 'ACC-11',
    subjectName: 'Accountancy',
    dateText: '18 Jun 2026',
    status: 'Absent',
    markedAtText: '18 Jun 2026',
    parentNotified: true,
  },
];

export const demoStaffAttendance = [
  {
    id: 'demo-staff-att-1',
    entityType: 'Staff',
    entityRecordId: 'demo-staff-1001',
    entityId: 'EMP-1001',
    entityName: 'Dr. Kavita Menon',
    department: 'Science',
    dateText: '18 Jun 2026',
    status: 'Present',
    markedAtText: '18 Jun 2026',
  },
];

export const demoAttendanceNotifications = [
  {
    id: 'demo-att-note-1',
    studentRecordId: 'demo-4450',
    studentId: 'STU-4450',
    studentName: 'Vaibhavi Aggarwal',
    channel: 'Parent Portal',
    reason: 'Absent on 18 Jun 2026',
    status: 'Queued',
    createdAtText: '18 Jun 2026',
  },
];
