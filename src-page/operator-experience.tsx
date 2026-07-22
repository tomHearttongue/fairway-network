"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { AlertTriangle, CheckCircle2, ClipboardList, RefreshCcw, ShieldAlert, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SuiteStatus = "available" | "occupied" | "turnover" | "inspection_required" | "maintenance" | "out_of_service" | "administrative_hold";

type OperatorSuite = {
  id: string;
  locationId: string;
  name: string;
  status: SuiteStatus;
  currentReservationId?: string | null;
  currentReservationStatus?: string | null;
  currentBookingMode?: string | null;
  currentMemberEmail?: string | null;
  activeSessionId?: string | null;
};

type OperatorReservation = {
  id: string;
  suiteName: string;
  memberEmail: string;
  memberDisplayName: string;
  bookingMode: "ADVANCE" | "PLAY_NOW" | "OPERATOR" | "INSTRUCTOR";
  status: "held" | "confirmed" | "checked_in" | "cancelled" | "completed";
  startAt: string;
  endAt: string;
  sessionStartedAt?: string;
  accessGrantStatus?: "active" | "revoked" | "expired" | null;
};

type OperatorState = {
  location: { id: string; name: string; timezone: string; suiteCount: number; turnoverBufferMinutes: number };
  suites: OperatorSuite[];
  reservations: OperatorReservation[];
  auditEvents: Array<{ id: string; type: string; reason: string; createdAt: string }>;
};

type Result = { ok: boolean; message: string };

const suiteStatusOptions: Array<{ status: SuiteStatus; label: string }> = [
  { status: "available", label: "Available" },
  { status: "maintenance", label: "Maintenance" },
  { status: "administrative_hold", label: "Admin Hold" },
  { status: "inspection_required", label: "Inspect" },
  { status: "turnover", label: "Turnover" },
  { status: "out_of_service", label: "Out" },
];

export function OperatorExperience() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <main className="operator-shell loading-state">Loading operator controls...</main>;
  if (!isSignedIn) {
    return (
      <main className="setup-page">
        <section className="setup-panel">
          <div className="brand"><span className="brand-mark">FN</span>Fairway Network</div>
          <h1>Operator Sign In</h1>
          <p>Facility controls require a Fairway operator role. Authentication alone is not authorization.</p>
          <SignInButton mode="modal"><button type="button">Sign In</button></SignInButton>
        </section>
      </main>
    );
  }
  return <OperatorControls />;
}

