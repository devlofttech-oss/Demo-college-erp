import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, FileText, GraduationCap, TrendingUp, Users, Wallet } from 'lucide-react';
import { demoStudents } from '../students/demoStudents';
import { demoStaffMembers } from '../facultyStaff/demoFacultyStaff';
import { demoFeeAdjustments, demoFeeAssignments, demoFeeCollections } from '../fees/demoFees';
import { demoManagedDocuments } from '../documents/demoDocuments';
import { demoExamSchedules } from '../exams/demoExams';
import { getDashboardData } from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { formatCurrency, summarizeFees } from '../fees/feeUtils';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import { filterByCourse, filterStudentScopedRecords, filterStudentsByCourse } from '../shared/courseFilters';
import { buildAdmissionStages } from './dashboardUtils';

const fallbackDashboardData = {
  students: demoStudents,
  studentAdmissions: [],
  staff: demoStaffMembers,
  feeAssignments: demoFeeAssignments,
  feeCollections: demoFeeCollections,
  feeAdjustments: demoFeeAdjustments,
  managedDocuments: demoManagedDocuments,
  examSchedules: demoExamSchedules,
};

const emptyDashboardData = {
  students: [],
  studentAdmissions: [],
  staff: [],
  feeAssignments: [],
  feeCollections: [],
  feeAdjustments: [],
  managedDocuments: [],
  examSchedules: [],
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDashboardDate(value) {
  if (!value) return null;
  const parsed = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const textDate = new Date(value);
  return Number.isNaN(textDate.getTime()) ? null : textDate;
}

function buildCollectionTrend(collections = []) {
  const datedCollections = collections
    .map((item) => ({ ...item, date: parseDashboardDate(item.paymentDate || item.createdAtText) }))
    .filter((item) => item.date);
  const referenceDate = datedCollections.reduce((latest, item) => (
    !latest || item.date > latest ? item.date : latest
  ), null) || new Date();
  const months = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - offset, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: MONTH_LABELS[date.getMonth()],
      value: 0,
    });
  }

  datedCollections.forEach((item) => {
    const key = `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, '0')}`;
    const month = months.find((entry) => entry.key === key);
    if (month) month.value += Number(item.amount || 0);
  });

  return months;
}

