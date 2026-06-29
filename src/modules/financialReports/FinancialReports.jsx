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
import { filterByCourse, filterStudentScopedRecords } from '../shared/courseFilters';
import { getStudentClassKey } from '../fees/feeUtils';

const defaultPaymentModes = ['Cash', 'Cheque', 'Bank Transfer', 'UPI Manual Entry', 'Card Swipe Offline'];

function csvValue(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows = []) {
  const csv = rows.map((row) => row.map(csvValue).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function pdfSafe(value) {
  return String(value ?? '')
    .replace(/₹/g, 'Rs ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function textCommand(text, x, y, size = 10) {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${pdfSafe(text)}) Tj ET`;
}

function rectCommand(x, y, width, height, color = '0.96 0.60 0.36') {
  return `${color} rg ${x} ${y} ${width} ${height} re f`;
}

function buildPdf(pages = []) {
  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };
  addObject('<< /Type /Catalog /Pages 2 0 R >>');
  addObject('');
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds = [];
  pages.forEach((content) => {
    const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((content, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${content}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function downloadPdf(filename, {
  activeReport,
  analytics,
  collectionRows,
  filters,
  outstandingRows,
  selectedCourseCode,
  summary,
}) {
  const pages = [];
  const activeRows = activeReport === 'collections' ? collectionRows : outstandingRows;
  const makePage = (rows, pageIndex) => {
    const content = [];
    let y = 758;
    if (pageIndex === 0) {
      content.push(textCommand('Financial Report', 40, y, 18));
      y -= 18;
      content.push(textCommand(`Course: ${selectedCourseCode === 'all' ? 'All Courses' : selectedCourseCode} | ${filters.fromDate} to ${filters.toDate}`, 40, y, 9));
      y -= 30;
      [
        ['Assigned Fees', formatCurrency(summary.totalAssigned)],
        ['Period Collection', formatCurrency(summary.filteredCollected)],
        ['Outstanding', formatCurrency(summary.totalOutstanding)],
        ['Collection Rate', `${summary.collectionRate}%`],
      ].forEach(([label, value], index) => {
        const x = 40 + (index % 2) * 260;
        const rowY = y - Math.floor(index / 2) * 44;
        content.push(rectCommand(x, rowY - 20, 230, 32, '0.96 0.97 0.98'));
        content.push(textCommand(label, x + 10, rowY, 8));
        content.push(textCommand(value, x + 10, rowY - 14, 12));
      });
      y -= 104;
      content.push(textCommand('Class Analytics', 40, y, 13));
      y -= 20;
      analytics.slice(0, 6).forEach((item) => {
        content.push(textCommand(`${item.classKey} (${item.collectionRate}%)`, 40, y, 9));
        content.push(rectCommand(210, y - 4, 220, 7, '0.90 0.93 0.96'));
        content.push(rectCommand(210, y - 4, Math.max(4, Math.round((item.collectionRate / 100) * 220)), 7, '0.96 0.60 0.36'));
        content.push(textCommand(`Collected ${formatCurrency(item.collected)} | Due ${formatCurrency(item.outstanding)}`, 440, y, 8));
        y -= 18;
      });
      y -= 12;
      content.push(textCommand(activeReport === 'collections' ? 'Collection Report' : 'Outstanding Report', 40, y, 13));
      y -= 18;
    } else {
      content.push(textCommand(`Financial Report continued (${pageIndex + 1})`, 40, y, 14));
      y -= 26;
    }

    const headers = activeReport === 'collections'
      ? ['Student', 'Class', 'Date', 'Mode', 'Amount']
      : ['Student', 'Class', 'Due Date', 'Aging', 'Outstanding'];
    const widths = [145, 105, 78, 86, 92];
    let x = 40;
    headers.forEach((header, index) => {
      content.push(textCommand(header, x, y, 8));
      x += widths[index];
    });
    y -= 12;

    rows.forEach((item) => {
      const values = activeReport === 'collections'
        ? [item.studentName, item.classKey || '-', item.paymentDate || '-', item.paymentMode || '-', formatCurrency(item.amount)]
        : [item.studentName, item.classKey || '-', item.dueDate || '-', item.dueBucket || '-', formatCurrency(item.dueAmount)];
      let rowX = 40;
      values.forEach((value, index) => {
        content.push(textCommand(String(value).slice(0, index === 0 ? 22 : 14), rowX, y, 8));
        rowX += widths[index];
      });
      y -= 13;
    });
    return content.join('\n');
  };

  const firstPageRows = activeRows.slice(0, 28);
  pages.push(makePage(firstPageRows, 0));
  for (let index = 28; index < activeRows.length; index += 45) {
    pages.push(makePage(activeRows.slice(index, index + 45), pages.length));
  }
  const blob = new Blob([buildPdf(pages)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function FinancialReports({ currentUser, academicYear = '2026-2027', scopedStudents = [], selectedCourse = null, selectedCourseCode = 'all' }) {
  const [structures, setStructures] = useState(isFirebaseConfigured ? [] : demoFinancialStructures);
  const [assignments, setAssignments] = useState(isFirebaseConfigured ? [] : demoFinancialAssignments);
  const [collections, setCollections] = useState(isFirebaseConfigured ? [] : demoFinancialCollections);
  const [adjustments, setAdjustments] = useState(isFirebaseConfigured ? [] : demoFinancialAdjustments);
  const [snapshots, setSnapshots] = useState(isFirebaseConfigured ? [] : demoFinancialSnapshots);
  const [activeReport, setActiveReport] = useState('collections');
  const [exportFormat, setExportFormat] = useState('pdf');
  const [filters, setFilters] = useState({
    fromDate: '2026-06-01',
    toDate: new Date().toISOString().slice(0, 10),
    classKey: '',
    paymentMode: '',
  });
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadReports = async () => {
      if (!isFirebaseConfigured) return;
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
  const courseStructures = useMemo(() => filterByCourse(structures, selectedCourseCode, selectedCourse), [selectedCourse, selectedCourseCode, structures]);
  const courseAssignments = useMemo(() => filterStudentScopedRecords(assignments, scopedStudents, selectedCourseCode, selectedCourse), [assignments, scopedStudents, selectedCourse, selectedCourseCode]);
  const courseAssignmentIds = useMemo(() => new Set(courseAssignments.map((item) => item.id).filter(Boolean)), [courseAssignments]);
  const courseCollections = useMemo(() => filterStudentScopedRecords(collections, scopedStudents, selectedCourseCode, selectedCourse)
    .filter((item) => selectedCourseCode === 'all' || !item.assignmentId || courseAssignmentIds.has(item.assignmentId)), [collections, courseAssignmentIds, scopedStudents, selectedCourse, selectedCourseCode]);
  const courseAdjustments = useMemo(() => filterStudentScopedRecords(adjustments, scopedStudents, selectedCourseCode, selectedCourse)
    .filter((item) => selectedCourseCode === 'all' || !item.assignmentId || courseAssignmentIds.has(item.assignmentId)), [adjustments, courseAssignmentIds, scopedStudents, selectedCourse, selectedCourseCode]);

  const classOptions = useMemo(() => [...new Set([
    ...courseStructures.map((item) => item.classKey),
    ...courseAssignments.map((item) => item.classKey),
    ...scopedStudents.map((student) => getStudentClassKey(student)),
  ].filter(Boolean))].sort(), [courseStructures, courseAssignments, scopedStudents]);
  const paymentModes = useMemo(() => [...new Set([
    ...defaultPaymentModes,
    ...courseCollections.map((item) => item.paymentMode).filter(Boolean),
  ])].sort(), [courseCollections]);
  const collectionReport = useMemo(() => buildCollectionReport(courseCollections, filters), [courseCollections, filters]);
  const outstandingReport = useMemo(() => buildOutstandingReport(courseAssignments), [courseAssignments]);
  const classAnalytics = useMemo(() => buildClassAnalytics(courseAssignments, courseCollections, courseAdjustments), [courseAdjustments, courseAssignments, courseCollections]);
  const summary = useMemo(() => buildFinancialSummary(courseAssignments, courseCollections, courseAdjustments, filters), [courseAdjustments, courseAssignments, courseCollections, filters]);

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
      setSnapshots((prev) => [{ id: id || `local-financial-snapshot-${Date.now()}`, ...payload, courseCode: selectedCourseCode }, ...prev]);
      toast.success('Financial summary saved');
    } catch {
      setSnapshots((prev) => [{ id: `local-financial-snapshot-${Date.now()}`, ...payload, courseCode: selectedCourseCode }, ...prev]);
      toast.success('Financial summary saved locally');
    }
  };

  const exportCsvReport = () => {
    if (!canExport) {
      toast.error('You do not have permission to export reports.');
      return;
    }
    const timestamp = new Date().toISOString().slice(0, 10);
    const courseLabel = selectedCourseCode === 'all' ? 'all-courses' : selectedCourseCode.toLowerCase();

    if (activeReport === 'collections') {
      downloadCsv(`financial-collections-${courseLabel}-${timestamp}.csv`, [
        ['Student', 'Student ID', 'Class', 'Date', 'Mode', 'Reference', 'Amount'],
        ...collectionReport.rows.map((item) => [
          item.studentName,
          item.studentId,
          item.classKey || '-',
          item.paymentDate || '-',
          item.paymentMode || '-',
          item.referenceNo || '-',
          item.amount || 0,
        ]),
      ]);
      toast.success('Collection report exported');
      return;
    }

    downloadCsv(`financial-outstanding-${courseLabel}-${timestamp}.csv`, [
      ['Student', 'Student ID', 'Class', 'Due Date', 'Aging', 'Assigned', 'Paid', 'Outstanding'],
      ...outstandingReport.rows.map((item) => [
        item.studentName,
        item.studentId,
        item.classKey || '-',
        item.dueDate || '-',
        item.dueBucket || '-',
        item.totalAmount || 0,
        item.paidAmount || 0,
        item.dueAmount || 0,
      ]),
    ]);
    toast.success('Outstanding report exported');
  };

  const exportPdfReport = () => {
    if (!canExport) {
      toast.error('You do not have permission to export reports.');
      return;
    }
    const timestamp = new Date().toISOString().slice(0, 10);
    const courseLabel = selectedCourseCode === 'all' ? 'all-courses' : selectedCourseCode.toLowerCase();
    downloadPdf(`financial-${activeReport}-${courseLabel}-${timestamp}.pdf`, {
      activeReport,
      analytics: classAnalytics,
      collectionRows: collectionReport.rows,
      filters,
      outstandingRows: outstandingReport.rows,
      selectedCourseCode,
      summary,
    });
    toast.success('PDF report exported');
  };

  const exportReport = () => {
    if (exportFormat === 'csv') exportCsvReport();
    else exportPdfReport();
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
          <select
            value={exportFormat}
            onChange={(event) => setExportFormat(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
            title="Export format"
          >
            <option value="pdf">PDF with graph</option>
            <option value="csv">CSV</option>
          </select>
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

      <FeeVisualGraph assignments={courseAssignments} collections={courseCollections} summary={summary} />

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
