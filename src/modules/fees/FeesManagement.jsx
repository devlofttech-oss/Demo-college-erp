import { useEffect, useMemo, useState } from 'react';
import { Banknote, FileText, Plus, Search, TrendingUp, Wallet } from 'lucide-react';
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

export default function FeesManagement({ currentUser }) {
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

  useEffect(() => {
    const loadFees = async () => {
      try {
        const data = await getFeesManagementData();
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
    if (!term) return assignments;
    return assignments.filter((assignment) =>
      [assignment.studentName, assignment.studentId, assignment.classKey, assignment.status, assignment.academicYear]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [assignments, search]);

  const stats = [
    { label: 'Assigned Fees', value: formatCurrency(summary.totalAssigned), icon: <Wallet size={22} /> },
    { label: 'Collected', value: formatCurrency(summary.totalCollected), icon: <Banknote size={22} /> },
    { label: 'Outstanding', value: formatCurrency(summary.totalOutstanding), icon: <TrendingUp size={22} /> },
    { label: 'Due Students', value: summary.dueStudents, icon: <FileText size={22} /> },
  ];

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

  const payableAssignments = assignments.filter((item) => Number(item.dueAmount || 0) > 0);

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Finance / <span className="text-[#f39a5f]">Fees Management</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Fees Management</h1>
          <p className="text-sm text-slate-500 mt-1">Fee structure setup, manual collection, due tracking, waivers, and fee analytics.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist fee records.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setShowAdjustmentModal(true)} disabled={!canAdjust || !payableAssignments.length} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm disabled:bg-slate-300">Adjustment</button>
          <button onClick={() => setShowCollectionModal(true)} disabled={!canCollect || !payableAssignments.length} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm disabled:bg-slate-300">Collect Fee</button>
          <button onClick={() => setShowStructureModal(true)} disabled={!canSetup} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2 disabled:bg-slate-300"><Plus size={16} /> Structure</button>
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

      <div className="flex flex-col xl:flex-row gap-5">
        <div className="xl:w-[68%] min-w-0">
          <div className="relative mb-4">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student name, ID, class, status..." className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100" />
          </div>
          <FeeAssignmentTable assignments={visibleAssignments} canCollect={canCollect} onCollect={collectForAssignment} />
          {canReports && <FeeReportsPanel collections={collections} adjustments={adjustments} />}
        </div>
        <FeeStructurePanel structures={structures} canEdit={canSetup || canAssign} onEdit={setEditingStructure} onAssign={assignStructureToStudents} />
      </div>

      {showStructureModal && <FeeStructureModal classOptions={classOptions} onClose={() => setShowStructureModal(false)} onSave={saveStructure} />}
      {editingStructure && <FeeStructureModal mode="edit" initialStructure={editingStructure} classOptions={classOptions} onClose={() => setEditingStructure(null)} onSave={saveStructure} />}
      {showCollectionModal && <FeeCollectionModal assignments={payableAssignments} initialAssignmentId={collectionAssignmentId} onClose={() => setShowCollectionModal(false)} onSave={saveCollection} />}
      {showAdjustmentModal && <FeeAdjustmentModal assignments={payableAssignments} onClose={() => setShowAdjustmentModal(false)} onSave={saveAdjustment} />}
    </div>
  );
}
