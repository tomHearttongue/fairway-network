"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Flag, PlayCircle, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SuiteStatus = "available" | "occupied" | "turnover" | "inspection_required" | "maintenance" | "out_of_service" | "administrative_hold";

type FacilityTask = {
  id: string;
  suiteId: string;
  suiteName: string;
  taskType: "turnover" | "inspection";
  priority: number;
  status: "open" | "claimed" | "in_progress" | "completed" | "cancelled";
  dueAt?: string | null;
  claimedBySelf: boolean;
  nextReservationAt?: string | null;
  minutesUntilNextReservation?: number | null;
  occupiedUntil?: string | null;
};

type FacilitiesSuite = {
  id: string;
  name: string;
  status: SuiteStatus;
  occupiedUntil?: string | null;
  nextReservationAt?: string | null;
  minutesUntilNextReservation?: number | null;
  openTaskCount: number;
};

type FacilitiesState = {
  location: { name: string; timezone: string };
  suites: FacilitiesSuite[];
  tasks: FacilityTask[];
  auditEvents: Array<{ id: string; type: string; reason: string; createdAt: string }>;
};

type Result = { ok: boolean; message: string };

export function FacilitiesExperience() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <main className="facilities-shell loading-state">Loading Cleaning Mode...</main>;
  if (!isSignedIn) {
    return (
      <main className="setup-page">
        <section className="setup-panel">
          <div className="brand"><span className="brand-mark">FN</span>Fairway Network</div>
          <h1>Facilities Sign In</h1>
          <p>Cleaning Mode requires a restricted Fairway Facilities role.</p>
          <SignInButton mode="modal"><button type="button">Sign In</button></SignInButton>
        </section>
      </main>
    );
  }
  return <FacilitiesControls />;
}

