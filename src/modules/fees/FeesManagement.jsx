import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Banknote, BarChart3, FileText, Plus, Search, Settings, TrendingUp, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createFeeAdjustment,
  createFeeAssignment,
  createFeeCollection,
  createFeeStructure,
  getFeesManagementData,
  updateFeeAssignment,
  updateFeeStructure,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import { getClassOptions } from '../timetable/timetableUtils';
import { demoFeeAdjustments, demoFeeAssignments, demoFeeCollections, demoFeeStructures, demoFeeStudents } from './demoFees';
import {
  calculateDueAmount,
  calculateFeeStatus,
  formatCurrency,
  formatDisplayDate,
  getStudentClassKey,
  summarizeFees,
  validateFeeAdjustment,
  validateFeeCollection,
  validateFeeStructure,
} from './feeUtils';
import FeeAdjustmentModal from './components/FeeAdjustmentModal';
import FeeAssignmentTable from './components/FeeAssignmentTable';
import FeeCollectionModal from './components/FeeCollectionModal';
import FeeReportsPanel from './components/FeeReportsPanel';
import FeeStructureModal from './components/FeeStructureModal';
import FeeStructurePanel from './components/FeeStructurePanel';
import FeeVisualGraph from './components/FeeVisualGraph';

export default function FeesManagement({ currentUser, academicYear = '2026-2027' }) {
  const [students, setStudents] = useState(demoFeeStudents);
  const [structures, setStructures] = useState(demoFeeStructures);
  const [assignments, setAssignments] = useState(demoFeeAssignments);
  const [collections, setCollections] = useState(demoFeeCollections);
  const [adjustments, setAdjustments] = useState(demoFeeAdjustments);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [editingStructure, setEditingStructure] = useState(null);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionAssignmentId, setCollectionAssignmentId] = useState('');
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [activeFeeTask, setActiveFeeTask] = useState('');
  const [activeFeeBranch, setActiveFeeBranch] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');

  useEffect(() => {
    const loadFees = async () => {
      try {
        const data = await getFeesManagementData(academicYear);
        if (data.students.length) setStudents(data.students.filter((student) => student.status !== 'Archived'));
        setStructures(data.feeStructures);
        setAssignments(data.feeAssignments);
        setCollections(data.feeCollections);
        setAdjustments(data.feeAdjustments);
      } catch (error) {
        console.warn('Using demo fee data because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore fee records. Showing demo/local records.');
      } finally {
        setLoading(false);
      }
    };
    loadFees();
  }, [academicYear]);

  useEffect(() => {
    const currentState = window.history.state || {};
    window.history.replaceState({
      ...currentState,
      feeFlow: currentState.feeFlow || { task: '', branch: '' },
    }, '');

    const handleHistoryBack = (event) => {
      const flow = event.state?.feeFlow;
      setShowStructureModal(false);
      setEditingStructure(null);
      setShowCollectionModal(false);
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
  }, []);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canSetup = canAccess(defaultRoles, currentRoleId, 'fees.setup');
  const canAssign = canAccess(defaultRoles, currentRoleId, 'fees.assign');
  const canCollect = canAccess(defaultRoles, currentRoleId, 'fees.collect');
  const canAdjust = canAccess(defaultRoles, currentRoleId, 'fees.adjust');
  const canReports = canAccess(defaultRoles, currentRoleId, 'fees.reports');
  const classOptions = getClassOptions(students);
  const summary = summarizeFees(assignments, collections, adjustments);

  const visibleAssignments = useMemo(() => {
    const term = search.trim().toLowerCase();
    const branchAssignments = activeFeeBranch === 'due-list'
      ? assignments.filter((assignment) => Number(assignment.dueAmount || 0) > 0)
      : assignments;
    if (!term) return branchAssignments;
    return branchAssignments.filter((assignment) =>
      [assignment.studentName, assignment.studentId, assignment.classKey, assignment.status, assignment.academicYear]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [activeFeeBranch, assignments, search]);

  const stats = [
    { label: 'Assigned Fees', value: formatCurrency(summary.totalAssigned), icon: <Wallet size={22} /> },
    { label: 'Collected', value: formatCurrency(summary.totalCollected), icon: <Banknote size={22} /> },
    { label: 'Outstanding', value: formatCurrency(summary.totalOutstanding), icon: <TrendingUp size={22} /> },
    { label: 'Due Students', value: summary.dueStudents, icon: <FileText size={22} /> },
  ];
  const payableAssignments = assignments.filter((item) => Number(item.dueAmount || 0) > 0);
  const selectedAssignment = selectedAssignmentId ? assignments.find((item) => item.id === selectedAssignmentId) || null : null;

  const openFeeTask = (taskId) => {
    setActiveFeeTask(taskId);
    setActiveFeeBranch('');
    setSelectedAssignmentId('');
    setSearch('');
    window.history.pushState({ ...(window.history.state || {}), feeFlow: { task: taskId, branch: '' } }, '');
  };

  const openFeeBranch = (branch) => {
    setActiveFeeBranch(branch.id);
    setSelectedAssignmentId('');
    setSearch('');
    window.history.pushState({ ...(window.history.state || {}), feeFlow: { task: activeFeeTask, branch: branch.id } }, '');
    if (branch.openStructure) setShowStructureModal(true);
  };

  const goBackOneFeeStep = () => {
    if (window.history.state?.feeFlow) {
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
      title: 'Collections',
      description: 'Collect payments and review due students.',
      icon: <Banknote size={22} />,
      meta: [`${payableAssignments.length} due`, formatCurrency(summary.totalOutstanding)],
    },
    {
      id: 'structures',
      title: 'Payment Setup',
      description: 'Create, edit, and assign fee structures.',
      icon: <Settings size={22} />,
      meta: [`${structures.length} active`, canSetup ? 'Setup enabled' : 'View only'],
    },
    {
      id: 'adjustments',
      title: 'Adjustments',
      description: 'Approve waivers and fee corrections.',
      icon: <Wallet size={22} />,
      meta: [`${adjustments.length} approved`, canAdjust ? 'Adjust enabled' : 'View only'],
    },
    {
      id: 'reports',
      title: 'Reports',
      description: 'View collection trends and recent activity.',
      icon: <BarChart3 size={22} />,
      meta: [formatCurrency(summary.totalCollected), canReports ? 'Reports enabled' : 'View only'],
    },
  ];

  const feeBranchOptions = {
    collections: [
      { id: 'collect-fee', title: 'Collect Payment', description: 'Select a student fee, then record payment.', icon: <Banknote size={20} />, disabled: !canCollect || !payableAssignments.length },
      { id: 'due-list', title: 'Due List', description: 'View students with pending dues.', icon: <TrendingUp size={20} /> },
    ],
    structures: [
      { id: 'create-structure', title: 'Create Structure', description: 'Open a new fee structure form.', icon: <Plus size={20} />, disabled: !canSetup, openStructure: true },
      { id: 'manage-structures', title: 'Manage Structures', description: 'Edit or assign existing structures.', icon: <Settings size={20} /> },
    ],
    adjustments: [
      { id: 'approve-adjustment', title: 'Approve Adjustment', description: 'Select a student fee, then approve adjustment.', icon: <Wallet size={20} />, disabled: !canAdjust || !payableAssignments.length },
      { id: 'adjustment-history', title: 'Adjustment History', description: 'Review recent waivers and corrections.', icon: <FileText size={20} /> },
    ],
    reports: [
      { id: 'overview-report', title: 'Overview Report', description: 'See fee graph, collections, and adjustments.', icon: <BarChart3 size={20} /> },
    ],
  };

  const activeTask = feeTaskOptions.find((task) => task.id === activeFeeTask);
  const activeBranches = feeBranchOptions[activeFeeTask] || [];
  const activeBranch = activeBranches.find((branch) => branch.id === activeFeeBranch);
  const branchAccentText = activeFeeTask === 'collections'
    ? 'Collection work'
    : activeFeeTask === 'structures'
      ? 'Structure setup'
      : activeFeeTask === 'adjustments'
        ? 'Adjustment work'
        : 'Report view';

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
      tuitionFee: Number(form.tuitionFee || 0),
      libraryFee: Number(form.libraryFee || 0),
      labFee: Number(form.labFee || 0),
      transportFee: Number(form.transportFee || 0),
      totalAmount: Number(form.totalAmount || 0),
      status: form.status || 'Active',
    };

    if (editingStructure) {
      const updates = { ...payload, updatedAtText: formatDisplayDate() };
      try {
        await updateFeeStructure(editingStructure.id, updates);
        setStructures((prev) => prev.map((item) => item.id === editingStructure.id ? { ...item, ...updates } : item));
        toast.success('Fee structure updated');
      } catch {
        setStructures((prev) => prev.map((item) => item.id === editingStructure.id ? { ...item, ...updates } : item));
        toast.success('Fee structure updated locally');
      } finally {
        setEditingStructure(null);
      }
      return;
    }

    const createPayload = { ...payload, createdAtText: formatDisplayDate() };
    try {
      const id = await createFeeStructure(createPayload);
      setStructures((prev) => [{ id: id || `local-fee-structure-${Date.now()}`, ...createPayload }, ...prev]);
      toast.success('Fee structure created');
    } catch {
      setStructures((prev) => [{ id: `local-fee-structure-${Date.now()}`, ...createPayload }, ...prev]);
      toast.success('Fee structure created locally');
    } finally {
      setShowStructureModal(false);
    }
  };

  const assignStructureToStudents = async (structure) => {
    if (!canAssign) {
      toast.error('You do not have permission to assign fees.');
      return;
    }
    const targetStudents = students.filter((student) => getStudentClassKey(student) === structure.classKey);
    if (!targetStudents.length) {
      toast.error('No active students found for this class.');
      return;
    }
    const existingKeys = new Set(assignments.map((item) => `${item.studentRecordId}-${item.feeStructureId}`));
    const payloads = targetStudents
      .filter((student) => !existingKeys.has(`${student.id}-${structure.id}`))
      .map((student) => ({
        feeStructureId: structure.id,
        studentRecordId: student.id,
        studentId: student.studentId,
        studentName: student.name,
        classKey: structure.classKey,
        academicYear: structure.academicYear,
        totalAmount: Number(structure.totalAmount || 0),
        paidAmount: 0,
        adjustmentAmount: 0,
        dueAmount: Number(structure.totalAmount || 0),
        dueDate: structure.dueDate,
        status: 'Due',
        assignedAtText: formatDisplayDate(),
      }));
    if (!payloads.length) {
      toast.success('This structure is already assigned to all matching students.');
      return;
    }
    try {
      const ids = await Promise.all(payloads.map((payload) => createFeeAssignment(payload)));
      setAssignments((prev) => [...payloads.map((payload, index) => ({ id: ids[index] || `local-fee-assignment-${Date.now()}-${index}`, ...payload })), ...prev]);
      toast.success('Fee structure assigned');
    } catch {
      setAssignments((prev) => [...payloads.map((payload, index) => ({ id: `local-fee-assignment-${Date.now()}-${index}`, ...payload })), ...prev]);
      toast.success('Fee structure assigned locally');
    }
  };

  const saveCollection = async (form) => {
    if (!canCollect) {
      toast.error('You do not have permission to record collections.');
      return;
    }
    const assignment = assignments.find((item) => item.id === form.assignmentId);
    const validationMessage = validateFeeCollection(form, assignment);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    const amount = Number(form.amount || 0);
    const nextPaid = Number(assignment.paidAmount || 0) + amount;
    const nextDue = calculateDueAmount(assignment.totalAmount, nextPaid, assignment.adjustmentAmount);
    const assignmentUpdates = {
      paidAmount: nextPaid,
      dueAmount: nextDue,
      status: calculateFeeStatus(assignment.totalAmount, nextPaid, assignment.adjustmentAmount),
      updatedAtText: formatDisplayDate(),
    };
    const collection = {
      assignmentId: assignment.id,
      studentRecordId: assignment.studentRecordId,
      studentId: assignment.studentId,
      studentName: assignment.studentName,
      amount,
      academicYear: assignment.academicYear || academicYear,
      paymentMode: form.paymentMode,
      referenceNo: form.referenceNo.trim(),
      paymentDate: form.paymentDate,
      collectedBy: form.collectedBy,
      status: 'Posted',
      createdAtText: formatDisplayDate(),
    };
    try {
      const id = await createFeeCollection(collection);
      await updateFeeAssignment(assignment.id, assignmentUpdates);
      setCollections((prev) => [{ id: id || `local-fee-collection-${Date.now()}`, ...collection }, ...prev]);
      setAssignments((prev) => prev.map((item) => item.id === assignment.id ? { ...item, ...assignmentUpdates } : item));
      toast.success('Fee collection posted');
    } catch {
      setCollections((prev) => [{ id: `local-fee-collection-${Date.now()}`, ...collection }, ...prev]);
      setAssignments((prev) => prev.map((item) => item.id === assignment.id ? { ...item, ...assignmentUpdates } : item));
      toast.success('Fee collection posted locally');
    } finally {
      setShowCollectionModal(false);
      setCollectionAssignmentId('');
    }
  };

  const saveAdjustment = async (form) => {
    if (!canAdjust) {
      toast.error('You do not have permission to approve adjustments.');
      return;
    }
    const assignment = assignments.find((item) => item.id === form.assignmentId);
    const validationMessage = validateFeeAdjustment(form, assignment);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    const amount = Number(form.amount || 0);
    const nextAdjusted = Number(assignment.adjustmentAmount || 0) + amount;
    const nextDue = calculateDueAmount(assignment.totalAmount, assignment.paidAmount, nextAdjusted);
    const assignmentUpdates = {
      adjustmentAmount: nextAdjusted,
      dueAmount: nextDue,
      status: calculateFeeStatus(assignment.totalAmount, assignment.paidAmount, nextAdjusted),
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
      await updateFeeAssignment(assignment.id, assignmentUpdates);
      setAdjustments((prev) => [{ id: id || `local-fee-adjustment-${Date.now()}`, ...adjustment }, ...prev]);
      setAssignments((prev) => prev.map((item) => item.id === assignment.id ? { ...item, ...assignmentUpdates } : item));
      toast.success('Fee adjustment approved');
    } catch {
      setAdjustments((prev) => [{ id: `local-fee-adjustment-${Date.now()}`, ...adjustment }, ...prev]);
      setAssignments((prev) => prev.map((item) => item.id === assignment.id ? { ...item, ...assignmentUpdates } : item));
      toast.success('Fee adjustment approved locally');
    } finally {
      setShowAdjustmentModal(false);
    }
  };

  const collectForAssignment = (assignmentId) => {
    setCollectionAssignmentId(assignmentId);
    setShowCollectionModal(true);
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Finance / <span className="text-[#f39a5f]">Payment</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Payment</h1>
          <p className="text-sm text-slate-500 mt-1">Student payment collection, due tracking, fee setup, waivers, and receipts.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist fee records.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
      </div>

      {!activeFeeTask ? (
      <>
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 my-5 rounded-lg bg-[#f5f5f6] p-4">
        <div>
          <div className="text-xs font-bold text-slate-500">Payment / <span className="text-[#fb8d49]">{activeTask?.title}</span></div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">Choose next step</h2>
        </div>
        <button onClick={goBackOneFeeStep} className="h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2">
          <ArrowLeft size={15} /> Back
        </button>
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
      <div className="erp-branch-focus flex flex-col lg:flex-row lg:items-center justify-between gap-4 my-5 rounded-lg bg-[#f5f5f6] p-5 border border-slate-100">
        <div className="flex items-center gap-4 min-w-0">
          <div className="erp-branch-icon h-16 w-16 rounded-lg bg-white text-[#fb8d49] flex items-center justify-center shrink-0">{activeBranch?.icon}</div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-500">Payment / {activeTask?.title}</div>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-1">{activeBranch?.title}</h2>
            <p className="text-sm text-slate-500 mt-1">{activeBranch?.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="h-10 px-4 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center">{branchAccentText}</span>
          {activeFeeBranch === 'create-structure' && canSetup && (
            <button onClick={() => setShowStructureModal(true)} className="h-10 px-4 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2"><Plus size={16} /> Open Form</button>
          )}
          <button onClick={goBackOneFeeStep} className="h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2">
            <ArrowLeft size={15} /> Back
          </button>
        </div>
      </div>

      {activeFeeBranch === 'overview-report' ? (
        <>
          <FeeVisualGraph assignments={assignments} collections={collections} summary={summary} />
          {canReports && <FeeReportsPanel collections={collections} adjustments={adjustments} />}
        </>
      ) : ['create-structure', 'manage-structures'].includes(activeFeeBranch) ? (
        <div className="max-w-3xl">
          <FeeStructurePanel structures={structures} canEdit={canSetup || canAssign} onEdit={setEditingStructure} onAssign={assignStructureToStudents} />
        </div>
      ) : activeFeeBranch === 'adjustment-history' ? (
        <FeeReportsPanel collections={[]} adjustments={adjustments} />
      ) : (
      <div className="flex flex-col xl:flex-row gap-5">
        <div className="xl:w-[68%] min-w-0">
          <div className="relative mb-4">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student name, ID, class, status..." className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100" />
          </div>
          <FeeAssignmentTable assignments={visibleAssignments} canCollect={canCollect} showActions={false} selectedId={selectedAssignmentId} onSelect={setSelectedAssignmentId} onCollect={collectForAssignment} />
        </div>
        <aside className="xl:w-[32%]">
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
              {activeFeeBranch === 'collect-fee' && (
                <button onClick={() => collectForAssignment(selectedAssignment.id)} disabled={!canCollect || selectedAssignment.dueAmount <= 0} className="mt-5 w-full h-10 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm disabled:bg-slate-300">Collect Payment</button>
              )}
              {activeFeeBranch === 'approve-adjustment' && (
                <button onClick={() => { setCollectionAssignmentId(selectedAssignment.id); setShowAdjustmentModal(true); }} disabled={!canAdjust || selectedAssignment.dueAmount <= 0} className="mt-5 w-full h-10 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm disabled:bg-slate-300">Approve Adjustment</button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-lg p-6 shadow-sm text-sm text-slate-600 min-h-72 flex flex-col items-center justify-center text-center">
              <div className="h-14 w-14 rounded-lg bg-[#f5f5f6] text-[#fb8d49] flex items-center justify-center mb-4">{activeBranch?.icon}</div>
              <h3 className="font-bold text-slate-900 mb-2">Payment Details</h3>
              <p>{visibleAssignments.length ? 'Click a student fee row to view details and available actions.' : 'No matching fee records found.'}</p>
            </div>
          )}
        </aside>
      </div>
      )}
      </>
      )}

      {showStructureModal && <FeeStructureModal classOptions={classOptions} onClose={() => setShowStructureModal(false)} onSave={saveStructure} />}
      {editingStructure && <FeeStructureModal mode="edit" initialStructure={editingStructure} classOptions={classOptions} onClose={() => setEditingStructure(null)} onSave={saveStructure} />}
      {showCollectionModal && <FeeCollectionModal assignments={payableAssignments} initialAssignmentId={collectionAssignmentId} onClose={() => setShowCollectionModal(false)} onSave={saveCollection} />}
      {showAdjustmentModal && <FeeAdjustmentModal assignments={payableAssignments} initialAssignmentId={collectionAssignmentId} onClose={() => setShowAdjustmentModal(false)} onSave={saveAdjustment} />}
    </div>
  );
}
