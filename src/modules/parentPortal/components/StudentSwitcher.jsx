export default function StudentSwitcher({ students, selectedId, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      {students.map((student) => (
        <button
          key={student.id}
          onClick={() => onSelect(student.id)}
          className={`h-10 px-4 rounded-md border text-sm font-semibold ${
            selectedId === student.id
              ? 'bg-[#33373e] text-white border-[#33373e]'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          {student.name}
        </button>
      ))}
    </div>
  );
}
