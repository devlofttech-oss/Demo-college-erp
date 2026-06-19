import StatusBadge from '../../students/components/StatusBadge';

export default function ParentNoticePanel({ notices }) {
  return (
    <div className="bg-white border border-slate-100 rounded-lg p-5">
      <h3 className="font-bold text-slate-900 mb-4">Notices</h3>
      <div className="space-y-3">
        {notices.slice(0, 5).map((item) => (
          <div key={item.id} className="rounded-lg bg-[#f5f5f6] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-900">{item.title}</div>
                <div className="text-xs text-slate-500 mt-1">{item.type} | {item.publishDate}</div>
              </div>
              <StatusBadge value={item.priority} />
            </div>
            <p className="text-sm text-slate-600 mt-3 line-clamp-2">{item.body}</p>
          </div>
        ))}
        {!notices.length && <div className="text-sm text-slate-500">No published notices available.</div>}
      </div>
    </div>
  );
}
