import { defineStore } from "pinia";
import http from "../lib/http";

export interface DashboardMetrics {
  kpis: { income: number; expenses: number; balance: number; savings: number };
  totals: { TODO: number; DOING: number; DONE: number; ARCHIVED: number };
  overdue: number;
  upcoming: Array<{ title: string; startUtc: string; allDay: boolean; projectId: string; syncStatus: string }>;
}

export const useDashboardStore = defineStore("dashboard", {
  state: () => ({ metrics: null as DashboardMetrics | null, loading: false }),
  actions: {
    async fetchMetrics() {
      this.loading = true;
      try {
        const res = await http.get("/dashboard/metrics");
        this.metrics = res.data?.data || null;
      } finally {
        this.loading = false;
      }
    },
  },
});

