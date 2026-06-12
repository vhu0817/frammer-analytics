import { create } from "zustand";

const useFilterStore = create((set) => ({
  // global filters — shared across all dashboard tabs
  startDate: null,
  endDate: null,
  clientId: null,
  channelId: null,
  userId: null,
  typeId: null,
  platformId: null,

  // set one or more filters at once
  // usage: setFilters({ clientId: 3, channelId: null })
  setFilters: (filters) => set((state) => ({ ...state, ...filters })),

  // reset everything back to "show all"
  resetFilters: () =>
    set({
      startDate: null,
      endDate: null,
      clientId: null,
      channelId: null,
      userId: null,
      typeId: null,
      platformId: null,
    }),

  // convenience: build query params object for axios
  // drops null/undefined values so the API treats them as "no filter"
  toParams: () => {
    const state = useFilterStore.getState();
    const params = {};
    if (state.startDate) params.start_date = state.startDate;
    if (state.endDate) params.end_date = state.endDate;
    if (state.clientId) params.client_id = state.clientId;
    if (state.channelId) params.channel_id = state.channelId;
    if (state.userId) params.user_id = state.userId;
    if (state.typeId) params.type_id = state.typeId;
    if (state.platformId) params.platform_id = state.platformId;
    return params;
  },
}));

export default useFilterStore;
