"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { CheckCircle2, Clock3, DoorOpen, FileCheck2, Flag, Gauge, History, MapPin, Play, Target, Trash2, UserPlus, Users, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

type MemberReservationGuest = { id: string; guestId: string; displayName: string; status: "active" | "removed"; waiverStatus: "not_requested" | "requested" | "completed" | "verified" | "revoked"; verificationState: "pending" | "verified" | "rejected"; agreementVersion?: string; ready: boolean; accessEligible: boolean; createdAt: string; removedAt?: string };
type MemberReservation = { id: string; locationName: string; suiteName: string; suiteId: string; bookingMode: "ADVANCE" | "PLAY_NOW" | "OPERATOR" | "INSTRUCTOR"; status: "held" | "confirmed" | "checked_in" | "cancelled" | "completed"; startAt: string; endAt: string; creditsCommitted: number; canCancel: boolean; accessWindowStatus: "none" | "scheduled" | "active" | "expired" | "revoked"; accessGrant?: { id: string; status: "active" | "revoked" | "expired"; startsAt: string; expiresAt: string; revokedAt?: string } | null; sessionStartedAt?: string; sessionEndedAt?: string; canCompleteSession?: boolean; cancelledAt?: string; guests: MemberReservationGuest[] };
type DemoGolfProfile = { id: string; displayName: string; label: string; officialGolf: { handicapIndex: number | null; source: string; status: "simulated" | "manual" | "verified" | "not_established"; lastUpdated?: string }; performance: Array<{ clubCode: string; clubName: string; typicalCarryYards: number; ballSpeedMph?: number; dispersionYards: number; sampleCount: number; trend: "stable" | "building" | "improving"; provenance: string }>; activity: Array<{ id: string; title: string; detail: string; occurredAt: string }> };
type PlayNowQuoteOption = { durationMinutes: number; demandBand: "OFF_PEAK" | "STANDARD" | "PRIME"; creditUnits: number; creditCost: number; sufficientCredits: boolean };
type PlayNowQuote = { available: boolean; blockedReason?: string; suiteId?: string; suiteName?: string; availableUntil?: string; maxDurationMinutes?: number; durationMinutes?: number; demandBand?: "OFF_PEAK" | "STANDARD" | "PRIME"; creditUnits?: number; creditCost?: number; memberAvailableCredits: number; sufficientCredits?: boolean; options: PlayNowQuoteOption[] };
type AvailabilityResponse = { environment: { clerkConfigured: boolean; supabaseConfigured: boolean }; location: { id: string; name: string; timezone: string; minimumSessionMinutes: number; bookingIncrementMinutes: number; turnoverBufferMinutes: number; accessBeforeMinutes: number; accessAfterMinutes: number; playNowEnabled: boolean }; member: { person: { displayName: string; email: string }; profile: { id: string; memberNumber: string }; membershipPlan: { id?: string; code: string; monthlyCredits: number; bookingWindowDays: number; maxActiveFutureReservations: number; guestAllowance: number }; availableCredits: number }; availability: Array<{ suiteId: string; suiteName: string; status: "available" | "reserved" | "unavailable"; maxPlayNowMinutes: number; availableUntil?: string }>; playNowQuote?: PlayNowQuote; reservations: MemberReservation[]; auditEvents: Array<{ id: string; type: string; reason: string; createdAt: string }>; demoGolfProfile: DemoGolfProfile };
type ActionResult = { ok: boolean; message: string; reservationId?: string };
type CompletionSummary = { reservationId: string; memberFirstName: string; suiteName: string; durationMinutes: number };
type MemberView = "home" | "play" | "golf";

export function MemberExperience() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <main className="fairway-loading">Opening Fairway...</main>;
  if (!isSignedIn) return <main className="fairway-signin"><section className="signin-panel" aria-labelledby="signin-title"><div className="brand-lockup"><span className="brand-crest">FN</span><span>Fairway Network</span></div><p className="eyebrow">Practice. Compete. Improve.</p><h1 id="signin-title">Golf when you want to golf.</h1><p>Sign in to see Practice Suite availability, start a session, and carry your Fairway golf identity across every future location.</p><SignInButton mode="modal"><button className="primary-action" type="button"><Play size={18} />Sign in</button></SignInButton></section></main>;
  return <AuthenticatedFlow />;
}

