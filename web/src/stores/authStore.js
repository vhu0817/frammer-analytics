import { create } from "zustand";
import api from "@/lib/api";

const useAuthStore = create((set, get) => ({
  // state
  token: localStorage.getItem("frammer_token") || null,
  user: JSON.parse(localStorage.getItem("frammer_user") || "null"),

  // derived
  get isAuthenticated() {
    return !!get().token;
  },

  // actions
  login: async (email, password) => {
    const res = await api.post("/api/auth/login", { email, password });
    const { access_token, user: userData } = res.data;

    const user = {
      user_id: userData.user_id,
      email: userData.email,
      role: userData.role,
      client_id: userData.client_id,
    };

    localStorage.setItem("frammer_token", access_token);
    localStorage.setItem("frammer_user", JSON.stringify(user));

    set({ token: access_token, user });
    return user;
  },

  logout: () => {
    localStorage.removeItem("frammer_token");
    localStorage.removeItem("frammer_user");
    set({ token: null, user: null });
  },
}));

export default useAuthStore;
