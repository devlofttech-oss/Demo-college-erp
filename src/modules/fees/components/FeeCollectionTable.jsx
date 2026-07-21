import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, Edit3 } from 'lucide-react';
import { formatCurrency, formatManualDueItems, formatPaymentDate, sortPaymentRecordsByDate } from '../feeUtils';

function getStudentCollectionKey(item = {}) {
  return item.studentRecordId || item.studentId || item.studentName || item.id;
}

function joinUnique(values = []) {
  const uniqueValues = [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
  return uniqueValues.length ? uniqueValues.join(', ') : '-';
}

function getStudentInitials(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'ST';
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function buildStudentCollectionGroups(collections = []) {
  const groups = collections.reduce((map, item) => {
    const key = getStudentCollectionKey(item);
    if (!map.has(key)) {
      map.set(key, {
        key,
        studentName: item.studentName || 'Unknown Student',
        studentId: item.studentId || '',
        classKeys: [],
        feeStructureNames: [],
        feeStructureIds: [],
        payments: [],
        totalAmount: 0,
      });
    }
    const group = map.get(key);
    group.studentName = group.studentName || item.studentName || 'Unknown Student';
    group.studentId = group.studentId || item.studentId || '';
    group.classKeys.push(item.classKey);
    group.feeStructureNames.push(item.feeStructureName);
    group.feeStructureIds.push(item.feeStructureId);
    group.payments.push(item);
    group.totalAmount += Number(item.amount || 0);
    return map;
  }, new Map());

  return Array.from(groups.values()).map((group) => {
    const payments = sortPaymentRecordsByDate(group.payments);
    const latestPayment = payments[0] || {};
    return {
      ...group,
      classLabel: joinUnique(group.classKeys),
      feeStructureLabel: joinUnique(group.feeStructureNames) !== '-'
        ? joinUnique(group.feeStructureNames)
        : joinUnique(group.feeStructureIds),
      latestPayment,
      payments,
    };
  });
}

export default function FeeCollectionTable({ collections, onEdit }) {
  const groupedCollections = useMemo(() => buildStudentCollectionGroups(collections), [collections]);
  const [expandedStudentKey, setExpandedStudentKey] = useState('');

  const toggleStudent = (studentKey) => {
    setExpandedStudentKey((currentKey) => (currentKey === studentKey ? '' : studentKey));
  };

  const handleStudentRowKeyDown = (event, studentKey) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleStudent(studentKey);
  };

  const handleStudentToggleClick = (event, studentKey) => {
    event.stopPropagation();
    toggleStudent(studentKey);
  };

  return (
    <div className="erp-fee-collection-table overflow-hidden border border-slate-100 rounded-lg bg-white">
      <div className="overflow-x-auto">
        <table className="erp-fee-collection-grid w-full text-sm">
          <thead className="erp-fee-collection-head bg-[#f5f5f6] text-slate-500">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Student</th>
              <th className="text-left px-4 py-3 font-semibold">Class</th>
              <th className="text-left px-4 py-3 font-semibold">Fee Structure</th>
              <th className="text-left px-4 py-3 font-semibold">Latest Payment</th>
              <th className="text-right px-4 py-3 font-semibold">Payments</th>
              <th className="text-right px-4 py-3 font-semibold">Total Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groupedCollections.map((group) => {
              const expanded = expandedStudentKey === group.key;
              return (
                <Fragment key={group.key}>
                  <tr
                    className={`erp-fee-collection-student-row ${expanded ? 'is-expanded' : ''}`}
                    onClick={() => toggleStudent(group.key)}
                    onKeyDown={(event) => handleStudentRowKeyDown(event, group.key)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Hide' : 'Show'} payments for ${group.studentName}`}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(event) => handleStudentToggleClick(event, group.key)}
                        className="erp-fee-student-toggle text-left inline-flex min-w-0 items-center gap-2 rounded-md text-slate-900"
                        aria-expanded={expanded}
                      >
                        <ChevronDown className={`erp-fee-student-chevron shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} size={16} />
                        <span className="erp-fee-student-avatar" aria-hidden="true">{getStudentInitials(group.studentName)}</span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-slate-900">{group.studentName}</span>
                          <span className="block text-xs text-slate-500">{group.studentId || '-'}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{group.classLabel}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="font-semibold text-slate-800">{group.feeStructureLabel}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{formatPaymentDate(group.latestPayment.paymentDate || group.latestPayment.createdAtText)}</div>
                      <div className="text-xs text-slate-500">{group.latestPayment.paymentMode || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      <button
                        type="button"
                        onClick={(event) => handleStudentToggleClick(event, group.key)}
                        className="erp-fee-payment-pill h-8 px-3 rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1"
                      >
                        {group.payments.length} payment{group.payments.length === 1 ? '' : 's'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="erp-fee-collection-amount font-bold text-emerald-700">{formatCurrency(group.totalAmount)}</div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr key={`${group.key}-payments`} className="erp-fee-payment-detail-row">
                      <td colSpan="6" className="erp-fee-payment-detail-cell bg-[#f8fafc] px-4 py-3">
                        <div className="erp-fee-payment-detail-panel overflow-x-auto rounded-lg border border-slate-100 bg-white">
                          <table className="erp-fee-payment-detail-table w-full text-xs">
                            <thead className="erp-fee-payment-detail-head bg-[#f5f5f6] text-slate-500">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold">No.</th>
                                <th className="px-3 py-2 text-left font-semibold">Date</th>
                                <th className="px-3 py-2 text-left font-semibold">Mode</th>
                                <th className="px-3 py-2 text-left font-semibold">Credited To</th>
                                <th className="px-3 py-2 text-left font-semibold">Reference</th>
                                <th className="px-3 py-2 text-left font-semibold">Paid Items</th>
                                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                                <th className="px-3 py-2 text-right font-semibold">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {group.payments.map((item) => (
                                <tr key={item.id} className="erp-fee-payment-detail-item hover:bg-slate-50">
                                  <td className="px-3 py-2 text-slate-600">
                                    <div className="font-bold text-slate-800">
                                      {item.installmentNo ? `${item.installmentNo}/${item.installmentCount || item.installmentNo}` : '-'}
                                    </div>
                                    {item.batchPaymentId && <div className="text-[11px] text-slate-500">Batch</div>}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">{formatPaymentDate(item.paymentDate || item.createdAtText)}</td>
                                  <td className="px-3 py-2 text-slate-600">{item.paymentMode || '-'}</td>
                                  <td className="px-3 py-2 text-slate-600">{item.creditedToAccount || '-'}</td>
                                  <td className="px-3 py-2 text-slate-600">{item.referenceNo || '-'}</td>
                                  <td className="px-3 py-2 text-slate-600">{formatManualDueItems(item.paidDueItems) || '-'}</td>
                                  <td className="px-3 py-2 text-right">
                                    <div className="erp-fee-collection-amount font-bold text-emerald-700">{formatCurrency(item.amount)}</div>
                                    {item.admissionThroughAgent && (
                                      <div className="text-[11px] font-semibold text-cyan-700">
                                        Agent payout {formatCurrency(item.agentFeePaidAmount)} | Pending {formatCurrency(item.pendingAgentFeeBalance)}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => onEdit?.(item)}
                                      className="erp-fee-payment-edit-button h-8 px-3 rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1"
                                    >
                                      <Edit3 size={13} /> Edit
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!groupedCollections.length && (
              <tr>
                <td colSpan="6" className="px-4 py-10 text-center text-slate-500">No fee collections found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