function FacilitiesControls() {
  const [state, setState] = useState<FacilitiesState | null>(null);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const selectedSuite = useMemo(() => state?.suites.find((suite) => suite.id === selectedSuiteId) ?? state?.suites[0], [state, selectedSuiteId]);
  const topTask = state?.tasks[0];
  const readyCount = state?.suites.filter((suite) => suite.status === "available" && suite.openTaskCount === 0).length ?? 0;

  async function refresh() {
    const response = await fetch("/api/facilities/state", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Unable to load Cleaning Mode");
    setState(body);
  }

  useEffect(() => {
    refresh().catch((error) => setResult({ ok: false, message: String(error) }));
  }, []);

  async function mutateTask(taskId: string, action: "claim" | "start" | "complete") {
    setLoading(true);
    setResult(null);
    const response = await fetch(`/api/facilities/tasks/${taskId}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completionNotes: notes, idempotencyKey: `facilities-${action}-${taskId}-${crypto.randomUUID()}` }),
    });
    const body = await response.json();
    if (!response.ok) {
      setLoading(false);
      setResult({ ok: false, message: body.error ?? `${action} failed` });
      return;
    }
    await refresh();
    setLoading(false);
    setResult({ ok: true, message: `${formatTask(body.task.taskType)} ${action}ed for ${body.task.suiteName ?? "suite"}.` });
  }

  async function flagInspection() {
    if (!selectedSuite) return;
    if (!notes.trim()) {
      setResult({ ok: false, message: "Add a note before flagging inspection." });
      return;
    }
    const ok = window.confirm(`Flag ${selectedSuite.name} for inspection?`);
    if (!ok) return;
    setLoading(true);
    setResult(null);
    const response = await fetch(`/api/facilities/suites/${selectedSuite.id}/inspection`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: notes, idempotencyKey: `inspection-${selectedSuite.id}-${crypto.randomUUID()}` }),
    });
    const body = await response.json();
    if (!response.ok) {
      setLoading(false);
      setResult({ ok: false, message: body.error ?? "Inspection flag failed" });
      return;
    }
    await refresh();
    setLoading(false);
    setResult({ ok: true, message: `${body.suite.name} flagged for inspection.` });
  }

  if (!state) return <main className="facilities-shell loading-state">Loading Cleaning Mode...</main>;

  return (
    <div className="facilities-shell">
      <header className="facilities-header">
        <div>
          <span className="operator-kicker">Cleaning Mode</span>
          <h1>What should I service now?</h1>
          <p>{state.tasks.length === 0 ? "All suites are ready." : `${state.tasks.length} active tasks. ${readyCount} suites ready.`}</p>
        </div>
        <div className="operator-header-actions"><button className="secondary" type="button" onClick={refresh}><RefreshCcw size={17} />Refresh</button><UserButton /></div>
      </header>

      {result && <div className={`operator-result ${result.ok ? "success" : "error"}`}>{result.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}{result.message}</div>}

      <main className="facilities-grid">
        <section className="facility-next-card" aria-label="Next service task">
          <div className="panel-heading"><h2>Next Best Action</h2><span>{state.location.timezone}</span></div>
          {topTask ? <TaskCard task={topTask} featured loading={loading} onClaim={() => mutateTask(topTask.id, "claim")} onStart={() => mutateTask(topTask.id, "start")} onComplete={() => mutateTask(topTask.id, "complete")} /> : <div className="all-ready"><CheckCircle2 size={36} /><strong>All suites are ready</strong><span>No turnover or inspection tasks are open.</span></div>}
        </section>

        <section className="operator-panel facilities-actions">
          <div className="panel-heading"><h2>Service Notes</h2><Flag size={18} /></div>
          <label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Completion note or inspection reason" /></label>
          <div className="selected-context"><strong>{selectedSuite?.name ?? "No suite selected"}</strong><span>{selectedSuite ? formatStatus(selectedSuite.status) : ""}</span></div>
          <button className="danger" type="button" disabled={loading || !selectedSuite} onClick={flagInspection}><Flag size={17} />Flag Inspection</button>
        </section>

        <section className="operator-panel facilities-task-list">
          <div className="panel-heading"><h2>Queue</h2><span>{state.tasks.length}</span></div>
          <div className="task-list">{state.tasks.length === 0 ? <p className="operator-empty">All suites are ready.</p> : state.tasks.map((task) => <TaskCard key={task.id} task={task} loading={loading} onClaim={() => mutateTask(task.id, "claim")} onStart={() => mutateTask(task.id, "start")} onComplete={() => mutateTask(task.id, "complete")} />)}</div>
        </section>

        <section className="operator-panel facilities-suite-list">
          <div className="panel-heading"><h2>Suites</h2><span>{state.suites.length}</span></div>
          <div className="facility-suite-list">{state.suites.map((suite) => <button className={`facility-suite-row ${suite.id === selectedSuite?.id ? "selected" : ""}`} key={suite.id} type="button" onClick={() => setSelectedSuiteId(suite.id)}><strong>{suite.name}</strong><span>{formatStatus(suite.status)}</span><small>{suite.occupiedUntil ? `Occupied until ${formatTime(suite.occupiedUntil)}` : suite.nextReservationAt ? `Next reservation ${formatTime(suite.nextReservationAt)}` : "No upcoming booking"}</small></button>)}</div>
        </section>
      </main>
    </div>
  );
}

function TaskCard({ task, featured, loading, onClaim, onStart, onComplete }: { task: FacilityTask; featured?: boolean; loading: boolean; onClaim: () => void; onStart: () => void; onComplete: () => void }) {
  return (
    <article className={`task-card ${featured ? "featured" : ""}`}>
      <div><strong>{task.suiteName}</strong><span>{formatTask(task.taskType)} / {task.status}</span></div>
      <dl>
        <dt>Priority</dt><dd>{task.priority}</dd>
        <dt>Window</dt><dd>{task.minutesUntilNextReservation == null ? "Long vacancy" : `${task.minutesUntilNextReservation} min`}</dd>
        <dt>Due</dt><dd>{task.dueAt ? formatTime(task.dueAt) : "Flexible"}</dd>
      </dl>
      <div className="button-row"><button className="secondary" type="button" disabled={loading || task.status !== "open"} onClick={onClaim}><ClipboardCheck size={16} />Claim</button><button className="secondary" type="button" disabled={loading || task.status === "completed"} onClick={onStart}><PlayCircle size={16} />Start</button><button type="button" disabled={loading || task.status === "completed"} onClick={onComplete}><CheckCircle2 size={16} />Complete</button></div>
    </article>
  );
}

function formatTask(task: string): string { return task.replaceAll("_", " "); }
function formatStatus(status: SuiteStatus): string { return status.replaceAll("_", " "); }
function formatTime(value: string | Date): string { return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value)); }