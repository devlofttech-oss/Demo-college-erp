import { Bell, BookOpen, Edit3, FileText, Phone, UserRound, Wallet } from 'lucide-react';
import StatusBadge from './StatusBadge';
import {
  certificateAdmissionFields,
  commonAdmissionFields,
  examAdmissionFields,
  lateralAdmissionFields,
} from '../admissionFieldConfig';

function DetailItem({ label, value, icon, full = false }) {
  return (
    <div className={`min-w-0 ${full ? 'xl:col-span-2' : ''}`}>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 flex items-center gap-2 font-semibold text-slate-900 break-words">
        {icon}
        <span className="min-w-0 break-words">{value || '-'}</span>
      </div>
    </div>
  );
}

function DetailGrid({ fields, student, title }) {
  const visibleFields = fields.filter(([key]) => student[key]);
  if (!visibleFields.length) return null;

  return (
    <div className="mt-5">
      <h4 className="text-sm font-bold text-slate-900 mb-3">{title}</h4>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-4 text-sm">
        {visibleFields.map(([key, label]) => (
          <DetailItem key={key} label={label} value={student[key]} />
        ))}
      </div>
    </div>
  );
}

export default function StudentProfileCard({
  canEdit = true,
  onEdit,
  onOpenDocuments,
  showExtendedDetails = true,
  showSummaryTabs = true,
  student,
}) {
  const summaryTabs = [
    { label: 'Profile', value: 'Open', icon: <UserRound size={14} /> },
    { label: 'Attendance', value: '84%', icon: <Bell size={14} /> },
    { label: 'Exams', value: 'View', icon: <BookOpen size={14} /> },
    { label: 'Payment', value: 'Summary', icon: <Wallet size={14} /> },
    { label: 'Docs', value: `${student.documents?.length || 0}`, icon: <FileText size={14} /> },
  ];

  return (
    <div className="bg-white border border-slate-100 rounded-lg p-5 mb-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-20 w-20 rounded-full bg-[#30343c] text-emerald-300 flex items-center justify-center shrink-0 overflow-hidden">
            {student.profilePhotoUrl ? (
              <img src={student.profilePhotoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserRound size={38} />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold text-slate-900 break-words">{student.name}</h2>
            <p className="text-sm text-slate-500 mt-1">{student.className} {student.section} | Student ID: {student.studentId}</p>
            <p className="text-xs text-slate-500 mt-1">{student.program}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {canEdit && (
            <button
              onClick={() => onEdit?.(student)}
              className="h-9 px-4 rounded-full bg-[#33373e] text-white font-semibold text-xs flex items-center justify-center gap-2"
            >
              <Edit3 size={14} /> Edit
            </button>
          )}
          <button
            onClick={() => onOpenDocuments?.(student)}
            className="h-9 px-4 rounded-full bg-[#f5f5f6] text-slate-700 border border-slate-200 font-semibold text-xs flex items-center justify-center gap-2"
          >
            <FileText size={14} /> Documents
          </button>
          <StatusBadge value={student.status} />
        </div>
      </div>

      <div className="pt-5">
        {showSummaryTabs && (
        <div className="flex flex-wrap gap-2 mb-5">
          {summaryTabs.map((tab, index) => (
            <button
              key={tab.label}
              className={`h-10 px-4 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                index === 0
                  ? 'bg-[#33373e] text-white border-[#33373e]'
                  : 'bg-[#f5f5f6] text-slate-600 border-slate-100'
              }`}
            >
              {tab.icon} {tab.label}
              <span className="text-[11px] opacity-75">{tab.value}</span>
            </button>
          ))}
        </div>
        )}

        <h3 className="font-bold text-slate-900 mb-4">Basic Details</h3>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-4 text-sm">
          <DetailItem label="Admission No" value={student.admissionNo} />
          <DetailItem label="Class" value={`${student.className || '-'} - ${student.section || '-'}`} />
          <DetailItem label="Guardian" value={student.guardianName} />
          <DetailItem label="ID Holder" value={student.idHolder} />
          <DetailItem label="Contact" value={student.phone} icon={<Phone size={13} className="shrink-0" />} />
          <DetailItem label="Email" value={student.email} />
        </div>

        {showExtendedDetails && (
          <>
            <DetailGrid title="RGUHS Admission Details" fields={commonAdmissionFields} student={student} />
            <DetailGrid title="Entrance & Qualifying Exam" fields={examAdmissionFields} student={student} />
            <DetailGrid title="Lateral Entry Diploma Details" fields={lateralAdmissionFields} student={student} />
            <DetailGrid title="Caste & Income Certificate Details" fields={certificateAdmissionFields} student={student} />
          </>
        )}
      </div>
    </div>
  );
}
