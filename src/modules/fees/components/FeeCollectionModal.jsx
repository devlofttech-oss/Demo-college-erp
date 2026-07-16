import { useMemo, useState } from 'react';
import { CalendarDays, Clock3, Plus, Trash2, X } from 'lucide-react';
import SearchSelect from '../../../components/SearchSelect';
import {
  agentFeeComponentField,
  calculateAssignmentPaymentLedger,
  calculatePendingAgentFeeBalance,
  calculateDueAmount,
  feeComponentFields,
  formatCurrency,
  formatPaymentDate,
  getFeeComponentValues,
  getCollectionsForFeeContext,
  getManualDueItemOptions,
  isAdmissionThroughAgent,
  normalizeManualDueItems,
  normalizePaymentEntries,
  sortPaymentRecordsByDate,
  sumPaymentEntryAgentFees,
  sumPaymentEntries,
  totalFeeComponents,
} from '../feeUtils';

const paymentModeOptions = ['Cash', 'Cheque', 'Bank Transfer', 'UPI Manual Entry', 'Card Swipe Offline'];

function createPaymentEntry(overrides = {}) {
  const now = new Date();
  return {
    rowKey: overrides.rowKey || `payment-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    amount: overrides.amount ?? '',
    paymentMode: overrides.paymentMode || 'Cash',
    creditedToAccount: overrides.creditedToAccount || '',
    referenceNo: overrides.referenceNo || '',
    paymentDate: overrides.paymentDate || now.toISOString().slice(0, 10),
    paymentTime: overrides.paymentTime || now.toTimeString().slice(0, 5),
    agentFeePaidAmount: overrides.agentFeePaidAmount ?? '',
  };
}

function totalFromForm(form = {}) {
  return totalFeeComponents(form);
}

function getInitialFeeValues({ assignment, collection, structure }) {
  if (assignment) return getFeeComponentValues(assignment);
  if (structure) return getFeeComponentValues(structure);
  if (collection?.totalAmount) return getFeeComponentValues(collection);
  return getFeeComponentValues({});
}

function syncAgentDueItem(items = [], admissionThroughAgent = false) {
  const normalized = normalizeManualDueItems(items, { admissionThroughAgent });
  return normalized.filter((item) => item.id !== 'agent-fee');
}

export default function FeeCollectionModal({
  assignments,
  initialAssignmentId = '',
  initialCollection = null,
  onClose,
  onSave,
  collections = [],
  students = [],
  structures = [],
  embedded = false,
}) {
  const initialAssignment = assignments.find((item) => item.id === (initialCollection?.assignmentId || initialAssignmentId));
  const initialStructure = structures.find((item) => item.id === (initialCollection?.feeStructureId || initialAssignment?.feeStructureId));
  const initialStudent = students.find((item) => item.id === (initialCollection?.studentRecordId || initialAssignment?.studentRecordId));
  const initialAdmissionThroughAgent = isAdmissionThroughAgent(initialCollection) || isAdmissionThroughAgent(initialAssignment) || isAdmissionThroughAgent(initialStudent);
  const initialFeeValues = getInitialFeeValues({
    assignment: initialAssignment,
    collection: initialCollection,
    structure: initialStructure,
  });
  const [form, setForm] = useState({
    entryMode: 'structure',
    collectionId: initialCollection?.id || '',
    assignmentId: initialAssignment?.id || '',
    studentRecordId: initialCollection?.studentRecordId || initialAssignment?.studentRecordId || '',
    feeStructureId: initialCollection?.feeStructureId || initialAssignment?.feeStructureId || '',
    ...initialFeeValues,
    admissionThroughAgent: initialAdmissionThroughAgent,
    agentFee: initialAdmissionThroughAgent ? initialFeeValues.agentFee : 0,
    agentFeePaidAmount: initialCollection?.agentFeePaidAmount || 0,
    amount: initialCollection?.amount || '',
    paymentMode: initialCollection?.paymentMode || 'Cash',
    creditedToAccount: initialCollection?.creditedToAccount || '',
    referenceNo: initialCollection?.referenceNo || '',
    paymentDate: initialCollection?.paymentDate || new Date().toISOString().slice(0, 10),
    paymentTime: initialCollection?.paymentTime || new Date().toTimeString().slice(0, 5),
    collectedBy: initialCollection?.collectedBy || 'Admin Office',
    paymentEntries: [createPaymentEntry({
      rowKey: initialCollection?.id || undefined,
      amount: initialCollection?.amount || '',
      paymentMode: initialCollection?.paymentMode || 'Cash',
      creditedToAccount: initialCollection?.creditedToAccount || '',
      referenceNo: initialCollection?.referenceNo || '',
      paymentDate: initialCollection?.paymentDate,
      paymentTime: initialCollection?.paymentTime,
      agentFeePaidAmount: initialCollection?.agentFeePaidAmount || '',
    })],
    manualDueItems: syncAgentDueItem(initialCollection?.manualDueItems || initialAssignment?.manualDueItems || [], initialAdmissionThroughAgent),
  });
  const [activePaymentIndex, setActivePaymentIndex] = useState(0);
  const [paymentStepError, setPaymentStepError] = useState('');

  const selectedStructure = structures.find((item) => item.id === form.feeStructureId);
  const selectedStudent = students.find((item) => item.id === form.studentRecordId);
  const matchingAssignment = assignments.find((item) => (
    item.id === form.assignmentId ||
    (item.studentRecordId === form.studentRecordId && item.feeStructureId === form.feeStructureId)
  ));
  const editedTotal = totalFromForm(form);
  const selectedManualDueItems = normalizeManualDueItems(form.manualDueItems, form);
  const dueItemOptions = getManualDueItemOptions(form);
  const paymentContext = {
    assignmentId: matchingAssignment?.id || form.assignmentId,
    studentRecordId: form.studentRecordId,
    studentId: selectedStudent?.studentId || matchingAssignment?.studentId || initialCollection?.studentId || '',
    studentName: selectedStudent?.name || matchingAssignment?.studentName || initialCollection?.studentName || '',
    feeStructureId: form.feeStructureId,
  };
  const hasFeeContext = Boolean(paymentContext.assignmentId || paymentContext.feeStructureId);
  const paymentHistory = sortPaymentRecordsByDate(
    getCollectionsForFeeContext(collections, paymentContext, '', { allowStudentOnly: true })
  );
  const historyLedger = calculateAssignmentPaymentLedger(
    { ...(matchingAssignment || {}), totalAmount: editedTotal, adjustmentAmount: matchingAssignment?.adjustmentAmount || 0, admissionThroughAgent: form.admissionThroughAgent, agentFee: form.agentFee },
    paymentHistory,
    { useLegacyPaidFallback: !initialCollection }
  );
  const previousPaymentsForLedger = hasFeeContext ? getCollectionsForFeeContext(
    collections,
    paymentContext,
    initialCollection?.id || ''
  ) : [];
  const previousLedger = calculateAssignmentPaymentLedger(
    { ...(matchingAssignment || {}), totalAmount: editedTotal, adjustmentAmount: matchingAssignment?.adjustmentAmount || 0, admissionThroughAgent: form.admissionThroughAgent, agentFee: form.agentFee },
    previousPaymentsForLedger,
    { useLegacyPaidFallback: !initialCollection }
  );
  const paymentEntries = form.paymentEntries?.length ? form.paymentEntries : [createPaymentEntry()];
  const normalizedPaymentEntries = normalizePaymentEntries(paymentEntries, form);
  const paymentEntriesTotal = sumPaymentEntries(normalizedPaymentEntries);
  const safeActivePaymentIndex = Math.min(activePaymentIndex, Math.max(paymentEntries.length - 1, 0));
  const activePaymentEntry = paymentEntries[safeActivePaymentIndex] || paymentEntries[0];
  const paymentEntryRows = paymentEntries.map((entry, index) => ({
    entry,
    index,
    isActive: entry.rowKey === activePaymentEntry?.rowKey,
  }));
  const orderedPaymentEntryRows = [
    ...paymentEntryRows.filter((row) => row.isActive),
    ...paymentEntryRows.filter((row) => !row.isActive),
  ];
  const agentFeePaidInThisPayment = form.admissionThroughAgent ? sumPaymentEntryAgentFees(normalizedPaymentEntries) : 0;
  const agentFeePaidBeforeThisPayment = form.admissionThroughAgent ? previousLedger.agentFeePaid : 0;
  const pendingAgentFeeBefore = form.admissionThroughAgent
    ? calculatePendingAgentFeeBalance(form.agentFee, agentFeePaidBeforeThisPayment)
    : 0;
  const pendingAgentFeeAfter = form.admissionThroughAgent
    ? calculatePendingAgentFeeBalance(form.agentFee, agentFeePaidBeforeThisPayment + agentFeePaidInThisPayment)
    : 0;
  const paidBeforeThisPayment = previousLedger.paidAmount;
  const dueBeforeThisPayment = calculateDueAmount(editedTotal, paidBeforeThisPayment, matchingAssignment?.adjustmentAmount);
  const dueAfterThisPayment = calculateDueAmount(editedTotal, paidBeforeThisPayment + paymentEntriesTotal, matchingAssignment?.adjustmentAmount);

  const studentOptions = useMemo(() => students.map((item) => ({
    value: item.id,
    label: `${item.name} - ${item.studentId || item.admissionNo}`,
  })), [students]);
  const structureOptions = useMemo(() => structures.map((item) => ({
    value: item.id,
    label: `${item.name} - ${item.classKey} - ${formatCurrency(item.totalAmount)}`,
  })), [structures]);

  const applyFeeSource = (nextForm, nextStructureId = nextForm.feeStructureId, nextStudentId = nextForm.studentRecordId) => {
    const nextAssignment = assignments.find((item) => item.studentRecordId === nextStudentId && item.feeStructureId === nextStructureId);
    const nextStructure = structures.find((item) => item.id === nextStructureId);
    const nextStudent = students.find((item) => item.id === nextStudentId);
    const feeValues = getInitialFeeValues({ assignment: nextAssignment, structure: nextStructure });
    const nextAdmissionThroughAgent = isAdmissionThroughAgent(nextAssignment) || isAdmissionThroughAgent(nextStudent);
    return {
      ...nextForm,
      assignmentId: nextAssignment?.id || '',
      ...feeValues,
      admissionThroughAgent: nextAdmissionThroughAgent,
      agentFee: nextAdmissionThroughAgent ? feeValues.agentFee : 0,
      agentFeePaidAmount: 0,
      paymentEntries: (nextForm.paymentEntries || []).map((entry) => ({
        ...entry,
        agentFeePaidAmount: nextAdmissionThroughAgent ? entry.agentFeePaidAmount : 0,
      })),
      manualDueItems: syncAgentDueItem(nextAssignment?.manualDueItems || [], nextAdmissionThroughAgent),
    };
  };

  const updateStudent = (studentRecordId) => {
    setForm((prev) => applyFeeSource({ ...prev, studentRecordId }, prev.feeStructureId, studentRecordId));
  };

  const updateStructure = (feeStructureId) => {
    setForm((prev) => applyFeeSource({ ...prev, feeStructureId }, feeStructureId, prev.studentRecordId));
  };

  const updateFeeComponent = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleManualDueItem = (item) => {
    setForm((prev) => {
      const currentItems = normalizeManualDueItems(prev.manualDueItems);
      const exists = currentItems.some((currentItem) => currentItem.id === item.id);
      return {
        ...prev,
        manualDueItems: exists
          ? currentItems.filter((currentItem) => currentItem.id !== item.id)
          : [...currentItems, item],
      };
    });
  };

  const updatePaymentEntry = (rowKey, key, value) => {
    setPaymentStepError('');
    setForm((prev) => ({
      ...prev,
      paymentEntries: prev.paymentEntries.map((entry) => (
        entry.rowKey === rowKey ? { ...entry, [key]: value } : entry
      )),
    }));
  };

  const validatePaymentStep = (entry) => {
    if (Number(entry?.amount || 0) <= 0) return 'Enter a payment amount before adding the next payment.';
    if (!entry?.paymentMode) return 'Select a payment mode before adding the next payment.';
    if (!entry?.paymentDate) return 'Select a payment date before adding the next payment.';
    return '';
  };

  const addPaymentEntry = () => {
    const entries = form.paymentEntries?.length ? form.paymentEntries : [createPaymentEntry()];
    const currentEntry = entries[Math.min(activePaymentIndex, entries.length - 1)] || entries[0];
    const validationMessage = validatePaymentStep(currentEntry);
    if (validationMessage) {
      setPaymentStepError(validationMessage);
      return;
    }
    if (activePaymentIndex < entries.length - 1) {
      setActivePaymentIndex((index) => index + 1);
      setPaymentStepError('');
      return;
    }
    setForm((prev) => {
      const sourceEntries = prev.paymentEntries?.length ? prev.paymentEntries : [createPaymentEntry()];
      const lastEntry = sourceEntries[Math.min(activePaymentIndex, sourceEntries.length - 1)] || sourceEntries[sourceEntries.length - 1] || {};
      return {
        ...prev,
        paymentEntries: [
          ...sourceEntries,
          createPaymentEntry({
            amount: '',
            paymentMode: lastEntry.paymentMode || 'Cash',
            creditedToAccount: lastEntry.creditedToAccount || '',
            paymentDate: lastEntry.paymentDate,
            paymentTime: lastEntry.paymentTime,
          }),
        ],
      };
    });
    setActivePaymentIndex(entries.length);
    setPaymentStepError('');
  };

  const removePaymentEntry = (rowKey) => {
    const removeIndex = form.paymentEntries.findIndex((entry) => entry.rowKey === rowKey);
    const nextLength = Math.max(form.paymentEntries.length - 1, 1);
    setForm((prev) => ({
      ...prev,
      paymentEntries: prev.paymentEntries.length > 1
        ? prev.paymentEntries.filter((entry) => entry.rowKey !== rowKey)
        : prev.paymentEntries,
    }));
    setActivePaymentIndex((currentIndex) => {
      if (removeIndex === -1) return Math.min(currentIndex, nextLength - 1);
      if (currentIndex > removeIndex) return currentIndex - 1;
      return Math.min(currentIndex, nextLength - 1);
    });
    setPaymentStepError('');
  };

  const submit = (event) => {
    event.preventDefault();
    const normalizedEntries = normalizePaymentEntries(form.paymentEntries, form);
    const firstPayment = normalizedEntries[0] || {};
    onSave({
      ...form,
      amount: sumPaymentEntries(normalizedEntries),
      paymentMode: firstPayment.paymentMode || form.paymentMode,
      creditedToAccount: firstPayment.creditedToAccount || form.creditedToAccount,
      referenceNo: firstPayment.referenceNo || form.referenceNo,
      paymentDate: firstPayment.paymentDate || form.paymentDate,
      paymentTime: firstPayment.paymentTime || form.paymentTime,
      paymentEntries: normalizedEntries,
      totalAmount: editedTotal,
      feeStructureName: selectedStructure?.name || '',
      manualDueItems: syncAgentDueItem(form.manualDueItems, form.admissionThroughAgent),
      admissionThroughAgent: Boolean(form.admissionThroughAgent),
      agentFee: form.admissionThroughAgent ? Number(form.agentFee || 0) : 0,
      agentFeePaidAmount: agentFeePaidInThisPayment,
      pendingAgentFeeBalance: pendingAgentFeeAfter,
    });
  };

  const shellClassName = embedded
    ? 'erp-fee-page-shell w-full'
    : 'erp-fee-modal-overlay fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4';
  const formClassName = embedded
    ? 'erp-fee-modal erp-fee-page w-full overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col'
    : 'erp-fee-modal w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col';
  const bodyClassName = embedded
    ? 'erp-fee-modal-body p-6 grid sm:grid-cols-2 gap-4'
    : 'erp-fee-modal-body p-6 grid sm:grid-cols-2 gap-4 overflow-y-auto';

  return (
    <div className={shellClassName}>
      <form onSubmit={submit} className={formClassName}>
        <div className="erp-fee-modal-header px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{initialCollection ? 'Edit Fee Collection' : 'Record Fee Collection'}</h2>
            <p className="text-sm text-slate-500">Select a student and fee structure, then edit fees if needed.</p>
          </div>
          <button type="button" onClick={onClose} className="erp-fee-close-button h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>
        <div className={bodyClassName}>
          <label className="sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Student</span>
            <SearchSelect
              value={form.studentRecordId}
              onChange={updateStudent}
              options={studentOptions}
              placeholder="Search student..."
            />
          </label>
          <label className="sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Fee Structure</span>
            <SearchSelect
              value={form.feeStructureId}
              onChange={updateStructure}
              options={structureOptions}
              placeholder="Search fee structure..."
            />
          </label>
          <label className="erp-agent-toggle sm:col-span-2 min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(form.admissionThroughAgent)}
              onChange={(event) => setForm((prev) => ({
                ...prev,
                admissionThroughAgent: event.target.checked,
                agentFee: event.target.checked ? prev.agentFee : 0,
                agentFeePaidAmount: event.target.checked ? prev.agentFeePaidAmount : 0,
                paymentEntries: prev.paymentEntries.map((entry) => ({
                  ...entry,
                  agentFeePaidAmount: event.target.checked ? entry.agentFeePaidAmount : 0,
                })),
                manualDueItems: syncAgentDueItem(prev.manualDueItems, event.target.checked),
              }))}
              className="h-4 w-4 rounded border-slate-300 accent-[#026c36]"
            />
            <span>Admission through agent{selectedStudent?.name ? ` - ${selectedStudent.name}` : ''}</span>
          </label>

          {selectedStructure && (
            <div className="erp-fee-selected-structure sm:col-span-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase text-emerald-700">Selected Structure</div>
                  <div className="font-bold text-slate-900">{selectedStructure.name}</div>
                  <div className="text-xs text-slate-500">{selectedStructure.classKey} | {selectedStructure.academicYear}</div>
                </div>
                <div className="text-sm font-bold text-slate-900">{formatCurrency(selectedStructure.totalAmount)}</div>
              </div>
            </div>
          )}

          <div className="erp-fee-component-grid sm:col-span-2 grid sm:grid-cols-2 md:grid-cols-3 gap-3 rounded-lg border border-slate-100 bg-[#f5f5f6] p-4">
            {feeComponentFields.map(({ label, key }) => (
              <label key={key} className="erp-fee-field">
                <span className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</span>
                <input
                  type="number"
                  min="0"
                  value={form[key]}
                  onChange={(event) => updateFeeComponent(key, event.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                />
              </label>
            ))}
            <div className="erp-fee-total-card rounded-lg bg-white p-3">
              <div className="text-xs font-semibold text-slate-500">Edited Total</div>
              <div className="text-lg font-extrabold text-slate-900">{formatCurrency(editedTotal)}</div>
            </div>
          </div>

          {form.admissionThroughAgent && (
            <div className="erp-agent-fee-panel sm:col-span-2 grid sm:grid-cols-2 gap-3 rounded-lg border border-cyan-100 bg-cyan-50/70 p-4">
              <label className="erp-fee-field">
                <span className="block text-xs font-semibold text-cyan-700 mb-1.5">Agent Fee (College Payout)</span>
                <input
                  type="number"
                  min="0"
                  value={form.agentFee}
                  onChange={(event) => updateFeeComponent(agentFeeComponentField.key, event.target.value)}
                  placeholder="Enter agent fee"
                  className="w-full h-10 rounded-lg border border-cyan-100 bg-white px-3 text-sm"
                />
              </label>
              <div className="erp-agent-balance-card rounded-lg bg-white p-3">
                <div className="text-xs font-semibold text-cyan-700">Pending Agent Payout Balance</div>
                <div className="text-lg font-extrabold text-slate-900">{formatCurrency(pendingAgentFeeAfter)}</div>
                <div className="text-[11px] font-semibold text-slate-500">Before payment: {formatCurrency(pendingAgentFeeBefore)}</div>
              </div>
            </div>
          )}

          <div className="sm:col-span-2 grid sm:grid-cols-3 gap-3 text-sm">
            <div className="erp-fee-summary-card rounded-lg bg-[#f5f5f6] p-3">
              <div className="text-xs font-semibold text-slate-500">Paid Before</div>
              <div className="font-bold text-slate-900">{formatCurrency(paidBeforeThisPayment)}</div>
            </div>
            <div className="erp-fee-summary-card rounded-lg bg-[#f5f5f6] p-3">
              <div className="text-xs font-semibold text-slate-500">Due Before</div>
              <div className="font-bold text-rose-700">{formatCurrency(dueBeforeThisPayment)}</div>
            </div>
            <div className="erp-fee-summary-card rounded-lg bg-[#f5f5f6] p-3">
              <div className="text-xs font-semibold text-slate-500">Due After</div>
              <div className="font-bold text-emerald-700">{formatCurrency(dueAfterThisPayment)}</div>
            </div>
          </div>

          <div className="erp-due-picker sm:col-span-2 rounded-lg border border-amber-100 bg-amber-50/60 p-4">
            <div className="erp-due-picker-title text-xs font-bold uppercase text-amber-700 mb-3">Pending Due Items</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {dueItemOptions.map((item) => {
                const checked = selectedManualDueItems.some((currentItem) => currentItem.id === item.id);
                return (
                  <label key={item.id} className={`erp-due-chip min-h-10 rounded-lg bg-white border border-amber-100 px-3 py-2 text-xs font-semibold text-slate-700 flex items-center gap-2 ${checked ? 'is-selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleManualDueItem(item)}
                      className="h-4 w-4 rounded border-slate-300 accent-[#026c36]"
                    />
                    <span>{item.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="erp-payment-history sm:col-span-2 rounded-lg border border-slate-100 bg-white p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-3">
              <div>
                <div className="text-xs font-bold uppercase text-slate-500">Payment History</div>
                <div className="text-sm font-bold text-slate-900">{formatCurrency(historyLedger.paidAmount)} paid across {historyLedger.paymentCount} payment{historyLedger.paymentCount === 1 ? '' : 's'}</div>
              </div>
              <div className="text-xs font-semibold text-rose-700">{hasFeeContext ? `Current due: ${formatCurrency(historyLedger.dueAmount)}` : 'Select fee structure to calculate due'}</div>
            </div>
            {paymentHistory.length ? (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-100">
                <table className="w-full text-xs">
                  <thead className="bg-[#f5f5f6] text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">No.</th>
                      <th className="px-3 py-2 text-left font-semibold">Date & Time</th>
                      <th className="px-3 py-2 text-left font-semibold">Mode</th>
                      <th className="px-3 py-2 text-left font-semibold">Credited To</th>
                      <th className="px-3 py-2 text-left font-semibold">Reference</th>
                      <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paymentHistory.map((payment, index) => (
                      <tr key={payment.id || `${payment.paymentDate}-${payment.amount}`}>
                        <td className="px-3 py-2 font-bold text-slate-500">
                          {payment.installmentNo ? `${payment.installmentNo}/${payment.installmentCount || payment.installmentNo}` : index + 1}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{formatPaymentDate(payment.paymentDate || payment.createdAtText)} {payment.paymentTime || ''}</td>
                        <td className="px-3 py-2 text-slate-600">{payment.paymentMode || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{payment.creditedToAccount || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{payment.referenceNo || '-'}</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatCurrency(payment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg bg-[#f5f5f6] p-3 text-sm text-slate-500">No payment history for this fee assignment yet.</div>
            )}
          </div>

          <div className="erp-payment-entry-panel sm:col-span-2 rounded-lg border border-slate-100 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
              <div>
                <div className="text-xs font-bold uppercase text-slate-500">Payments to Post</div>
                <div className="text-sm font-bold text-slate-900">{formatCurrency(paymentEntriesTotal)} across {paymentEntries.length} payment{paymentEntries.length === 1 ? '' : 's'}</div>
              </div>
              <div className="text-xs font-semibold text-emerald-700">Due after: {formatCurrency(dueAfterThisPayment)}</div>
            </div>

            <div className="space-y-3">
              {orderedPaymentEntryRows.map(({ entry, index, isActive }) => {
                if (!isActive) {
                  return (
                    <div key={entry.rowKey} className="erp-payment-step-summary rounded-lg border border-slate-200 bg-[#f8fafc] p-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePaymentIndex(index);
                          setPaymentStepError('');
                        }}
                        className="min-w-0 flex-1 text-left flex items-center gap-3"
                      >
                        <div className="erp-payment-entry-number h-7 w-7 rounded-full bg-[#026c36] text-white text-xs font-extrabold flex items-center justify-center shrink-0">{index + 1}</div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900">Payment {index + 1}</div>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
                            <span>{formatCurrency(entry.amount)}</span>
                            <span>{entry.paymentMode || '-'}</span>
                            <span>{formatPaymentDate(entry.paymentDate)} {entry.paymentTime || ''}</span>
                            {entry.creditedToAccount && <span>{entry.creditedToAccount}</span>}
                            {entry.referenceNo && <span>Ref: {entry.referenceNo}</span>}
                          </div>
                        </div>
                      </button>
                      {!initialCollection && paymentEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePaymentEntry(entry.rowKey)}
                          className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-700 inline-flex items-center justify-center shrink-0"
                          aria-label={`Remove payment ${index + 1}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={entry.rowKey} className="erp-payment-entry-card rounded-lg border border-dashed border-slate-300 bg-[#f8fafc] p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="erp-payment-entry-number h-7 w-7 rounded-full bg-[#026c36] text-white text-xs font-extrabold flex items-center justify-center">{index + 1}</div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">Payment {index + 1}</div>
                          <div className="text-xs font-semibold text-slate-500">{formatCurrency(entry.amount)}</div>
                        </div>
                      </div>
                      {!initialCollection && paymentEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePaymentEntry(entry.rowKey)}
                          className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-700 inline-flex items-center justify-center"
                          aria-label={`Remove payment ${index + 1}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <label>
                        <span className="block text-xs font-semibold text-slate-500 mb-1.5">Payment Amount</span>
                        <input
                          type="number"
                          min="0"
                          value={entry.amount}
                          onChange={(event) => updatePaymentEntry(entry.rowKey, 'amount', event.target.value)}
                          placeholder={dueBeforeThisPayment || 0}
                          className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm"
                        />
                      </label>
                      <label>
                        <span className="block text-xs font-semibold text-slate-500 mb-1.5">Payment Mode</span>
                        <select
                          value={entry.paymentMode}
                          onChange={(event) => updatePaymentEntry(entry.rowKey, 'paymentMode', event.target.value)}
                          className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm"
                        >
                          {paymentModeOptions.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </label>
                      <label>
                        <span className="block text-xs font-semibold text-slate-500 mb-1.5">Credited To Account</span>
                        <input
                          value={entry.creditedToAccount || ''}
                          onChange={(event) => updatePaymentEntry(entry.rowKey, 'creditedToAccount', event.target.value)}
                          className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm"
                        />
                      </label>
                      {form.admissionThroughAgent && (
                        <label>
                          <span className="block text-xs font-semibold text-slate-500 mb-1.5">Agent Payout Paid</span>
                          <input
                            type="number"
                            min="0"
                            max={pendingAgentFeeBefore}
                            value={entry.agentFeePaidAmount}
                            onChange={(event) => updatePaymentEntry(entry.rowKey, 'agentFeePaidAmount', event.target.value)}
                            className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </label>
                      )}
                      <label>
                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 mb-1.5"><CalendarDays size={13} /> Payment Date</span>
                        <input
                          type="date"
                          value={entry.paymentDate}
                          onChange={(event) => updatePaymentEntry(entry.rowKey, 'paymentDate', event.target.value)}
                          className="erp-payment-date-input w-full h-11 rounded-lg border border-slate-200 px-3 text-sm"
                        />
                      </label>
                      <label>
                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 mb-1.5"><Clock3 size={13} /> Payment Time</span>
                        <input
                          type="time"
                          value={entry.paymentTime}
                          onChange={(event) => updatePaymentEntry(entry.rowKey, 'paymentTime', event.target.value)}
                          className="erp-payment-time-input w-full h-11 rounded-lg border border-slate-200 px-3 text-sm"
                        />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="block text-xs font-semibold text-slate-500 mb-1.5">Reference No.</span>
                        <input
                          value={entry.referenceNo}
                          onChange={(event) => updatePaymentEntry(entry.rowKey, 'referenceNo', event.target.value)}
                          className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            {paymentStepError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {paymentStepError}
              </div>
            )}

            {!initialCollection && (
              <button
                type="button"
                onClick={addPaymentEntry}
                className="erp-add-payment-box mt-3 w-full min-h-12 rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50/70 text-emerald-800 text-sm font-extrabold flex items-center justify-center gap-2"
              >
                <Plus size={16} /> {safeActivePaymentIndex < paymentEntries.length - 1 ? 'Save & Proceed' : 'Save & Add Next Payment'}
              </button>
            )}
          </div>
        </div>
        <div className="erp-fee-modal-footer px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">Cancel</button>
          <button type="submit" className="h-10 px-5 rounded-lg bg-[#033500] text-white font-bold text-sm shadow-[0_10px_22px_rgba(3,53,0,0.25)]">
            {initialCollection ? 'Save Changes' : 'Post Collection'}
          </button>
        </div>
      </form>
    </div>
  );
}