function formatChartCurrency(value) {
  return `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
}

function DashboardCard({ color = '#38bdf8', icon, label, value, helper, onClick }) {
  return (
    <button
      onClick={onClick}
      className="erp-dashboard-card min-h-28 min-w-0 rounded-lg border border-slate-100 bg-white p-4 text-left flex items-center gap-4 shadow-sm"
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

export default function DashboardManagement({ academicYear = '2026-2027', currentUser, onNavigate, scopedStudents = [], selectedCourse = null, selectedCourseCode = 'all' }) {
  const [dashboardData, setDashboardData] = useState(isFirebaseConfigured ? null : fallbackDashboardData);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      if (!isFirebaseConfigured) {
        setDashboardData(fallbackDashboardData);
        setLoading(false);
        return;
      }

      try {
        const data = await getDashboardData(academicYear);
        if (!mounted) return;
        setDashboardData(data);
        setLoadError('');
      } catch (error) {
        console.warn('Unable to load live dashboard data.', error);
        if (!mounted) return;
        setDashboardData(emptyDashboardData);
        setLoadError('Unable to load live dashboard data.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, [academicYear]);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canViewStudents = canAccess(defaultRoles, currentRoleId, 'students.view');
  const canViewStaff = canAccess(defaultRoles, currentRoleId, 'staff.view');
  const canViewFees = canAccess(defaultRoles, currentRoleId, 'fees.view');
  const canViewDocuments = canAccess(defaultRoles, currentRoleId, 'documents.view');
  const canVerifyDocuments = canAccess(defaultRoles, currentRoleId, 'documents.verify');
  const canViewExams = canAccess(defaultRoles, currentRoleId, 'exams.view');
  const canViewFinancialReports = canAccess(defaultRoles, currentRoleId, 'financialReports.view');
  const {
    students = [],
    studentAdmissions = [],
    staff = [],
    feeAssignments = [],
    feeCollections = [],
    feeAdjustments = [],
    managedDocuments = [],
    examSchedules = [],
  } = dashboardData || emptyDashboardData;
  const courseStudents = scopedStudents.length ? scopedStudents : filterStudentsByCourse(students, selectedCourseCode, selectedCourse);
  const courseAdmissions = filterStudentScopedRecords(studentAdmissions, courseStudents, selectedCourseCode, selectedCourse);
  const courseFeeAssignments = filterStudentScopedRecords(feeAssignments, courseStudents, selectedCourseCode, selectedCourse);
  const courseAssignmentIds = new Set(courseFeeAssignments.map((item) => item.id).filter(Boolean));
  const courseFeeCollections = filterStudentScopedRecords(feeCollections, courseStudents, selectedCourseCode, selectedCourse)
    .filter((item) => !item.assignmentId || courseAssignmentIds.has(item.assignmentId) || selectedCourseCode === 'all');
  const courseFeeAdjustments = filterStudentScopedRecords(feeAdjustments, courseStudents, selectedCourseCode, selectedCourse)
    .filter((item) => !item.assignmentId || courseAssignmentIds.has(item.assignmentId) || selectedCourseCode === 'all');
  const courseDocuments = filterStudentScopedRecords(managedDocuments, courseStudents, selectedCourseCode, selectedCourse);
  const courseExamSchedules = filterByCourse(examSchedules, selectedCourseCode, selectedCourse);
  const activeStudents = courseStudents.filter((student) => student.status !== 'Archived');
  const facultyCount = staff.filter((member) => member.staffType === 'Faculty' && member.status !== 'Archived').length;
  const courseFeeSummary = useMemo(
    () => summarizeFees(courseFeeAssignments, courseFeeCollections, courseFeeAdjustments),
    [courseFeeAdjustments, courseFeeAssignments, courseFeeCollections]
  );
  const pendingDocuments = courseDocuments.filter((item) => item.verificationStatus === 'Pending Review');
  const upcomingExams = courseExamSchedules
    .filter((item) => item.status !== 'Archived')
    .sort((first, second) => String(first.examDate || '').localeCompare(String(second.examDate || '')));
  const collectionTrend = useMemo(() => buildCollectionTrend(courseFeeCollections), [courseFeeCollections]);
  const hasCollectionTrend = collectionTrend.some((item) => item.value > 0);
  const maxTrendValue = Math.max(...collectionTrend.map((item) => item.value), 1);
  const trendPoints = collectionTrend.map((item, index) => {
    const x = 16 + (index / Math.max(collectionTrend.length - 1, 1)) * 328;
    const y = 126 - (item.value / maxTrendValue) * 96;
    return [x, y, item.value];
  });
  const trendPath = trendPoints.map(([x, y], index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');
  const trendArea = `${trendPath} L ${trendPoints.at(-1)[0]} 138 L ${trendPoints[0][0]} 138 Z`;
  const highlightIndex = trendPoints.reduce((bestIndex, point, index) => (
    point[2] > trendPoints[bestIndex][2] ? index : bestIndex
  ), 0);
  const highlightPoint = trendPoints[highlightIndex];
  const tooltipX = Math.min(highlightPoint[0] + 12, 232);
  const tooltipY = Math.max(highlightPoint[1] - 34, 8);
  const courseAdmissionStages = useMemo(
    () => buildAdmissionStages(courseStudents, courseAdmissions),
    [courseAdmissions, courseStudents]
  );
  const maxAdmissionStageValue = Math.max(...courseAdmissionStages.map((stage) => stage.value), 0);
  const hasAdmissionPipeline = maxAdmissionStageValue > 0;
  const admittedRate = courseAdmissionStages[0].value
    ? Math.round((courseAdmissionStages[2].value / courseAdmissionStages[0].value) * 100)
    : 0;
  const paymentSplit = [
    { label: 'Collected', value: courseFeeSummary.totalCollected, color: '#22c55e' },
    { label: 'Pending', value: courseFeeSummary.totalOutstanding, color: '#f59e0b' },
    { label: 'Adjusted', value: courseFeeSummary.totalAdjusted, color: '#ef4444' },
  ];
  const splitTotal = Math.max(paymentSplit.reduce((sum, item) => sum + item.value, 0), 1);
  const collectionRate = courseFeeSummary.totalAssigned
    ? Math.round((courseFeeSummary.totalCollected / courseFeeSummary.totalAssigned) * 100)
    : 0;
  let pieCursor = 0;
  const pieGradient = paymentSplit.map((item) => {
    const start = pieCursor;
    const end = pieCursor + (item.value / splitTotal) * 100;
    pieCursor = end;
    return `${item.color} ${start}% ${end}%`;
  }).join(', ');

  const dashboardCards = [
    canViewStudents && { color: '#2563eb', icon: <Users size={22} />, label: 'Students', value: loading ? '-' : activeStudents.length, helper: loading ? '-' : 'Active records', page: 'students' },
    canViewStaff && { color: '#22c55e', icon: <GraduationCap size={22} />, label: 'Faculty', value: loading ? '-' : facultyCount, helper: loading ? '-' : 'Teaching staff', page: 'faculty-staff' },
    canViewFees && { color: '#f59e0b', icon: <Wallet size={22} />, label: 'Collection', value: loading ? '-' : formatCurrency(courseFeeSummary.totalCollected), helper: loading ? '-' : `${courseFeeSummary.dueStudents} due students`, page: 'fees' },
    canViewDocuments && { color: '#8b5cf6', icon: <FileText size={22} />, label: 'Documents', value: loading ? '-' : pendingDocuments.length, helper: loading ? '-' : 'Pending review', page: 'document-management' },
    canViewExams && { color: '#ef4444', icon: <TrendingUp size={22} />, label: 'Exams', value: loading ? '-' : upcomingExams.length, helper: loading ? '-' : 'Upcoming exams', page: 'examination-results' },
  ].filter(Boolean);

  const pendingWork = [
    canViewDocuments && canVerifyDocuments && {
      label: loading ? 'Documents need review' : `${pendingDocuments.length} documents need review`,
      helper: loading ? '-' : 'Open verification queue',
      page: 'document-management',
    },
    canViewExams && {
      label: loading ? 'Upcoming exams' : `${upcomingExams.length} upcoming exams`,
      helper: loading ? '-' : 'View exam schedule',
      page: 'examination-results',
    },
    canViewFees && courseFeeSummary.dueStudents > 0 && {
      label: `${courseFeeSummary.dueStudents} students have pending dues`,
      helper: 'Open payment due list',
      page: 'fees',
    },
  ].filter(Boolean);

  return (
    <div className="erp-dashboard min-w-0">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Today&apos;s college overview for {academicYear}.</p>
          {loading && <p className="text-xs text-slate-500 mt-2">Loading live dashboard data...</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4 py-5">
        {dashboardCards.map((card) => (
          <DashboardCard key={card.label} {...card} onClick={() => onNavigate?.(card.page)} />
        ))}
      </div>

      <div className="grid xl:grid-cols-[1.5fr_.9fr] gap-5">
        {canViewFinancialReports && (
        <section className="min-w-0 rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-bold text-slate-900">Payment Trend</h2>
              <p className="text-xs text-slate-500 mt-1">Smooth monthly collection movement.</p>
            </div>
            <span className="rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-semibold text-slate-600">{academicYear}</span>
          </div>
          <div className="relative">
            {hasCollectionTrend ? (
            <>
            <svg viewBox="0 0 360 160" className="w-full h-64 max-w-full">
              <defs>
                <linearGradient id="paymentTrendFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={trendArea} fill="url(#paymentTrendFill)" />
              <path d={trendPath} fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <line x1={highlightPoint[0]} x2={highlightPoint[0]} y1="12" y2="142" stroke="rgba(148,163,184,.55)" strokeWidth="2" strokeDasharray="6 6" />
              <circle cx={highlightPoint[0]} cy={highlightPoint[1]} r="6" fill="#f97316" stroke="#ffffff" strokeWidth="3" />
              <g transform={`translate(${tooltipX} ${tooltipY})`}>
                <rect x="0" y="0" width="112" height="32" rx="10" fill="white" opacity="0.96" />
                <text x="10" y="21" fill="#111827" fontSize="14" fontWeight="700">{loading ? '-' : formatChartCurrency(highlightPoint[2])}</text>
              </g>
              {trendPoints.map(([x], index) => (
                <line key={index} x1={x} x2={x} y1="145" y2="150" stroke="rgba(148,163,184,.5)" strokeWidth="2" />
              ))}
            </svg>
            <div className="grid grid-cols-6 gap-2 text-[11px] text-slate-500 px-4 -mt-4">
              {collectionTrend.map((month) => <span key={month.key}>{month.label}</span>)}
            </div>
            </>
            ) : (
              <div className="h-64 rounded-lg bg-[#f5f5f6] flex items-center justify-center text-sm text-slate-500">
                No payment collections yet.
              </div>
            )}
          </div>
        </section>
        )}

        <section className="min-w-0 rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
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
        {canViewStudents && (
        <section className="min-w-0 rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-bold text-slate-900">Admissions Pipeline</h2>
              <p className="text-xs text-slate-500 mt-1">Derived from student admission and status records.</p>
            </div>
            <span className="rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-bold text-emerald-500">{loading ? '-' : `${admittedRate}%`}</span>
          </div>
          {hasAdmissionPipeline ? (
          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,.85fr)] gap-5 items-center">
            <div className="space-y-1">
              {courseAdmissionStages.map((stage) => (
                <div
                  key={stage.label}
                  className="mx-auto h-10"
                  style={{
                    width: `${Math.max(12, Math.round((stage.value / maxAdmissionStageValue) * 100))}%`,
                    background: stage.color,
                    clipPath: 'polygon(0 0, 100% 0, 88% 100%, 12% 100%)',
                  }}
                />
              ))}
            </div>
            <div className="space-y-3">
              {courseAdmissionStages.map((stage) => (
                <div key={stage.label} className="flex items-center gap-3 text-sm">
                  <span className="h-3 w-3 rounded-sm" style={{ background: stage.color }} />
                  <span className="text-slate-600">{stage.label}</span>
                  <b className="ml-auto text-slate-900">{loading ? '-' : stage.value}</b>
                </div>
              ))}
            </div>
          </div>
          ) : (
            <div className="h-44 rounded-lg bg-[#f5f5f6] flex items-center justify-center text-sm text-slate-500">
              No admission records yet.
            </div>
          )}
        </section>
        )}

        {canViewFees && (
        <section className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-bold text-slate-900">Fee Collection</h2>
              <p className="text-xs text-slate-500 mt-1">Collected, pending, and adjusted split.</p>
            </div>
            <span className="rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-semibold text-slate-600">{academicYear}</span>
          </div>
          <div className="grid md:grid-cols-[180px_1fr] gap-6 items-center">
            <div className="relative h-44 w-44 mx-auto rounded-full" style={{ background: `conic-gradient(${pieGradient})` }}>
              <div className="erp-dashboard-donut-hole absolute inset-8 rounded-full flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-slate-900">{loading ? '-' : `${collectionRate}%`}</span>
                <span className="text-xs text-slate-500">Collected</span>
              </div>
            </div>
            <div className="space-y-3">
              {paymentSplit.map((item) => (
                <div key={item.label} className="flex items-center gap-3 text-sm">
                  <span className="h-3 w-3 rounded-sm" style={{ background: item.color }} />
                  <span className="text-slate-600">{item.label}</span>
                  <b className="ml-auto text-slate-900">{loading ? '-' : formatCurrency(item.value)}</b>
                </div>
              ))}
            </div>
          </div>
        </section>
        )}
      </div>

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