function AuthenticatedFlow() {
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<MemberView>("home");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const upcomingReservations = useMemo(() => data?.reservations.filter((reservation) => reservation.status !== "cancelled" && reservation.status !== "completed") ?? [], [data]);
  const historicalReservations = useMemo(() => data?.reservations.filter((reservation) => reservation.status === "cancelled" || reservation.status === "completed") ?? [], [data]);
  const activeSession = useMemo(() => upcomingReservations.find((reservation) => reservation.status === "checked_in" && reservation.sessionStartedAt && !reservation.sessionEndedAt), [upcomingReservations]);
  const immediateReservation = useMemo(() => upcomingReservations.find((reservation) => reservation.bookingMode === "PLAY_NOW" && (reservation.status === "confirmed" || reservation.status === "checked_in")), [upcomingReservations]);
  const selectedReservation = useMemo(() => data?.reservations.find((reservation) => reservation.id === selectedReservationId) ?? activeSession ?? immediateReservation ?? upcomingReservations[0], [activeSession, data, immediateReservation, selectedReservationId, upcomingReservations]);
  const activeGuestCount = selectedReservation?.guests.filter((guest) => guest.status === "active").length ?? 0;
  const guestLimitReached = Boolean(data && selectedReservation && activeGuestCount >= data.member.membershipPlan.guestAllowance);
  const playNowOptions = data?.playNowQuote?.options ?? [];
  const selectedPlayNowOption = playNowOptions.find((option) => option.durationMinutes === selectedDuration) ?? playNowOptions[0];
  const canPlayNow = Boolean(data?.playNowQuote?.available && selectedPlayNowOption?.sufficientCredits && !immediateReservation);

  async function refresh() { const response = await fetch("/api/member/availability", { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(friendlyError(body.error, "We could not refresh Fairway. Try again in a moment.")); setData(body); }
  useEffect(() => { refresh().catch((error) => setResult({ ok: false, message: String(error) })); }, []);
  useEffect(() => { if (!selectedDuration && playNowOptions.length > 0) setSelectedDuration(playNowOptions[Math.min(2, playNowOptions.length - 1)].durationMinutes); }, [playNowOptions, selectedDuration]);

  function changeView(next: MemberView) {
    if (next !== view) setResult(null);
    setView(next);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }

  async function createPlayNowReservation() {
    if (!selectedPlayNowOption) { setResult({ ok: false, message: "No Play Now duration is available right now." }); return; }
    setLoading(true); setResult(null); setCompletionSummary(null);
    const quoteContext = data?.playNowQuote;
    const response = await fetch("/api/member/reservations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "PLAY_NOW", requestedMinutes: selectedPlayNowOption.durationMinutes, idempotencyKey: `play-now-${selectedPlayNowOption.durationMinutes}-${crypto.randomUUID()}` }) });
    const body = await response.json();
    if (!response.ok) { setLoading(false); await refresh().catch(() => undefined); setResult({ ok: false, message: friendlyError(body.error, `We could not complete that ${selectedPlayNowOption.durationMinutes}-minute session. Your credits were not charged.`) }); return; }
    setSelectedReservationId(body.reservation.id); changeView("play"); await refresh(); setLoading(false); setResult({ ok: true, reservationId: body.reservation.id, message: `${quoteContext?.suiteName ?? "Your Practice Suite"} is ready. ${accessGrantCopy(body.accessGrant)}` });
  }
  async function cancelReservation(reservationId: string) {
    setLoading(true); setResult(null); setCompletionSummary(null);
    const response = await fetch(`/api/member/reservations/${reservationId}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `cancel-${reservationId}` }) });
    const body = await response.json();
    if (!response.ok) { setLoading(false); setResult({ ok: false, message: friendlyError(body.error, "We could not cancel that reservation. The reservation is still safe."), reservationId }); return; }
    setSelectedReservationId(null); await refresh(); setLoading(false); setResult({ ok: true, message: `Reservation cancelled. ${formatCredits(Number(body.refundedCredits ?? 0))} credits returned.` });
  }

  async function startSession() {
    const reservationId = result?.reservationId ?? selectedReservation?.id;
    if (!reservationId) { setResult({ ok: false, message: "Choose a reservation before starting a session." }); return; }
    setLoading(true);
    const response = await fetch("/api/member/session/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reservationId, idempotencyKey: `session-${reservationId}` }) });
    const body = await response.json();
    if (!response.ok) { setLoading(false); setResult({ ok: false, message: friendlyError(body.error, "We could not start the session. Your reservation is still safe."), reservationId }); return; }
    setSelectedReservationId(reservationId); changeView("play"); await refresh(); setLoading(false); setResult({ ok: true, reservationId, message: "Session started. Enjoy your Practice Suite." });
  }

  async function completeSession() {
    const reservationId = result?.reservationId ?? selectedReservation?.id;
    if (!reservationId) { setResult({ ok: false, message: "Choose an active session before finishing." }); return; }
    const reservation = data?.reservations.find((item) => item.id === reservationId) ?? selectedReservation;
    setLoading(true); setResult(null); setCompletionSummary(null);
    const response = await fetch("/api/member/session/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reservationId, idempotencyKey: `complete-${reservationId}` }) });
    const body = await response.json();
    if (!response.ok) { setLoading(false); setResult({ ok: false, message: friendlyError(body.error, "We could not finish that session. Try again before leaving."), reservationId }); return; }
    setSelectedReservationId(reservationId);
    setCompletionSummary({ reservationId, memberFirstName: data ? memberFirstName(data.member.person.displayName, data.demoGolfProfile.displayName) : "there", suiteName: reservation?.suiteName ?? "Your Practice Suite", durationMinutes: reservation ? durationMinutesFor(reservation) : 0 });
    changeView("play"); await refresh(); setLoading(false);
  }
  async function addGuest() {
    if (!selectedReservation) { setResult({ ok: false, message: "Choose a reservation before adding a guest." }); return; }
    if (!guestName.trim()) { setResult({ ok: false, message: "Guest name is required." }); return; }
    setLoading(true); setResult(null); setCompletionSummary(null);
    const response = await fetch(`/api/member/reservations/${selectedReservation.id}/guests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ guestName, guestEmail, idempotencyKey: `guest-add-${selectedReservation.id}-${guestEmail || guestName}` }) });
    const body = await response.json();
    if (!response.ok) { setLoading(false); setResult({ ok: false, reservationId: selectedReservation.id, message: friendlyError(body.error, "We could not add that guest. Try again or remove another guest first.") }); return; }
    setGuestName(""); setGuestEmail(""); await refresh(); setLoading(false); setResult({ ok: true, reservationId: selectedReservation.id, message: `${body.reservationGuest.displayName} is added. Send their waiver before the session.` });
  }

  async function mutateGuest(reservationGuestId: string, action: "request" | "eligibility" | "remove") {
    if (!selectedReservation) return;
    setLoading(true); setResult(null); setCompletionSummary(null);
    const path = `/api/member/reservations/${selectedReservation.id}/guests/${reservationGuestId}`;
    const requestBody = action === "remove" ? { idempotencyKey: `guest-${action}-${reservationGuestId}` } : { action: guestActionName(action), idempotencyKey: `guest-${action}-${reservationGuestId}` };
    const response = await fetch(path, { method: action === "remove" ? "DELETE" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(requestBody) });
    const body = await response.json();
    if (!response.ok) { setLoading(false); setResult({ ok: false, reservationId: selectedReservation.id, message: friendlyError(body.error, "Guest readiness could not be updated. The reservation is unchanged.") }); return; }
    await refresh(); setLoading(false);
    const messages = { request: "Waiver sent. We will show this guest as ready once it is completed.", eligibility: body.accessEligible ? "Guest is ready for the active access window." : `Guest is not ready yet: ${friendlyGuestBlock(body.blockedReason)}.`, remove: "Guest removed from this reservation." };
    setResult({ ok: true, reservationId: selectedReservation.id, message: messages[action] });
  }

  if (!data) return <main className="fairway-loading">Checking Practice Suite availability...</main>;

  return (
    <div className="fairway-member">
      <header className="member-topbar">
        <div className="brand-lockup"><span className="brand-crest">FN</span><span>Fairway Network</span></div>
        <nav className="member-nav" aria-label="Member navigation"><button type="button" aria-current={view === "home" ? "page" : undefined} onClick={() => changeView("home")}>Home</button><button type="button" aria-current={view === "play" ? "page" : undefined} onClick={() => changeView("play")}>Play</button><button type="button" aria-current={view === "golf" ? "page" : undefined} onClick={() => changeView("golf")}>My Golf</button></nav>
        <div className="topbar-actions"><UserButton /></div>
      </header>
      <main className="member-main">
        <h2 className="sr-only">Practice Suite Availability</h2>
        <MemberContext headingRef={headingRef} view={view} data={data} canPlayNow={canPlayNow} selectedReservation={selectedReservation} />
        {result && <div className={`member-result ${result.ok ? "success" : "error"}`} role="status" aria-live="polite">{result.message}</div>}
        {view === "home" && <HomeView data={data} canPlayNow={canPlayNow} selectedReservation={selectedReservation} activeSession={activeSession} loading={loading} quote={data.playNowQuote} selectedOption={selectedPlayNowOption} immediateReservation={immediateReservation} onDurationChange={setSelectedDuration} onPlayNow={createPlayNowReservation} onStartSession={startSession} onCompleteSession={completeSession} onOpenPlay={() => changeView("play")} onOpenGolf={() => changeView("golf")} />}
        {view === "play" && <PlayView data={data} selectedReservation={selectedReservation} upcomingReservations={upcomingReservations} historicalReservations={historicalReservations} quote={data.playNowQuote} selectedOption={selectedPlayNowOption} canPlayNow={canPlayNow} loading={loading} guestName={guestName} guestEmail={guestEmail} guestLimitReached={guestLimitReached} immediateReservation={immediateReservation} completionSummary={completionSummary} onDurationChange={setSelectedDuration} onPlayNow={createPlayNowReservation} onStartSession={startSession} onCompleteSession={completeSession} onDismissCompletionSummary={() => { setCompletionSummary(null); changeView("home"); }} onViewGolfFromSummary={() => { setCompletionSummary(null); changeView("golf"); }} onCancel={cancelReservation} onSelectReservation={setSelectedReservationId} onGuestNameChange={setGuestName} onGuestEmailChange={setGuestEmail} onAddGuest={addGuest} onGuestAction={mutateGuest} />}
        {view === "golf" && <MyGolfView profile={data.demoGolfProfile} />}
      </main>
    </div>
  );
}

