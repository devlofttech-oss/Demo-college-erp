import { useEffect, useMemo, useState } from 'react';
import { Megaphone, MessageCircle, Plus, Search, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  archiveNoticeItem,
  createNoticeItem,
  getNoticeBoardData,
  updateNoticeItem,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
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

const communicationTaskIds = ['notices', 'alerts', 'parents'];
const normalizeCommunicationTask = (taskId) => (
  communicationTaskIds.includes(taskId) ? taskId : 'notices'
);

export default function NoticeBoardManagement({
  currentUser,
  academicYear = '',
  initialTask = 'notices',
  selectedCourse = null,
  selectedCourseCode = 'all',
}) {
  const navigate = useNavigate();
  const [notices, setNotices] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [filters, setFilters] = useState({ search: '', type: '', audience: '', status: '' });
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [activeCommunicationTask, setActiveCommunicationTask] = useState(normalizeCommunicationTask(initialTask));

  useEffect(() => {
    const loadNotices = async () => {
      if (!isFirebaseConfigured) {
        setLoadError('Live Firebase data is not configured.');
        return;
      }
      try {
        const data = await getNoticeBoardData(academicYear);
        setNotices(data.noticeItems);
        setSelectedId(data.noticeItems[0]?.id || '');
        setLoadError('');
      } catch (error) {
        console.warn('Unable to load live communication data.', error);
        setLoadError('Unable to load live communication records.');
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
  const taskScopedNotices = useMemo(() => {
    if (activeCommunicationTask === 'alerts') {
      return roleScopedNotices.filter((item) => item.type === 'SMS/WhatsApp Alert' || item.communicationFeature === 'alerts');
    }
    if (activeCommunicationTask === 'parents') {
      return roleScopedNotices.filter((item) => item.audience === 'Parents' || item.type === 'Parent Communication' || item.communicationFeature === 'parents');
    }
    return roleScopedNotices;
  }, [activeCommunicationTask, roleScopedNotices]);
  const visibleNotices = useMemo(() => filterNotices(taskScopedNotices, activeFilters), [taskScopedNotices, activeFilters]);
  const selectedNotice = taskScopedNotices.find((item) => item.id === selectedId) || visibleNotices[0] || taskScopedNotices[0];
  const communicationTaskOptions = [
    {
      id: 'notices',
      title: 'Notices & Announcements',
      helper: 'Circulars, public notices, and event announcements.',
      icon: <Megaphone size={22} />,
      count: roleScopedNotices.length,
    },
    {
      id: 'alerts',
      title: 'SMS/WhatsApp Alerts',
      helper: 'Short alerts for urgent updates and reminders.',
      icon: <MessageCircle size={22} />,
      count: roleScopedNotices.filter((item) => item.type === 'SMS/WhatsApp Alert' || item.communicationFeature === 'alerts').length,
    },
    {
      id: 'parents',
      title: 'Parent Communication',
      helper: 'Parent-facing messages and guardian updates.',
      icon: <UserRound size={22} />,
      count: roleScopedNotices.filter((item) => item.audience === 'Parents' || item.type === 'Parent Communication' || item.communicationFeature === 'parents').length,
    },
  ];
  const activeCommunicationOption = communicationTaskOptions.find((item) => item.id === activeCommunicationTask) || communicationTaskOptions[0];
  const modalDefaults = activeCommunicationTask === 'alerts'
    ? { type: 'SMS/WhatsApp Alert' }
    : activeCommunicationTask === 'parents'
      ? { type: 'Parent Communication', audience: 'Parents' }
      : {};

  const buildPayload = (form) => ({
    ...form,
    title: form.title.trim(),
    referenceNo: form.referenceNo.trim() || `${form.type.split(' ')[0].toUpperCase()}-${Date.now()}`,
    body: form.body.trim(),
    createdByName: currentUser?.name || 'Admin Office',
    courseCode: selectedCourseCode === 'all' ? '' : selectedCourseCode,
    courseName: selectedCourseCode === 'all' ? '' : selectedCourse?.courseName || selectedCourse?.name || '',
    communicationFeature: activeCommunicationTask,
    channel: activeCommunicationTask === 'alerts' ? 'SMS/WhatsApp' : 'Notice Board',
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
      } catch (error) {
        console.error('Unable to update live announcement.', error);
        toast.error('Announcement was not saved to live data.');
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
      if (!id) throw new Error('Live announcement was not created.');
      const created = { id, ...createPayload };
      setNotices((prev) => [created, ...prev]);
      setSelectedId(created.id);
      toast.success('Announcement created');
    } catch (error) {
      console.error('Unable to create live announcement.', error);
      toast.error('Announcement was not saved to live data.');
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
    } catch (error) {
      console.error('Unable to archive live announcement.', error);
      toast.error('Announcement archive was not saved to live data.');
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
    } catch (error) {
      console.error('Unable to publish live announcement.', error);
      toast.error('Announcement publish was not saved to live data.');
    }
  };

  const selectForPreview = (notice) => setSelectedId(notice.id);
  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const openCommunicationTask = (taskId) => {
    const nextTaskId = normalizeCommunicationTask(taskId);
    if (nextTaskId === activeCommunicationTask) return;
    setActiveCommunicationTask(nextTaskId);
    setSelectedId('');
    navigate('/modules/communication', { state: { communicationTask: nextTaskId } });
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Administration / <span className="text-[#f39a5f]">Communication</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Communication</h1>
          <p className="text-sm text-slate-500 mt-1">Announcements, circular management, event communication, audience targeting, and publication status.</p>
          {!isFirebaseConfigured && <p className="text-xs text-rose-600 mt-2">Live Firebase data is not configured.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        {canCreate && (
          <button onClick={() => setShowModal(true)} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2">
            <Plus size={16} /> {activeCommunicationTask === 'alerts' ? 'Alert' : activeCommunicationTask === 'parents' ? 'Parent Message' : 'Announcement'}
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4 py-5">
        {communicationTaskOptions.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => openCommunicationTask(task.id)}
            aria-pressed={activeCommunicationTask === task.id}
            className={`erp-communication-task min-h-32 rounded-lg border p-4 text-left flex flex-col justify-between ${activeCommunicationTask === task.id ? 'is-active border-emerald-300 bg-emerald-50' : 'border-slate-100 bg-white'}`}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="h-11 w-11 rounded-lg bg-[#f5f5f6] text-[#34363d] flex items-center justify-center">{task.icon}</span>
              <span className="rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-bold text-slate-600">{task.count}</span>
            </span>
            <span>
              <span className="block text-base font-bold text-slate-900">{task.title}</span>
              <span className="block text-sm text-slate-500 mt-1">{task.helper}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-5">
        <div className="xl:w-[68%] min-w-0">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">{activeCommunicationOption.title}</h2>
          </div>
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

      {showModal && <NoticeModal defaultValues={modalDefaults} onClose={() => setShowModal(false)} onSave={saveNotice} />}
      {editingNotice && <NoticeModal mode="edit" initialNotice={editingNotice} onClose={() => setEditingNotice(null)} onSave={saveNotice} />}
    </div>
  );
}
