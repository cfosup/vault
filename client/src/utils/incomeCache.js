// Utility to cache and retrieve recently used Company (Class) and Income (Sub-class) selections

const CACHE_KEY_PREFIX = 'vault_cached_income_selection_';
const CACHE_LIST_PREFIX = 'vault_cached_income_list_';

export const getCachedIncomeSelection = (userId) => {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read cached income selection:', err);
    return null;
  }
};

export const getRecentIncomeSelections = (userId) => {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${CACHE_LIST_PREFIX}${userId}`);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
    const single = getCachedIncomeSelection(userId);
    return single ? [single] : [];
  } catch (err) {
    console.error('Failed to read recent income list:', err);
    return [];
  }
};

export const setCachedIncomeSelection = (userId, selection) => {
  if (!userId || !selection) return;
  try {
    const item = {
      companyId: selection.companyId || '',
      companyName: selection.companyName || '',
      incomeId: selection.incomeId || null,
      incomeSource: selection.incomeSource || selection.source || '',
      incomeAmount: selection.incomeAmount || selection.amount || 0,
      incomeDate: selection.incomeDate || selection.date || '',
      updatedAt: Date.now(),
    };

    // Save single latest
    localStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify(item));

    // Save into recent list (max 5 items, deduplicated)
    const existing = getRecentIncomeSelections(userId);
    const filtered = existing.filter((x) => {
      if (item.incomeId && x.incomeId) {
        return x.incomeId !== item.incomeId;
      }
      if (!item.incomeId && !x.incomeId) {
        return x.companyId !== item.companyId;
      }
      return true;
    });

    const updatedList = [item, ...filtered].slice(0, 5);
    localStorage.setItem(`${CACHE_LIST_PREFIX}${userId}`, JSON.stringify(updatedList));
  } catch (err) {
    console.error('Failed to save cached income selection:', err);
  }
};

export const clearCachedIncomeSelection = (userId) => {
  if (!userId) return;
  try {
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${userId}`);
    localStorage.removeItem(`${CACHE_LIST_PREFIX}${userId}`);
  } catch (err) {
    console.error('Failed to clear cached income selection:', err);
  }
};