function MemberContext({ headingRef, view, data, canPlayNow, selectedReservation }: { headingRef: RefObject<HTMLHeadingElement | null>; view: MemberView; data: AvailabilityResponse; canPlayNow: boolean; selectedReservation?: MemberReservation }) {
  const firstName = memberFirstName(data.member.person.displayName, data.demoGolfProfile.displayName);
  const title = view === "home" ? `Ready to play, ${firstName}?` : view === "play" ? "Play" : "My Golf";
  const copy = view === "home"
    ? canPlayNow ? "Choose a duration and Fairway will assign the right Practice Suite." : selectedReservation ? `Next up: ${selectedReservation.suiteName} at ${formatDateTime(selectedReservation.startAt)}.` : "No suite is ready right now."
    : view === "play" ? "Start now, manage the current reservation, or bring a guest into this session."
    : "Your Fairway golf identity, baselines, and activity live here.";
  return <section className={`member-context ${view !== "home" ? "compact" : ""}`} aria-labelledby="member-home-title"><div><p className="eyebrow">{data.location.name}</p><h1 id="member-home-title" ref={headingRef} tabIndex={-1}>{title}</h1><p>{copy}</p></div><div className="member-summary" aria-label="Member summary"><span className="demo-badge">Demo</span><span><strong>{formatCredits(data.member.availableCredits)}</strong> credits</span><span>{planLabel(data.member.membershipPlan.code)}</span></div></section>;
}
function HomeView({ data, canPlayNow, selectedReservation, activeSession, immediateReservation, loading, quote, selectedOption, onDurationChange, onPlayNow, onStartSession, onCompleteSession, onOpenPlay, onOpenGolf }: { data: AvailabilityResponse; canPlayNow: boolean; selectedReservation?: MemberReservation; activeSession?: MemberReservation; immediateReservation?: MemberReservation; loading: boolean; quote?: PlayNowQuote; selectedOption?: PlayNowQuoteOption; onDurationChange: (value: number) => void; onPlayNow: () => void; onStartSession: () => void; onCompleteSession: () => void; onOpenPlay: () => void; onOpenGolf: () => void }) {
  const attentionGuest = selectedReservation?.guests.find((guest) => guest.status === "active" && !guest.ready);
  const featuredReservation = activeSession ?? immediateReservation ?? selectedReservation;
  return <section className="home-layout" aria-label="Fairway home"><PlayNowPanel quote={quote} selectedOption={selectedOption} immediateReservation={immediateReservation} loading={loading} canPlayNow={canPlayNow} onDurationChange={onDurationChange} onPlayNow={onPlayNow} onStartSession={onStartSession} onCompleteSession={onCompleteSession} /><article className="session-card"><div className="section-heading"><span><DoorOpen size={18} />{activeSession ? "Current session" : "Up next"}</span></div>{featuredReservation ? <SessionState reservation={featuredReservation} loading={loading} showActions={!immediateReservation} onStartSession={onStartSession} onCompleteSession={onCompleteSession} /> : <EmptyState title="No reservation yet" body="Play Now is the fastest path when a suite is ready." action="Open Play" onAction={onOpenPlay} />}</article><article className="insight-card"><div className="section-heading"><span><Target size={18} />My Golf</span><button className="text-button" type="button" onClick={onOpenGolf}>View</button></div><PassportPreview profile={data.demoGolfProfile} /></article>{attentionGuest && <article className="attention-card"><div className="section-heading"><span><Flag size={18} />Guest readiness</span></div><p><strong>{attentionGuest.displayName}</strong> still needs waiver completion before they are ready for this reservation.</p></article>}</section>;
}
function PlayView({ data, selectedReservation, upcomingReservations, historicalReservations, quote, selectedOption, immediateReservation, completionSummary, canPlayNow, loading, guestName, guestEmail, guestLimitReached, onDurationChange, onPlayNow, onStartSession, onCompleteSession, onDismissCompletionSummary, onViewGolfFromSummary, onCancel, onSelectReservation, onGuestNameChange, onGuestEmailChange, onAddGuest, onGuestAction }: { data: AvailabilityResponse; selectedReservation?: MemberReservation; upcomingReservations: MemberReservation[]; historicalReservations: MemberReservation[]; quote?: PlayNowQuote; selectedOption?: PlayNowQuoteOption; immediateReservation?: MemberReservation; completionSummary: CompletionSummary | null; canPlayNow: boolean; loading: boolean; guestName: string; guestEmail: string; guestLimitReached: boolean; onDurationChange: (value: number) => void; onPlayNow: () => void; onStartSession: () => void; onCompleteSession: () => void; onDismissCompletionSummary: () => void; onViewGolfFromSummary: () => void; onCancel: (reservationId: string) => void; onSelectReservation: (reservationId: string) => void; onGuestNameChange: (value: string) => void; onGuestEmailChange: (value: string) => void; onAddGuest: () => void; onGuestAction: (reservationGuestId: string, action: "request" | "eligibility" | "remove") => void }) {
  if (completionSummary) return <section className="play-layout completion-layout" aria-label="Completed session"><SessionCompletionPanel summary={completionSummary} onDone={onDismissCompletionSummary} onViewGolf={onViewGolfFromSummary} /></section>;
  return <section className="play-layout" aria-label="Play and booking"><PlayNowPanel quote={quote} selectedOption={selectedOption} immediateReservation={immediateReservation} loading={loading} canPlayNow={canPlayNow} onDurationChange={onDurationChange} onPlayNow={onPlayNow} onStartSession={onStartSession} onCompleteSession={onCompleteSession} /><article className="flow-panel session-flow"><div className="section-heading"><span><Clock3 size={18} />Selected session</span></div>{selectedReservation ? <SessionState reservation={selectedReservation} loading={loading} showActions={!immediateReservation || selectedReservation.id !== immediateReservation.id} onStartSession={onStartSession} onCompleteSession={onCompleteSession} /> : <EmptyState title="No reservation selected" body="Create or choose a reservation to see suite and access details." />}</article><ReservationList title="Upcoming" reservations={upcomingReservations.slice(0, 3)} selectedReservationId={selectedReservation?.id} loading={loading} onSelect={onSelectReservation} onCancel={onCancel} /><GuestPanel reservation={selectedReservation} allowance={data.member.membershipPlan.guestAllowance} guestName={guestName} guestEmail={guestEmail} loading={loading} limitReached={guestLimitReached} onGuestNameChange={onGuestNameChange} onGuestEmailChange={onGuestEmailChange} onAddGuest={onAddGuest} onGuestAction={onGuestAction} /><details className="flow-panel inventory-flow"><summary><span><MapPin size={18} />Suite details</span><small>{data.availability.filter((slot) => slot.status === "available").length} ready now</small></summary><div className="suite-lineup">{data.availability.map((slot) => <div className={`suite-chip ${slot.status}`} key={slot.suiteId}><strong>{slot.suiteName}</strong><span>{availabilityLabel(slot)}</span></div>)}</div></details>{historicalReservations.length > 0 && <details className="flow-panel reservation-flow"><summary><span><History size={18} />Recent activity</span><small>{historicalReservations.length}</small></summary><ReservationStack reservations={historicalReservations.slice(0, 4)} selectedReservationId={selectedReservation?.id} loading={loading} onSelect={onSelectReservation} onCancel={onCancel} emptyTitle="No recent activity" /></details>}</section>;
}
function PlayNowPanel({ quote, selectedOption, immediateReservation, loading, canPlayNow, onDurationChange, onPlayNow, onStartSession, onCompleteSession }: { quote?: PlayNowQuote; selectedOption?: PlayNowQuoteOption; immediateReservation?: MemberReservation; loading: boolean; canPlayNow: boolean; onDurationChange: (value: number) => void; onPlayNow: () => void; onStartSession: () => void; onCompleteSession: () => void }) {
  if (immediateReservation) {
    return <article className="play-now-card ready-card"><div className="availability-pill"><span className="dot ready" />{immediateReservation.status === "checked_in" ? "Session active" : "You are ready"}</div><h2>{immediateReservation.suiteName}</h2><p>{accessReadyCopy(immediateReservation)} Session runs until {formatTime(immediateReservation.endAt)}.</p><div className="action-stack">{immediateReservation.status === "confirmed" && <button className="primary-action large" type="button" disabled={loading} onClick={onStartSession}><DoorOpen size={20} />Start Session</button>}{immediateReservation.status === "checked_in" && immediateReservation.canCompleteSession && <button className="primary-action large" type="button" disabled={loading} onClick={onCompleteSession}><CheckCircle2 size={20} />Finish Session</button>}</div></article>;
  }
  const options = quote?.options ?? [];
  const blocked = !quote?.available || options.length === 0;
  return <article className="play-now-card"><div className="availability-pill"><span className={blocked ? "dot blocked" : "dot ready"} />{blocked ? blockedPlayNowLabel(quote?.blockedReason) : "Suite available now"}</div><h2>{selectedOption ? `${selectedOption.durationMinutes} minutes` : "Play Now"}</h2><p>{selectedOption ? `${formatCredits(selectedOption.creditCost)} credits · ${demandBandLabel(selectedOption.demandBand)}. Fairway will assign an available Practice Suite.` : "We will show the next safe option when a Practice Suite is ready."}</p>{options.length > 0 && <div className="duration-options" role="radiogroup" aria-label="Play Now duration">{options.map((option) => <button key={option.durationMinutes} type="button" className={selectedOption?.durationMinutes === option.durationMinutes ? "selected" : ""} aria-pressed={selectedOption?.durationMinutes === option.durationMinutes} onClick={() => onDurationChange(option.durationMinutes)}>{option.durationMinutes} min<span>{formatCredits(option.creditCost)} credits</span></button>)}</div>}{selectedOption && !selectedOption.sufficientCredits && <p className="member-warning">This session needs {formatCredits(selectedOption.creditCost)} credits. You have {formatCredits(quote?.memberAvailableCredits ?? 0)}.</p>}<div className="action-stack"><button className="primary-action large" type="button" disabled={loading || !canPlayNow} onClick={onPlayNow}><Play size={20} />Confirm Play Now</button></div></article>;
}
function SessionCompletionPanel({ summary, onDone, onViewGolf }: { summary: CompletionSummary; onDone: () => void; onViewGolf: () => void }) {
  const duration = summary.durationMinutes > 0 ? `${summary.durationMinutes} minutes` : "Session saved";
  return <article className="completion-card" role="status" aria-live="polite"><p className="eyebrow">Session complete</p><h2>Nice work, {summary.memberFirstName}.</h2><p><strong>{summary.suiteName}</strong> - {duration}</p><p>Your Fairway activity has been saved.</p><div className="action-stack horizontal"><button className="primary-action" type="button" onClick={onViewGolf}><Target size={18} />View My Golf</button><button className="quiet-button" type="button" onClick={onDone}>Done</button></div></article>;
}
function MyGolfView({ profile }: { profile: DemoGolfProfile }) {
  const completedCount = profile.activity.length;
  const hasOfficialHandicap = profile.officialGolf.handicapIndex != null;
  return <section className="golf-layout" aria-label="My Golf and Golfer Passport"><article className="passport-hero"><p className="eyebrow">Golfer Passport</p><h2>{profile.displayName} <span>{profile.label}</span></h2><p>{hasOfficialHandicap ? "Official golf identity, Fairway baselines, and recent activity in one place." : "Your Fairway golf identity will build as you play."}</p><div className={`official-golf ${hasOfficialHandicap ? "" : "empty"}`}><span>Handicap Index</span>{hasOfficialHandicap ? <strong>{formatHandicap(profile.officialGolf.handicapIndex)}</strong> : <strong>No handicap connected</strong>}<small>{officialGolfLabel(profile.officialGolf.status, profile.officialGolf.source)}</small></div></article><article className="performance-panel"><div className="section-heading"><span><Gauge size={18} />Fairway Performance</span></div><div className="club-grid">{profile.performance.length === 0 ? <EmptyState title="No Fairway baseline yet" body="After a few Practice Suite sessions, this becomes your club-level view of carry distance, dispersion, and progress." /> : profile.performance.map((club) => <ClubMetric key={club.clubCode} club={club} />)}</div></article><article className="activity-panel"><div className="section-heading"><span><History size={18} />Fairway Activity</span><small>{completedCount} completed</small></div><div className="activity-list">{profile.activity.length === 0 ? <EmptyState title="No Fairway activity yet" body="Sessions and practice history will appear here after you play." /> : profile.activity.map((activity) => <div className="activity-row" key={activity.id}><time>{formatDate(activity.occurredAt)}</time><strong>{activity.title}</strong><span>{activity.detail}</span></div>)}</div><p className="supporting-copy">Demo data is marked as demo until live performance sources are connected.</p></article></section>;
}
function SessionState({ reservation, loading, showActions = true, onStartSession, onCompleteSession }: { reservation: MemberReservation; loading: boolean; showActions?: boolean; onStartSession: () => void; onCompleteSession: () => void }) {
  const readyGuests = reservation.guests.filter((guest) => guest.status === "active" && guest.ready).length;
  const activeGuests = reservation.guests.filter((guest) => guest.status === "active").length;
  const canStart = reservation.status === "confirmed";
  const canFinish = reservation.status === "checked_in" && Boolean(reservation.canCompleteSession);
  return <div className="session-state-card"><div><span className="state-label">{reservationStatusLabel(reservation)}</span><h3>{reservation.suiteName}</h3><p>{formatDateTime(reservation.startAt)} to {formatTime(reservation.endAt)}</p></div><dl className="state-list"><div><dt>Access</dt><dd>{accessStatusLabel(reservation.accessWindowStatus)}</dd></div><div><dt>Booking</dt><dd>{bookingModeLabel(reservation.bookingMode)}</dd></div><div><dt>Guests</dt><dd>{activeGuests === 0 ? "None" : `${readyGuests}/${activeGuests} ready`}</dd></div></dl>{showActions && canStart && <div className="action-stack horizontal"><button className="primary-action" type="button" disabled={loading} onClick={onStartSession}><DoorOpen size={18} />Start session</button></div>}{showActions && canFinish && <div className="action-stack horizontal"><button className="primary-action" type="button" disabled={loading} onClick={onCompleteSession}><CheckCircle2 size={18} />Finish session</button></div>}{!canStart && !canFinish && reservation.status === "completed" && <p className="supporting-copy">Session complete. Your activity is saved.</p>}</div>;
}
function ReservationList(props: { title: string; reservations: MemberReservation[]; selectedReservationId?: string; loading: boolean; onSelect: (reservationId: string) => void; onCancel: (reservationId: string) => void }) {
  return <article className="flow-panel reservation-flow"><div className="section-heading"><span><Flag size={18} />{props.title}</span></div><ReservationStack {...props} emptyTitle={`No ${props.title.toLowerCase()} reservations`} /></article>;
}