function OperatorControls() {
  const [state, setState] = useState<OperatorState | null>(null);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const selectedSuite = useMemo(() => state?.suites.find((suite) => suite.id === selectedSuiteId) ?? state?.suites[0], [state, selectedSuiteId]);
  const selectedReservation = useMemo(() => state?.reservations.find((reservation) => reservation.id === selectedReservationId) ?? state?.reservations.find((reservation) => reservation.status === "confirmed"), [state, selectedReservationId]);
  const counts = useMemo(() => {
    const suites = state?.suites ?? [];
    return {
      available: suites.filter((suite) => suite.status === "available").length,
      blocked: suites.filter((suite) => suite.status !== "available").length,
      active: state?.reservations.filter((reservation) => reservation.status === "checked_in").length ?? 0,
    };
  }, [state]);

  async function refresh() {
    const response = await fetch("/api/operator/facility", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Unable to load facility state");
    setState(body);
  }

  useEffect(() => {
    refresh().catch((error) => setResult({ ok: false, message: String(error) }));
  }, []);

  async function updateSuiteStatus(status: SuiteStatus) {
    if (!selectedSuite) return;
    if (!reason.trim()) {
      setResult({ ok: false, message: "Reason required before changing suite state." });
      return;
    }
    setLoading(true);
    setResult(null);
    const response = await fetch(`/api/operator/suites/${selectedSuite.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, reason, idempotencyKey: `suite-${selectedSuite.id}-${status}-${crypto.randomUUID()}` }),
    });
    const body = await response.json();
    if (!response.ok) {
      setLoading(false);
      setResult({ ok: false, message: body.error ?? "Suite update failed" });
      return;
    }
    await refresh();
    setLoading(false);
    setResult({ ok: true, message: `${body.suite.name} is now ${body.suite.status}.` });
  }

  async function cancelReservation() {
    if (!selectedReservation) return;
    if (!reason.trim()) {
      setResult({ ok: false, message: "Reason required before cancelling a reservation." });
      return;
    }
    const ok = window.confirm(`Cancel ${selectedReservation.bookingMode} reservation for ${selectedReservation.memberEmail} in ${selectedReservation.suiteName}?`);
    if (!ok) return;
    setLoading(true);
    setResult(null);
    const response = await fetch(`/api/operator/reservations/${selectedReservation.id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason, idempotencyKey: `operator-cancel-${selectedReservation.id}-${crypto.randomUUID()}` }),
    });
    const body = await response.json();
    if (!response.ok) {
      setLoading(false);
      setResult({ ok: false, message: body.error ?? "Cancellation failed" });
      return;
    }
    await refresh();
    setLoading(false);
    setResult({ ok: true, message: `Reservation cancelled. Refunded credits: ${body.refundedCredits}.` });
  }

  if (!state) return <main className="operator-shell loading-state">Loading facility state...</main>;

  return (
    <div className="operator-shell">
      <header className="operator-header">
        <div>
          <span className="operator-kicker">Operator Controls</span>
          <h1>{state.location.name}</h1>
          <p>{counts.available} suites available, {counts.blocked} blocked, {counts.active} active sessions.</p>
        </div>
        <div className="operator-header-actions"><button className="secondary" type="button" onClick={refresh}><RefreshCcw size={17} />Refresh</button><UserButton /></div>
      </header>

      {result && <div className={`operator-result ${result.ok ? "success" : "error"}`}>{result.ok ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}{result.message}</div>}

      <main className="operator-grid">
        <section className="operator-panel suite-board" aria-label="Suite operational state">
          <div className="panel-heading"><h2>Suite State</h2><span>{state.location.timezone}</span></div>
          <div className="operator-suite-grid">
            {state.suites.map((suite) => (
              <button key={suite.id} type="button" className={`operator-suite ${suite.status} ${suite.id === selectedSuite?.id ? "selected" : ""}`} onClick={() => setSelectedSuiteId(suite.id)}>
                <strong>{suite.name}</strong>
                <span>{formatStatus(suite.status)}</span>
                {suite.currentMemberEmail ? <small>{suite.currentBookingMode} - {suite.currentMemberEmail}</small> : <small>No active reservation</small>}
              </button>
            ))}
          </div>
        </section>

        <section className="operator-panel action-panel" aria-label="Operator action controls">
          <div className="panel-heading"><h2>Governed Actions</h2><AlertTriangle size={18} /></div>
          <label>Required reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason visible in audit trail" /></label>
          <div className="selected-context">
            <strong>{selectedSuite?.name ?? "No suite selected"}</strong>
            <span>{selectedSuite ? formatStatus(selectedSuite.status) : ""}</span>
          </div>
          <div className="operator-button-grid">
            {suiteStatusOptions.map((option) => <button key={option.status} className={option.status === "available" ? "restore" : "secondary"} type="button" disabled={loading || selectedSuite?.status === option.status} onClick={() => updateSuiteStatus(option.status)}><Wrench size={16} />{option.label}</button>)}
          </div>
          <div className="selected-context destructive-context">
            <strong>{selectedReservation ? `${selectedReservation.bookingMode} ${selectedReservation.suiteName}` : "No cancellable reservation"}</strong>
            <span>{selectedReservation ? `${selectedReservation.memberEmail} - ${formatDateTime(selectedReservation.startAt)}` : "Select a reservation below"}</span>
          </div>
          <button className="danger" type="button" disabled={loading || !selectedReservation || selectedReservation.status !== "confirmed"} onClick={cancelReservation}><ClipboardList size={17} />Cancel Reservation</button>
        </section>

        <section className="operator-panel reservations-board" aria-label="Upcoming and active reservations">
          <div className="panel-heading"><h2>Reservations</h2><span>{state.reservations.length}</span></div>
          <div className="operator-reservation-list">
            {state.reservations.length === 0 ? <p className="operator-empty">No relevant upcoming or active reservations.</p> : state.reservations.map((reservation) => (
              <button key={reservation.id} type="button" className={`operator-reservation ${reservation.id === selectedReservation?.id ? "selected" : ""}`} onClick={() => setSelectedReservationId(reservation.id)}>
                <span><strong>{reservation.suiteName}</strong><small>{reservation.memberEmail}</small></span>
                <span><strong>{reservation.bookingMode}</strong><small>{reservation.status} / access {reservation.accessGrantStatus ?? "none"}</small></span>
                <span><strong>{formatTime(reservation.startAt)}</strong><small>{formatTime(reservation.endAt)}</small></span>
              </button>
            ))}
          </div>
        </section>

        <section className="operator-panel audit-board" aria-label="Operator audit trail">
          <div className="panel-heading"><h2>Audit</h2><span>Latest</span></div>
          <div className="audit-list">{state.auditEvents.length === 0 ? <p className="operator-empty">No operator audit events yet.</p> : state.auditEvents.slice(0, 8).map((event) => <div className="audit-event" key={event.id}><time>{formatTime(event.createdAt)}</time><div><strong>{event.type}</strong><br />{event.reason}</div></div>)}</div>
        </section>
      </main>
    </div>
  );
}

function formatStatus(status: SuiteStatus): string {
  return status.replaceAll("_", " ");
}

function formatTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}