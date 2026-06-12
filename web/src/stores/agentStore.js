import { create } from "zustand";
import api from "@/lib/api";

const useAgentStore = create((set, get) => ({
  // chat state
  messages: [],
  isOpen: false,
  isLoading: false,

  // toggle the ATLAS chat panel
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  // send a natural language query to ATLAS
  sendQuery: async (query) => {
    // add the user's message immediately
    set((state) => ({
      messages: [...state.messages, { role: "user", content: query }],
      isLoading: true,
    }));

    try {
      const res = await api.post("/api/agent/query", { query });
      const { answer, chart } = res.data;

      set((state) => ({
        messages: [
          ...state.messages,
          {
            role: "assistant",
            content: answer,
            chart: chart || null,
          },
        ],
        isLoading: false,
      }));
    } catch (err) {
      set((state) => ({
        messages: [
          ...state.messages,
          {
            role: "assistant",
            content: "Sorry, I ran into an error. Try rephrasing your question.",
          },
        ],
        isLoading: false,
      }));
    }
  },

  // clear chat history
  clearMessages: () => set({ messages: [] }),
}));

export default useAgentStore;