function ReservationStack({ reservations, selectedReservationId, loading, onSelect, onCancel, emptyTitle }: { reservations: MemberReservation[]; selectedReservationId?: string; loading: boolean; onSelect: (reservationId: string) => void; onCancel: (reservationId: string) => void; emptyTitle: string }) {
  return <div className="reservation-stack">{reservations.length === 0 ? <EmptyState title={emptyTitle} body="Your Fairway activity will appear here as you play." /> : reservations.map((reservation) => <div className={`reservation-tile ${reservation.id === selectedReservationId ? "selected" : ""}`} key={reservation.id}><button type="button" onClick={() => onSelect(reservation.id)}><strong>{reservation.suiteName}</strong><span>{formatDateTime(reservation.startAt)} - {bookingModeLabel(reservation.bookingMode)}</span></button><div className="reservation-meta"><span>{reservationStatusLabel(reservation)}</span><span>{formatCredits(reservation.creditsCommitted)} credits</span><span>{accessStatusLabel(reservation.accessWindowStatus)}</span></div>{reservation.guests.length > 0 && <p>{reservation.guests.filter((guest) => guest.status === "active" && guest.ready).length}/{reservation.guests.filter((guest) => guest.status === "active").length} guests ready</p>}{reservation.canCancel && <button className="danger-action" type="button" disabled={loading} onClick={() => onCancel(reservation.id)}><XCircle size={16} />Cancel</button>}</div>)}</div>;
}
function GuestPanel({ reservation, allowance, guestName, guestEmail, loading, limitReached, onGuestNameChange, onGuestEmailChange, onAddGuest, onGuestAction }: { reservation?: MemberReservation; allowance: number; guestName: string; guestEmail: string; loading: boolean; limitReached: boolean; onGuestNameChange: (value: string) => void; onGuestEmailChange: (value: string) => void; onAddGuest: () => void; onGuestAction: (reservationGuestId: string, action: "request" | "eligibility" | "remove") => void }) {
  const guests = reservation?.guests ?? [];
  const activeGuests = guests.filter((guest) => guest.status === "active");
  const canAdd = Boolean(reservation && reservation.status !== "cancelled" && reservation.status !== "completed" && !limitReached && !loading);
  return <article className="flow-panel guest-flow"><div className="section-heading"><span><Users size={18} />Guests</span><small>{activeGuests.length}/{allowance} allowed</small></div>{!reservation && <EmptyState title="Choose a reservation" body="Guest readiness is managed for a specific reservation or session." />}{reservation && <>{!limitReached && <div className="guest-form refined"><label>Guest name<input value={guestName} onChange={(event) => onGuestNameChange(event.target.value)} placeholder="Guest name" /></label><label>Guest email optional<input type="email" value={guestEmail} onChange={(event) => onGuestEmailChange(event.target.value)} placeholder="guest@example.com" /></label><button className="secondary-action" type="button" disabled={!canAdd || !guestName.trim()} onClick={onAddGuest}><UserPlus size={17} />Add guest</button></div>}{limitReached && <p className="member-warning">{activeGuests.length}/{allowance} guest added. Remove a guest before adding another.</p>}<div className="guest-list refined-list">{guests.length === 0 ? <p className="supporting-copy">No guests yet. Guests must be added to this reservation and complete the required waiver before they are ready.</p> : guests.map((guest) => <GuestTile key={guest.id} guest={guest} loading={loading} onGuestAction={onGuestAction} />)}</div></>}</article>;
}

