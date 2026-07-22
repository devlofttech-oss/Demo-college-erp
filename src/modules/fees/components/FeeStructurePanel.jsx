import { useMemo, useState } from 'react';
import StatusBadge from '../../students/components/StatusBadge';
import { feeComponentFields, formatCurrency } from '../feeUtils';

function getCourseLabel(item = {}) {
  return item.programName || item.courseName || 'Unassigned Course';
}

function getRouteLabel(classKey = '') {
  const parts = String(classKey).split(' - ').map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function getYearSortValue(item = {}) {
  const label = `${item.feeYearLabel || item.classKey || ''}`.toLowerCase();
  if (label.includes('1')) return 1;
  if (label.includes('2')) return 2;
  if (label.includes('3')) return 3;
  if (label.includes('4')) return 4;
  return 99;
}

function getRouteSortValue(classKey = '') {
  const route = getRouteLabel(classKey).toLowerCase();
  if (route.includes('regular')) return 1;
  if (route.includes('lateral')) return 2;
  return 9;
}

function getCourseSortValue(label = '') {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes('nursing')) return 1;
  if (lowerLabel.includes('physiotherapy') || lowerLabel === 'bpt') return 2;
  if (lowerLabel.includes('occupational therapy')) return 3;
  if (lowerLabel.includes('at & ot') || lowerLabel.includes('anaesthesia') || lowerLabel.includes('anesthesia')) return 4;
  if (lowerLabel.includes('medical imaging') || lowerLabel.includes('imaging technology')) return 5;
  if (lowerLabel.includes('medical laboratory') || lowerLabel.includes('mlt')) return 6;
  return 99;
}

function getStructureTitle(item = {}, isGrid = false) {
  if (!isGrid) return item.name;
  const route = getRouteLabel(item.classKey);
  const parts = [item.feeYearLabel || item.classKey, route, 'Fee'];
  return parts.filter(Boolean).join(' ');
}

function getExtraChargesSummary(note = '') {
  if (!note) return '';
  return 'Extra charges apply: books, uniform, pocket articles, eligibility certificate, university exam fees, and hostel/transport charges as applicable.';
}

function getGroupedStructures(structures = []) {
  const groups = structures.reduce((map, item) => {
    const label = getCourseLabel(item);
    if (!map.has(label)) {
      map.set(label, {
        label,
        courseTotalAmount: Number(item.courseTotalAmount || 0),
        items: [],
      });
    }
    const group = map.get(label);
    group.courseTotalAmount = Math.max(group.courseTotalAmount, Number(item.courseTotalAmount || 0));
    group.items.push(item);
    return map;
  }, new Map());

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: [...group.items].sort((first, second) => (
        getYearSortValue(first) - getYearSortValue(second)
        || getRouteSortValue(first.classKey) - getRouteSortValue(second.classKey)
        || String(first.name || '').localeCompare(String(second.name || ''))
      )),
    }))
    .sort((first, second) => (
      getCourseSortValue(first.label) - getCourseSortValue(second.label)
      || first.label.localeCompare(second.label)
    ));
}

export default function FeeStructurePanel({ structures, canEdit, canAssign = canEdit, onEdit, onAssign, layout = 'inspector' }) {
  const isGrid = layout === 'grid';
  const [selectedCourse, setSelectedCourse] = useState('all');
  const groupedStructures = useMemo(() => (isGrid ? getGroupedStructures(structures) : []), [isGrid, structures]);
  const selectedCourseExists = groupedStructures.some((group) => group.label === selectedCourse);
  const activeCourse = selectedCourse === 'all' || !selectedCourseExists ? 'all' : selectedCourse;
  const visibleGroups = activeCourse === 'all'
    ? groupedStructures
    : groupedStructures.filter((group) => group.label === activeCourse);
  const visibleStructureCount = activeCourse === 'all'
    ? structures.length
    : visibleGroups.reduce((count, group) => count + group.items.length, 0);

  const renderStructureCard = (item) => {
    const visibleComponents = feeComponentFields.filter(({ key }) => Number(item[key] || 0) > 0);
    const extraChargesSummary = getExtraChargesSummary(item.extraChargesNote);
    const structureTitle = getStructureTitle(item, isGrid);

    return (
      <div key={item.id} className="rounded-lg bg-[#f5f5f6] p-4 flex flex-col min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 leading-snug">{structureTitle}</div>
            <div className="text-xs text-slate-500 mt-1">{item.classKey} | {item.academicYear}</div>
            {!isGrid && item.courseName && <div className="text-xs text-slate-500 mt-0.5">{item.courseName}</div>}
          </div>
          <span className="shrink-0"><StatusBadge value={item.status} /></span>
        </div>
        <div className={isGrid ? 'grid grid-cols-2 xl:grid-cols-3 gap-2 mt-4 text-xs text-slate-600' : 'grid grid-cols-2 gap-2 mt-4 text-xs text-slate-600'}>
          {visibleComponents.map(({ key, shortLabel }) => (
            <div key={key} className="rounded-md bg-white p-2">{shortLabel}<br /><b>{formatCurrency(item[key])}</b></div>
          ))}
        </div>
        {extraChargesSummary && (
          <div className="mt-3 text-[11px] leading-relaxed text-slate-500" title={item.extraChargesNote}>{extraChargesSummary}</div>
        )}
        <div className="flex items-center justify-between gap-3 mt-auto pt-4">
          <div>
            <div className="text-xs text-slate-500">Total</div>
            <div className="font-bold text-slate-900">{formatCurrency(item.totalAmount)}</div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => onAssign(item)} disabled={!canAssign} className="h-8 px-3 rounded-md bg-white border border-slate-200 text-xs font-semibold disabled:text-slate-300">Assign</button>
            <button onClick={() => onEdit(item)} disabled={!canEdit} className="h-8 px-3 rounded-md bg-[#33373e] text-white text-xs font-semibold disabled:bg-slate-300">Edit</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className={isGrid ? 'w-full space-y-4' : 'xl:w-[32%] erp-sticky-inspector space-y-4'}>
      <div className="bg-white border border-slate-100 rounded-lg p-5">
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Fee Structures</h3>
            <span className="text-xs text-slate-500">{visibleStructureCount} active</span>
          </div>
          {isGrid && groupedStructures.length > 1 && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              Course
              <select
                value={activeCourse}
                onChange={(event) => setSelectedCourse(event.target.value)}
                className="h-9 min-w-64 max-w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="all">All Courses</option>
                {groupedStructures.map((group) => (
                  <option key={group.label} value={group.label}>{group.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="space-y-6">
          {isGrid ? visibleGroups.map((group) => (
            <div key={group.label} className="space-y-3 border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">{group.label}</h4>
                  <p className="text-xs text-slate-500 mt-1">{group.items.length} fee structures</p>
                </div>
                {group.courseTotalAmount > 0 && (
                  <div className="text-xs font-semibold text-slate-500 sm:text-right">
                    Course total <span className="text-slate-900">{formatCurrency(group.courseTotalAmount)}</span>
                  </div>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {group.items.map(renderStructureCard)}
              </div>
            </div>
          )) : structures.map(renderStructureCard)}
          {!structures.length && <div className="rounded-lg bg-[#f5f5f6] p-4 text-sm text-slate-500">No fee structures created yet.</div>}
        </div>
      </div>
    </section>
  );
}
