"use client";

import { CalendarPlus, DoorOpen, Play, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type AvailabilityResponse = {
  environment: { clerkConfigured: boolean; supabaseConfigured: boolean };
  location: { name: string; timezone: string; minimumSessionMinutes: number; bookingIncrementMinutes: number; turnoverBufferMinutes: number; accessBeforeMinutes: number; accessAfterMinutes: number; playNowEnabled: boolean };
  member: { person: { displayName: string; email: string }; profile: { memberNumber: string }; membershipPlan: { code: string; monthlyCredits: number; bookingWindowDays: number; maxActiveFutureReservations: number; guestAllowance: number }; availableCredits: number };
  availability: Array<{ suiteId: string; suiteName: string; status: "available" | "reserved" | "unavailable"; maxPlayNowMinutes: number; availableUntil?: string }>;
  auditEvents: Array<{ id: string; type: string; reason: string; createdAt: string }>;
};

type ActionResult = { ok: boolean; message: string };

export function DemoMemberExperience() {
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const firstAvailableSuite = useMemo(() => data?.availability.find((slot) => slot.status === "available"), [data]);

  async function refresh() {
    const response = await fetch("/api/demo/availability", { cache: "no-store" });
    setData(await response.json());
  }

  useEffect(() => {
    refresh().catch((error) => setResult({ ok: false, message: String(error) }));
  }, []);

  async function createReservation(mode: "ADVANCE" | "PLAY_NOW") {
    setLoading(true);
    setResult(null);
    const now = new Date();
    const startAt = new Date(now.getTime() + 60 * 60_000);
    const endAt = new Date(startAt.getTime() + 30 * 60_000);

    const response = await fetch("/api/demo/reservations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode,
        suiteId: firstAvailableSuite?.suiteId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        requestedMinutes: firstAvailableSuite?.maxPlayNowMinutes ?? 30,
        creditCost: 1,
        idempotencyKey: `${mode.toLowerCase()}-${crypto.randomUUID()}`,
      }),
    });
    const body = await response.json();
    setLoading(false);

    if (!response.ok) {
      setResult({ ok: false, message: body.error ?? "Reservation failed" });
      return;
    }

    setResult({ ok: true, message: `Created ${body.reservation.bookingMode} reservation in ${body.reservation.suiteId}. Access: ${body.accessGrant.credentialLabel} from ${formatTime(body.accessGrant.startsAt)} to ${formatTime(body.accessGrant.expiresAt)}.` });
    await refresh();
  }

  async function startSession() {
    setLoading(true);
    const response = await fetch("/api/demo/session/start", { method: "POST" });
    const body = await response.json();
    setLoading(false);

    if (!response.ok) {
      setResult({ ok: false, message: body.error ?? "Session start failed" });
      return;
    }

    setResult({ ok: true, message: `Started simulated Practice Suite session ${body.session.id}.` });
    await refresh();
  }

  if (!data) return <main className="main">Loading Fairway Network...</main>;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">FN</span>Fairway Network</div>
        <section className="member-panel"><h2>{data.member.person.displayName}</h2><p>{data.member.person.email}</p><dl><dt>Member</dt><dd>{data.member.profile.memberNumber}</dd><dt>Plan</dt><dd>{data.member.membershipPlan.code}</dd><dt>Credits</dt><dd>{data.member.availableCredits}</dd><dt>Guests</dt><dd>{data.member.membershipPlan.guestAllowance}</dd></dl></section>
        <section className="status-panel"><h2>Location #1</h2><dl><dt>Suites</dt><dd>{data.availability.length}</dd><dt>Timezone</dt><dd>{data.location.timezone}</dd><dt>Minimum</dt><dd>{data.location.minimumSessionMinutes}m</dd><dt>Turnover</dt><dd>{data.location.turnoverBufferMinutes}m</dd></dl></section>
      </aside>
      <main className="main">
        <header className="topbar"><div><h1>Practice Suite Availability</h1><p>First vertical slice: member identity, test credits, availability, canonical reservations, Play Now, simulated access, and simulated session start.</p></div><button className="secondary" type="button" onClick={refresh}><RefreshCcw size={17} />Refresh</button></header>
        {(!data.environment.clerkConfigured || !data.environment.supabaseConfigured) && <div className="env-warning">Clerk and Supabase integration boundaries are present. Add real development values to `.env.local` when you are ready to run the authenticated Supabase-backed flow.</div>}
        <section className="grid">
          <div className="panel availability"><h2>Availability Now</h2><div className="suite-grid">{data.availability.map((slot) => <div className={`suite ${slot.status}`} key={slot.suiteId}><strong>{slot.suiteName}</strong><span>{slot.status}</span><span>Play Now: {slot.maxPlayNowMinutes} min</span>{slot.availableUntil && <span>Available until {formatTime(slot.availableUntil)}</span>}</div>)}</div></div>
          <div className="panel actions"><h2>Member Actions</h2><div className="form-grid"><label>Assigned suite<input readOnly value={firstAvailableSuite?.suiteName ?? "No suite available"} /></label><label>Booking mode<select defaultValue="PLAY_NOW"><option value="PLAY_NOW">Play Now</option><option value="ADVANCE">Advance reservation</option></select></label><div className="button-row"><button type="button" disabled={loading} onClick={() => createReservation("PLAY_NOW")}><Play size={17} />Play Now</button><button className="secondary" type="button" disabled={loading} onClick={() => createReservation("ADVANCE")}><CalendarPlus size={17} />Reserve</button><button className="secondary" type="button" disabled={loading} onClick={startSession}><DoorOpen size={17} />Start Session</button></div>{result && <div className={`result ${result.ok ? "success" : "error"}`}>{result.message}</div>}</div></div>
          <div className="panel audit"><h2>Audit Trail</h2><div className="audit-list">{data.auditEvents.length === 0 ? <p>No audit events yet.</p> : data.auditEvents.map((event) => <div className="audit-event" key={event.id}><time>{formatTime(event.createdAt)}</time><div><strong>{event.type}</strong><br />{event.reason}</div></div>)}</div></div>
        </section>
      </main>
    </div>
  );
}

function formatTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
