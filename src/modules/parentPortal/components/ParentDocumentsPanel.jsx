import { Download } from 'lucide-react';
import StatusBadge from '../../students/components/StatusBadge';

export default function ParentDocumentsPanel({ documents }) {
  return (
    <div className="bg-white border border-slate-100 rounded-lg p-5">
      <h3 className="font-bold text-slate-900 mb-4">Verified Documents</h3>
      <div className="space-y-3">
        {documents.slice(0, 5).map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg bg-[#f5f5f6] p-3 gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{item.documentType}</div>
              <div className="text-xs text-slate-500 truncate">{item.fileName || 'Metadata only'}</div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge value={item.verificationStatus} />
              {item.fileUrl && (
                <a href={item.fileUrl} target="_blank" rel="noreferrer" className="h-8 w-8 rounded-md bg-white border border-slate-200 inline-flex items-center justify-center">
                  <Download size={14} />
                </a>
              )}
            </div>
          </div>
        ))}
        {!documents.length && <div className="text-sm text-slate-500">No verified documents available.</div>}
      </div>
    </div>
  );
}
