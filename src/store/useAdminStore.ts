import { create } from 'zustand';

export type AdminTab =
  | 'settings'
  | 'patients'
  | 'meds'
  | 'rules'
  | 'allowed'
  | 'exemptions'
  | 'history'
  | 'survey';

interface AdminState {
  isAuthed: boolean;
  activeTab: AdminTab;
  authError: string;
  unlock: (pw: string, correctPw: string) => void;
  setTab: (tab: AdminTab) => void;
  logout: () => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  isAuthed: false,
  activeTab: 'settings',
  authError: '',

  unlock: (pw, correctPw) => {
    if (pw === correctPw) {
      set({ isAuthed: true, authError: '' });
    } else {
      set({ authError: '비밀번호가 올바르지 않습니다.' });
    }
  },

  setTab: (tab) => set({ activeTab: tab }),

  logout: () => set({ isAuthed: false, activeTab: 'settings', authError: '' }),
}));
