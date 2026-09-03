import { joinAttendanceTimeParts, splitAttendanceTimeParts } from '../attendanceUtils';

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const MERIDIEM_OPTIONS = ['AM', 'PM'];

// A 12-hour picker over the canonical 24-hour "HH:MM" value. `<input type="time">`
// follows the browser locale, so it shows a 24-hour clock for most users here.
export default function TimeField12Hour({ ariaLabel = 'Time', onChange, value = '' }) {
  // Derived from `value` rather than held locally: picking an hour always completes
  // the other two parts, so the parent's value is never a partial time.
  const parts = splitAttendanceTimeParts(value);

  const updatePart = (key, partValue) => {
    const nextParts = { ...parts, [key]: partValue };
    if (key === 'hour' && partValue) {
      if (!nextParts.minute) nextParts.minute = '00';
      // College sessions run through the day, so an early hour most likely means PM.
      if (!nextParts.meridiem) nextParts.meridiem = Number(partValue) < 8 ? 'PM' : 'AM';
    }
    if (!nextParts.hour) {
      nextParts.minute = '';
      nextParts.meridiem = '';
    }
    onChange(joinAttendanceTimeParts(nextParts));
  };

  const selectClass = 'erp-attendance-select h-11 rounded-lg border border-slate-200 bg-white px-2 text-sm';

  return (
    <div className="erp-time-field flex items-center gap-1.5" role="group" aria-label={ariaLabel}>
      <select
        aria-label={`${ariaLabel} hour`}
        value={parts.hour}
        onChange={(event) => updatePart('hour', event.target.value)}
        className={`${selectClass} flex-1`}
      >
        <option value="">--</option>
        {HOUR_OPTIONS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
      </select>
      <span className="text-sm font-bold text-slate-400" aria-hidden="true">:</span>
      <select
        aria-label={`${ariaLabel} minute`}
        value={parts.minute}
        onChange={(event) => updatePart('minute', event.target.value)}
        disabled={!parts.hour}
        className={`${selectClass} flex-1`}
      >
        <option value="">--</option>
        {MINUTE_OPTIONS.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
      </select>
      <select
        aria-label={`${ariaLabel} AM or PM`}
        value={parts.meridiem}
        onChange={(event) => updatePart('meridiem', event.target.value)}
        disabled={!parts.hour}
        className={`${selectClass} flex-1`}
      >
        <option value="">--</option>
        {MERIDIEM_OPTIONS.map((meridiem) => <option key={meridiem} value={meridiem}>{meridiem}</option>)}
      </select>
    </div>
  );
}
