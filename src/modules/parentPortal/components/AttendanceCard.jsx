import { useMemo, useState } from 'react';
import { Activity, BarChart3, CheckCircle2, Clock3, XCircle } from 'lucide-react';

const subjectPalette = [
  { accent: '#2563eb', soft: 'rgba(37,99,235,.16)', glow: 'rgba(37,99,235,.26)' },
  { accent: '#22c55e', soft: 'rgba(34,197,94,.16)', glow: 'rgba(34,197,94,.24)' },
  { accent: '#f97316', soft: 'rgba(249,115,22,.16)', glow: 'rgba(249,115,22,.22)' },
  { accent: '#8b5cf6', soft: 'rgba(139,92,246,.17)', glow: 'rgba(139,92,246,.24)' },
  { accent: '#06b6d4', soft: 'rgba(6,182,212,.16)', glow: 'rgba(6,182,212,.22)' },
];

function clampPercent(value) {
  return Math.min(100, Math.max(0, Number(value || 0)));
}

function AttendanceRing({ percentage, label, color = '#2563eb', size = 'lg' }) {
  const safePercentage = clampPercent(percentage);
  return (
    <div
      className={`parent-attendance-ring parent-attendance-ring-${size}`}
      style={{
        '--ring-color': color,
        '--ring-track': 'rgba(148,163,184,.18)',
        '--ring-deg': `${safePercentage * 3.6}deg`,
      }}
    >
      <div className="parent-attendance-ring-core">
        <strong>{safePercentage}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function MetricTile({ icon, label, value, color }) {
  return (
    <div className="parent-attendance-metric" style={{ '--metric-color': color }}>
      <span className="parent-attendance-metric-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProgressMetric({ label, count, percent, color }) {
  const safePercent = clampPercent(percent);
  return (
    <div className="parent-attendance-breakdown-row">
      <div>
        <span>{label}</span>
        <strong>{count}</strong>
      </div>
      <div className="parent-attendance-bar-track">
        <div
          className="parent-attendance-bar-fill"
          style={{ width: `${safePercent}%`, background: color }}
        />
      </div>
      <b>{safePercent}%</b>
    </div>
  );
}

export default function AttendanceCard({ attendance }) {
  const [selectedSubjectName, setSelectedSubjectName] = useState('');
  const subjectRows = useMemo(() => attendance.subjectRows || [], [attendance.subjectRows]);
  const selectedSubject = useMemo(
    () => subjectRows.find((item) => item.subject === selectedSubjectName) || subjectRows[0] || null,
    [selectedSubjectName, subjectRows]
  );
  const selectedIndex = Math.max(0, subjectRows.findIndex((item) => item.subject === selectedSubject?.subject));
  const selectedPalette = subjectPalette[selectedIndex % subjectPalette.length];
  const selectedTotal = selectedSubject?.total || 0;
  const selectedPresentPercent = selectedTotal ? Math.round((Number(selectedSubject.present || 0) / selectedTotal) * 100) : 0;
  const selectedAbsentPercent = selectedTotal ? Math.round((Number(selectedSubject.absent || 0) / selectedTotal) * 100) : 0;
  const selectedLatePercent = selectedTotal ? Math.round((Number(selectedSubject.late || 0) / selectedTotal) * 100) : 0;
  const selectedLeavePercent = selectedTotal ? Math.round((Number(selectedSubject.leave || 0) / selectedTotal) * 100) : 0;

  return (
    <div className="parent-attendance-card">
      <div className="parent-attendance-header">
        <div>
          <div className="parent-attendance-kicker">Attendance</div>
          <h3>Subject Monitoring</h3>
          <p>Tap a subject to view its attendance graph and status split.</p>
        </div>
        <div className="parent-attendance-total-pill">
          <BarChart3 size={16} />
          <span>{attendance.total || 0} records</span>
        </div>
      </div>

      <div className="parent-attendance-overview">
        <div className="parent-attendance-overview-main">
          <AttendanceRing percentage={attendance.percentage} label="Overall" color="#2563eb" />
          <div>
            <h4>{attendance.percentage || 0}% Overall Attendance</h4>
            <p>Live attendance pulled from marked class records.</p>
          </div>
        </div>
        <div className="parent-attendance-metrics">
          <MetricTile icon={<CheckCircle2 size={17} />} label="Present" value={attendance.present || 0} color="#22c55e" />
          <MetricTile icon={<Clock3 size={17} />} label="Late" value={attendance.late || 0} color="#f59e0b" />
          <MetricTile icon={<XCircle size={17} />} label="Absent" value={attendance.absent || 0} color="#ef4444" />
          <MetricTile icon={<Clock3 size={17} />} label="Leave" value={attendance.leave || 0} color="#f97316" />
        </div>
      </div>

      <div className="parent-attendance-layout">
        <div className="parent-attendance-subjects">
          {subjectRows.map((item, index) => {
            const palette = subjectPalette[index % subjectPalette.length];
            const isSelected = selectedSubject?.subject === item.subject;
            const percentage = clampPercent(item.percentage);
            return (
              <button
                key={item.subject}
                type="button"
                onClick={() => setSelectedSubjectName(item.subject)}
                className={`parent-attendance-subject ${isSelected ? 'is-selected' : ''}`}
                style={{ '--subject-color': palette.accent, '--subject-soft': palette.soft, '--subject-glow': palette.glow }}
              >
                <div className="parent-attendance-subject-top">
                  <span className="parent-attendance-subject-dot" />
                  <div>
                    <strong>{item.subject}</strong>
                    <small>{item.total ? `${item.present}/${item.total} present` : 'Not marked yet'}</small>
                  </div>
                  <b>{item.status}</b>
                </div>
                <div className="parent-attendance-subject-track">
                  <span style={{ width: `${percentage}%` }} />
                </div>
                <div className="parent-attendance-subject-counts">
                  <span>Present {item.present || 0}</span>
                  <span>Late {item.late || 0}</span>
                  <span>Absent {item.absent || 0}</span>
                  <span>Leave {item.leave || 0}</span>
                </div>
              </button>
            );
          })}
          {!subjectRows.length && (
            <div className="parent-attendance-empty">No subjects found for this course.</div>
          )}
        </div>

        {selectedSubject && (
          <div className="parent-attendance-detail" style={{ '--detail-color': selectedPalette.accent, '--detail-soft': selectedPalette.soft }}>
            <div className="parent-attendance-detail-hero">
              <div>
                <div className="parent-attendance-kicker">Selected Subject</div>
                <h4>{selectedSubject.subject}</h4>
                <p>{selectedTotal ? `${selectedTotal} attendance records analyzed.` : 'Attendance has not been marked for this subject yet.'}</p>
              </div>
              <AttendanceRing percentage={selectedSubject.percentage} label="Subject" color={selectedPalette.accent} size="sm" />
            </div>

            <div className="parent-attendance-breakdown">
              <ProgressMetric label="Present" count={selectedSubject.present || 0} percent={selectedPresentPercent} color="#22c55e" />
              <ProgressMetric label="Late" count={selectedSubject.late || 0} percent={selectedLatePercent} color="#f59e0b" />
              <ProgressMetric label="Absent" count={selectedSubject.absent || 0} percent={selectedAbsentPercent} color="#ef4444" />
              <ProgressMetric label="Leave" count={selectedSubject.leave || 0} percent={selectedLeavePercent} color="#f97316" />
            </div>

            <div className="parent-attendance-stack" aria-label="Selected subject attendance split">
              <span style={{ width: `${selectedPresentPercent}%`, background: '#22c55e' }} />
              <span style={{ width: `${selectedLatePercent}%`, background: '#f59e0b' }} />
              <span style={{ width: `${selectedAbsentPercent}%`, background: '#ef4444' }} />
              <span style={{ width: `${selectedLeavePercent}%`, background: '#f97316' }} />
              {!selectedTotal && <i />}
            </div>

            <div className="parent-attendance-note">
              <Activity size={16} />
              <span>{selectedSubject.status === 'Not Marked' ? 'Waiting for faculty attendance entry.' : `${selectedSubject.status} attendance for this subject.`}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
