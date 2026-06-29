import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Building2, CalendarDays, Hash, Save, Settings, Upload, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSettingsData, saveSystemSetting } from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import { demoAcademicYearSettings, demoIdFormatSettings, demoInstituteSettings, demoModuleDefaultSettings, normalizeInstituteSettings } from './demoSettings';
import { buildNextId, formatDisplayDate, summarizeSettings, validateAcademicYearSettings, validateInstituteSettings } from './settingsUtils';
import AcademicsManagement from '../academics/AcademicsManagement';
import UserRoleManagement from '../userRoles/UserRoleManagement';

export default function SettingsManagement({ currentUser, selectedCourse = null, selectedCourseCode = 'all' }) {
  const [institute, setInstitute] = useState(isFirebaseConfigured ? {} : demoInstituteSettings);
  const [academicYear, setAcademicYear] = useState(isFirebaseConfigured ? {} : demoAcademicYearSettings);
  const [idFormats, setIdFormats] = useState(isFirebaseConfigured ? {} : demoIdFormatSettings);
  const [moduleDefaults, setModuleDefaults] = useState(isFirebaseConfigured ? {} : demoModuleDefaultSettings);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [loadError, setLoadError] = useState('');
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const currentState = window.history.state || {};
    window.history.replaceState({
      ...currentState,
      settingsFlow: { section: '' },
    }, '');

    const handleHistoryBack = (event) => {
      setActiveSection(event.state?.settingsFlow?.section || '');
    };

    window.addEventListener('popstate', handleHistoryBack);
    return () => window.removeEventListener('popstate', handleHistoryBack);
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      if (!isFirebaseConfigured) return;
      try {
        const data = await getSettingsData();
        if (data.institute) setInstitute(normalizeInstituteSettings(data.institute));
        if (data.academicYear) setAcademicYear(data.academicYear);
        if (data.idFormats) setIdFormats(data.idFormats);
        if (data.moduleDefaults) setModuleDefaults(data.moduleDefaults);
      } catch (error) {
        console.warn('Using demo settings because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore settings. Showing demo/local records.');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const currentRoleId = currentUser?.roleId || 'admin';
  const isSuperAdmin = currentRoleId === 'super-admin';
  const canManage = canAccess(defaultRoles, currentRoleId, 'settings.manage');
  const canManageUsers = canAccess(defaultRoles, currentRoleId, 'users.view');
  const canViewAcademics = canAccess(defaultRoles, currentRoleId, 'academics.view');
  const summary = summarizeSettings(institute, academicYear, idFormats, moduleDefaults);
  const setupSections = [
    {
      id: 'institute',
      title: 'Institute Setup',
      description: 'College profile, contact, and address.',
      icon: <Building2 size={24} />,
      meta: loading ? '-' : summary.instituteConfigured ? 'Ready' : 'Pending',
    },
    {
      id: 'academic-year',
      title: 'Academic Year',
      description: 'Active year, start date, and end date.',
      icon: <CalendarDays size={24} />,
      meta: loading ? '-' : summary.academicYear,
    },
    {
      id: 'academic-setup',
      title: 'Academic Setup',
      description: 'Programs, subjects, batches, and academic calendar setup.',
      icon: <BookOpen size={24} />,
      meta: loading ? '-' : canViewAcademics ? 'Open' : 'No access',
      disabled: !canViewAcademics,
    },
    {
      id: 'people-setup',
      title: 'People Setup',
      description: 'Users, roles, permissions, and admin access.',
      icon: <Users size={24} />,
      meta: loading ? '-' : canManageUsers ? 'Admin' : 'No access',
      disabled: !canManageUsers,
    },
    {
      id: 'id-formats',
      title: 'ID & Receipt Formats',
      description: 'Student, admission, employee, and receipt numbering.',
      icon: <Hash size={24} />,
      meta: loading ? '-' : summary.idFormats,
      superAdminOnly: true,
    },
    {
      id: 'module-defaults',
      title: 'Module Defaults',
      description: 'Turn default ERP behaviors on or off.',
      icon: <Settings size={24} />,
      meta: loading ? '-' : `${summary.enabledDefaults} on`,
      superAdminOnly: true,
    },
  ];
  const visibleSetupSections = setupSections.filter((section) => !section.superAdminOnly || isSuperAdmin);

  const saveSettings = async () => {
    if (!canManage) {
      toast.error('You do not have permission to manage settings.');
      return;
    }
    const instituteMessage = validateInstituteSettings(institute);
    if (instituteMessage) return toast.error(instituteMessage);
    const yearMessage = validateAcademicYearSettings(academicYear);
    if (yearMessage) return toast.error(yearMessage);
    const updatedAtText = formatDisplayDate();
    const saveOperations = [
        saveSystemSetting('institute', { ...normalizeInstituteSettings(institute), updatedAtText }),
        saveSystemSetting('academicYear', { ...academicYear, updatedAtText }),
    ];
    if (isSuperAdmin) {
      saveOperations.push(
        saveSystemSetting('idFormats', { ...idFormats, updatedAtText }),
        saveSystemSetting('moduleDefaults', { ...moduleDefaults, updatedAtText })
      );
    }
    try {
      await Promise.all(saveOperations);
      window.dispatchEvent(new CustomEvent('institute-settings-updated', {
        detail: normalizeInstituteSettings({ ...institute, updatedAtText }),
      }));
      toast.success('Settings saved');
      setLoadError('');
    } catch (error) {
      console.error('Unable to save Firestore settings.', error);
      setLoadError('Unable to save Firestore settings. Deploy Firestore rules before changing settings.');
      toast.error('Settings were not saved to Firestore.');
    }
  };

  const toggleDefault = (key) => setModuleDefaults((prev) => ({ ...prev, [key]: !prev[key] }));
  const uploadLogo = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Upload an image file for the logo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setInstitute((prev) => ({
        ...prev,
        logoUrl: reader.result,
        logoFileName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };
  const openSection = (sectionId) => {
    setActiveSection(sectionId);
    window.history.pushState({ ...(window.history.state || {}), settingsFlow: { section: sectionId } }, '');
  };
  const goBackOneSettingsStep = () => {
    if (window.history.state?.settingsFlow?.section) {
      window.history.back();
      return;
    }
    setActiveSection('');
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Administration / <span className="text-[#f39a5f]">Settings</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Institute profile, academic year, ID formats, and module defaults.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist settings.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!['academic-setup', 'people-setup'].includes(activeSection) && (
            <button onClick={saveSettings} disabled={!canManage} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2 disabled:bg-slate-300">
              <Save size={16} /> Save Settings
            </button>
          )}
        </div>
      </div>

      {!activeSection && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 py-5">
          {visibleSetupSections.map((section) => (
            <button
              key={section.id}
              onClick={() => !section.disabled && openSection(section.id)}
              disabled={section.disabled}
              className="min-h-40 rounded-lg bg-white border border-slate-100 p-5 text-left shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="h-12 w-12 rounded-lg bg-[#f5f5f6] text-[#fb8d49] flex items-center justify-center">{section.icon}</span>
                <span className="rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-bold text-slate-600">{section.meta}</span>
              </div>
              <h2 className="font-bold text-lg text-slate-900 mt-5">{section.title}</h2>
              <p className="text-sm text-slate-500 mt-2 leading-6">{section.description}</p>
            </button>
          ))}
        </div>
      )}

      {activeSection === 'academic-setup' && (
        <div className="pt-5">
          <div className="mb-5 flex items-center gap-3">
            <button onClick={goBackOneSettingsStep} className="erp-back-button h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2">
              <ArrowLeft size={15} /> Back
            </button>
          </div>
          <AcademicsManagement currentUser={currentUser} academicYear={academicYear.name || '2026-2027'} selectedCourse={selectedCourse} selectedCourseCode={selectedCourseCode} />
        </div>
      )}

      {activeSection === 'people-setup' && (
        <div className="pt-5">
          <div className="mb-5 flex items-center gap-3">
            <button onClick={goBackOneSettingsStep} className="erp-back-button h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2">
              <ArrowLeft size={15} /> Back
            </button>
          </div>
          <UserRoleManagement currentUser={currentUser} />
        </div>
      )}

      {['institute', 'academic-year', 'id-formats', 'module-defaults'].includes(activeSection) && (
      <>
      <div className="pt-5 flex items-center gap-3">
        <button onClick={goBackOneSettingsStep} className="erp-back-button h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2">
          <ArrowLeft size={15} /> Back
        </button>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 py-5">
        {[
          ['Institute', summary.instituteConfigured ? 'Ready' : 'Pending', <Building2 size={22} />],
          ['Academic Year', summary.academicYear, <CalendarDays size={22} />],
          ['ID Formats', summary.idFormats, <Hash size={22} />],
          ['Defaults On', summary.enabledDefaults, <Settings size={22} />],
        ].map(([label, value, icon]) => (
          <div key={label} className="bg-[#f5f5f6] rounded-lg p-4 flex items-center gap-4">
            <div className="h-12 w-12 bg-white rounded-lg flex items-center justify-center text-[#34363d] shadow-sm">{icon}</div>
            <div><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold">{loading ? '...' : value}</div></div>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        {activeSection === 'institute' && (
        <section className="bg-white border border-slate-100 rounded-lg p-5">
          <h3 className="font-bold mb-4">Institute Profile</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 rounded-lg bg-[#f5f5f6] p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="h-20 w-20 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                {institute.logoUrl ? (
                  <img src={institute.logoUrl} alt="" className="h-full w-full object-contain p-2" />
                ) : (
                  <Building2 size={30} className="text-slate-400" />
                )}
              </div>
              <label className="inline-flex h-10 px-4 rounded-lg bg-white border border-slate-200 text-sm font-semibold items-center justify-center gap-2 cursor-pointer w-fit">
                <Upload size={16} /> Upload Logo
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => uploadLogo(event.target.files?.[0])} />
              </label>
              <span className="text-xs text-slate-500">{institute.logoFileName || 'Logo appears in the top-left app shell after saving.'}</span>
            </div>
            {['name', 'instituteId', 'code', 'email', 'phone', 'city'].map((key) => (
              <label key={key}><span className="block text-xs font-semibold text-slate-500 mb-1.5 capitalize">{key}</span><input value={institute[key] || ''} onChange={(event) => setInstitute((prev) => ({ ...prev, [key]: event.target.value }))} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
            ))}
            <label className="sm:col-span-2"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Address</span><input value={institute.address || ''} onChange={(event) => setInstitute((prev) => ({ ...prev, address: event.target.value }))} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
          </div>
        </section>
        )}
        {activeSection === 'academic-year' && (
        <section className="bg-white border border-slate-100 rounded-lg p-5">
          <h3 className="font-bold mb-4">Academic Year</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <label><span className="block text-xs font-semibold text-slate-500 mb-1.5">Name</span><input value={academicYear.name || ''} onChange={(event) => setAcademicYear((prev) => ({ ...prev, name: event.target.value }))} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
            <label><span className="block text-xs font-semibold text-slate-500 mb-1.5">Status</span><select value={academicYear.status || 'Active'} onChange={(event) => setAcademicYear((prev) => ({ ...prev, status: event.target.value }))} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm"><option>Active</option><option>Draft</option><option>Archived</option></select></label>
            <label><span className="block text-xs font-semibold text-slate-500 mb-1.5">Starts On</span><input type="date" value={academicYear.startsOn || ''} onChange={(event) => setAcademicYear((prev) => ({ ...prev, startsOn: event.target.value }))} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
            <label><span className="block text-xs font-semibold text-slate-500 mb-1.5">Ends On</span><input type="date" value={academicYear.endsOn || ''} onChange={(event) => setAcademicYear((prev) => ({ ...prev, endsOn: event.target.value }))} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
          </div>
        </section>
        )}
        {activeSection === 'id-formats' && (
        <section className="bg-white border border-slate-100 rounded-lg p-5">
          <h3 className="font-bold mb-4">ID Formats</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {['student', 'admission', 'employee', 'receipt'].map((key) => (
              <label key={key}><span className="block text-xs font-semibold text-slate-500 mb-1.5 capitalize">{key}</span><input value={idFormats[key] || ''} onChange={(event) => setIdFormats((prev) => ({ ...prev, [key]: event.target.value }))} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" /><span className="text-[11px] text-slate-500">Preview: {buildNextId(idFormats[key] || '', 1)}</span></label>
            ))}
          </div>
        </section>
        )}
        {activeSection === 'module-defaults' && (
        <section className="bg-white border border-slate-100 rounded-lg p-5">
          <h3 className="font-bold mb-4">Module Defaults</h3>
          <div className="space-y-2">
            {Object.entries(moduleDefaults).filter(([key]) => key !== 'id' && key !== 'updatedAtText').map(([key, value]) => (
              <label key={key} className="flex items-center justify-between rounded-lg bg-[#f5f5f6] p-3 text-sm">
                <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                <input type="checkbox" checked={Boolean(value)} onChange={() => toggleDefault(key)} disabled={['onlinePayments', 'receiptGeneration', 'communicationModule'].includes(key)} />
              </label>
            ))}
          </div>
        </section>
        )}
      </div>
      </>
      )}
    </div>
  );
}
