import { AlertCircle, CalendarDays, FileText, GraduationCap, Search, TrendingUp, Users, Wallet } from 'lucide-react';
import { demoStudents } from '../students/demoStudents';
import { demoStaffMembers } from '../facultyStaff/demoFacultyStaff';
import { demoFeeAssignments, demoFeeCollections } from '../fees/demoFees';
import { demoManagedDocuments } from '../documents/demoDocuments';
import { demoExamSchedules } from '../exams/demoExams';
import { formatCurrency } from '../fees/feeUtils';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';

function DashboardCard({ color = '#38bdf8', icon, label, value, helper, onClick }) {
  return (
    <button
      onClick={onClick}
      className="erp-dashboard-card min-h-28 rounded-lg border border-slate-100 bg-white p-4 text-left flex items-center gap-4 shadow-sm"
      style={{ '--card-color': color }}
    >
      <span className="h-13 w-13 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}22`, color }}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-500">{label}</span>
        <span className="block text-2xl font-extrabold text-slate-900 mt-1">{value}</span>
        <span className="block text-xs text-slate-500 mt-1">{helper}</span>
      </span>
    </button>
  );
}

export default function DashboardManagement({ academicYear = '2026-2027', currentUser, onNavigate }) {
  const currentRoleId = currentUser?.roleId || 'admin';
  const canViewStudents = canAccess(defaultRoles, currentRoleId, 'students.view');
  const canCreateStudents = canAccess(defaultRoles, currentRoleId, 'students.create');
  const canViewStaff = canAccess(defaultRoles, currentRoleId, 'staff.view');
  const canViewFees = canAccess(defaultRoles, currentRoleId, 'fees.view');
  const canCollectFees = canAccess(defaultRoles, currentRoleId, 'fees.collect');
  const canViewDocuments = canAccess(defaultRoles, currentRoleId, 'documents.view');
  const canUploadDocuments = canAccess(defaultRoles, currentRoleId, 'documents.upload');
  const canVerifyDocuments = canAccess(defaultRoles, currentRoleId, 'documents.verify');
  const canViewExams = canAccess(defaultRoles, currentRoleId, 'exams.view');
  const canViewFinancialReports = canAccess(defaultRoles, currentRoleId, 'financialReports.view');
  const activeStudents = demoStudents.filter((student) => student.status !== 'Archived');
  const facultyCount = demoStaffMembers.filter((member) => member.staffType === 'Faculty' && member.status !== 'Archived').length;
  const collectedAmount = demoFeeCollections.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const dueCount = demoFeeAssignments.filter((item) => Number(item.dueAmount || 0) > 0).length;
  const pendingDocuments = demoManagedDocuments.filter((item) => item.verificationStatus === 'Pending Review');
  const upcomingExams = demoExamSchedules.filter((item) => item.status !== 'Archived');
  const collectionMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const collectionValues = [18, 24, 16, 28, 22, 40];
  const admissionStages = [
    { label: 'Enquiries', value: 1324, color: '#2563eb' },
    { label: 'Applications', value: 842, color: '#22c55e' },
    { label: 'Shortlisted', value: 428, color: '#f59e0b' },
    { label: 'Admitted', value: 238, color: '#8b5cf6' },
  ];
  const paymentSplit = [
    { label: 'Collected', value: collectedAmount, color: '#22c55e' },
    { label: 'Pending', value: demoFeeAssignments.reduce((sum, item) => sum + Number(item.dueAmount || 0), 0), color: '#f59e0b' },
    { label: 'Adjusted', value: demoFeeAssignments.reduce((sum, item) => sum + Number(item.adjustmentAmount || 0), 0), color: '#ef4444' },
  ];
  const splitTotal = Math.max(paymentSplit.reduce((sum, item) => sum + item.value, 0), 1);
  let pieCursor = 0;
  const pieGradient = paymentSplit.map((item) => {
    const start = pieCursor;
    const end = pieCursor + (item.value / splitTotal) * 100;
    pieCursor = end;
    return `${item.color} ${start}% ${end}%`;
  }).join(', ');

  const dashboardCards = [
    canViewStudents && { color: '#2563eb', icon: <Users size={22} />, label: 'Students', value: activeStudents.length, helper: 'Active records', page: 'students' },
    canViewStaff && { color: '#22c55e', icon: <GraduationCap size={22} />, label: 'Faculty', value: facultyCount, helper: 'Teaching staff', page: 'faculty-staff' },
    canViewFees && { color: '#f59e0b', icon: <Wallet size={22} />, label: 'Collection', value: formatCurrency(collectedAmount), helper: `${dueCount} due students`, page: 'fees' },
    canViewDocuments && { color: '#8b5cf6', icon: <FileText size={22} />, label: 'Documents', value: pendingDocuments.length, helper: 'Pending review', page: 'document-management' },
    canViewExams && { color: '#ef4444', icon: <TrendingUp size={22} />, label: 'Exams', value: upcomingExams.length, helper: 'Upcoming exams', page: 'examination-results' },
  ].filter(Boolean);

  const quickActions = [
    canCreateStudents && { label: 'Add student', helper: 'Open admissions', icon: <GraduationCap size={18} />, page: 'students' },
    canCollectFees && { label: 'Collect payment', helper: 'Search dues', icon: <Wallet size={18} />, page: 'fees' },
    canUploadDocuments && { label: 'Upload document', helper: 'Repository', icon: <FileText size={18} />, page: 'document-management' },
  ].filter(Boolean);

  const pendingWork = [
    canViewDocuments && canVerifyDocuments && {
      label: `${pendingDocuments.length} documents need review`,
      helper: 'Open verification queue',
      page: 'document-management',
    },
    canViewExams && {
      label: `${upcomingExams.length} upcoming exams`,
      helper: 'View exam schedule',
      page: 'examination-results',
    },
    canViewFees && dueCount > 0 && {
      label: `${dueCount} students have pending dues`,
      helper: 'Open payment due list',
      page: 'fees',
    },
  ].filter(Boolean);

  return (
    <div className="erp-dashboard">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Today&apos;s college overview for {academicYear}.</p>
        </div>
        <div className="relative w-full xl:w-[420px]">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search students, faculty, documents, receipts..."
            className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 py-5">
        {dashboardCards.map((card) => (
          <DashboardCard key={card.label} {...card} onClick={() => onNavigate?.(card.page)} />
        ))}
      </div>

      <div className="grid xl:grid-cols-[1.5fr_.9fr] gap-5">
        {canViewFinancialReports && (
        <section className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-bold text-slate-900">Payment Trend</h2>
              <p className="text-xs text-slate-500 mt-1">Simple monthly collection view.</p>
            </div>
            <span className="rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-semibold text-slate-600">2026</span>
          </div>
          <div className="h-64 flex items-end gap-4">
            {collectionMonths.map((month, index) => (
              <div key={month} className="flex-1 h-full flex flex-col justify-end gap-2">
                <div className="rounded-t-lg min-h-6" style={{ height: `${collectionValues[index] * 2.2}%`, background: 'linear-gradient(180deg,#2563eb,#38bdf8)' }} />
                <div className="rounded-t-lg min-h-6" style={{ height: `${Math.max(collectionValues[index] - 8, 8) * 1.7}%`, background: 'linear-gradient(180deg,#f59e0b,#fb7185)' }} />
                <span className="text-[11px] text-center text-slate-500">{month}</span>
              </div>
            ))}
          </div>
        </section>
        )}

        <section className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="font-bold text-slate-900">Pending Work</h2>
            <AlertCircle size={18} className="text-[#fb8d49]" />
          </div>
          <div className="space-y-3">
            {pendingWork.map((item) => (
              <button key={item.label} onClick={() => onNavigate?.(item.page)} className="w-full rounded-lg bg-[#f5f5f6] p-4 text-left">
                <span className="block font-bold text-sm text-slate-900">{item.label}</span>
                <span className="block text-xs text-slate-500 mt-1">{item.helper}</span>
              </button>
            ))}
            {!pendingWork.length && (
              <div className="rounded-lg bg-[#f5f5f6] p-4 text-sm text-slate-500">
                No pending items available for your role.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid xl:grid-cols-[1fr_1fr] gap-5 mt-5">
        <section className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-bold text-slate-900">Admissions Pipeline</h2>
              <p className="text-xs text-slate-500 mt-1">Colorful stage view for quick scanning.</p>
            </div>
            <span className="rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-bold text-emerald-500">28.3%</span>
          </div>
          <div className="grid md:grid-cols-[1fr_.85fr] gap-5 items-center">
            <div className="space-y-1">
              {admissionStages.map((stage, index) => (
                <div
                  key={stage.label}
                  className="mx-auto h-10"
                  style={{
                    width: `${100 - index * 14}%`,
                    background: stage.color,
                    clipPath: 'polygon(0 0, 100% 0, 88% 100%, 12% 100%)',
                  }}
                />
              ))}
            </div>
            <div className="space-y-3">
              {admissionStages.map((stage) => (
                <div key={stage.label} className="flex items-center gap-3 text-sm">
                  <span className="h-3 w-3 rounded-sm" style={{ background: stage.color }} />
                  <span className="text-slate-600">{stage.label}</span>
                  <b className="ml-auto text-slate-900">{stage.value}</b>
                </div>
              ))}
            </div>
          </div>
        </section>

        {canViewFees && (
        <section className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-bold text-slate-900">Fee Collection</h2>
              <p className="text-xs text-slate-500 mt-1">Collected, pending, and adjusted split.</p>
            </div>
            <span className="rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-semibold text-slate-600">This month</span>
          </div>
          <div className="grid md:grid-cols-[180px_1fr] gap-6 items-center">
            <div className="relative h-44 w-44 mx-auto rounded-full" style={{ background: `conic-gradient(${pieGradient})` }}>
              <div className="absolute inset-8 rounded-full bg-white flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-slate-900">78%</span>
                <span className="text-xs text-slate-500">Collected</span>
              </div>
            </div>
            <div className="space-y-3">
              {paymentSplit.map((item) => (
                <div key={item.label} className="flex items-center gap-3 text-sm">
                  <span className="h-3 w-3 rounded-sm" style={{ background: item.color }} />
                  <span className="text-slate-600">{item.label}</span>
                  <b className="ml-auto text-slate-900">{formatCurrency(item.value)}</b>
                </div>
              ))}
            </div>
          </div>
        </section>
        )}
      </div>

      {!!quickActions.length && (
      <div className="grid gap-5 mt-5">
        <section className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-bold text-slate-900">Quick Actions</h2>
            <CalendarDays size={18} className="text-slate-400" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <button key={action.label} onClick={() => onNavigate?.(action.page)} className="rounded-lg bg-[#f5f5f6] p-4 text-left flex items-center gap-3">
                <span className="h-10 w-10 rounded-lg bg-white flex items-center justify-center text-[#fb8d49]">{action.icon}</span>
                <span>
                  <span className="block text-sm font-bold text-slate-900">{action.label}</span>
                  <span className="block text-xs text-slate-500 mt-1">{action.helper}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
      )}

      {canViewExams && (
      <div className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm mt-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-bold text-slate-900">Upcoming Exams</h2>
          <TrendingUp size={18} className="text-slate-400" />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {upcomingExams.map((exam) => (
            <button key={exam.id} onClick={() => onNavigate?.('examination-results')} className="rounded-lg bg-[#f5f5f6] p-4 text-left">
              <span className="block text-sm font-bold text-slate-900">{exam.examName}</span>
              <span className="block text-xs text-slate-500 mt-1">{exam.classKey} - {exam.subject}</span>
              <span className="block text-xs font-semibold text-[#fb8d49] mt-3">{exam.examDate}</span>
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
