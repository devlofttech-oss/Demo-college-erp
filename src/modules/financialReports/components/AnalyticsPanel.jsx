import { formatCurrency } from '../../fees/feeUtils';

export default function AnalyticsPanel({ analytics, snapshots }) {
  return (
    <aside className="xl:w-[32%] space-y-4">
      <div className="bg-white border border-slate-100 rounded-lg p-5">
        <h3 className="font-bold text-slate-900 mb-4">Class Analytics</h3>
        <div className="space-y-3">
          {analytics.map((item) => (
            <div key={item.classKey} className="rounded-lg bg-[#f5f5f6] p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold text-slate-900">{item.classKey}</div>
                  <div className="text-xs text-slate-500">{item.students} assigned students</div>
                </div>
                <div className="text-sm font-bold text-[#33373e]">{item.collectionRate}%</div>
              </div>
              <div className="h-2 rounded-full bg-white overflow-hidden mb-3">
                <div className="h-full bg-[#fb9a5b]" style={{ width: `${Math.min(100, item.collectionRate)}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-white p-2">Collected<br /><b className="text-emerald-700">{formatCurrency(item.collected)}</b></div>
                <div className="rounded-md bg-white p-2">Outstanding<br /><b className="text-rose-700">{formatCurrency(item.outstanding)}</b></div>
              </div>
            </div>
          ))}
          {!analytics.length && <div className="text-sm text-slate-500">No class analytics available.</div>}
        </div>
      </div>
      <div className="bg-white border border-slate-100 rounded-lg p-5">
        <h3 className="font-bold text-slate-900 mb-4">Saved Summaries</h3>
        <div className="space-y-3">
          {snapshots.slice(0, 5).map((item) => (
            <div key={item.id} className="rounded-lg bg-[#f5f5f6] p-3">
              <div className="font-semibold text-sm">{item.reportName}</div>
              <div className="text-xs text-slate-500 mt-1">{item.createdAtText}</div>
              <div className="flex items-center justify-between mt-3 text-xs">
                <span>Collection rate</span>
                <b>{item.collectionRate}%</b>
              </div>
            </div>
          ))}
          {!snapshots.length && <div className="text-sm text-slate-500">No saved summaries yet.</div>}
        </div>
      </div>
    </aside>
  );
}
