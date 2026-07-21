import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Banknote, FileText, MessageCircle, Plus, Search, Settings, TrendingUp, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createFeeAdjustment,
  createFeeAssignment,
  createFeeCollection,
  createFeeStructure,
  getFeesManagementData,
  updateFeeAssignment,
  updateFeeCollection,
  updateFeeStructure,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import { getClassOptions } from '../timetable/timetableUtils';
import {
  calculateAssignmentPaymentLedger,
  calculatePendingAgentFeeBalance,
  calculateFeeStatus,
  filterPaidDueItems,
  formatManualDueItems,
  formatCurrency,
  formatDisplayDate,
  getFeeComponentValues,
  getCollectionsForAssignment,
  getCollectionsForFeeContext,
  getRemainingDueItems,
  getStudentClassKey,
  isAdmissionThroughAgent,
  normalizeManualDueItems,
  normalizePaymentEntries,
  sortPaymentRecordsByDate,
  summarizeFees,
  sumPaymentEntryAgentFees,
  sumPaymentEntries,
  totalFeeComponents,
  validateFeeAdjustment,
  validateFeeCollection,
  validateFeeStructure,
} from './feeUtils';
import FeeAdjustmentModal from './components/FeeAdjustmentModal';
import FeeCollectionTable from './components/FeeCollectionTable';
import FeeAssignmentTable from './components/FeeAssignmentTable';
import FeeCollectionModal from './components/FeeCollectionModal';
import FeeReportsPanel from './components/FeeReportsPanel';
import FeeStructureModal from './components/FeeStructureModal';
import FeeStructurePanel from './components/FeeStructurePanel';
import { filterByCourse, filterStudentScopedRecords, filterStudentsByCourse } from '../shared/courseFilters';

function getFeeValues(form = {}) {
  return getFeeComponentValues(form);
}

