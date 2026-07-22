"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { CalendarPlus, CheckCircle2, DoorOpen, Play, RefreshCcw, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type MemberReservation = {
  id: string;
  locationName: string;
  suiteName: string;
  suiteId: string;
  bookingMode: "ADVANCE" | "PLAY_NOW" | "OPERATOR" | "INSTRUCTOR";
  status: "held" | "confirmed" | "checked_in" | "cancelled" | "completed";
  startAt: string;
  endAt: string;
  creditsCommitted: number;
  canCancel: boolean;
  accessWindowStatus: "none" | "scheduled" | "active" | "expired" | "revoked";
  accessGrant?: { id: string; status: "active" | "revoked" | "expired"; startsAt: string; expiresAt: string; revokedAt?: string } | null;
  sessionStartedAt?: string;
  sessionEndedAt?: string;
  canCompleteSession?: boolean;
  cancelledAt?: string;
};

type AvailabilityResponse = {
  environment: { clerkConfigured: boolean; supabaseConfigured: boolean };
  location: { id: string; name: string; timezone: string; minimumSessionMinutes: number; bookingIncrementMinutes: number; turnoverBufferMinutes: number; accessBeforeMinutes: number; accessAfterMinutes: number; playNowEnabled: boolean };
  member: { person: { displayName: string; email: string }; profile: { id: string; memberNumber: string }; membershipPlan: { code: string; monthlyCredits: number; bookingWindowDays: number; maxActiveFutureReservations: number; guestAllowance: number }; availableCredits: number };
  availability: Array<{ suiteId: string; suiteName: string; status: "available" | "reserved" | "unavailable"; maxPlayNowMinutes: number; availableUntil?: string }>;
  reservations: MemberReservation[];
  auditEvents: Array<{ id: string; type: string; reason: string; createdAt: string }>;
};

type ActionResult = { ok: boolean; message: string; reservationId?: string };

export function MemberExperience() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) return <main className="main">Loading Fairway Network...</main>;

  if (!isSignedIn) {
    return (
      <main className="setup-page">
        <section className="setup-panel">
          <div className="brand"><span className="brand-mark">FN</span>Fairway Network</div>
          <h1>Sign In To Practice</h1>
          <p>Your Fairway identity is separate from Clerk. Clerk authenticates you; Fairway owns your Member Profile, credits, reservations, access grants, and sessions.</p>
          <SignInButton mode="modal"><button type="button">Sign In</button></SignInButton>
        </section>
      </main>
    );
  }

  return <AuthenticatedFlow />;
}

