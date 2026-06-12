import { create } from 'zustand';

export type ViewId = 'inventory' | 'mail' | 'settings';

interface ViewState {
  view: ViewId;
  setView: (view: ViewId) => void;
}

export const useView = create<ViewState>((set) => ({
  view: 'inventory',
  setView: (view) => set({ view }),
}));
