import { Banknote, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { formatCurrency } from '../feeUtils';

const donutSegments = [
  ['Collected', 'totalCollected', '#00d184'],
  ['Outstanding', 'totalOutstanding', '#6576d8'],
  ['Adjusted', 'totalAdjusted', '#38a5ff'],
];

function polarToCartesian(cx, cy, radius, angle) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function arcPath(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function buildTrendPoints(collections = []) {
  const grouped = collections.reduce((map, item) => {
    const key = item.paymentDate || item.createdAtText || 'Unscheduled';
    map[key] = (map[key] || 0) + Number(item.amount || 0);
    return map;
  }, {});
  const rows = Object.entries(grouped).sort(([a], [b]) => String(a).localeCompare(String(b))).slice(-6);
  if (!rows.length) return [[0, 78], [48, 68], [96, 74], [144, 48], [192, 56], [240, 34]];
  const max = Math.max(...rows.map(([, value]) => value), 1);
  return rows.map(([, value], index) => {
    const x = rows.length === 1 ? 120 : (index / (rows.length - 1)) * 240;
    const y = 86 - (Number(value || 0) / max) * 64;
    return [x, y];
  });
}

export default function FeeVisualGraph({ assignments = [], collections = [], summary = {} }) {
  const totalAssigned = Number(summary.totalAssigned || 0);
  const collectionRate = totalAssigned ? Math.round((Number(summary.totalCollected || 0) / totalAssigned) * 100) : 0;
  const netRealized = Number(summary.totalCollected || 0) + Number(summary.totalAdjusted || 0);
  const segmentTotal = Math.max(netRealized + Number(summary.totalOutstanding || 0), 1);
  const { arcs: donutArcs } = donutSegments.reduce((state, [label, key, color]) => {
    const value = Number(summary[key] || 0);
    if (!value) return state;
    const angle = (value / segmentTotal) * 360;
    return {
      cursor: state.cursor + angle,
      arcs: [
        ...state.arcs,
        {
          label,
          color,
          path: arcPath(110, 110, 76, state.cursor, state.cursor + angle),
        },
      ],
    };
  }, { cursor: -110, arcs: [] });
  const classDues = Object.entries(assignments.reduce((map, item) => {
    const key = item.classKey || 'Unassigned';
    map[key] = (map[key] || 0) + Number(item.dueAmount || 0);
    return map;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxClassDue = Math.max(...classDues.map(([, value]) => value), 1);
  const trendPoints = buildTrendPoints(collections);
  const trendPath = trendPoints.map(([x, y], index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');
  const trendArea = `${trendPath} L ${trendPoints.at(-1)[0]} 96 L ${trendPoints[0][0]} 96 Z`;

  return (
    <section className="mb-5 grid xl:grid-cols-[1.15fr_.85fr] gap-4">
      <div className="bg-white border border-slate-100 rounded-lg p-5">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="font-bold text-slate-900">Fee Overview</h3>
            <p className="text-xs text-slate-500 mt-1">Collected, adjusted, and outstanding fee split.</p>
          </div>
          <div className="h-9 px-3 rounded-full bg-[#f5f5f6] text-xs font-bold text-slate-700 flex items-center">
            {collectionRate}% collected
          </div>
        </div>

        <div className="grid md:grid-cols-[220px_1fr] gap-5 items-center">
          <div className="relative h-56 flex items-center justify-center">
            <svg viewBox="0 0 220 220" className="h-56 w-56">
              <circle cx="110" cy="110" r="76" fill="none" stroke="rgba(148,163,184,.16)" strokeWidth="28" />
              {donutArcs.map(({ label, path, color }) => (
                <path key={label} d={path} fill="none" stroke={color} strokeWidth="28" strokeLinecap="round" />
              ))}
              <circle cx="110" cy="110" r="50" fill="rgba(148,163,184,.10)" />
            </svg>
            <div className="absolute text-center">
              <div className="text-xs text-slate-500">Collected</div>
              <div className="text-2xl font-bold text-slate-900">{collectionRate}%</div>
              <div className="text-[11px] text-slate-500">{formatCurrency(summary.totalCollected)}</div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {[
              ['Assigned', summary.totalAssigned, <Wallet size={18} />, '#6576d8'],
              ['Collected', summary.totalCollected, <Banknote size={18} />, '#00d184'],
              ['Outstanding', summary.totalOutstanding, <TrendingUp size={18} />, '#f05252'],
              ['Adjusted', summary.totalAdjusted, <TrendingDown size={18} />, '#38a5ff'],
            ].map(([label, value, icon, color]) => (
              <div key={label} className="rounded-lg bg-[#f5f5f6] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="h-8 w-8 rounded-lg bg-white flex items-center justify-center" style={{ color }}>{icon}</span>
                  {label}
                </div>
                <div className="text-xl font-bold text-slate-900 mt-3">{formatCurrency(value)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          {donutSegments.map(([label, key, color]) => (
            <div key={label} className="flex items-center gap-2 text-xs text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              <span>{label}</span>
              <span className="ml-auto font-bold text-slate-900">{formatCurrency(summary[key])}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="bg-white border border-slate-100 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-slate-900">Collection Trend</h3>
              <p className="text-xs text-slate-500 mt-1">Recent payment activity.</p>
            </div>
            <div className="text-sm font-bold text-emerald-500">{formatCurrency(summary.totalCollected)}</div>
          </div>
          <svg viewBox="0 0 240 100" className="w-full h-28">
            <path d={trendArea} fill="rgba(0,209,132,.16)" />
            <path d={trendPath} fill="none" stroke="#00d184" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {trendPoints.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill="#00d184" />)}
          </svg>
        </div>

        <div className="bg-white border border-slate-100 rounded-lg p-5">
          <h3 className="font-bold text-slate-900 mb-4">Class Due Split</h3>
          <div className="space-y-3">
            {classDues.map(([classKey, due]) => (
              <div key={classKey}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600">{classKey}</span>
                  <span className="font-bold text-slate-900">{formatCurrency(due)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-[#f0f0f2] overflow-hidden">
                  <div className="h-full rounded-full bg-[#b7ff38]" style={{ width: `${Math.max(5, Math.round((due / maxClassDue) * 100))}%` }} />
                </div>
              </div>
            ))}
            {!classDues.length && <div className="text-xs text-slate-500">No fee assignments available.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
