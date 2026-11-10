export function periodRange(preset, customStart, customEnd) {
  const now = new Date();
  if (preset === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }
  if (preset === 'quarter') {
    const startMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), startMonth, 1);
    const end = new Date(now.getFullYear(), startMonth + 3, 0, 23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }
  if (preset === 'custom' && (customStart || customEnd)) {
    return {
      startDate: customStart ? new Date(`${customStart}T00:00:00`).toISOString() : undefined,
      endDate: customEnd ? new Date(`${customEnd}T23:59:59`).toISOString() : undefined,
    };
  }
  return {};
}

export function periodLabel(preset) {
  if (preset === 'quarter') return 'this quarter';
  if (preset === 'custom') return 'the dates you choose';
  return 'this month';
}
