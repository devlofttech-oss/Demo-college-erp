import { Bell, BookOpen, Edit3, FileText, Phone, UserRound, Wallet } from 'lucide-react';
import StatusBadge from './StatusBadge';
import {
  certificateAdmissionFields,
  commonAdmissionFields,
  examAdmissionFields,
  lateralAdmissionFields,
} from '../admissionFieldConfig';

function DetailGrid({ fields, student, title }) {
  const visibleFields = fields.filter(([key]) => student[key]);
  if (!visibleFields.length) return null;

  return (
    <div className="mt-5">
      <h4 className="text-sm font-bold text-slate-900 mb-3">{title}</h4>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 text-sm">
        {visibleFields.map(([key, label]) => (
          <div key={key} className="rounded-lg bg-[#f5f5f6] p-3 min-w-0">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="font-semibold mt-1 break-words">{student[key]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudentProfileCard({ canEdit = true, showSummaryTabs = true, student, onEdit }) {
  const summaryTabs = [
    { label: 'Profile', value: 'Open', icon: <UserRound size={14} /> },
    { label: 'Attendance', value: '84%', icon: <Bell size={14} /> },
    { label: 'Exams', value: 'View', icon: <BookOpen size={14} /> },
    { label: 'Payment', value: 'Summary', icon: <Wallet size={14} /> },
    { label: 'Docs', value: `${student.documents?.length || 0}`, icon: <FileText size={14} /> },
  ];

  return (
    <div className="bg-white border border-slate-100 rounded-lg overflow-hidden mb-5 shadow-sm">
      <div className="relative min-h-36 bg-[#34363d] p-6 text-white overflow-hidden">
        <div className="absolute -right-12 -top-10 h-44 w-44 rounded-full border-[22px] border-[#fb9a5b] opacity-80" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 rounded-full bg-white/15 border border-white/20 text-emerald-300 flex items-center justify-center shrink-0">
              <UserRound size={42} />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white">{student.name}</h2>
              <p className="text-sm text-white/80 mt-1">{student.className} {student.section} | Student ID: {student.studentId}</p>
              <p className="text-xs text-white/70 mt-1">{student.program}</p>
            </div>
          </div>
          <StatusBadge value={student.status} />
        </div>
      </div>

      <div className="p-5">
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

        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-slate-900">Basic Details</h3>
          {canEdit && (
            <button
              onClick={() => onEdit(student)}
              className="h-9 px-4 rounded-full bg-[#33373e] text-white font-semibold text-xs flex items-center justify-center gap-2"
            >
              <Edit3 size={14} /> Edit
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg bg-[#f5f5f6] p-3">
            <div className="text-xs text-slate-500">Admission No</div>
            <div className="font-semibold mt-1">{student.admissionNo}</div>
          </div>
          <div className="rounded-lg bg-[#f5f5f6] p-3">
            <div className="text-xs text-slate-500">Class</div>
            <div className="font-semibold mt-1">{student.className} - {student.section}</div>
          </div>
          <div className="rounded-lg bg-[#f5f5f6] p-3">
            <div className="text-xs text-slate-500">Guardian</div>
            <div className="font-semibold mt-1">{student.guardianName || '-'}</div>
          </div>
          <div className="rounded-lg bg-[#f5f5f6] p-3">
            <div className="text-xs text-slate-500">ID Holder</div>
            <div className="font-semibold mt-1">{student.idHolder || '-'}</div>
          </div>
          <div className="rounded-lg bg-[#f5f5f6] p-3">
            <div className="text-xs text-slate-500">Contact</div>
            <div className="font-semibold mt-1 flex items-center gap-2"><Phone size={13} /> {student.phone || '-'}</div>
          </div>
          <div className="rounded-lg bg-[#f5f5f6] p-3">
            <div className="text-xs text-slate-500">Email</div>
            <div className="font-semibold mt-1 break-all">{student.email || '-'}</div>
          </div>
        </div>

        <DetailGrid title="RGUHS Admission Details" fields={commonAdmissionFields} student={student} />
        <DetailGrid title="Entrance & Qualifying Exam" fields={examAdmissionFields} student={student} />
        <DetailGrid title="Lateral Entry Diploma Details" fields={lateralAdmissionFields} student={student} />
        <DetailGrid title="Caste & Income Certificate Details" fields={certificateAdmissionFields} student={student} />
      </div>
    </div>
  );
}
