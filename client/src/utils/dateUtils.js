/**
 * Bulletproof date formatter that handles:
 * - ISO strings ("2026-10-22T00:00:00.000Z")
 * - Epoch timestamp numbers or strings ("1792688341646", 1792688341646)
 * - Date objects
 * - YYYY-MM-DD strings
 * - DD/MM/YYYY or DD-MM-YYYY strings
 * Never returns "Invalid Date"
 */
export const formatDisplayDate = (val) => {
  if (!val) return '—';

  // If it's a numeric timestamp (e.g. 1792688341646 or "1792688341646")
  if (typeof val === 'number') {
    const d = new Date(val);
    return !isNaN(d.getTime()) ? d.toLocaleDateString() : '—';
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '—';

    // Numeric timestamp string
    if (/^\d+$/.test(trimmed) && trimmed.length > 8) {
      const d = new Date(Number(trimmed));
      if (!isNaN(d.getTime())) return d.toLocaleDateString();
    }

    // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
    const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) {
      const year = parseInt(ymd[1], 10);
      const month = parseInt(ymd[2], 10) - 1;
      const day = parseInt(ymd[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d.toLocaleDateString();
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmy) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10) - 1;
      const year = parseInt(dmy[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d.toLocaleDateString();
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toLocaleDateString();
  }

  if (val instanceof Date) {
    return !isNaN(val.getTime()) ? val.toLocaleDateString() : '—';
  }

  return '—';
};
