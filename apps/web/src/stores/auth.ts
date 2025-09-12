import { defineStore } from "pinia";
import axios from "axios";

type Tokens = { accessToken: string; refreshToken: string };

export const useAuthStore = defineStore("auth", {
  state: () => ({
    accessToken: "" as string,
    refreshToken: "" as string,
    initialized: false,
  }),
  getters: {
    isAuthenticated: (s) => !!s.accessToken,
  },
  actions: {
    async init() {
      if (this.initialized) return;
      const rt = localStorage.getItem("refreshToken");
      if (rt) {
        try {
          await this.refresh(rt);
        } catch {
          await this.logout();
        }
      }
      this.initialized = true;
    },
    async refresh(refreshToken: string) {
      const res = await axios.post<Tokens>("/auth/refresh", { refreshToken });
      this.accessToken = res.data.accessToken;
      this.refreshToken = res.data.refreshToken;
      localStorage.setItem("refreshToken", this.refreshToken);
    },
    async login(email: string, password: string, remember: boolean) {
      const res = await axios.post<Tokens>("/auth/login", { email, password });
      this.accessToken = res.data.accessToken;
      this.refreshToken = res.data.refreshToken;
      if (remember) localStorage.setItem("refreshToken", this.refreshToken);
    },
    async logout() {
      this.accessToken = "";
      this.refreshToken = "";
      localStorage.removeItem("refreshToken");
    },
    authHeader() {
      return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {};
    },
  },
});
