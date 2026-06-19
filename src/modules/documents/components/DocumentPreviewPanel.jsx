import StatusBadge from '../../students/components/StatusBadge';
import { formatFileSize } from '../documentUtils';

export default function DocumentPreviewPanel({ document }) {
  return (
    <aside className="xl:w-[32%]">
      <div className="bg-white border border-slate-100 rounded-lg p-5 sticky top-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-900">Document Details</h3>
            <p className="text-xs text-slate-500 mt-1">{document?.ownerType || 'Select a document'}</p>
          </div>
          {document && <StatusBadge value={document.verificationStatus} />}
        </div>
        {document ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#f5f5f6] p-4">
              <div className="text-xs font-semibold text-slate-500">{document.category}</div>
              <h2 className="text-xl font-bold text-slate-900 mt-2">{document.documentType}</h2>
              <p className="text-sm text-slate-600 mt-2">{document.ownerName || document.archiveTitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div className="rounded-lg bg-[#f5f5f6] p-3">File<br /><b>{document.fileName || 'Metadata only'}</b></div>
              <div className="rounded-lg bg-[#f5f5f6] p-3">Size<br /><b>{formatFileSize(document.fileSize)}</b></div>
              <div className="rounded-lg bg-[#f5f5f6] p-3">Uploaded<br /><b>{document.uploadedAtText}</b></div>
              <div className="rounded-lg bg-[#f5f5f6] p-3">Verified<br /><b>{document.verifiedAtText || '-'}</b></div>
            </div>
            <div className="rounded-lg bg-[#f5f5f6] p-3 text-sm text-slate-600">
              Tags: {document.tags || '-'}
            </div>
            {document.fileUrl && (
              <a href={document.fileUrl} target="_blank" rel="noreferrer" className="h-10 px-4 rounded-lg bg-[#33373e] text-white text-sm font-semibold inline-flex items-center justify-center">
                Open Document
              </a>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-[#f5f5f6] p-4 text-sm text-slate-500">Choose a document to inspect metadata and verification details.</div>
        )}
      </div>
    </aside>
  );
}
