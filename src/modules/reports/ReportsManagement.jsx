import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, BookOpen, ClipboardList, Download, FileText, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import AttendanceReports from '../attendance/components/AttendanceReports';
import FinancialReports from '../financialReports/FinancialReports';
import StatusBadge from '../students/components/StatusBadge';
import { canAccess, canAccessFinancialReports, defaultRoles } from '../userRoles/rolePermissions';

function csvValue(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows = []) {
  const csv = rows.map((row) => row.map(csvValue).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-lg bg-[#f5f5f6] p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function EmptyReport({ message }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">
      {message}
    </div>
  );
}

function StudentReportsPanel({ academicYear, admissions = [], documents = [], promotions = [], students = [] }) {
  const activeStudents = students.filter((student) => student.status !== 'Archived');
  const archivedStudents = students.filter((student) => student.status === 'Archived');
  const pendingStudents = students.filter((student) => ['Pending Approval', 'Admission Review'].includes(student.status));
  const approvedStudents = students.filter((student) => ['Active', 'Approved', 'Admitted'].includes(student.status));
  const pendingDocuments = documents.filter((item) => item.verificationStatus === 'Pending Review');
  const classBreakdown = Object.entries(students.reduce((summary, student) => {
    const classKey = `${student.className || 'Unassigned'} - ${student.section || '-'}`;
    summary[classKey] = (summary[classKey] || 0) + 1;
    return summary;
  }, {}));

  const downloadReport = () => {
    downloadCsv(`student-report-${academicYear}.csv`, [
      ['Student Name', 'Student ID', 'Admission No', 'Class', 'Program', 'Guardian', 'ID Holder', 'Status', 'Created On'],
      ...students.map((student) => [
        student.name,
        student.studentId,
        student.admissionNo,
        `${student.className || ''} ${student.section || ''}`.trim(),
        student.program,
        student.guardianName,
        student.idHolder,
        student.status,
        student.createdAtText,
      ]),
    ]);
    toast.success('Student report downloaded');
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Student Reports</h2>
          <p className="text-sm text-slate-500 mt-1">Admissions, approval queue, documents, and student status for {academicYear}.</p>
        </div>
        <button onClick={downloadReport} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm flex items-center justify-center gap-2">
          <Download size={16} /> Download CSV
        </button>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
        <SummaryCard label="Students" value={students.length} />
        <SummaryCard label="Active" value={activeStudents.length} />
        <SummaryCard label="Pending Approval" value={pendingStudents.length} />
        <SummaryCard label="Approved" value={approvedStudents.length} />
        <SummaryCard label="Archived" value={archivedStudents.length} />
      </div>

      <div className="grid xl:grid-cols-[.75fr_1.25fr] gap-5">
        <section className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Report Categories</h3>
          <div className="space-y-2 text-sm">
            {[
              ['Admissions', admissions.length],
              ['Documents', documents.length],
              ['Pending Documents', pendingDocuments.length],
              ['Promotions', promotions.length],
              ['Classes', classBreakdown.length],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-[#f5f5f6] px-3 py-2">
                <span>{label}</span>
                <b>{value}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-x-auto rounded-lg border border-slate-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#e7e7e9] text-left text-slate-900">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Admission / ID</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold">{student.name}<div className="text-xs font-normal text-slate-500">{student.guardianName}</div></td>
                  <td className="px-4 py-3">{student.admissionNo}<div className="text-xs text-slate-500">{student.studentId}</div></td>
                  <td className="px-4 py-3">{student.className} - {student.section}<div className="text-xs text-slate-500">{student.program}</div></td>
                  <td className="px-4 py-3"><StatusBadge value={student.status} /></td>
                </tr>
              ))}
              {!students.length && (
                <tr><td colSpan="4" className="px-4 py-10 text-center text-slate-500">No student records found for {academicYear}.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function AttendanceReportsPanel({ records = [] }) {
  const [scope, setScope] = useState('daily');

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Attendance Reports</h2>
          <p className="text-sm text-slate-500 mt-1">Daily, monthly, yearly, and subject-wise attendance summaries.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ['daily', 'Daily'],
            ['monthly', 'Monthly'],
            ['yearly', 'Yearly'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setScope(value)}
              className={`h-10 px-4 rounded-md border text-sm font-semibold ${scope === value ? 'bg-[#33373e] text-white border-[#33373e]' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {records.length ? <AttendanceReports records={records} scope={scope} /> : <EmptyReport message="No attendance report records are available for this selection." />}
    </div>
  );
}

function DocumentReportsPanel({ documents = [] }) {
  const byStatus = Object.entries(documents.reduce((summary, document) => {
    const status = document.verificationStatus || 'Pending Review';
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {}));
  const byCategory = Object.entries(documents.reduce((summary, document) => {
    const category = document.category || document.documentType || 'Uncategorized';
    summary[category] = (summary[category] || 0) + 1;
    return summary;
  }, {}));

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">Document Reports</h2>
      <p className="text-sm text-slate-500 mt-1 mb-5">Verification and category reports for student documents.</p>
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <SummaryCard label="Documents" value={documents.length} />
        <SummaryCard label="Verified" value={documents.filter((item) => ['Verified', 'Source PDF'].includes(item.verificationStatus)).length} />
        <SummaryCard label="Pending Review" value={documents.filter((item) => item.verificationStatus === 'Pending Review').length} />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        {[['By Status', byStatus], ['By Category', byCategory]].map(([title, rows]) => (
          <section key={title} className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">{title}</h3>
            <div className="space-y-2 text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-[#f5f5f6] px-3 py-2">
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
              {!rows.length && <div className="text-slate-500">No document records available.</div>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ExamReportsPanel({ marksEntries = [], studentResults = [] }) {
  const rows = [
    ...marksEntries.map((item) => ({ ...item, reportType: 'Marks Entry', label: item.examName || item.subject || 'Marks Entry' })),
    ...studentResults.map((item) => ({ ...item, reportType: 'Student Result', label: item.examName || item.subject || 'Student Result' })),
  ];
  const subjectRows = Object.entries(rows.reduce((summary, row) => {
    const subject = row.subject || row.subjectName || row.examName || 'General';
    summary[subject] = (summary[subject] || 0) + 1;
    return summary;
  }, {}));

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">Exam Reports</h2>
      <p className="text-sm text-slate-500 mt-1 mb-5">Marks entries, generated results, and report-card readiness.</p>
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <SummaryCard label="Marks Entries" value={marksEntries.length} />
        <SummaryCard label="Student Results" value={studentResults.length} />
        <SummaryCard label="Subjects / Exams" value={subjectRows.length} />
      </div>
      <section className="overflow-x-auto rounded-lg border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#e7e7e9] text-left text-slate-900">
            <tr>
              <th className="px-4 py-3">Report</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Subject / Exam</th>
              <th className="px-4 py-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id || `${row.reportType}-${index}`} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold">{row.reportType}</td>
                <td className="px-4 py-3">{row.studentName || row.name || row.studentId || '-'}</td>
                <td className="px-4 py-3">{row.label}</td>
                <td className="px-4 py-3">{row.percentage ? `${row.percentage}%` : row.grade || row.status || '-'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan="4" className="px-4 py-10 text-center text-slate-500">No exam report records available.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default function ReportsManagement({
  academicYear = '',
  admissions = [],
  attendanceRecords = [],
  currentUser,
  documents = [],
  initialCategoryId = '',
  marksEntries = [],
  promotions = [],
  scopedStudents = [],
  selectedCourse = null,
  selectedCourseCode = 'all',
  studentResults = [],
}) {
  const navigate = useNavigate();
  const currentRoleId = currentUser?.roleId || 'admin';
  const categories = useMemo(() => [
    {
      id: 'attendance',
      label: 'Attendance',
      description: 'Daily, monthly, yearly',
      icon: <ClipboardList size={18} />,
      enabled: canAccess(defaultRoles, currentRoleId, 'attendance.reports'),
      content: <AttendanceReportsPanel records={attendanceRecords} />,
    },
    {
      id: 'documents',
      label: 'Documents',
      description: 'Verification reports',
      icon: <FileText size={18} />,
      enabled: canAccess(defaultRoles, currentRoleId, 'documents.view') || canAccess(defaultRoles, currentRoleId, 'students.documents'),
      content: <DocumentReportsPanel documents={documents} />,
    },
    {
      id: 'exams',
      label: 'Exams',
      description: 'Marks and results',
      icon: <BookOpen size={18} />,
      enabled: canAccess(defaultRoles, currentRoleId, 'exams.view') || canAccess(defaultRoles, currentRoleId, 'exams.results'),
      content: <ExamReportsPanel marksEntries={marksEntries} studentResults={studentResults} />,
    },
    {
      id: 'financial',
      label: 'Financial',
      description: 'Collections and dues',
      icon: <BarChart3 size={18} />,
      enabled: canAccessFinancialReports(defaultRoles, currentRoleId),
      content: (
        <FinancialReports
          academicYear={academicYear}
          currentUser={currentUser}
          scopedStudents={scopedStudents}
          selectedCourse={selectedCourse}
          selectedCourseCode={selectedCourseCode}
        />
      ),
    },
    {
      id: 'students',
      label: 'Student',
      description: 'Admissions and approval queue',
      icon: <GraduationCap size={18} />,
      enabled: canAccess(defaultRoles, currentRoleId, 'students.view'),
      content: <StudentReportsPanel academicYear={academicYear} admissions={admissions} documents={documents} promotions={promotions} students={scopedStudents} />,
    },
  ], [academicYear, admissions, attendanceRecords, currentRoleId, currentUser, documents, marksEntries, promotions, scopedStudents, selectedCourse, selectedCourseCode, studentResults]);
  const visibleCategories = categories.filter((category) => category.enabled);
  const activeCategory = visibleCategories.find((category) => category.id === initialCategoryId) || visibleCategories[0];
  const openCategory = (categoryId) => {
    if (categoryId === activeCategory?.id) return;
    navigate('/modules/reports', { state: { reportCategory: categoryId } });
  };

  if (!visibleCategories.length) {
    return (
      <div className="rounded-lg bg-[#f5f5f6] p-6 text-sm text-slate-600">
        You do not have permission to view reports.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">ERP / <span className="text-[#f39a5f]">Reports</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Category-wise reports for the modules available to your role.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3 py-5">
        {visibleCategories.map((category) => {
          const active = activeCategory?.id === category.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => openCategory(category.id)}
              aria-pressed={active}
              className={`erp-report-category-card min-h-28 rounded-lg border p-4 text-left transition-colors ${
                active
                  ? 'is-active border-emerald-300 bg-emerald-50'
                  : 'border-slate-100 bg-white hover:border-emerald-200'
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="erp-report-category-icon h-10 w-10 rounded-lg bg-[#f5f5f6] text-[#34363d] flex items-center justify-center">{category.icon}</span>
                <span className="erp-report-category-pill rounded-full bg-[#f5f5f6] px-3 py-1 text-[11px] font-bold text-slate-600">{active ? 'Open' : 'View'}</span>
              </span>
              <span className="mt-4 block text-sm font-bold text-slate-900">{category.label}</span>
              <span className="mt-1 block text-xs text-slate-500">{category.description}</span>
            </button>
          );
        })}
      </div>

      <section className="min-w-0 pt-5">
        {activeCategory?.content}
      </section>
    </div>
  );
}
