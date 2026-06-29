import { useId, useMemo, useState } from 'react';

function normalizeOptions(options = []) {
  return options.map((option) => (
    typeof option === 'string'
      ? { value: option, label: option }
      : { ...option, label: option.label || option.value || '' }
  ));
}

export default function SearchSelect({
  className = '',
  disabled = false,
  onChange,
  options = [],
  placeholder = 'Search...',
  value = '',
}) {
  const inputId = useId();
  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);
  const selectedOption = normalizedOptions.find((option) => option.value === value) || null;
  const [draftQuery, setDraftQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const query = isEditing ? draftQuery : selectedOption?.label || '';

  const selectFromQuery = (nextQuery) => {
    setDraftQuery(nextQuery);
    const match = normalizedOptions.find((option) => option.label.toLowerCase() === nextQuery.trim().toLowerCase());
    if (match) onChange?.(match.value);
  };

  return (
    <>
      <input
        list={inputId}
        value={query}
        disabled={disabled}
        onFocus={() => {
          setIsEditing(true);
          setDraftQuery(selectedOption?.label || '');
        }}
        onChange={(event) => selectFromQuery(event.target.value)}
        onBlur={() => setIsEditing(false)}
        placeholder={placeholder}
        className={`erp-search-select w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#033500] focus:ring-2 focus:ring-[rgba(3,53,0,.12)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      />
      <datalist id={inputId}>
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.label} />
        ))}
      </datalist>
    </>
  );
}
