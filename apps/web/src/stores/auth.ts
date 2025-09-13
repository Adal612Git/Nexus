import { defineStore } from "pinia";
import http from "../lib/http";

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
      const at = localStorage.getItem("accessToken");
      if (at) this.accessToken = at;
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
      const res = await http.post<Tokens>("/auth/refresh", { refreshToken });
      this.accessToken = res.data.accessToken;
      this.refreshToken = res.data.refreshToken;
      localStorage.setItem("accessToken", this.accessToken);
      localStorage.setItem("refreshToken", this.refreshToken);
    },
    async login(email: string, password: string, remember: boolean) {
      const res = await http.post<Tokens>("/auth/login", { email, password });
      this.accessToken = res.data.accessToken;
      this.refreshToken = res.data.refreshToken;
      localStorage.setItem("accessToken", this.accessToken);
      if (remember) localStorage.setItem("refreshToken", this.refreshToken);
    },
    async logout() {
      this.accessToken = "";
      this.refreshToken = "";
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    },
    authHeader() {
      return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {};
    },
  },
});
