import { create } from 'zustand';
import type { UpdateStatus } from '@shared-ipc';

interface UpdaterState {
  status: UpdateStatus | null;
  dismissed: boolean;
  setStatus: (status: UpdateStatus) => void;
  dismiss: () => void;
}

export const useUpdater = create<UpdaterState>((set) => ({
  status: null,
  dismissed: false,
  setStatus: (status) =>
    set((prev) => ({
      status,
      dismissed: status.state === 'available' ? false : prev.dismissed,
    })),
  dismiss: () => set({ dismissed: true }),
}));
