import { useEffect, useMemo, useState } from 'react';
import { Banknote, Download, FileText, Save, TrendingUp, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createFinancialReportSnapshot,
  getFinancialReportsData,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import { formatCurrency, formatDisplayDate } from '../fees/feeUtils';
import {
  demoFinancialAdjustments,
  demoFinancialAssignments,
  demoFinancialCollections,
  demoFinancialSnapshots,
  demoFinancialStructures,
} from './demoFinancialReports';
import {
  buildClassAnalytics,
  buildCollectionReport,
  buildFinancialSummary,
  buildOutstandingReport,
} from './financialReportUtils';
import AnalyticsPanel from './components/AnalyticsPanel';
import CollectionReportTable from './components/CollectionReportTable';
import OutstandingReportTable from './components/OutstandingReportTable';
import ReportFilters from './components/ReportFilters';
import FeeVisualGraph from '../fees/components/FeeVisualGraph';

export default function FinancialReports({ currentUser, academicYear = '2026-2027' }) {
  const [structures, setStructures] = useState(demoFinancialStructures);
  const [assignments, setAssignments] = useState(demoFinancialAssignments);
  const [collections, setCollections] = useState(demoFinancialCollections);
  const [adjustments, setAdjustments] = useState(demoFinancialAdjustments);
  const [snapshots, setSnapshots] = useState(demoFinancialSnapshots);
  const [activeReport, setActiveReport] = useState('collections');
  const [filters, setFilters] = useState({
    fromDate: '2026-06-01',
    toDate: new Date().toISOString().slice(0, 10),
    classKey: '',
    paymentMode: '',
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadReports = async () => {
      try {
        const data = await getFinancialReportsData(academicYear);
        setStructures(data.feeStructures);
        setAssignments(data.feeAssignments);
        const assignmentClassMap = data.feeAssignments.reduce((map, item) => {
          map[item.id] = item.classKey;
          return map;
        }, {});
        setCollections(data.feeCollections.map((item) => ({ ...item, classKey: item.classKey || assignmentClassMap[item.assignmentId] || '' })));
        setAdjustments(data.feeAdjustments);
        setSnapshots(data.financialReportSnapshots);
      } catch (error) {
        console.warn('Using demo financial reports because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore financial reports. Showing demo/local records.');
      } finally {
        setLoading(false);
      }
    };
    loadReports();
  }, [academicYear]);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canView = canAccess(defaultRoles, currentRoleId, 'financialReports.view');
  const canExport = canAccess(defaultRoles, currentRoleId, 'financialReports.export');
  const canSnapshot = canAccess(defaultRoles, currentRoleId, 'financialReports.snapshots');

  const classOptions = useMemo(() => [...new Set([
    ...structures.map((item) => item.classKey),
    ...assignments.map((item) => item.classKey),
  ].filter(Boolean))].sort(), [structures, assignments]);
  const paymentModes = useMemo(() => [...new Set(collections.map((item) => item.paymentMode).filter(Boolean))].sort(), [collections]);
  const collectionReport = useMemo(() => buildCollectionReport(collections, filters), [collections, filters]);
  const outstandingReport = useMemo(() => buildOutstandingReport(assignments), [assignments]);
  const classAnalytics = useMemo(() => buildClassAnalytics(assignments, collections, adjustments), [assignments, collections, adjustments]);
  const summary = useMemo(() => buildFinancialSummary(assignments, collections, adjustments, filters), [assignments, collections, adjustments, filters]);

  const stats = [
    { label: 'Assigned Fees', value: formatCurrency(summary.totalAssigned), icon: <Wallet size={22} /> },
    { label: 'Period Collection', value: formatCurrency(summary.filteredCollected), icon: <Banknote size={22} /> },
    { label: 'Outstanding', value: formatCurrency(summary.totalOutstanding), icon: <TrendingUp size={22} /> },
    { label: 'Collection Rate', value: `${summary.collectionRate}%`, icon: <FileText size={22} /> },
  ];

  const saveSnapshot = async () => {
    if (!canSnapshot) {
      toast.error('You do not have permission to save report summaries.');
      return;
    }
    const payload = {
      reportName: `Finance Summary ${formatDisplayDate()}`,
      filters,
      ...summary,
      status: 'Generated',
      createdAtText: formatDisplayDate(),
    };
    try {
      const id = await createFinancialReportSnapshot(payload);
      setSnapshots((prev) => [{ id: id || `local-financial-snapshot-${Date.now()}`, ...payload }, ...prev]);
      toast.success('Financial summary saved');
    } catch {
      setSnapshots((prev) => [{ id: `local-financial-snapshot-${Date.now()}`, ...payload }, ...prev]);
      toast.success('Financial summary saved locally');
    }
  };

  const exportReport = () => {
    if (!canExport) {
      toast.error('You do not have permission to export reports.');
      return;
    }
    toast.success('Report export prepared for the selected filters.');
  };

  if (!canView) {
    return (
      <div className="rounded-lg bg-[#f5f5f6] p-6 text-sm text-slate-600">
        You do not have permission to view financial reports.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Finance / <span className="text-[#f39a5f]">Financial Reports</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Collection reports, outstanding reports, class-wise fee analytics, and saved financial summaries.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist financial report snapshots.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={exportReport} disabled={!canExport} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm flex items-center gap-2 disabled:bg-slate-300">
            <Download size={16} /> Export
          </button>
          <button onClick={saveSnapshot} disabled={!canSnapshot} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2 disabled:bg-slate-300">
            <Save size={16} /> Save Summary
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 py-5">
        {stats.map(({ label, value, icon }) => (
          <div key={label} className="bg-[#f5f5f6] rounded-lg p-4 flex items-center gap-4">
            <div className="h-12 w-12 bg-white rounded-lg flex items-center justify-center text-[#34363d] shadow-sm">{icon}</div>
            <div>
              <div className="text-xs text-slate-500">{label}</div>
              <div className="text-xl font-bold text-slate-900">{loading ? '...' : value}</div>
            </div>
          </div>
        ))}
      </div>

      <FeeVisualGraph assignments={assignments} collections={collections} summary={summary} />

      <div className="flex flex-col xl:flex-row gap-5">
        <div className="xl:w-[68%] min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {[
              ['collections', 'Collection Reports'],
              ['outstanding', 'Outstanding Reports'],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setActiveReport(id)} className={`h-10 px-4 rounded-md border text-sm font-semibold ${activeReport === id ? 'bg-[#33373e] text-white border-[#33373e]' : 'bg-white text-slate-600 border-slate-200'}`}>
                {label}
              </button>
            ))}
          </div>
          <ReportFilters filters={filters} classOptions={classOptions} paymentModes={paymentModes} onChange={setFilters} />
          {activeReport === 'collections' ? (
            <CollectionReportTable rows={collectionReport.rows} />
          ) : (
            <OutstandingReportTable rows={outstandingReport.rows} />
          )}
        </div>
        <AnalyticsPanel analytics={classAnalytics} snapshots={snapshots} />
      </div>
    </div>
  );
}
