import StatusBadge from '../../students/components/StatusBadge';

export default function PerformanceCard({ performance }) {
  return (
    <div className="bg-white border border-slate-100 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900">Academic Performance</h3>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-[#33373e]">{performance.average}%</span>
          {performance.grade !== '-' && <StatusBadge value={performance.grade} />}
        </div>
      </div>
      <div className="space-y-2">
        {performance.subjectRows.map((item) => (
          <div key={`${item.subject}-${item.maxMarks}`} className="rounded-lg bg-[#f5f5f6] p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{item.subject}</span>
              <span>{item.marksObtained}/{item.maxMarks}</span>
            </div>
            <div className="h-2 bg-white rounded-full overflow-hidden mt-2">
              <div className="h-full bg-[#fb9a5b]" style={{ width: `${Math.min(100, item.percentage)}%` }} />
            </div>
          </div>
        ))}
        {!performance.subjectRows.length && <div className="text-sm text-slate-500">No marks entries available.</div>}
      </div>
    </div>
  );
}