function AuthenticatedFlow() {
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const firstAvailableSuite = useMemo(() => data?.availability.find((slot) => slot.status === "available"), [data]);
  const advanceSuite = useMemo(() => data?.availability.find((slot) => slot.status === "available" && slot.maxPlayNowMinutes >= 90) ?? firstAvailableSuite, [data, firstAvailableSuite]);
  const upcomingReservations = useMemo(() => data?.reservations.filter((reservation) => reservation.status !== "cancelled" && reservation.status !== "completed") ?? [], [data]);
  const historicalReservations = useMemo(() => data?.reservations.filter((reservation) => reservation.status === "cancelled" || reservation.status === "completed") ?? [], [data]);
  const selectedReservation = useMemo(() => data?.reservations.find((reservation) => reservation.id === selectedReservationId) ?? upcomingReservations[0], [data, selectedReservationId, upcomingReservations]);

  async function refresh() {
    const response = await fetch("/api/member/availability", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Unable to load availability");
    setData(body);
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

    const response = await fetch("/api/member/reservations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode,
        suiteId: mode === "ADVANCE" ? advanceSuite?.suiteId : firstAvailableSuite?.suiteId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        requestedMinutes: firstAvailableSuite?.maxPlayNowMinutes ?? 30,
        creditCost: 1,
        idempotencyKey: `${mode.toLowerCase()}-${crypto.randomUUID()}`,
      }),
    });
    const body = await response.json();

    if (!response.ok) {
      setLoading(false);
      setResult({ ok: false, message: body.error ?? "Reservation failed" });
      return;
    }

    setSelectedReservationId(body.reservation.id);
    await refresh();
    setLoading(false);
    setResult({ ok: true, reservationId: body.reservation.id, message: `Created ${body.reservation.bookingMode} reservation in ${body.reservation.suiteId}. Access: ${body.accessGrant.credentialLabel} from ${formatTime(body.accessGrant.startsAt)} to ${formatTime(body.accessGrant.expiresAt)}.` });
  }

  async function cancelReservation(reservationId: string) {
    setLoading(true);
    setResult(null);
    const response = await fetch(`/api/member/reservations/${reservationId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: `cancel-${reservationId}` }),
    });
    const body = await response.json();

    if (!response.ok) {
      setLoading(false);
      setResult({ ok: false, message: body.error ?? "Cancellation failed", reservationId });
      return;
    }

    setSelectedReservationId(null);
    await refresh();
    setLoading(false);
    setResult({ ok: true, message: `Cancelled reservation. Refunded credits: ${body.refundedCredits}. Available credits: ${body.availableCredits}.` });
  }

  async function startSession() {
    const reservationId = result?.reservationId ?? selectedReservation?.id;
    if (!reservationId) {
      setResult({ ok: false, message: "Create or select a reservation before starting a session." });
      return;
    }

    setLoading(true);
    const response = await fetch("/api/member/session/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reservationId, idempotencyKey: `session-${reservationId}` }),
    });
    const body = await response.json();

    if (!response.ok) {
      setLoading(false);
      setResult({ ok: false, message: body.error ?? "Session start failed", reservationId });
      return;
    }

    await refresh();
    setLoading(false);
    setResult({ ok: true, reservationId, message: `Started simulated Practice Suite session ${body.session.id}.` });
  }


  async function completeSession() {
    const reservationId = result?.reservationId ?? selectedReservation?.id;
    if (!reservationId) {
      setResult({ ok: false, message: "Start or select an active session before completing." });
      return;
    }

    setLoading(true);
    setResult(null);
    const response = await fetch("/api/member/session/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reservationId, idempotencyKey: `complete-${reservationId}` }),
    });
    const body = await response.json();

    if (!response.ok) {
      setLoading(false);
      setResult({ ok: false, message: body.error ?? "Session completion failed", reservationId });
      return;
    }

    await refresh();
    setLoading(false);
    setResult({ ok: true, reservationId, message: `Completed session. ${body.facilityTask ? "Turnover task created." : "Readiness already recorded."}` });
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
        <header className="topbar"><div><h1>Practice Suite Availability</h1><p>Authenticated lifecycle slice: persisted reservations, credits, access grants, cancellation, and simulated session start.</p></div><div className="button-row"><button className="secondary" type="button" onClick={refresh}><RefreshCcw size={17} />Refresh</button><UserButton /></div></header>
        <section className="grid">
          <div className="panel availability"><h2>Availability Now</h2><div className="suite-grid">{data.availability.map((slot) => <div className={`suite ${slot.status}`} key={slot.suiteId}><strong>{slot.suiteName}</strong><span>{slot.status}</span><span>Play Now: {slot.maxPlayNowMinutes} min</span>{slot.availableUntil && <span>Available until {formatTime(slot.availableUntil)}</span>}</div>)}</div></div>
          <div className="panel actions"><h2>Member Actions</h2><div className="form-grid"><label>Selected reservation<input readOnly value={selectedReservation ? `${selectedReservation.bookingMode} ${selectedReservation.suiteName}` : "No reservation selected"} /></label><div className="button-row"><button type="button" disabled={loading} onClick={() => createReservation("PLAY_NOW")}><Play size={17} />Play Now</button><button className="secondary" type="button" disabled={loading} onClick={() => createReservation("ADVANCE")}><CalendarPlus size={17} />Reserve</button><button className="secondary" type="button" disabled={loading} onClick={startSession}><DoorOpen size={17} />Start Session</button><button className="secondary" type="button" disabled={loading || !selectedReservation?.canCompleteSession} onClick={completeSession}><CheckCircle2 size={17} />Complete</button></div>{result && <div className={`result ${result.ok ? "success" : "error"}`}>{result.message}</div>}</div></div>
          <ReservationPanel title="Upcoming Reservations" reservations={upcomingReservations} loading={loading} selectedReservationId={selectedReservation?.id} onSelect={setSelectedReservationId} onCancel={cancelReservation} />
          <ReservationPanel title="Reservation History" reservations={historicalReservations} loading={loading} selectedReservationId={selectedReservation?.id} onSelect={setSelectedReservationId} onCancel={cancelReservation} />
          <div className="panel audit"><h2>Audit Trail</h2><div className="audit-list">{data.auditEvents.length === 0 ? <p>No audit events yet.</p> : data.auditEvents.map((event) => <div className="audit-event" key={event.id}><time>{formatTime(event.createdAt)}</time><div><strong>{event.type}</strong><br />{event.reason}</div></div>)}</div></div>
        </section>
      </main>
    </div>
  );
}

function ReservationPanel({ title, reservations, selectedReservationId, loading, onSelect, onCancel }: { title: string; reservations: MemberReservation[]; selectedReservationId?: string; loading: boolean; onSelect: (reservationId: string) => void; onCancel: (reservationId: string) => void }) {
  return (
    <div className="panel reservations-panel">
      <h2>{title}</h2>
      <div className="reservation-list">
        {reservations.length === 0 ? <p className="muted">No reservations.</p> : reservations.map((reservation) => (
          <article className={`reservation-card ${reservation.id === selectedReservationId ? "selected" : ""}`} key={reservation.id}>
            <button className="reservation-main" type="button" onClick={() => onSelect(reservation.id)}>
              <span><strong>{reservation.suiteName}</strong><small>{reservation.locationName}</small></span>
              <span><strong>{formatDateTime(reservation.startAt)}</strong><small>{formatTime(reservation.startAt)}-{formatTime(reservation.endAt)}</small></span>
            </button>
            <dl>
              <dt>Mode</dt><dd>{reservation.bookingMode}</dd>
              <dt>Status</dt><dd>{reservation.status}</dd>
              <dt>Credits</dt><dd>{reservation.creditsCommitted}</dd>
              <dt>Access</dt><dd>{reservation.accessWindowStatus}</dd>
            </dl>
            {reservation.accessGrant && <p className="muted">Access {reservation.accessGrant.status}: {formatTime(reservation.accessGrant.startsAt)}-{formatTime(reservation.accessGrant.expiresAt)}</p>}
            {reservation.sessionStartedAt && <p className="muted">Session started {formatTime(reservation.sessionStartedAt)}</p>}\n            {reservation.sessionEndedAt && <p className="muted">Session completed {formatTime(reservation.sessionEndedAt)}</p>}
            {reservation.cancelledAt && <p className="muted">Cancelled {formatDateTime(reservation.cancelledAt)}</p>}
            {reservation.canCancel && <button className="danger" type="button" disabled={loading} onClick={() => onCancel(reservation.id)}><XCircle size={17} />Cancel</button>}
          </article>
        ))}
      </div>
    </div>
  );
}

function formatTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
