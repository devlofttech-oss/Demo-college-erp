import { demoStudents } from '../students/demoStudents';
import { demoStaffMembers } from '../facultyStaff/demoFacultyStaff';

export const demoExamStudents = demoStudents;
export const demoExamStaff = demoStaffMembers;

export const demoExamSchedules = [
  {
    id: 'demo-exam-1',
    examName: 'Mid Term Examination',
    classKey: 'Class XII - A',
    subject: 'Physics',
    examType: 'Written',
    examDate: '2026-06-25',
    startTime: '09:30',
    durationMinutes: 180,
    roomNo: '101',
    maxMarks: 100,
    facultyId: 'demo-staff-1001',
    facultyName: 'Dr. Kavita Menon',
    status: 'Scheduled',
    createdAtText: '18 Jun 2026',
  },
  {
    id: 'demo-exam-2',
    examName: 'Internal Assessment 1',
    classKey: 'Class XI - B',
    subject: 'Accountancy',
    examType: 'Internal',
    examDate: '2026-06-27',
    startTime: '10:00',
    durationMinutes: 120,
    roomNo: '102',
    maxMarks: 50,
    facultyId: 'demo-staff-1002',
    facultyName: 'Prof. Ramesh Iyer',
    status: 'Scheduled',
    createdAtText: '18 Jun 2026',
  },
];

export const demoAssessments = [
  {
    id: 'demo-assessment-1',
    title: 'Physics Lab Record',
    classKey: 'Class XII - A',
    subject: 'Physics',
    maxMarks: 20,
    status: 'Active',
    createdAtText: '18 Jun 2026',
  },
];

export const demoMarksEntries = [
  {
    id: 'demo-marks-1',
    examScheduleId: 'demo-exam-1',
    studentRecordId: 'demo-4449',
    studentId: 'STU-4449',
    studentName: 'Vivek Sharma',
    classKey: 'Class XII - A',
    subject: 'Physics',
    marksObtained: 86,
    maxMarks: 100,
    percentage: 86,
    grade: 'A',
    status: 'Entered',
    enteredAtText: '18 Jun 2026',
  },
];

export const demoResults = [
  {
    id: 'demo-result-1',
    studentRecordId: 'demo-4449',
    studentId: 'STU-4449',
    studentName: 'Vivek Sharma',
    classKey: 'Class XII - A',
    examName: 'Mid Term Examination',
    totalObtained: 86,
    totalMax: 100,
    percentage: 86,
    grade: 'A',
    status: 'Pass',
    generatedAtText: '18 Jun 2026',
  },
];

export const demoReportCards = [
  {
    id: 'demo-report-card-1',
    studentRecordId: 'demo-4449',
    studentId: 'STU-4449',
    examName: 'Mid Term Examination',
    status: 'Generated',
    generatedAtText: '18 Jun 2026',
  },
];
