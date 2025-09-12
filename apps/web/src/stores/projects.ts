import { defineStore } from "pinia";
import http from "../lib/http";

export interface Project { id: string; name: string; createdAt: string }

export const useProjectsStore = defineStore("projects", {
  state: () => ({ list: [] as Project[], loading: false }),
  actions: {
    async fetch() {
      this.loading = true;
      const res = await http.get("/projects");
      this.list = res.data.data || [];
      this.loading = false;
    },
    async create(name: string) {
      const res = await http.post("/projects", { name });
      await this.fetch();
      return res.data.data as Project;
    },
    async remove(id: string) {
      await http.delete(`/projects/${id}`);
      this.list = this.list.filter((p) => p.id !== id);
    },
  },
});

