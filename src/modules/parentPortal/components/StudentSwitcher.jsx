import SearchSelect from '../../../components/SearchSelect';

export default function StudentSwitcher({ students, selectedId, onSelect }) {
  return (
    <div className="w-full xl:w-80">
      <div className="flex items-center justify-between gap-3 mb-2">
        <label htmlFor="parent-student-switcher" className="text-xs font-bold uppercase text-slate-500">
          Student
        </label>
        <span className="text-xs text-slate-500">{students.length} linked</span>
      </div>
      <SearchSelect
        value={selectedId || ''}
        onChange={onSelect}
        options={students.map((student) => ({
          value: student.id,
          label: [student.name, student.studentId].filter(Boolean).join(' - '),
        }))}
        placeholder="Search student..."
        className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
      />
    </div>
  );
}
