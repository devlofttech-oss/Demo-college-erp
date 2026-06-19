import { calculateDueAmount, getDueBucket } from '../fees/feeUtils.js';

export function withinDateRange(dateValue, fromDate, toDate) {
  if (!dateValue) return false;
  const current = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(current.getTime())) return false;
  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00`);
    if (current < from) return false;
  }
  if (toDate) {
    const to = new Date(`${toDate}T23:59:59`);
    if (current > to) return false;
  }
  return true;
}

export function filterCollections(collections = [], filters = {}) {
  return collections.filter((item) => {
    const dateMatches = withinDateRange(item.paymentDate, filters.fromDate, filters.toDate);
    const classMatches = !filters.classKey || item.classKey === filters.classKey;
    const modeMatches = !filters.paymentMode || item.paymentMode === filters.paymentMode;
    return dateMatches && classMatches && modeMatches;
  });
}

export function buildCollectionReport(collections = [], filters = {}) {
  const rows = filterCollections(collections, filters);
  const totalCollected = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const byMode = rows.reduce((map, item) => {
    map[item.paymentMode] = (map[item.paymentMode] || 0) + Number(item.amount || 0);
    return map;
  }, {});

  return { rows, totalCollected, byMode };
}

export function buildOutstandingReport(assignments = [], now = new Date()) {
  const rows = assignments
    .map((item) => {
      const dueAmount = Number(item.dueAmount ?? calculateDueAmount(item.totalAmount, item.paidAmount, item.adjustmentAmount));
      return {
        ...item,
        dueAmount,
        dueBucket: getDueBucket(item.dueDate, item.status, now),
      };
    })
    .filter((item) => item.dueAmount > 0);

  return {
    rows,
    totalOutstanding: rows.reduce((sum, item) => sum + Number(item.dueAmount || 0), 0),
    overdueAmount: rows.filter((item) => item.dueBucket === 'Overdue').reduce((sum, item) => sum + Number(item.dueAmount || 0), 0),
    dueSoonAmount: rows.filter((item) => item.dueBucket === 'Due Soon').reduce((sum, item) => sum + Number(item.dueAmount || 0), 0),
  };
}

export function buildClassAnalytics(assignments = [], collections = [], adjustments = []) {
  const paidByAssignment = collections.reduce((map, item) => {
    map[item.assignmentId] = (map[item.assignmentId] || 0) + Number(item.amount || 0);
    return map;
  }, {});
  const adjustedByAssignment = adjustments.reduce((map, item) => {
    map[item.assignmentId] = (map[item.assignmentId] || 0) + Number(item.amount || 0);
    return map;
  }, {});

  const analytics = assignments.reduce((map, item) => {
    const classKey = item.classKey || 'Unassigned';
    const paid = paidByAssignment[item.id] || Number(item.paidAmount || 0);
    const adjusted = adjustedByAssignment[item.id] || Number(item.adjustmentAmount || 0);
    const due = calculateDueAmount(item.totalAmount, paid, adjusted);
    if (!map[classKey]) {
      map[classKey] = {
        classKey,
        assigned: 0,
        collected: 0,
        adjusted: 0,
        outstanding: 0,
        students: 0,
      };
    }
    map[classKey].assigned += Number(item.totalAmount || 0);
    map[classKey].collected += paid;
    map[classKey].adjusted += adjusted;
    map[classKey].outstanding += due;
    map[classKey].students += 1;
    return map;
  }, {});

  return Object.values(analytics).map((item) => ({
    ...item,
    collectionRate: item.assigned > 0 ? Math.round((item.collected / item.assigned) * 100) : 0,
  }));
}

export function buildFinancialSummary(assignments = [], collections = [], adjustments = [], filters = {}) {
  const collectionReport = buildCollectionReport(collections, filters);
  const outstandingReport = buildOutstandingReport(assignments);
  const classAnalytics = buildClassAnalytics(assignments, collections, adjustments);
  const totalAssigned = assignments.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const totalAdjusted = adjustments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const lifetimeCollected = collections.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    totalAssigned,
    lifetimeCollected,
    filteredCollected: collectionReport.totalCollected,
    totalAdjusted,
    totalOutstanding: outstandingReport.totalOutstanding,
    overdueAmount: outstandingReport.overdueAmount,
    dueSoonAmount: outstandingReport.dueSoonAmount,
    collectionRate: totalAssigned > 0 ? Math.round((lifetimeCollected / totalAssigned) * 100) : 0,
    classCount: classAnalytics.length,
    dueStudentCount: outstandingReport.rows.length,
  };
}
