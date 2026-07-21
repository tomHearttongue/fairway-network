export interface AuditEvent {
  id: string;
  type: string;
  actorId: string;
  resourceId: string;
  reason: string;
  createdAt: Date;
}

export class AuditLog {
  private readonly events: AuditEvent[] = [];

  record(input: Omit<AuditEvent, "id">): AuditEvent {
    const event: AuditEvent = { id: `audit_${this.events.length + 1}`, ...input, createdAt: new Date(input.createdAt) };
    this.events.unshift(event);
    return event;
  }

  list(): AuditEvent[] {
    return this.events.map((event) => ({ ...event, createdAt: new Date(event.createdAt) }));
  }
}
