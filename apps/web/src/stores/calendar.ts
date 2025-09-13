import { defineStore } from "pinia";
import http from "../lib/http";

export interface CalendarEventVM {
  eventId: string;
  cardId: string;
  title: string;
  status: string;
  boardId: string;
  start: string; // ISO with offset
  end: string;
  allDay: boolean;
  syncStatus: string;
}

export const useCalendarStore = defineStore("calendar", {
  state: () => ({
    events: [] as CalendarEventVM[],
    cache: {} as Record<string, CalendarEventVM>,
    pending: [] as Array<{ cardId: string; projectId: string; start: string; end?: string }>,
    loading: false,
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
  }),
  actions: {
    async fetchEvents(params: { from: string; to: string; boardId?: string; status?: string; label?: string }) {
      this.loading = true;
      try {
        const res = await http.get("/integrations/calendar/events", { params });
        this.events = res.data?.data || [];
        this.cache = {};
        for (const ev of this.events) this.cache[ev.cardId] = ev;
      } finally {
        this.loading = false;
      }
    },
    enqueuePending(ev: { cardId: string; projectId: string; start: string; end?: string }) {
      this.pending.push(ev);
      try {
        localStorage.setItem("pendingEvents", JSON.stringify(this.pending));
      } catch {}
    },
    loadPending() {
      try {
        const raw = localStorage.getItem("pendingEvents");
        if (raw) this.pending = JSON.parse(raw);
      } catch {}
    },
    async replayPending(setDueDate: (cardId: string, projectId: string, input: { start: string; end?: string }) => Promise<void>) {
      if (!this.pending.length) return;
      const items = [...this.pending];
      this.pending = [];
      try {
        await Promise.allSettled(items.map((it) => setDueDate(it.cardId, it.projectId, { start: it.start, end: it.end })));
      } finally {
        localStorage.setItem("pendingEvents", JSON.stringify(this.pending));
      }
    },
    bindOnlineListener(setDueDate: (cardId: string, projectId: string, input: { start: string; end?: string }) => Promise<void>) {
      this.loadPending();
      if (typeof window !== "undefined") {
        window.addEventListener("online", () => {
          this.online = true;
          this.replayPending(setDueDate);
        });
        window.addEventListener("offline", () => (this.online = false));
      }
    },
  },
});

