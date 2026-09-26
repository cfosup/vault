import { create } from 'zustand';

const storedToken = localStorage.getItem('vault_token') || localStorage.getItem('expenseflow_token');
const storedUser = localStorage.getItem('vault_user') || localStorage.getItem('expenseflow_user');
const storedOrg = localStorage.getItem('vault_org') || localStorage.getItem('expenseflow_org');
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