export default function FeesManagement({
  currentUser,
  academicYear = '',
  initialBranch = '',
  initialTask = '',
  scopedStudents = [],
  selectedCourse = null,
  selectedCourseCode = 'all',
}) {
  const [students, setStudents] = useState([]);
  const [structures, setStructures] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [collections, setCollections] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState('');
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [editingStructure, setEditingStructure] = useState(null);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionAssignmentId, setCollectionAssignmentId] = useState('');
  const [editingCollection, setEditingCollection] = useState(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [activeFeeTask, setActiveFeeTask] = useState(initialTask || '');
  const [activeFeeBranch, setActiveFeeBranch] = useState(initialBranch || '');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');

  useEffect(() => {
    const loadFees = async () => {
      if (!isFirebaseConfigured) {
        setLoadError('Live Firebase data is not configured.');
        return;
      }
      try {
        const data = await getFeesManagementData(academicYear);
        setStudents(data.students.filter((student) => student.status !== 'Archived'));
        setStructures(data.feeStructures);
        setAssignments(data.feeAssignments);
        setCollections(data.feeCollections);
        setAdjustments(data.feeAdjustments);
        setLoadError('');
      } catch (error) {
        console.warn('Unable to load live fee data.', error);
        setLoadError('Unable to load live fee records.');
      }
    };
    loadFees();
  }, [academicYear]);

  useEffect(() => {
    const currentState = window.history.state || {};
    window.history.replaceState({
      ...currentState,
      feeFlow: currentState.feeFlow || { task: initialTask || '', branch: initialBranch || '' },
    }, '');

    const handleHistoryBack = (event) => {
      const flow = event.state?.feeFlow;
      setShowStructureModal(false);
      setEditingStructure(null);
      setShowCollectionModal(false);
      setEditingCollection(null);
      setShowAdjustmentModal(false);
      if (!flow) {
        setActiveFeeTask('');
        setActiveFeeBranch('');
        setSelectedAssignmentId('');
        return;
      }
      setActiveFeeTask(flow.task || '');
      setActiveFeeBranch(flow.branch || '');
      setSelectedAssignmentId('');
      setSearch('');
    };

    window.addEventListener('popstate', handleHistoryBack);
    return () => window.removeEventListener('popstate', handleHistoryBack);
  }, [initialBranch, initialTask]);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canSetup = canAccess(defaultRoles, currentRoleId, 'fees.setup');
  const canAssign = canAccess(defaultRoles, currentRoleId, 'fees.assign');
  const canCollect = canAccess(defaultRoles, currentRoleId, 'fees.collect');
  const canAdjust = canAccess(defaultRoles, currentRoleId, 'fees.adjust');
  const courseStudents = useMemo(
    () => scopedStudents.length ? scopedStudents : filterStudentsByCourse(students, selectedCourseCode, selectedCourse),
    [scopedStudents, selectedCourse, selectedCourseCode, students]
  );
  const courseStructures = useMemo(
    () => filterByCourse(structures, selectedCourseCode, selectedCourse),
    [selectedCourse, selectedCourseCode, structures]
  );
  const courseAssignments = useMemo(
    () => filterStudentScopedRecords(assignments, courseStudents, selectedCourseCode, selectedCourse),
    [assignments, courseStudents, selectedCourse, selectedCourseCode]
  );
  const courseAssignmentIds = useMemo(() => new Set(courseAssignments.map((item) => item.id).filter(Boolean)), [courseAssignments]);
  const courseCollections = useMemo(
    () => filterStudentScopedRecords(collections, courseStudents, selectedCourseCode, selectedCourse)
      .filter((item) => selectedCourseCode === 'all' || !item.assignmentId || courseAssignmentIds.has(item.assignmentId)),
    [collections, courseAssignmentIds, courseStudents, selectedCourse, selectedCourseCode]
  );
  const courseAdjustments = useMemo(
    () => filterStudentScopedRecords(adjustments, courseStudents, selectedCourseCode, selectedCourse)
      .filter((item) => selectedCourseCode === 'all' || !item.assignmentId || courseAssignmentIds.has(item.assignmentId)),
    [adjustments, courseAssignmentIds, courseStudents, selectedCourse, selectedCourseCode]
  );
  const classOptions = getClassOptions(courseStudents);
  const summary = summarizeFees(courseAssignments, courseCollections, courseAdjustments);

  const visibleAssignments = useMemo(() => {
    const term = search.trim().toLowerCase();
    const branchAssignments = activeFeeBranch === 'due-list'
      ? courseAssignments.filter((assignment) => Number(assignment.dueAmount || 0) > 0)
      : courseAssignments;
    if (!term) return branchAssignments;
    return branchAssignments.filter((assignment) =>
      [assignment.studentName, assignment.studentId, assignment.classKey, assignment.status, assignment.academicYear]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [activeFeeBranch, courseAssignments, search]);

  const visibleCollections = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filteredCollections = term
      ? courseCollections.filter((collection) =>
        [collection.studentName, collection.studentId, collection.classKey, collection.paymentMode, collection.creditedToAccount, collection.referenceNo, collection.paymentDate]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      )
      : courseCollections;
    return sortPaymentRecordsByDate(filteredCollections);
  }, [courseCollections, search]);

  const validateAgentFeePayments = (paymentEntries, pendingAgentFeeBefore, admissionThroughAgent) => {
    if (!admissionThroughAgent) return '';
    const agentFeePaidAmount = sumPaymentEntryAgentFees(paymentEntries);
    if (agentFeePaidAmount > Number(pendingAgentFeeBefore || 0)) return 'Agent payout cannot exceed pending agent fee balance.';
    return '';
  };

  const payableAssignments = courseAssignments.filter((item) => Number(item.dueAmount || 0) > 0);
  const selectedAssignment = selectedAssignmentId ? courseAssignments.find((item) => item.id === selectedAssignmentId) || null : null;

  const getAssignmentStudent = (assignment) => courseStudents.find((student) => (
    student.id === assignment.studentRecordId || student.studentId === assignment.studentId
  ));

  const formatWhatsAppPhone = (phone = '') => {
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10) return `91${digits}`;
    return digits;
  };

  const openFeeTask = (taskId) => {
    const directBranch = taskId === 'due-tracking'
      ? 'due-list'
      : taskId === 'collections'
        ? 'collect-fee'
        : '';
    setActiveFeeTask(taskId);
    setActiveFeeBranch(directBranch);
    setSelectedAssignmentId('');
    setSearch('');
    window.history.pushState({
      ...(window.history.state || {}),
      feeFlow: { task: taskId, branch: directBranch },
    }, '');
  };

  const openFeeBranch = (branch) => {
    setActiveFeeBranch(branch.id);
    setSelectedAssignmentId('');
    setSearch('');
    window.history.pushState({ ...(window.history.state || {}), feeFlow: { task: activeFeeTask, branch: branch.id } }, '');
    if (branch.openStructure) setShowStructureModal(true);
    if (branch.openCollection) {
      setCollectionAssignmentId('');
      setEditingCollection(null);
      setShowCollectionModal(true);
    }
  };

  const closeCollectionForm = () => {
    setShowCollectionModal(false);
    setEditingCollection(null);
    setCollectionAssignmentId('');
  };

  const goBackOneFeeStep = () => {
    if (showCollectionModal) {
      closeCollectionForm();
      return;
    }
    const flow = window.history.state?.feeFlow;
    if (flow?.branch || flow?.task) {
      window.history.back();
      return;
    }
    if (activeFeeBranch) {
      setActiveFeeBranch('');
      setSelectedAssignmentId('');
      return;
    }
    setActiveFeeTask('');
  };

  const feeTaskOptions = [
    {
      id: 'collections',
      title: 'Fee Collections',
      description: 'Manual payments.',
      icon: <Banknote size={22} />,
      meta: [formatCurrency(summary.totalCollected), 'Manual entry'],
    },
    {
      id: 'structures',
      title: 'Payment Settings',
      description: 'Create, edit, and assign fee structures.',
      icon: <Settings size={22} />,
      meta: [`${courseStructures.length} active`, canSetup ? 'Setup enabled' : 'View only'],
    },
    {
      id: 'adjustments',
      title: 'Adjustments',
      description: 'Approve waivers and fee corrections.',
      icon: <Wallet size={22} />,
      meta: [`${courseAdjustments.length} approved`, canAdjust ? 'Adjust enabled' : 'View only'],
    },
    {
      id: 'due-tracking',
      title: 'Due Fee Tracking',
      description: 'Track pending fees and message parents on WhatsApp.',
      icon: <MessageCircle size={22} />,
      meta: [`${payableAssignments.length} due`, formatCurrency(summary.totalOutstanding)],
    },
  ];

  const feeBranchOptions = {
    collections: [
      { id: 'collect-fee', title: 'Fee Collections', description: 'Record manual fee payments and review posted collections.', icon: <Banknote size={20} />, disabled: !canCollect, openCollection: true },
    ],
    structures: [
      { id: 'create-structure', title: 'Create Structure', description: 'Open a new fee structure form.', icon: <Plus size={20} />, disabled: !canSetup, openStructure: true },
      { id: 'manage-structures', title: 'Manage Structures', description: 'Edit or assign existing structures.', icon: <Settings size={20} /> },
    ],
    adjustments: [
      { id: 'approve-adjustment', title: 'Approve Adjustment', description: 'Select a student fee, then approve adjustment.', icon: <Wallet size={20} />, disabled: !canAdjust || !payableAssignments.length },
      { id: 'adjustment-history', title: 'Adjustment History', description: 'Review recent waivers and corrections.', icon: <FileText size={20} /> },
    ],
    'due-tracking': [
      { id: 'due-list', title: 'Due Fee Tracking', description: 'Review due students and notify parents on WhatsApp.', icon: <MessageCircle size={20} /> },
    ],
  };

  const activeTask = feeTaskOptions.find((task) => task.id === activeFeeTask);
  const activeBranches = feeBranchOptions[activeFeeTask] || [];
  const activeBranch = activeBranches.find((branch) => branch.id === activeFeeBranch);
  const saveStructure = async (form) => {
    if (!canSetup) {
      toast.error('You do not have permission to manage fee structures.');
      return;
    }
    const validationMessage = validateFeeStructure(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    const payload = {
      ...form,
      name: form.name.trim(),
      academicYear: form.academicYear.trim(),
      ...getFeeValues(form),
      totalAmount: Number(form.totalAmount || 0),
      status: form.status || 'Active',
    };

    if (editingStructure) {
      const updates = { ...payload, updatedAtText: formatDisplayDate() };
      try {
        await updateFeeStructure(editingStructure.id, updates);
        setStructures((prev) => prev.map((item) => item.id === editingStructure.id ? { ...item, ...updates } : item));
        toast.success('Fee structure updated');
      } catch (error) {
        console.error('Unable to update live fee structure.', error);
        toast.error('Fee structure was not saved to live data.');
      } finally {
        setEditingStructure(null);
      }
      return;
    }

    const createPayload = { ...payload, createdAtText: formatDisplayDate() };
    try {
      const id = await createFeeStructure(createPayload);
      if (!id) throw new Error('Live fee structure was not created.');
      setStructures((prev) => [{ id, ...createPayload }, ...prev]);
      toast.success('Fee structure created');
    } catch (error) {
      console.error('Unable to create live fee structure.', error);
      toast.error('Fee structure was not saved to live data.');
    } finally {
      setShowStructureModal(false);
    }
  };

  const assignStructureToStudents = async (structure) => {
    if (!canAssign) {
      toast.error('You do not have permission to assign fees.');
      return;
    }
    const structureCourse = structure.courseCode
      ? { courseCode: structure.courseCode, courseName: structure.courseName }
      : selectedCourse;
    const structureStudents = structure.courseCode
      ? filterStudentsByCourse(courseStudents, structure.courseCode, structureCourse)
      : courseStudents;
    const targetStudents = structureStudents.filter((student) => getStudentClassKey(student) === structure.classKey);
    if (!targetStudents.length) {
      toast.error('No active students found for this class.');
      return;
    }
    const existingKeys = new Set(courseAssignments.map((item) => `${item.studentRecordId}-${item.feeStructureId}`));
    const payloads = targetStudents
      .filter((student) => !existingKeys.has(`${student.id}-${structure.id}`))
      .map((student) => {
        const studentPayableTotal = totalFeeComponents(structure) || Number(structure.totalAmount || 0);
        return {
          feeStructureId: structure.id,
          studentRecordId: student.id,
          studentId: student.studentId,
          studentName: student.name,
          classKey: structure.classKey,
          academicYear: structure.academicYear,
          courseCode: structure.courseCode || student.courseCode || '',
          courseName: structure.courseName || student.courseName || student.program || '',
          ...getFeeValues(structure),
          totalAmount: studentPayableTotal,
          paidAmount: 0,
          adjustmentAmount: 0,
          dueAmount: studentPayableTotal,
          dueDate: structure.dueDate,
          status: 'Due',
          assignedAtText: formatDisplayDate(),
          feeYearLabel: structure.feeYearLabel || '',
          seedSource: structure.seedSource || '',
        };
      });
    if (!payloads.length) {
      toast.success('This structure is already assigned to all matching students.');
      return;
    }
    try {
      const ids = await Promise.all(payloads.map((payload) => createFeeAssignment(payload)));
      if (ids.some((id) => !id)) throw new Error('One or more live fee assignments were not created.');
      setAssignments((prev) => [...payloads.map((payload, index) => ({ id: ids[index], ...payload })), ...prev]);
      toast.success('Fee structure assigned');
    } catch (error) {
      console.error('Unable to assign live fee structure.', error);
      toast.error('Fee assignments were not saved to live data.');
    }
  };

  const getPaymentDateTime = (form, now = new Date()) => {
    const paymentDate = form.paymentDate || now.toISOString().slice(0, 10);
    const paymentTime = form.paymentTime || now.toTimeString().slice(0, 5);
    const paidAtDate = new Date(`${paymentDate}T${paymentTime || '00:00'}`);
    return {
      paymentDate,
      paymentTime,
      paidAt: Number.isNaN(paidAtDate.getTime()) ? now.toISOString() : paidAtDate.toISOString(),
    };
  };

  const getLedgerAssignmentUpdates = (assignment, projectedCollections, nowText) => {
    const ledger = calculateAssignmentPaymentLedger(assignment, projectedCollections, { useLegacyPaidFallback: false });
    return {
      paidAmount: ledger.paidAmount,
      dueAmount: ledger.dueAmount,
      agentFeePaid: ledger.agentFeePaid,
      pendingAgentFeeBalance: ledger.pendingAgentFeeBalance,
      status: ledger.status,
      updatedAtText: nowText,
    };
  };

  const createBatchPaymentId = (now = new Date()) => `fee-batch-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;

  const buildInstallmentCollections = ({
    paymentEntries,
    collectionBase,
    assignmentForLedger,
    previousCollections,
    batchPaymentId,
    now,
    editingCollectionId = '',
  }) => {
    let runningCollections = [...previousCollections];
    return paymentEntries.map((entry, index) => {
      const entryAmount = Number(entry.amount || 0);
      const paymentDateTime = getPaymentDateTime(entry, now);
      const entryAgentFeePaid = collectionBase.admissionThroughAgent
        ? Number(entry.agentFeePaidAmount || 0)
        : 0;
      const beforeLedger = calculateAssignmentPaymentLedger(
        assignmentForLedger,
        runningCollections,
        { useLegacyPaidFallback: false }
      );
      const pendingId = editingCollectionId || `__pending_payment_${index}`;
      const installment = {
        ...collectionBase,
        amount: entryAmount,
        paymentMode: entry.paymentMode,
        creditedToAccount: entry.creditedToAccount,
        referenceNo: entry.referenceNo,
        paymentDate: paymentDateTime.paymentDate,
        paymentTime: paymentDateTime.paymentTime,
        paidAt: paymentDateTime.paidAt,
        agentFeePaidAmount: entryAgentFeePaid,
        batchPaymentId,
        installmentNo: editingCollectionId ? (collectionBase.installmentNo || index + 1) : index + 1,
        installmentCount: editingCollectionId ? (collectionBase.installmentCount || paymentEntries.length) : paymentEntries.length,
        dueBeforePayment: beforeLedger.dueAmount,
      };
      const afterLedger = calculateAssignmentPaymentLedger(
        assignmentForLedger,
        [...runningCollections, { id: pendingId, ...installment }],
        { useLegacyPaidFallback: false }
      );
      const collection = {
        ...installment,
        totalPaidAfterPayment: afterLedger.paidAmount,
        dueAfterPayment: afterLedger.dueAmount,
        pendingAgentFeeBalance: afterLedger.pendingAgentFeeBalance,
      };
      runningCollections = [...runningCollections, { id: pendingId, ...collection }];
      return collection;
    });
  };

  const saveCollection = async (form) => {
    if (!canCollect) {
      toast.error('You do not have permission to record collections.');
      return;
    }
    const normalizedEntries = normalizePaymentEntries(form.paymentEntries, form);
    const paymentEntries = editingCollection ? normalizedEntries.slice(0, 1) : normalizedEntries;
    const firstPaymentEntry = paymentEntries[0] || {};
    const collectionForm = {
      ...form,
      paymentEntries,
      amount: sumPaymentEntries(paymentEntries),
      paymentMode: firstPaymentEntry.paymentMode || form.paymentMode,
      creditedToAccount: firstPaymentEntry.creditedToAccount || form.creditedToAccount || '',
      referenceNo: firstPaymentEntry.referenceNo ?? form.referenceNo,
      paymentDate: firstPaymentEntry.paymentDate || form.paymentDate,
      paymentTime: firstPaymentEntry.paymentTime || form.paymentTime,
    };
    const assignment = courseAssignments.find((item) => item.id === form.assignmentId);
    const validationAssignment = assignment
      ? {
        ...assignment,
        dueAmount: calculateAssignmentPaymentLedger(
          assignment,
          getCollectionsForAssignment(courseCollections, assignment.id)
        ).dueAmount,
      }
      : assignment;
    const validationMessage = validateFeeCollection(collectionForm, validationAssignment);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    const amount = Number(collectionForm.amount || 0);
    const manualDueItems = normalizeManualDueItems(collectionForm.manualDueItems, collectionForm);
    const paidDueItems = filterPaidDueItems(collectionForm.paidDueItems, manualDueItems, collectionForm);
    const remainingManualDueItems = getRemainingDueItems(manualDueItems, paidDueItems, collectionForm);
    const now = new Date();
    const nowText = formatDisplayDate(now);
    const batchPaymentId = editingCollection?.batchPaymentId || createBatchPaymentId(now);

    if (collectionForm.entryMode === 'structure') {
      const student = courseStudents.find((item) => item.id === collectionForm.studentRecordId);
      const structure = courseStructures.find((item) => item.id === collectionForm.feeStructureId);
      const targetAssignment = collectionForm.assignmentId
        ? courseAssignments.find((item) => item.id === collectionForm.assignmentId)
        : courseAssignments.find((item) => item.studentRecordId === collectionForm.studentRecordId && item.feeStructureId === collectionForm.feeStructureId);
      const oldAssignment = editingCollection?.assignmentId
        ? courseAssignments.find((item) => item.id === editingCollection.assignmentId)
        : null;
      const feeValues = getFeeValues(collectionForm);
      const totalAmount = Number(collectionForm.totalAmount || 0);
      const adjustmentAmount = Number(targetAssignment?.adjustmentAmount || 0);
      const admissionThroughAgent = isAdmissionThroughAgent(collectionForm) || isAdmissionThroughAgent(targetAssignment) || isAdmissionThroughAgent(student);
      const agentFee = admissionThroughAgent ? Number(collectionForm.agentFee || 0) : 0;
      const baseAssignmentForLedger = {
        ...(targetAssignment || {}),
        totalAmount,
        adjustmentAmount,
        admissionThroughAgent,
        agentFee,
      };
      const previousCollections = getCollectionsForFeeContext(courseCollections, {
        assignmentId: targetAssignment?.id || collectionForm.assignmentId,
        studentRecordId: student?.id || targetAssignment?.studentRecordId || collectionForm.studentRecordId,
        studentId: student?.studentId || targetAssignment?.studentId || collectionForm.studentId || '',
        studentName: student?.name || targetAssignment?.studentName || collectionForm.studentName || '',
        feeStructureId: structure?.id || targetAssignment?.feeStructureId || collectionForm.feeStructureId,
      }, editingCollection?.id || '');
      const previousLedger = calculateAssignmentPaymentLedger(
        baseAssignmentForLedger,
        previousCollections,
        { useLegacyPaidFallback: !editingCollection }
      );
      const ledgerBaseCollections = previousCollections.length || editingCollection || previousLedger.paidAmount <= 0
        ? previousCollections
        : [{
          id: '__legacy_paid_amount__',
          amount: previousLedger.paidAmount,
          agentFeePaidAmount: previousLedger.agentFeePaid,
          status: 'Posted',
        }];
      const pendingAgentFeeBefore = admissionThroughAgent
        ? calculatePendingAgentFeeBalance(agentFee, previousLedger.agentFeePaid)
        : 0;
      const dueBeforePayment = previousLedger.dueAmount;
      if (amount > dueBeforePayment) {
        toast.error('Collection amount cannot exceed outstanding due.');
        return;
      }
      const agentFeeValidationMessage = validateAgentFeePayments(paymentEntries, pendingAgentFeeBefore, admissionThroughAgent);
      if (agentFeeValidationMessage) {
        toast.error(agentFeeValidationMessage);
        return;
      }

      const classKey = structure?.classKey || targetAssignment?.classKey || getStudentClassKey(student);
      const assignmentBase = {
        feeStructureId: structure?.id || targetAssignment?.feeStructureId || '',
        studentRecordId: student?.id || targetAssignment?.studentRecordId || '',
        studentId: student?.studentId || targetAssignment?.studentId || '',
        studentName: student?.name || targetAssignment?.studentName || '',
        classKey,
        academicYear,
        courseCode: structure?.courseCode || student?.courseCode || targetAssignment?.courseCode || '',
        courseName: structure?.courseName || student?.courseName || student?.program || targetAssignment?.courseName || '',
        ...feeValues,
        admissionThroughAgent,
        agentFee,
        totalAmount,
        dueDate: structure?.dueDate || targetAssignment?.dueDate || '',
        feeYearLabel: structure?.feeYearLabel || targetAssignment?.feeYearLabel || '',
        seedSource: structure?.seedSource || targetAssignment?.seedSource || '',
      };
      let nextAssignmentId = targetAssignment?.id || '';
      let nextAssignment = null;
      let oldAssignmentUpdates = null;

      try {
        if (!targetAssignment) {
          const createPayload = {
            ...assignmentBase,
            paidAmount: 0,
            adjustmentAmount: 0,
            dueAmount: totalAmount,
            agentFeePaid: 0,
            pendingAgentFeeBalance: admissionThroughAgent ? calculatePendingAgentFeeBalance(agentFee, 0) : 0,
            manualDueItems: remainingManualDueItems,
            status: calculateFeeStatus(totalAmount, 0, 0),
            assignedAtText: nowText,
          };
          nextAssignmentId = await createFeeAssignment(createPayload);
          if (!nextAssignmentId) throw new Error('Live fee assignment was not created.');
          nextAssignment = { id: nextAssignmentId, ...createPayload };
        } else {
          nextAssignment = { ...targetAssignment, ...assignmentBase };
        }
        const assignmentForLedger = { ...nextAssignment, ...assignmentBase, adjustmentAmount, manualDueItems: remainingManualDueItems };

        const collectionBase = {
          assignmentId: nextAssignmentId,
          feeStructureId: assignmentBase.feeStructureId,
          feeStructureName: collectionForm.feeStructureName || structure?.name || '',
          studentRecordId: assignmentBase.studentRecordId,
          studentId: assignmentBase.studentId,
          studentName: assignmentBase.studentName,
          classKey,
          ...feeValues,
          admissionThroughAgent,
          agentFee,
          installmentNo: editingCollection?.installmentNo || 0,
          installmentCount: editingCollection?.installmentCount || 0,
          totalAmount,
          manualDueItems,
          paidDueItems,
          pendingDueItemsAfterPayment: remainingManualDueItems,
          academicYear,
          collectedBy: collectionForm.collectedBy,
          status: 'Posted',
          entryMode: 'Fee Structure',
          ...(editingCollection ? { updatedAtText: nowText } : { createdAtText: nowText }),
        };
        const collectionsToSave = buildInstallmentCollections({
          paymentEntries,
          collectionBase,
          assignmentForLedger,
          previousCollections: ledgerBaseCollections,
          batchPaymentId,
          now,
          editingCollectionId: editingCollection?.id || '',
        });
        let savedCollections = [];

        if (editingCollection) {
          const collection = collectionsToSave[0];
          await updateFeeCollection(editingCollection.id, collection);
          savedCollections = [{ id: editingCollection.id, ...collection }];
        } else {
          const ids = await Promise.all(collectionsToSave.map((collection) => createFeeCollection(collection)));
          if (ids.some((id) => !id)) throw new Error('One or more live fee collections were not created.');
          savedCollections = collectionsToSave.map((collection, index) => ({ id: ids[index], ...collection }));
        }

        const nextAssignmentUpdates = {
          ...assignmentBase,
          adjustmentAmount,
          manualDueItems: remainingManualDueItems,
          ...getLedgerAssignmentUpdates(
            assignmentForLedger,
            [...ledgerBaseCollections, ...savedCollections],
            nowText
          ),
        };
        await updateFeeAssignment(nextAssignmentId, nextAssignmentUpdates);
        nextAssignment = { ...nextAssignment, ...nextAssignmentUpdates };

        if (editingCollection && oldAssignment && oldAssignment.id !== nextAssignmentId) {
          oldAssignmentUpdates = getLedgerAssignmentUpdates(
            oldAssignment,
            getCollectionsForAssignment(courseCollections, oldAssignment.id, editingCollection.id),
            nowText
          );
          await updateFeeAssignment(oldAssignment.id, oldAssignmentUpdates);
        }

        setCollections((prev) => (
          editingCollection
            ? prev.map((item) => item.id === editingCollection.id ? savedCollections[0] : item)
            : [...savedCollections].reverse().concat(prev)
        ));
        setAssignments((prev) => {
          let next = prev;
          if (oldAssignmentUpdates) {
            next = next.map((item) => item.id === oldAssignment.id ? { ...item, ...oldAssignmentUpdates } : item);
          }
          const exists = next.some((item) => item.id === nextAssignment.id);
          return exists
            ? next.map((item) => item.id === nextAssignment.id ? nextAssignment : item)
            : [nextAssignment, ...next];
        });
        toast.success(editingCollection
          ? 'Fee collection updated'
          : `${savedCollections.length} payment${savedCollections.length === 1 ? '' : 's'} posted`);
      } catch (error) {
        console.error('Unable to save live fee collection.', error);
        toast.error('Fee collection was not saved to live data.');
      } finally {
        setShowCollectionModal(false);
        setCollectionAssignmentId('');
        setEditingCollection(null);
      }
      return;
    }
    if (collectionForm.entryMode === 'manual') {
      const student = courseStudents.find((item) => item.id === collectionForm.studentRecordId);
      const admissionThroughAgent = isAdmissionThroughAgent(collectionForm) || isAdmissionThroughAgent(student);
      const agentFee = admissionThroughAgent ? Number(collectionForm.agentFee || 0) : 0;
      const pendingAgentFeeBefore = admissionThroughAgent ? agentFee : 0;
      const agentFeeValidationMessage = validateAgentFeePayments(paymentEntries, pendingAgentFeeBefore, admissionThroughAgent);
      if (agentFeeValidationMessage) {
        toast.error(agentFeeValidationMessage);
        return;
      }
      let agentFeePaidSoFar = 0;
      const collectionsToSave = paymentEntries.map((entry, index) => {
        const entryAmount = Number(entry.amount || 0);
        const paymentDateTime = getPaymentDateTime(entry, now);
        const entryAgentFeePaid = admissionThroughAgent ? Number(entry.agentFeePaidAmount || 0) : 0;
        agentFeePaidSoFar += entryAgentFeePaid;
        return {
          assignmentId: '',
          studentRecordId: student?.id || '',
          studentId: student?.studentId || '',
          studentName: student?.name || '',
          classKey: getStudentClassKey(student),
          amount: entryAmount,
          academicYear,
          paymentMode: entry.paymentMode,
          creditedToAccount: entry.creditedToAccount,
          referenceNo: entry.referenceNo,
          paymentDate: paymentDateTime.paymentDate,
          paymentTime: paymentDateTime.paymentTime,
          paidAt: paymentDateTime.paidAt,
          collectedBy: collectionForm.collectedBy,
          status: 'Posted',
          createdAtText: nowText,
          entryMode: 'Manual',
          manualDueItems,
          paidDueItems,
          pendingDueItemsAfterPayment: remainingManualDueItems,
          admissionThroughAgent,
          agentFee,
          agentFeePaidAmount: entryAgentFeePaid,
          pendingAgentFeeBalance: admissionThroughAgent ? calculatePendingAgentFeeBalance(agentFee, agentFeePaidSoFar) : 0,
          batchPaymentId,
          installmentNo: index + 1,
          installmentCount: paymentEntries.length,
        };
      });
      try {
        const ids = await Promise.all(collectionsToSave.map((collection) => createFeeCollection(collection)));
        if (ids.some((id) => !id)) throw new Error('One or more live manual fee collections were not created.');
        const savedCollections = collectionsToSave.map((collection, index) => ({ id: ids[index], ...collection }));
        setCollections((prev) => [...savedCollections].reverse().concat(prev));
        toast.success(`${savedCollections.length} manual payment${savedCollections.length === 1 ? '' : 's'} posted`);
      } catch (error) {
        console.error('Unable to post live manual fee collection.', error);
        toast.error('Manual fee collection was not saved to live data.');
      } finally {
        setShowCollectionModal(false);
        setCollectionAssignmentId('');
        setEditingCollection(null);
      }
      return;
    }
    const admissionThroughAgent = isAdmissionThroughAgent(assignment);
    const agentFee = admissionThroughAgent ? Number(assignment.agentFee || 0) : 0;
    const previousCollections = getCollectionsForAssignment(courseCollections, assignment.id);
    const previousLedger = calculateAssignmentPaymentLedger(assignment, previousCollections);
    const ledgerBaseCollections = previousCollections.length || previousLedger.paidAmount <= 0
      ? previousCollections
      : [{
        id: '__legacy_paid_amount__',
        amount: previousLedger.paidAmount,
        agentFeePaidAmount: previousLedger.agentFeePaid,
        status: 'Posted',
      }];
    const pendingAgentFeeBefore = admissionThroughAgent ? calculatePendingAgentFeeBalance(agentFee, previousLedger.agentFeePaid) : 0;
    if (amount > previousLedger.dueAmount) {
      toast.error('Collection amount cannot exceed outstanding due.');
      return;
    }
    const agentFeeValidationMessage = validateAgentFeePayments(paymentEntries, pendingAgentFeeBefore, admissionThroughAgent);
    if (agentFeeValidationMessage) {
      toast.error(agentFeeValidationMessage);
      return;
    }
    const collectionBase = {
      assignmentId: assignment.id,
      studentRecordId: assignment.studentRecordId,
      studentId: assignment.studentId,
      studentName: assignment.studentName,
      classKey: assignment.classKey,
      academicYear: assignment.academicYear || academicYear,
      collectedBy: collectionForm.collectedBy,
      status: 'Posted',
      createdAtText: nowText,
      manualDueItems,
      paidDueItems,
      pendingDueItemsAfterPayment: remainingManualDueItems,
      admissionThroughAgent,
      agentFee,
    };
    const collectionsToSave = buildInstallmentCollections({
      paymentEntries,
      collectionBase,
      assignmentForLedger: assignment,
      previousCollections: ledgerBaseCollections,
      batchPaymentId,
      now,
    });
    const projectedCollections = [
      ...ledgerBaseCollections,
      ...collectionsToSave.map((collection, index) => ({ id: `__pending_payment_${index}`, ...collection })),
    ];
    const assignmentUpdates = {
      manualDueItems: remainingManualDueItems,
      ...getLedgerAssignmentUpdates(assignment, projectedCollections, nowText),
    };
    try {
      const ids = await Promise.all(collectionsToSave.map((collection) => createFeeCollection(collection)));
      if (ids.some((id) => !id)) throw new Error('One or more live fee collections were not created.');
      const savedCollections = collectionsToSave.map((collection, index) => ({ id: ids[index], ...collection }));
      await updateFeeAssignment(assignment.id, assignmentUpdates);
      setCollections((prev) => [...savedCollections].reverse().concat(prev));
      setAssignments((prev) => prev.map((item) => item.id === assignment.id ? { ...item, ...assignmentUpdates } : item));
      toast.success(`${savedCollections.length} payment${savedCollections.length === 1 ? '' : 's'} posted`);
    } catch (error) {
      console.error('Unable to post live fee collection.', error);
      toast.error('Fee collection was not saved to live data.');
    } finally {
      setShowCollectionModal(false);
      setCollectionAssignmentId('');
      setEditingCollection(null);
    }
  };

  const saveAdjustment = async (form) => {
    if (!canAdjust) {
      toast.error('You do not have permission to approve adjustments.');
      return;
    }
    const assignment = courseAssignments.find((item) => item.id === form.assignmentId);
    const validationMessage = validateFeeAdjustment(form, assignment);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    const amount = Number(form.amount || 0);
    const nextAdjusted = Number(assignment.adjustmentAmount || 0) + amount;
    const ledger = calculateAssignmentPaymentLedger(
      { ...assignment, adjustmentAmount: nextAdjusted },
      getCollectionsForAssignment(courseCollections, assignment.id)
    );
    const assignmentUpdates = {
      adjustmentAmount: nextAdjusted,
      paidAmount: ledger.paidAmount,
      dueAmount: ledger.dueAmount,
      status: ledger.status,
      updatedAtText: formatDisplayDate(),
    };
    const adjustment = {
      assignmentId: assignment.id,
      studentRecordId: assignment.studentRecordId,
      studentId: assignment.studentId,
      studentName: assignment.studentName,
      amount,
      academicYear: assignment.academicYear || academicYear,
      reason: form.reason.trim(),
      status: 'Approved',
      createdAtText: formatDisplayDate(),
    };
    try {
      const id = await createFeeAdjustment(adjustment);
      if (!id) throw new Error('Live fee adjustment was not created.');
      await updateFeeAssignment(assignment.id, assignmentUpdates);
      setAdjustments((prev) => [{ id, ...adjustment }, ...prev]);
      setAssignments((prev) => prev.map((item) => item.id === assignment.id ? { ...item, ...assignmentUpdates } : item));
      toast.success('Fee adjustment approved');
    } catch (error) {
      console.error('Unable to approve live fee adjustment.', error);
      toast.error('Fee adjustment was not saved to live data.');
    } finally {
      setShowAdjustmentModal(false);
    }
  };

  const collectForAssignment = (assignmentId) => {
    setCollectionAssignmentId(assignmentId);
    setEditingCollection(null);
    setShowCollectionModal(true);
  };

  const sendDueReminder = (assignmentId) => {
    const assignment = courseAssignments.find((item) => item.id === assignmentId);
    if (!assignment) return;
    const student = getAssignmentStudent(assignment);
    const phone = formatWhatsAppPhone(student?.parentPhone || student?.guardianPhone || student?.phone);
    if (!phone) {
      toast.error('No parent WhatsApp number found for this student.');
      setSelectedAssignmentId(assignmentId);
      return;
    }
    const parentName = student?.guardianName || 'Parent';
    const manualDueSummary = formatManualDueItems(assignment.manualDueItems);
    const pendingAgentFeeBalance = Number(assignment.pendingAgentFeeBalance || 0);
    const message = [
      `Dear ${parentName},`,
      `This is a fee reminder for ${assignment.studentName}.`,
      `Outstanding due: ${formatCurrency(assignment.dueAmount)}.`,
      ...(pendingAgentFeeBalance > 0 ? [`Pending agent fee balance: ${formatCurrency(pendingAgentFeeBalance)}.`] : []),
      ...(manualDueSummary ? [`Pending due items: ${manualDueSummary}.`] : []),
      `Due date: ${assignment.dueDate || 'Not specified'}.`,
      'Please complete the payment at the earliest.',
    ].join('\n');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    toast.success(`WhatsApp reminder opened for ${assignment.studentName}`);
    setSelectedAssignmentId(assignmentId);
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Finance / <span className="text-[#f39a5f]">Payment</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Payment</h1>
          <p className="text-sm text-slate-500 mt-1">Student payment collection, due tracking, fee setup, waivers, and receipts.</p>
          {!isFirebaseConfigured && <p className="text-xs text-rose-600 mt-2">Live Firebase data is not configured.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
      </div>

      {!activeFeeTask ? (
      <>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {feeTaskOptions.map((task) => (
          <button key={task.id} onClick={() => openFeeTask(task.id)} className="group min-h-40 text-left rounded-lg border border-slate-100 bg-white p-5 shadow-sm hover:-translate-y-1 transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="h-12 w-12 rounded-lg bg-[#f5f5f6] text-[#34363d] flex items-center justify-center">{task.icon}</div>
              <ArrowRight size={18} className="text-slate-400 group-hover:text-[#fb8d49]" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-5">{task.title}</h2>
            <p className="text-sm text-slate-500 mt-2">{task.description}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {task.meta.map((item) => (
                <span key={item} className="rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-semibold text-slate-600">{item}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
      </>
      ) : !activeFeeBranch ? (
      <>
      <div className="erp-back-row my-5">
        <button onClick={goBackOneFeeStep} className="erp-back-button h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2">
          <ArrowLeft size={15} /> Back
        </button>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5 rounded-lg bg-[#f5f5f6] p-4">
        <div>
          <div className="text-xs font-bold text-slate-500">Payment / <span className="text-[#fb8d49]">{activeTask?.title}</span></div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">Choose next step</h2>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {activeBranches.map((branch) => (
          <button
            key={branch.id}
            onClick={() => openFeeBranch(branch)}
            disabled={branch.disabled}
            className="group min-h-36 text-left rounded-lg border border-slate-100 bg-white p-5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="h-11 w-11 rounded-lg bg-[#f5f5f6] text-[#34363d] flex items-center justify-center">{branch.icon}</div>
              <ArrowRight size={17} className="text-slate-400 group-hover:text-[#fb8d49]" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-4">{branch.title}</h3>
            <p className="text-sm text-slate-500 mt-2">{branch.disabled ? 'Not available right now.' : branch.description}</p>
          </button>
        ))}
      </div>
      </>
      ) : (
      <>
      <div className="erp-back-row my-5">
        <button onClick={goBackOneFeeStep} className="erp-back-button h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2">
          <ArrowLeft size={15} /> Back
        </button>
      </div>
      <div className="erp-branch-focus flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 rounded-lg bg-[#f5f5f6] p-5 border border-slate-100">
        <div className="flex items-center gap-4 min-w-0">
          <div className="erp-branch-icon h-16 w-16 rounded-lg bg-white text-[#fb8d49] flex items-center justify-center shrink-0">{activeBranch?.icon}</div>
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold text-slate-900">{activeBranch?.title}</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeFeeBranch === 'create-structure' && canSetup && (
            <button onClick={() => setShowStructureModal(true)} className="h-10 px-4 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2"><Plus size={16} /> Open Form</button>
          )}
        </div>
      </div>

      {activeFeeBranch === 'collect-fee' ? (
        <div>
          {showCollectionModal ? (
            <FeeCollectionModal
              assignments={courseAssignments}
              initialAssignmentId={collectionAssignmentId}
              initialCollection={editingCollection}
              onClose={closeCollectionForm}
              onSave={saveCollection}
              collections={courseCollections}
              students={courseStudents}
              structures={courseStructures}
              embedded
            />
          ) : (
            <>
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-5">
                <div className="grid sm:grid-cols-3 gap-6 rounded-lg bg-white border border-slate-100 p-5 flex-1">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase">Total Collected</div>
                    <div className="text-2xl font-extrabold text-emerald-600 mt-1">{formatCurrency(summary.totalCollected)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase">Total Payments</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{courseCollections.length}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase">This Year</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{courseCollections.filter((item) => item.academicYear === academicYear).length}</div>
                  </div>
                </div>
                <button
                  onClick={() => { setCollectionAssignmentId(''); setEditingCollection(null); setShowCollectionModal(true); }}
                  disabled={!canCollect}
                  className="erp-record-payment-button h-12 px-6 rounded-xl bg-[#026c36] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-[0_14px_30px_rgba(2,108,54,0.35)] ring-2 ring-emerald-300/60 hover:bg-[#02552b] disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none disabled:ring-0"
                >
                  <Plus className="erp-record-payment-icon" size={16} /> Record Payment
                </button>
              </div>
              <div className="relative mb-4 max-w-xl">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by student, payment mode, reference..."
                  className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <FeeCollectionTable
                collections={visibleCollections}
                onEdit={(collection) => {
                  setCollectionAssignmentId(collection.assignmentId || '');
                  setEditingCollection(collection);
                  setShowCollectionModal(true);
                }}
              />
            </>
          )}
        </div>
      ) : ['create-structure', 'manage-structures'].includes(activeFeeBranch) ? (
        <div className="w-full">
          <FeeStructurePanel layout="grid" structures={courseStructures} canEdit={canSetup || canAssign} onEdit={setEditingStructure} onAssign={assignStructureToStudents} />
        </div>
      ) : activeFeeBranch === 'adjustment-history' ? (
        <FeeReportsPanel collections={[]} adjustments={courseAdjustments} showCollections={false} />
      ) : (
      <div className="flex flex-col xl:flex-row gap-5">
        <div className="xl:w-[68%] min-w-0">
          <div className="relative mb-4">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student name, ID, class, status..." className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100" />
          </div>
          <FeeAssignmentTable
            assignments={visibleAssignments}
            canCollect={canCollect}
            onCollect={collectForAssignment}
            onNotifyDue={sendDueReminder}
            onSelect={setSelectedAssignmentId}
            selectedId={selectedAssignmentId}
            showActions={activeFeeBranch === 'due-list'}
            showDueNotify={activeFeeBranch === 'due-list'}
          />
        </div>
        <aside className="xl:w-[32%] erp-sticky-inspector">
          {selectedAssignment ? (
            <div className="erp-selected-detail bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
              <h3 className="font-bold text-slate-900">{selectedAssignment.studentName}</h3>
              <p className="text-xs text-slate-500 mt-1">{selectedAssignment.studentId} | {selectedAssignment.classKey}</p>
              <div className="grid grid-cols-2 gap-3 text-sm mt-5">
                <div className="rounded-lg bg-[#f5f5f6] p-3"><div className="text-xs text-slate-500">Total</div><b>{formatCurrency(selectedAssignment.totalAmount)}</b></div>
                <div className="rounded-lg bg-[#f5f5f6] p-3"><div className="text-xs text-slate-500">Paid</div><b>{formatCurrency(selectedAssignment.paidAmount)}</b></div>
                <div className="rounded-lg bg-[#f5f5f6] p-3"><div className="text-xs text-slate-500">Due</div><b>{formatCurrency(selectedAssignment.dueAmount)}</b></div>
                <div className="rounded-lg bg-[#f5f5f6] p-3"><div className="text-xs text-slate-500">Due Date</div><b>{selectedAssignment.dueDate || '-'}</b></div>
              </div>
              {formatManualDueItems(selectedAssignment.manualDueItems) && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 p-3 text-sm">
                  <div className="text-xs font-semibold text-amber-700">Pending Due Items</div>
                  <div className="mt-1 font-semibold text-slate-800">{formatManualDueItems(selectedAssignment.manualDueItems)}</div>
                </div>
              )}
              {isAdmissionThroughAgent(selectedAssignment) && (
                <div className="mt-3 rounded-lg bg-cyan-50 border border-cyan-100 p-3 text-sm">
                  <div className="text-xs font-semibold text-cyan-700">Agent Fees</div>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-xs text-slate-500">Agent Fee</span>
                      <b>{formatCurrency(selectedAssignment.agentFee)}</b>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-500">Pending Balance</span>
                      <b>{formatCurrency(selectedAssignment.pendingAgentFeeBalance)}</b>
                    </div>
                  </div>
                </div>
              )}
              {activeFeeBranch === 'collect-fee' && (
                <button onClick={() => collectForAssignment(selectedAssignment.id)} disabled={!canCollect || selectedAssignment.dueAmount <= 0} className="mt-5 w-full h-10 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm disabled:bg-slate-300">Post Against This Fee</button>
              )}
              {activeFeeBranch === 'approve-adjustment' && (
                <button onClick={() => { setCollectionAssignmentId(selectedAssignment.id); setShowAdjustmentModal(true); }} disabled={!canAdjust || selectedAssignment.dueAmount <= 0} className="mt-5 w-full h-10 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm disabled:bg-slate-300">Approve Adjustment</button>
              )}
              {activeFeeBranch === 'due-list' && (
                <button onClick={() => sendDueReminder(selectedAssignment.id)} disabled={selectedAssignment.dueAmount <= 0} className="mt-5 w-full h-10 rounded-full bg-[#25d366] text-white font-semibold text-sm disabled:bg-slate-300 flex items-center justify-center gap-2">
                  <MessageCircle size={16} /> Send WhatsApp Reminder
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-lg p-6 shadow-sm text-sm text-slate-600 min-h-72 flex flex-col items-center justify-center text-center">
              <div className="h-14 w-14 rounded-lg bg-[#f5f5f6] text-[#fb8d49] flex items-center justify-center mb-4">{activeBranch?.icon}</div>
              <h3 className="font-bold text-slate-900 mb-2">{activeFeeBranch === 'collect-fee' ? 'Manual Fee Entry' : 'Payment Details'}</h3>
              <p>
                {activeFeeBranch === 'collect-fee'
                  ? 'Use the manual entry form to record an offline fee collection.'
                  : visibleAssignments.length ? 'Click a student fee row to view details and available actions.' : 'No matching fee records found.'}
              </p>
              {activeFeeBranch === 'collect-fee' && (
                <button onClick={() => { setCollectionAssignmentId(''); setEditingCollection(null); setShowCollectionModal(true); }} disabled={!canCollect} className="erp-record-payment-button mt-5 h-10 px-5 rounded-full bg-[#026c36] text-white font-semibold text-sm shadow-[0_10px_22px_rgba(2,108,54,0.24)] disabled:bg-slate-300 disabled:shadow-none inline-flex items-center justify-center gap-2">
                  <Plus className="erp-record-payment-icon" size={15} /> Record Payment
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
      )}
      </>
      )}

      {showStructureModal && <FeeStructureModal classOptions={classOptions} onClose={() => setShowStructureModal(false)} onSave={saveStructure} />}
      {editingStructure && <FeeStructureModal mode="edit" initialStructure={editingStructure} classOptions={classOptions} onClose={() => setEditingStructure(null)} onSave={saveStructure} />}
      {showAdjustmentModal && <FeeAdjustmentModal assignments={payableAssignments} initialAssignmentId={collectionAssignmentId} onClose={() => setShowAdjustmentModal(false)} onSave={saveAdjustment} />}
    </div>
  );
}
