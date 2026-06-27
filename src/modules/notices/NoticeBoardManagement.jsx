import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  archiveNoticeItem,
  createNoticeItem,
  getNoticeBoardData,
  updateNoticeItem,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import { demoNoticeItems } from './demoNotices';
import {
  filterNotices,
  filterVisibleNoticesForRole,
  formatDisplayDate,
  noticeAudiences,
  noticeMatchesCourseScope,
  noticeTypes,
  validateNoticeForm,
} from './noticeUtils';
import NoticeModal from './components/NoticeModal';
import NoticePreviewPanel from './components/NoticePreviewPanel';
import NoticeTable from './components/NoticeTable';

export default function NoticeBoardManagement({ currentUser, academicYear = '2026-2027', selectedCourse = null, selectedCourseCode = 'all' }) {
  const [notices, setNotices] = useState(isFirebaseConfigured ? [] : demoNoticeItems);
  const [selectedId, setSelectedId] = useState(isFirebaseConfigured ? '' : demoNoticeItems[0]?.id || '');
  const [filters, setFilters] = useState({ search: '', type: '', audience: '', status: '' });
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);

  useEffect(() => {
    const loadNotices = async () => {
      if (!isFirebaseConfigured) return;
      try {
        const data = await getNoticeBoardData(academicYear);
        setNotices(data.noticeItems);
        setSelectedId(data.noticeItems[0]?.id || '');
      } catch (error) {
        console.warn('Using demo notices because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore notice records. Showing demo/local records.');
      }
    };
    loadNotices();
  }, [academicYear]);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canCreate = canAccess(defaultRoles, currentRoleId, 'notices.create');
  const canEdit = canAccess(defaultRoles, currentRoleId, 'notices.edit');
  const canArchive = canAccess(defaultRoles, currentRoleId, 'notices.archive');
  const canManageNotices = canCreate || canEdit || canArchive;
  const isParentViewer = currentRoleId === 'parent' && !canManageNotices;
  const courseNotices = useMemo(
    () => notices.filter((item) => noticeMatchesCourseScope(item, selectedCourseCode, selectedCourse)),
    [notices, selectedCourse, selectedCourseCode],
  );
  const roleScopedNotices = useMemo(
    () => filterVisibleNoticesForRole(courseNotices, currentRoleId, canManageNotices),
    [canManageNotices, courseNotices, currentRoleId],
  );
  const activeFilters = useMemo(() => (canManageNotices ? filters : { ...filters, status: '' }), [canManageNotices, filters]);
  const visibleNotices = useMemo(() => filterNotices(roleScopedNotices, activeFilters), [roleScopedNotices, activeFilters]);
  const selectedNotice = roleScopedNotices.find((item) => item.id === selectedId) || visibleNotices[0] || roleScopedNotices[0];

  const buildPayload = (form) => ({
    ...form,
    title: form.title.trim(),
    referenceNo: form.referenceNo.trim() || `${form.type.split(' ')[0].toUpperCase()}-${Date.now()}`,
    body: form.body.trim(),
    createdByName: currentUser?.name || 'Admin Office',
    courseCode: selectedCourseCode === 'all' ? '' : selectedCourseCode,
    courseName: selectedCourseCode === 'all' ? '' : selectedCourse?.courseName || selectedCourse?.name || '',
  });

  const saveNotice = async (form) => {
    const validationMessage = validateNoticeForm(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    const payload = buildPayload(form);
    if (editingNotice) {
      if (!canEdit) {
        toast.error('You do not have permission to edit announcements.');
        return;
      }
      const updates = { ...payload, updatedAtText: formatDisplayDate() };
      try {
        await updateNoticeItem(editingNotice.id, updates);
        setNotices((prev) => prev.map((item) => item.id === editingNotice.id ? { ...item, ...updates } : item));
        toast.success('Announcement updated');
      } catch {
        setNotices((prev) => prev.map((item) => item.id === editingNotice.id ? { ...item, ...updates } : item));
        toast.success('Announcement updated locally');
      } finally {
        setEditingNotice(null);
      }
      return;
    }

    if (!canCreate) {
      toast.error('You do not have permission to create announcements.');
      return;
    }
    const createPayload = { ...payload, academicYear, createdAtText: formatDisplayDate() };
    try {
      const id = await createNoticeItem(createPayload);
      const created = { id: id || `local-notice-${Date.now()}`, ...createPayload };
      setNotices((prev) => [created, ...prev]);
      setSelectedId(created.id);
      toast.success('Announcement created');
    } catch {
      const created = { id: `local-notice-${Date.now()}`, ...createPayload };
      setNotices((prev) => [created, ...prev]);
      setSelectedId(created.id);
      toast.success('Announcement created locally');
    } finally {
      setShowModal(false);
    }
  };

  const archiveNotice = async (notice) => {
    if (!canArchive) {
      toast.error('You do not have permission to archive announcements.');
      return;
    }
    const updates = { status: 'Archived', archivedAtText: formatDisplayDate() };
    try {
      await archiveNoticeItem(notice.id, updates);
      setNotices((prev) => prev.map((item) => item.id === notice.id ? { ...item, ...updates } : item));
      toast.success('Announcement archived');
    } catch {
      setNotices((prev) => prev.map((item) => item.id === notice.id ? { ...item, ...updates } : item));
      toast.success('Announcement archived locally');
    }
  };

  const publishNotice = async (notice) => {
    if (!canEdit) {
      toast.error('You do not have permission to publish announcements.');
      return;
    }
    if (notice.status !== 'Draft') {
      toast.error('Only draft announcements can be published.');
      return;
    }
    const updates = { status: 'Published', publishedAtText: formatDisplayDate() };
    try {
      await updateNoticeItem(notice.id, updates);
      setNotices((prev) => prev.map((item) => item.id === notice.id ? { ...item, ...updates } : item));
      setSelectedId(notice.id);
      toast.success('Announcement published');
    } catch {
      setNotices((prev) => prev.map((item) => item.id === notice.id ? { ...item, ...updates } : item));
      setSelectedId(notice.id);
      toast.success('Announcement published locally');
    }
  };

  const selectForPreview = (notice) => setSelectedId(notice.id);
  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Administration / <span className="text-[#f39a5f]">Notice Board & Announcements</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Notice Board & Announcements</h1>
          <p className="text-sm text-slate-500 mt-1">Digital notices, circular management, event announcements, audience targeting, and publication status.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist announcements.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        {canCreate && (
          <button onClick={() => setShowModal(true)} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2">
            <Plus size={16} /> Announcement
          </button>
        )}
      </div>

      <div className="flex flex-col xl:flex-row gap-5">
        <div className="xl:w-[68%] min-w-0">
          <div className={`grid gap-3 mb-4 ${canManageNotices ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            <div className="relative md:col-span-1">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search..." className="w-full h-10 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-3 text-sm" />
            </div>
            <select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)} className="h-10 rounded-lg bg-[#f0f0f2] border-0 px-3 text-sm">
              <option value="">All Types</option>
              {noticeTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
            {isParentViewer ? (
              <select value="Parents" disabled className="h-10 rounded-lg bg-[#f0f0f2] border-0 px-3 text-sm disabled:opacity-100">
                <option value="Parents">Parents</option>
              </select>
            ) : (
              <select value={filters.audience} onChange={(event) => updateFilter('audience', event.target.value)} className="h-10 rounded-lg bg-[#f0f0f2] border-0 px-3 text-sm">
                <option value="">All Audiences</option>
                {noticeAudiences.map((item) => <option key={item}>{item}</option>)}
              </select>
            )}
            {canManageNotices && (
              <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="h-10 rounded-lg bg-[#f0f0f2] border-0 px-3 text-sm">
                <option value="">All Statuses</option>
                {['Draft', 'Published', 'Scheduled', 'Expired', 'Archived'].map((item) => <option key={item}>{item}</option>)}
              </select>
            )}
          </div>
          <NoticeTable
            notices={visibleNotices}
            canArchive={canArchive}
            canEdit={canEdit}
            showActions={canManageNotices}
            onEdit={setEditingNotice}
            onPreview={selectForPreview}
            onArchive={archiveNotice}
            onPublish={publishNotice}
          />
        </div>
        <NoticePreviewPanel canPublish={canEdit} notice={selectedNotice} showActions={canManageNotices} onPublish={publishNotice} />
      </div>

      {showModal && <NoticeModal onClose={() => setShowModal(false)} onSave={saveNotice} />}
      {editingNotice && <NoticeModal mode="edit" initialNotice={editingNotice} onClose={() => setEditingNotice(null)} onSave={saveNotice} />}
    </div>
  );
}
