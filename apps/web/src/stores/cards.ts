import { defineStore } from "pinia";
import http from "../lib/http";

export interface Card { id: string; title: string; status: string; position: number; projectId: string }

export const useCardsStore = defineStore("cards", {
  state: () => ({ byProject: {} as Record<string, Card[]> }),
  getters: {
    listByProject: (s) => (projectId: string) => s.byProject[projectId] || [],
  },
  actions: {
    async fetch(projectId: string) {
      const res = await http.get(`/cards`, { params: { projectId } });
      this.byProject[projectId] = res.data.data || [];
    },
    async create(input: { projectId: string; title: string; status: string; position: number }) {
      const res = await http.post(`/cards`, input);
      await this.fetch(input.projectId);
      return res.data.data as Card;
    },
    async update(id: string, projectId: string, data: Partial<Pick<Card, "title" | "status" | "position">>) {
      await http.put(`/cards/${id}`, data);
      await this.fetch(projectId);
    },
    async archive(id: string, projectId: string) {
      await http.patch(`/cards/${id}/archive`);
      await this.fetch(projectId);
    },
  },
});