function GuestTile({ guest, loading, onGuestAction }: { guest: MemberReservationGuest; loading: boolean; onGuestAction: (reservationGuestId: string, action: "request" | "eligibility" | "remove") => void }) {
  const canSend = guest.status !== "removed" && guest.waiverStatus === "not_requested";
  const canResend = guest.status !== "removed" && guest.waiverStatus === "requested" && guest.verificationState !== "verified";
  return <div className={`guest-tile ${guest.ready ? "ready" : "pending"}`}><div className="guest-copy"><strong>{guest.displayName}</strong><span>{guestStatusLabel(guest)}</span></div><div className="guest-actions">{canSend && <button className="quiet-button" type="button" disabled={loading} onClick={() => onGuestAction(guest.id, "request")}><FileCheck2 size={16} />Send waiver</button>}{canResend && <button className="quiet-button" type="button" disabled={loading} onClick={() => onGuestAction(guest.id, "request")}><FileCheck2 size={16} />Resend</button>}<button className="quiet-button" type="button" disabled={loading || guest.status === "removed"} onClick={() => onGuestAction(guest.id, "eligibility")}>Check readiness</button><button className="danger-action" type="button" disabled={loading || guest.status === "removed"} onClick={() => onGuestAction(guest.id, "remove")}><Trash2 size={16} />Remove</button></div></div>;
}

