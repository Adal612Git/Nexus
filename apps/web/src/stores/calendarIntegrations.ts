import { defineStore } from "pinia";
import http from "../lib/http";

export type Provider = "GOOGLE" | "OUTLOOK";
export type IntegrationStatus = "Synced" | "Pending" | "Expired" | "Error";

export interface CalendarIntegration {
  id: string;
  provider: Provider;
  accountEmail: string;
  defaultCalendarId: string;
  timezone: string;
  status: IntegrationStatus;
}

export const useCalendarIntegrations = defineStore("calendarIntegrations", {
  state: () => ({ integration: null as CalendarIntegration | null, loading: false }),
  actions: {
    async fetch() {
      this.loading = true;
      try {
        const res = await http.get("/integrations/calendar");
        this.integration = res.data?.data || null;
      } catch (e: any) {
        this.integration = null;
      } finally {
        this.loading = false;
      }
    },
    async connect(input: { provider: Provider; accountEmail: string; defaultCalendarId: string; timezone: string }) {
      const res = await http.post("/integrations/calendar/connect", input);
      this.integration = res.data?.data || null;
    },
    async refresh() {
      const res = await http.post("/integrations/calendar/refresh");
      this.integration = res.data?.data || null;
    },
    async disconnect() {
      await http.delete("/integrations/calendar/disconnect");
      this.integration = null;
    },
    // Dev helper to simulate token expiration
    simulateExpire() {
      if (this.integration) this.integration.status = "Expired";
    },
  },
});

