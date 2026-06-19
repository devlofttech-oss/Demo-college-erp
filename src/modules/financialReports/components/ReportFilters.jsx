export default function ReportFilters({ filters, classOptions, paymentModes, onChange }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="grid md:grid-cols-4 gap-3 mb-4">
      <label>
        <span className="block text-xs font-semibold text-slate-500 mb-1.5">From</span>
        <input type="date" value={filters.fromDate} onChange={(event) => update('fromDate', event.target.value)} className="w-full h-10 rounded-lg bg-[#f0f0f2] border-0 px-3 text-sm" />
      </label>
      <label>
        <span className="block text-xs font-semibold text-slate-500 mb-1.5">To</span>
        <input type="date" value={filters.toDate} onChange={(event) => update('toDate', event.target.value)} className="w-full h-10 rounded-lg bg-[#f0f0f2] border-0 px-3 text-sm" />
      </label>
      <label>
        <span className="block text-xs font-semibold text-slate-500 mb-1.5">Class</span>
        <select value={filters.classKey} onChange={(event) => update('classKey', event.target.value)} className="w-full h-10 rounded-lg bg-[#f0f0f2] border-0 px-3 text-sm">
          <option value="">All Classes</option>
          {classOptions.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label>
        <span className="block text-xs font-semibold text-slate-500 mb-1.5">Mode</span>
        <select value={filters.paymentMode} onChange={(event) => update('paymentMode', event.target.value)} className="w-full h-10 rounded-lg bg-[#f0f0f2] border-0 px-3 text-sm">
          <option value="">All Modes</option>
          {paymentModes.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
    </div>
  );
}
