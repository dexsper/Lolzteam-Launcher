import type { UserLabel } from '@shared-types';
import { create } from 'zustand';

export type LabelMutation = { ok: true; labels: UserLabel[] } | { ok: false; message: string };

interface ProfileLabelsState {
  labels: UserLabel[];
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  create: (title: string, bc: string) => Promise<LabelMutation>;
  update: (tagId: number, title: string, bc: string) => Promise<LabelMutation>;
  remove: (tagId: number) => Promise<LabelMutation>;
  reorder: (tagIds: number[]) => Promise<LabelMutation>;
}

const applyResult = (
  set: (partial: Partial<ProfileLabelsState>) => void,
  res: LabelMutation,
): LabelMutation => {
  if (res.ok) set({ labels: res.labels, loaded: true });
  return res;
};

export const useProfileLabels = create<ProfileLabelsState>((set, get) => ({
  labels: [],
  loading: false,
  loaded: false,
  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const labels = await window.launcher.profile.getLabels();
      set({ labels, loaded: true });
    } catch {
    } finally {
      set({ loading: false });
    }
  },
  refresh: async () => {
    set({ loading: true });
    try {
      const labels = await window.launcher.profile.refreshLabels();
      set({ labels, loaded: true });
    } catch {
    } finally {
      set({ loading: false });
    }
  },
  create: async (title, bc) =>
    applyResult(set, await window.launcher.profile.createLabel(title, bc)),
  update: async (tagId, title, bc) =>
    applyResult(set, await window.launcher.profile.updateLabel(tagId, title, bc)),
  remove: async (tagId) => applyResult(set, await window.launcher.profile.deleteLabel(tagId)),
  reorder: async (tagIds) => applyResult(set, await window.launcher.profile.reorderLabels(tagIds)),
}));
