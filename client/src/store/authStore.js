import { create } from 'zustand';

const storedToken = localStorage.getItem('expenseflow_token');
const storedUser = localStorage.getItem('expenseflow_user');
const storedOrg = localStorage.getItem('expenseflow_org');
const storedCompanyId = localStorage.getItem('expenseflow_active_company_id');

export const useAuthStore = create((set) => ({
  token: storedToken || null,
  user: storedUser ? JSON.parse(storedUser) : null,
  org: storedOrg ? JSON.parse(storedOrg) : null,
  activeCompanyId: storedCompanyId || null,
  theme: localStorage.getItem('expenseflow_theme') || 'dark',

  login: (token, user, org) => {
    localStorage.setItem('expenseflow_token', token);
    localStorage.setItem('expenseflow_user', JSON.stringify(user));
    localStorage.setItem('expenseflow_org', JSON.stringify(org));
    set({ token, user, org });
  },

  logout: () => {
    localStorage.removeItem('expenseflow_token');
    localStorage.removeItem('expenseflow_user');
    localStorage.removeItem('expenseflow_org');
    localStorage.removeItem('expenseflow_active_company_id');
    set({ token: null, user: null, org: null, activeCompanyId: null });
  },

  setActiveCompanyId: (companyId) => {
    if (companyId) {
      localStorage.setItem('expenseflow_active_company_id', companyId);
    } else {
      localStorage.removeItem('expenseflow_active_company_id');
    }
    set({ activeCompanyId: companyId });
  },

  toggleTheme: () => {
    set((state) => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('expenseflow_theme', nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      return { theme: nextTheme };
    });
  },
}));

export default useAuthStore;
