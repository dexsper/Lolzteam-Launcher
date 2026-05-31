import { create } from 'zustand';

interface AccountsLoadingState {
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useAccountsLoading = create<AccountsLoadingState>((set) => ({
  loading: false,
  setLoading: (loading) => set({ loading }),
}));
