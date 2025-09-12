export type CalendarSyncStatus = "Synced" | "Pending" | "Error";

export interface CalendarEventInput {
  id?: string;
  accountEmail: string;
  title: string;
  startsAt: string; // ISO datetime
  endsAt?: string;  // ISO datetime
  calendarId: string;
}

export interface CalendarAdapterResult<T = any> {
  status: CalendarSyncStatus;
  data?: T;
  error?: string;
}

export interface CalendarAdapter {
  create(event: CalendarEventInput): Promise<CalendarAdapterResult>;
  update(event: CalendarEventInput): Promise<CalendarAdapterResult>;
  delete(event: { id: string; accountEmail: string }): Promise<CalendarAdapterResult>;
}

