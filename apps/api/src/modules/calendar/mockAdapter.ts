import { CalendarAdapter, CalendarAdapterResult, CalendarEventInput } from "./adapter.js";

type StoreKey = string; // accountEmail

class InMemoryCalendarAdapter implements CalendarAdapter {
  private store = new Map<StoreKey, Map<string, CalendarEventInput>>();

  async create(event: CalendarEventInput): Promise<CalendarAdapterResult> {
    const id = event.id || `evt_${Math.random().toString(36).slice(2)}`;
    const key = event.accountEmail;
    const bucket = this.ensureBucket(key);
    bucket.set(id, { ...event, id });
    return { status: "Synced", data: { id } };
  }

  async update(event: CalendarEventInput): Promise<CalendarAdapterResult> {
    if (!event.id) return { status: "Error", error: "Missing id" };
    const key = event.accountEmail;
    const bucket = this.ensureBucket(key);
    if (!bucket.has(event.id)) return { status: "Pending" };
    bucket.set(event.id, { ...bucket.get(event.id)!, ...event });
    return { status: "Synced", data: { id: event.id } };
  }

  async delete(event: { id: string; accountEmail: string }): Promise<CalendarAdapterResult> {
    const bucket = this.ensureBucket(event.accountEmail);
    bucket.delete(event.id);
    return { status: "Synced" };
  }

  private ensureBucket(key: StoreKey) {
    if (!this.store.has(key)) this.store.set(key, new Map());
    return this.store.get(key)!;
  }
}

export const calendarAdapter = new InMemoryCalendarAdapter();

