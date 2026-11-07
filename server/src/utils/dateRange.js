const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const UTC_MIDNIGHT = /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/;

const parseDateOnly = (value) => {
  const match = String(value).trim().match(DATE_ONLY);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
  };
};

export const rangeStart = (value) => {
  if (value == null || value === '') return null;
  const dateOnly = parseDateOnly(value);
  if (dateOnly) {
    return new Date(Date.UTC(dateOnly.year, dateOnly.month, dateOnly.day, 0, 0, 0, 0));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const rangeEnd = (value) => {
  if (value == null || value === '') return null;
  const dateOnly = parseDateOnly(value);
  if (dateOnly) {
    return new Date(Date.UTC(dateOnly.year, dateOnly.month, dateOnly.day, 23, 59, 59, 999));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (UTC_MIDNIGHT.test(String(value).trim())) {
    parsed.setUTCHours(23, 59, 59, 999);
  }
  return parsed;
};

export const applyDateBounds = (target, startDate, endDate, field = 'date') => {
  const start = rangeStart(startDate);
  const end = rangeEnd(endDate);
  if (!start && !end) return target;
  target[field] = {};
  if (start) target[field].$gte = start;
  if (end) target[field].$lte = end;
  return target;
};

export const inclusiveEndDate = (value) => {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return parsed;
  if (
    parsed.getUTCHours() === 0 &&
    parsed.getUTCMinutes() === 0 &&
    parsed.getUTCSeconds() === 0 &&
    parsed.getUTCMilliseconds() === 0
  ) {
    parsed.setUTCHours(23, 59, 59, 999);
  }
  return parsed;
};
