import StatusBadge from '../../students/components/StatusBadge';

export default function DocumentArchivePanel({ documents }) {
  const archives = documents.filter((item) => item.ownerType === 'Academic Archive').slice(0, 5);

  return (
    <div className="bg-white border border-slate-100 rounded-lg p-5 mt-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900">Academic Records Archive</h3>
        <span className="text-xs text-slate-500">{archives.length} recent</span>
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        {archives.map((item) => (
          <div key={item.id} className="rounded-lg bg-[#f5f5f6] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-900">{item.archiveTitle || item.documentType}</div>
                <div className="text-xs text-slate-500 mt-1">{item.fileName || 'Metadata only'} | {item.uploadedAtText}</div>
              </div>
              <StatusBadge value={item.verificationStatus} />
            </div>
          </div>
        ))}
        {!archives.length && <div className="text-sm text-slate-500">No academic archive records yet.</div>}
      </div>
    </div>
  );
}