function PassportPreview({ profile }: { profile: DemoGolfProfile }) {
  if (profile.performance.length === 0) return <div className="passport-preview empty"><strong>Build your baseline</strong><span>Complete sessions to start tracking your golf.</span><small>{officialGolfLabel(profile.officialGolf.status, profile.officialGolf.source)}</small></div>;
  return <><div className="passport-preview"><strong>{formatHandicap(profile.officialGolf.handicapIndex)}</strong><span>Handicap Index</span><small>{officialGolfLabel(profile.officialGolf.status, profile.officialGolf.source)}</small></div><div className="mini-metrics">{profile.performance.slice(0, 2).map((club) => <span key={club.clubCode}><strong>{club.typicalCarryYards} yd</strong>{club.clubName} carry</span>)}</div></>;
}

function ClubMetric({ club }: { club: DemoGolfProfile["performance"][number] }) {
  return <div className="club-metric"><div className="club-metric-head"><strong>{club.clubName}</strong><span>{club.provenance}</span></div><div className="metric-lead"><strong>{club.typicalCarryYards} yd</strong><span>Typical carry</span></div><dl><div><dt>Dispersion</dt><dd>{club.dispersionYards} yd</dd></div>{club.ballSpeedMph && <div><dt>Ball speed</dt><dd>{club.ballSpeedMph} mph</dd></div>}<div><dt>Sample</dt><dd>{club.sampleCount} swings</dd></div></dl></div>;
}
function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) { return <div className="empty-state"><strong>{title}</strong><p>{body}</p>{action && onAction && <button className="quiet-button" type="button" onClick={onAction}>{action}</button>}</div>; }
function guestActionName(action: "request" | "eligibility"): "request_waiver" | "check_eligibility" { return action === "request" ? "request_waiver" : "check_eligibility"; }
function guestStatusLabel(guest: MemberReservationGuest): string { if (guest.status === "removed") return "Removed"; if (guest.ready && guest.accessEligible) return "Ready now"; if (guest.ready) return "Ready when access opens"; if (guest.waiverStatus === "not_requested") return "Waiver required"; if (guest.verificationState !== "verified") return "Waiting for waiver completion"; return "Not ready"; }
function reservationStatusLabel(reservation: MemberReservation): string { if (reservation.status === "checked_in") return "Session active"; if (reservation.status === "confirmed" && new Date(reservation.startAt) > new Date()) return "Booked"; if (reservation.status === "confirmed") return "Ready to start"; if (reservation.status === "completed") return "Completed"; if (reservation.status === "cancelled") return "Cancelled"; return "Held"; }
function bookingModeLabel(mode: MemberReservation["bookingMode"]): string { if (mode === "PLAY_NOW") return "Play Now"; if (mode === "ADVANCE") return "Booked ahead"; if (mode === "OPERATOR") return "Operator assisted"; return "Instructor time"; }
function accessStatusLabel(status: MemberReservation["accessWindowStatus"]): string { if (status === "active") return "Access open"; if (status === "scheduled") return "Access scheduled"; if (status === "expired") return "Access closed"; if (status === "revoked") return "Access closed"; return "No access yet"; }
function availabilityLabel(slot: AvailabilityResponse["availability"][number]): string { if (slot.status === "available") return `${slot.maxPlayNowMinutes} min now`; if (slot.status === "reserved") return "Protected booking"; return "Not ready"; }
function officialGolfLabel(status: DemoGolfProfile["officialGolf"]["status"], source: string): string { if (status === "not_established") return "No official handicap connected"; if (status === "simulated") return source || "Demo official handicap"; if (status === "manual") return "Manual handicap"; return "Verified handicap"; }
function friendlyError(error: unknown, fallback: string): string { const message = String(error ?? ""); if (message.includes("SUITE_NOT_AVAILABLE")) return "That suite is no longer available. Your credits were not charged."; if (message.includes("ACTIVE_RESERVATION_LIMIT_REACHED")) return "You have reached the active booking limit for this membership."; if (message.includes("INSUFFICIENT_CREDITS")) return "You do not have enough credits for that session."; if (message.includes("PLAY_NOW_DURATION_UNAVAILABLE")) return "That Play Now duration is no longer available. Choose another duration and try again."; if (message.includes("GUEST_ALLOWANCE_EXCEEDED")) return "Guest limit reached for this membership."; if (message.includes("SESSION_ALREADY_STARTED")) return "This session has already started, so normal member cancellation is closed."; return fallback; }
function friendlyGuestBlock(reason: unknown): string { const value = String(reason ?? ""); if (value.includes("WAIVER_ACCEPTANCE_REQUIRED")) return "waiver pending"; if (value.includes("ACCESS_WINDOW_INACTIVE")) return "access window is not active"; if (value.includes("GUEST_REMOVED")) return "guest was removed"; return "not eligible"; }
function memberFirstName(displayName: string, fallbackName = "there"): string { const source = displayName && !displayName.includes("@") ? displayName : fallbackName; return source.split(/[ ._-]/)[0] || "there"; }
function planLabel(code: string): string { return code.replace(/^TEST_/, "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatHandicap(value: number | null): string { return value == null ? "Not set" : value.toFixed(1); }
function formatCredits(value: number): string { return Number.isInteger(value) ? String(value) : value.toFixed(1); }
function demandBandLabel(value: PlayNowQuoteOption["demandBand"]): string { if (value === "OFF_PEAK") return "Off-peak"; if (value === "PRIME") return "Prime"; return "Standard"; }
function blockedPlayNowLabel(reason?: string): string { if (reason?.includes("NO_SUITE_AVAILABLE")) return "No suite ready right now"; if (reason?.includes("PLAY_NOW_DISABLED")) return "Play Now unavailable"; return "No Play Now option"; }
function accessGrantCopy(accessGrant?: { startsAt?: string; expiresAt?: string }): string { if (!accessGrant?.startsAt) return "Access will be prepared for this session."; const now = Date.now(); const starts = new Date(accessGrant.startsAt).getTime(); const expires = accessGrant.expiresAt ? new Date(accessGrant.expiresAt).getTime() : Number.POSITIVE_INFINITY; if (now >= starts && now < expires) return "Access is open now."; return `Access opens at ${formatTime(accessGrant.startsAt)}.`; }
function durationMinutesFor(reservation: MemberReservation): number { return Math.max(0, Math.round((new Date(reservation.endAt).getTime() - new Date(reservation.startAt).getTime()) / 60000)); }
function accessReadyCopy(reservation: MemberReservation): string { if (reservation.accessWindowStatus === "active") return "Access is open now."; if (reservation.accessGrant?.startsAt) return `Access opens at ${formatTime(reservation.accessGrant.startsAt)}.`; return "Access will be ready for this session."; }
function formatTime(value: string | Date): string { return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function formatDate(value: string | Date): string { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value)); }
function formatDateTime(value: string | Date): string { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }












