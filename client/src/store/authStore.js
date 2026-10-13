import { create } from 'zustand';

export const isTokenExpired = (token) => {
  if (!token || typeof token !== 'string') return true;
  if (token === 'undefined' || token === 'null' || token.trim() === '') return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);
    if (!decoded.exp) return false;
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

const rawToken = localStorage.getItem('vault_token') || localStorage.getItem('expenseflow_token');
const tokenValid = !isTokenExpired(rawToken);

if (!tokenValid && rawToken) {
  localStorage.removeItem('vault_token');
  localStorage.removeItem('vault_user');
  localStorage.removeItem('vault_org');
  localStorage.removeItem('vault_active_company_id');
  localStorage.removeItem('expenseflow_token');
  localStorage.removeItem('expenseflow_user');
  localStorage.removeItem('expenseflow_org');
}

const storedToken = tokenValid ? rawToken : null;
const storedUser = tokenValid ? (localStorage.getItem('vault_user') || localStorage.getItem('expenseflow_user')) : null;
const storedOrg = tokenValid ? (localStorage.getItem('vault_org') || localStorage.getItem('expenseflow_org')) : null;
const storedCompanyId = localStorage.getItem('vault_active_company_id') || localStorage.getItem('expenseflow_active_company_id');
const initialTheme = localStorage.getItem('vault_theme') || localStorage.getItem('expenseflow_theme') || 'dark';

// Synchronize root theme attributes immediately
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', initialTheme);
  document.documentElement.classList.toggle('dark', initialTheme === 'dark');
}

export const useAuthStore = create((set) => ({
  token: storedToken || null,
  user: storedUser ? JSON.parse(storedUser) : null,
  org: storedOrg ? JSON.parse(storedOrg) : null,
  activeCompanyId: storedCompanyId || null,
  theme: initialTheme,

  login: (token, user, org) => {
    localStorage.setItem('vault_token', token);
    localStorage.setItem('vault_user', JSON.stringify(user));
    localStorage.setItem('vault_org', JSON.stringify(org));
    set({ token, user, org });
  },

  updateUser: (user) => {
    localStorage.setItem('vault_user', JSON.stringify(user));
    set((state) => ({ user: { ...state.user, ...user } }));
  },

  logout: () => {
    localStorage.removeItem('vault_token');
    localStorage.removeItem('vault_user');
    localStorage.removeItem('vault_org');
    localStorage.removeItem('vault_active_company_id');
    localStorage.removeItem('expenseflow_token');
    localStorage.removeItem('expenseflow_user');
    localStorage.removeItem('expenseflow_org');
    set({ token: null, user: null, org: null, activeCompanyId: null });
  },

  setActiveCompanyId: (companyId) => {
    if (companyId) {
      localStorage.setItem('vault_active_company_id', companyId);
    } else {
      localStorage.removeItem('vault_active_company_id');
    }
    set({ activeCompanyId: companyId });
  },

  toggleTheme: () => {
    set((state) => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('vault_theme', nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      return { theme: nextTheme };
    });
  },
}));

export default useAuthStore;
