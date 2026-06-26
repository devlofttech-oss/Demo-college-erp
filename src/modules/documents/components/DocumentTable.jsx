import { Archive, CheckCircle, Download, Eye, XCircle } from 'lucide-react';
import StatusBadge from '../../students/components/StatusBadge';
import { formatFileSize } from '../documentUtils';

export default function DocumentTable({
  documents,
  canVerify,
  canArchive,
  onArchive,
  onPreview,
  onVerify,
  onSelect,
  selectedId,
  showActions = true,
}) {
  const stopRowAction = (event, action) => {
    event.stopPropagation();
    action?.();
  };

  return (
    <div className="overflow-hidden border border-slate-100 rounded-lg bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f5f5f6] text-slate-500">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Document</th>
              <th className="text-left px-4 py-3 font-semibold">Owner</th>
              <th className="text-left px-4 py-3 font-semibold">Category</th>
              <th className="text-left px-4 py-3 font-semibold">Uploaded</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              {showActions && <th className="text-right px-4 py-3 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.map((item) => (
              <tr
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect?.(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect?.(item.id);
                  }
                }}
                className={`hover:bg-slate-50 cursor-pointer ${selectedId === item.id ? 'erp-row-selected' : ''}`}
              >
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{item.documentType}</div>
                  <div className="text-xs text-slate-500">{item.fileName || 'Metadata only'} | {formatFileSize(item.fileSize)}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-700">{item.ownerName || item.archiveTitle}</div>
                  <div className="text-xs text-slate-500">{item.ownerType} | {item.ownerId || '-'}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.category}</td>
                <td className="px-4 py-3 text-slate-600">{item.uploadedAtText}</td>
                <td className="px-4 py-3"><StatusBadge value={item.verificationStatus} /></td>
                {showActions && (
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={(event) => stopRowAction(event, () => onPreview(item))} className="h-8 w-8 rounded-md bg-white border border-slate-200 inline-flex items-center justify-center"><Eye size={14} /></button>
                    {item.fileUrl && (
                      <a href={item.fileUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="h-8 w-8 rounded-md bg-white border border-slate-200 inline-flex items-center justify-center">
                        <Download size={14} />
                      </a>
                    )}
                    <button onClick={(event) => stopRowAction(event, () => onVerify(item, 'Verified'))} disabled={!canVerify} className="h-8 w-8 rounded-md bg-white border border-emerald-200 text-emerald-700 inline-flex items-center justify-center disabled:text-slate-300 disabled:border-slate-200"><CheckCircle size={14} /></button>
                    <button onClick={(event) => stopRowAction(event, () => onVerify(item, 'Rejected'))} disabled={!canVerify} className="h-8 w-8 rounded-md bg-white border border-rose-200 text-rose-700 inline-flex items-center justify-center disabled:text-slate-300 disabled:border-slate-200"><XCircle size={14} /></button>
                    <button onClick={(event) => stopRowAction(event, () => onArchive(item))} disabled={!canArchive || item.verificationStatus === 'Archived'} className="h-8 w-8 rounded-md bg-white border border-slate-200 inline-flex items-center justify-center disabled:text-slate-300"><Archive size={14} /></button>
                  </div>
                </td>
                )}
              </tr>
            ))}
            {!documents.length && (
              <tr>
                <td colSpan={showActions ? 6 : 5} className="px-4 py-10 text-center text-slate-500">No documents found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
