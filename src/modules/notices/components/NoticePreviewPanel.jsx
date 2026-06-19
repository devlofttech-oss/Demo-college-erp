import StatusBadge from '../../students/components/StatusBadge';
import { getNoticeDisplayStatus } from '../noticeUtils';

export default function NoticePreviewPanel({ notice }) {
  return (
    <aside className="xl:w-[32%]">
      <div className="bg-white border border-slate-100 rounded-lg p-5 sticky top-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-900">Preview</h3>
            <p className="text-xs text-slate-500 mt-1">{notice?.referenceNo || 'Select an announcement'}</p>
          </div>
          {notice && <StatusBadge value={getNoticeDisplayStatus(notice)} />}
        </div>
        {notice ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#f5f5f6] p-4">
              <div className="text-xs font-semibold text-slate-500">{notice.type} | {notice.audience}</div>
              <h2 className="text-xl font-bold text-slate-900 mt-2">{notice.title}</h2>
              <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{notice.body}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div className="rounded-lg bg-[#f5f5f6] p-3">Priority<br /><b>{notice.priority}</b></div>
              <div className="rounded-lg bg-[#f5f5f6] p-3">Created By<br /><b>{notice.createdByName}</b></div>
              <div className="rounded-lg bg-[#f5f5f6] p-3">Publish<br /><b>{notice.publishDate}</b></div>
              <div className="rounded-lg bg-[#f5f5f6] p-3">Expiry<br /><b>{notice.expiryDate || '-'}</b></div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-[#f5f5f6] p-4 text-sm text-slate-500">Choose a notice, circular, or event announcement to preview it.</div>
        )}
      </div>
    </aside>
  );
}
