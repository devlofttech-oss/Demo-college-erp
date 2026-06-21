import { useEffect, useState } from 'react';
import { Building2, CalendarDays, Hash, Save, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSettingsData, saveSystemSetting } from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import { demoAcademicYearSettings, demoIdFormatSettings, demoInstituteSettings, demoModuleDefaultSettings } from './demoSettings';
import { buildNextId, formatDisplayDate, summarizeSettings, validateAcademicYearSettings, validateInstituteSettings } from './settingsUtils';

export default function SettingsManagement({ currentUser }) {
  const [institute, setInstitute] = useState(demoInstituteSettings);
  const [academicYear, setAcademicYear] = useState(demoAcademicYearSettings);
  const [idFormats, setIdFormats] = useState(demoIdFormatSettings);
  const [moduleDefaults, setModuleDefaults] = useState(demoModuleDefaultSettings);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getSettingsData();
        if (data.institute) setInstitute(data.institute);
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
  const canManage = canAccess(defaultRoles, currentRoleId, 'settings.manage');
  const summary = summarizeSettings(institute, academicYear, idFormats, moduleDefaults);

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
    try {
      await Promise.all([
        saveSystemSetting('institute', { ...institute, updatedAtText }),
        saveSystemSetting('academicYear', { ...academicYear, updatedAtText }),
        saveSystemSetting('idFormats', { ...idFormats, updatedAtText }),
        saveSystemSetting('moduleDefaults', { ...moduleDefaults, updatedAtText }),
      ]);
      toast.success('Settings saved');
      setLoadError('');
    } catch (error) {
      console.error('Unable to save Firestore settings.', error);
      setLoadError('Unable to save Firestore settings. Deploy Firestore rules before changing settings.');
      toast.error('Settings were not saved to Firestore.');
    }
  };

  const toggleDefault = (key) => setModuleDefaults((prev) => ({ ...prev, [key]: !prev[key] }));

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
        <button onClick={saveSettings} disabled={!canManage} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2 disabled:bg-slate-300">
          <Save size={16} /> Save Settings
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
        <section className="bg-white border border-slate-100 rounded-lg p-5">
          <h3 className="font-bold mb-4">Institute Profile</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {['name', 'instituteId', 'code', 'email', 'phone', 'city'].map((key) => (
              <label key={key}><span className="block text-xs font-semibold text-slate-500 mb-1.5 capitalize">{key}</span><input value={institute[key] || ''} onChange={(event) => setInstitute((prev) => ({ ...prev, [key]: event.target.value }))} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
            ))}
            <label className="sm:col-span-2"><span className="block text-xs font-semibold text-slate-500 mb-1.5">Address</span><input value={institute.address || ''} onChange={(event) => setInstitute((prev) => ({ ...prev, address: event.target.value }))} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
          </div>
        </section>
        <section className="bg-white border border-slate-100 rounded-lg p-5">
          <h3 className="font-bold mb-4">Academic Year</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <label><span className="block text-xs font-semibold text-slate-500 mb-1.5">Name</span><input value={academicYear.name || ''} onChange={(event) => setAcademicYear((prev) => ({ ...prev, name: event.target.value }))} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
            <label><span className="block text-xs font-semibold text-slate-500 mb-1.5">Status</span><select value={academicYear.status || 'Active'} onChange={(event) => setAcademicYear((prev) => ({ ...prev, status: event.target.value }))} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm"><option>Active</option><option>Draft</option><option>Archived</option></select></label>
            <label><span className="block text-xs font-semibold text-slate-500 mb-1.5">Starts On</span><input type="date" value={academicYear.startsOn || ''} onChange={(event) => setAcademicYear((prev) => ({ ...prev, startsOn: event.target.value }))} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
            <label><span className="block text-xs font-semibold text-slate-500 mb-1.5">Ends On</span><input type="date" value={academicYear.endsOn || ''} onChange={(event) => setAcademicYear((prev) => ({ ...prev, endsOn: event.target.value }))} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
          </div>
        </section>
        <section className="bg-white border border-slate-100 rounded-lg p-5">
          <h3 className="font-bold mb-4">ID Formats</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {['student', 'admission', 'employee', 'receipt'].map((key) => (
              <label key={key}><span className="block text-xs font-semibold text-slate-500 mb-1.5 capitalize">{key}</span><input value={idFormats[key] || ''} onChange={(event) => setIdFormats((prev) => ({ ...prev, [key]: event.target.value }))} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" /><span className="text-[11px] text-slate-500">Preview: {buildNextId(idFormats[key] || '', 1)}</span></label>
            ))}
          </div>
        </section>
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
      </div>
    </div>
  );
}
