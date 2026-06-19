export default function StatusBadge({ value }) {
  const classes = {
    Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Admission Review': 'bg-orange-50 text-orange-700 border-orange-200',
    Eligible: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Pending Review': 'bg-amber-50 text-amber-700 border-amber-200',
    'Certificate Ready': 'bg-sky-50 text-sky-700 border-sky-200',
    'Not Requested': 'bg-slate-50 text-slate-600 border-slate-200',
    Promoted: 'bg-violet-50 text-violet-700 border-violet-200',
    Verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    Archived: 'bg-slate-100 text-slate-500 border-slate-200',
    Suspended: 'bg-rose-50 text-rose-700 border-rose-200',
    Staff: 'bg-slate-50 text-slate-600 border-slate-200',
    Present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Absent: 'bg-rose-50 text-rose-700 border-rose-200',
    Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'On Leave': 'bg-amber-50 text-amber-700 border-amber-200',
    Leave: 'bg-amber-50 text-amber-700 border-amber-200',
    Queued: 'bg-sky-50 text-sky-700 border-sky-200',
    Draft: 'bg-amber-50 text-amber-700 border-amber-200',
    Published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Scheduled: 'bg-sky-50 text-sky-700 border-sky-200',
    Entered: 'bg-sky-50 text-sky-700 border-sky-200',
    Generated: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Pass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Needs Improvement': 'bg-rose-50 text-rose-700 border-rose-200',
    Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Due: 'bg-rose-50 text-rose-700 border-rose-200',
    'Partially Paid': 'bg-amber-50 text-amber-700 border-amber-200',
    Posted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Cleared: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Overdue: 'bg-rose-50 text-rose-700 border-rose-200',
    'Due Soon': 'bg-amber-50 text-amber-700 border-amber-200',
    Upcoming: 'bg-sky-50 text-sky-700 border-sky-200',
    'No Due Date': 'bg-slate-50 text-slate-600 border-slate-200',
    Important: 'bg-amber-50 text-amber-700 border-amber-200',
    Urgent: 'bg-rose-50 text-rose-700 border-rose-200',
    Expired: 'bg-slate-100 text-slate-500 border-slate-200',
    'A+': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    A: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'B+': 'bg-sky-50 text-sky-700 border-sky-200',
    B: 'bg-sky-50 text-sky-700 border-sky-200',
    C: 'bg-amber-50 text-amber-700 border-amber-200',
    D: 'bg-orange-50 text-orange-700 border-orange-200',
    F: 'bg-rose-50 text-rose-700 border-rose-200',
    'Not Marked': 'bg-slate-50 text-slate-600 border-slate-200',
  };

  return (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-[11px] font-semibold ${classes[value] || classes.Active}`}>
      {value}
    </span>
  );
}

