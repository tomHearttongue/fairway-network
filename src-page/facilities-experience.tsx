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
type TaskAction = "claim" | "start" | "complete";

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
  const topTask = state?.tasks[0];
  const otherTasks = state?.tasks.slice(1) ?? [];
  const selectedSuite = useMemo(() => {
    const preferredSuiteId = selectedSuiteId ?? topTask?.suiteId;
    return state?.suites.find((suite) => suite.id === preferredSuiteId) ?? state?.suites[0];
  }, [state, selectedSuiteId, topTask?.suiteId]);
  const selectedTaskForSuite = useMemo(() => state?.tasks.find((task) => task.suiteId === selectedSuite?.id), [state, selectedSuite?.id]);
  const readyCount = state?.suites.filter((suite) => suite.status === "available" && suite.openTaskCount === 0).length ?? 0;
  const contextChangedFromTopTask = Boolean(topTask && selectedSuite && selectedSuite.id !== topTask.suiteId);

  async function refresh() {
    const response = await fetch("/api/facilities/state", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Unable to load Cleaning Mode");
    setState(body);
  }

  useEffect(() => {
    refresh().catch((error) => setResult({ ok: false, message: String(error) }));
  }, []);

  async function mutateTask(task: FacilityTask, action: TaskAction) {
    setLoading(true);
    setResult(null);
    const response = await fetch(`/api/facilities/tasks/${task.id}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completionNotes: notes, idempotencyKey: `facilities-${action}-${task.id}-${crypto.randomUUID()}` }),
    });
    const body = await response.json();
    if (!response.ok) {
      setLoading(false);
      setResult({ ok: false, message: friendlyFacilitiesError(body.error, `${taskActionLabel(action)} failed for ${task.suiteName}.`) });
      return;
    }
    await refresh();
    setLoading(false);
    setResult({ ok: true, message: taskSuccessMessage(task, action) });
  }

  async function flagInspection() {
    if (!selectedSuite) return;
    if (!notes.trim()) {
      setResult({ ok: false, message: `Add a note before flagging ${selectedSuite.name} for inspection.` });
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
      setResult({ ok: false, message: friendlyFacilitiesError(body.error, `Inspection flag failed for ${selectedSuite.name}.`) });
      return;
    }
    await refresh();
    setLoading(false);
    setResult({ ok: true, message: `${body.suite?.name ?? selectedSuite.name} flagged for inspection.` });
  }

  if (!state) return <main className="facilities-shell loading-state">Loading Cleaning Mode...</main>;

  return (
    <div className="facilities-shell">
      <header className="facilities-header">
        <div>
          <span className="operator-kicker">Cleaning Mode</span>
          <h1>What should I service now?</h1>
          <p>{state.tasks.length === 0 ? "All suites are ready." : `${state.tasks.length} active ${state.tasks.length === 1 ? "task" : "tasks"}. ${readyCount} suites ready.`}</p>
        </div>
        <div className="operator-header-actions"><button className="secondary" type="button" onClick={refresh}><RefreshCcw size={17} />Refresh</button><UserButton /></div>
      </header>

      {result && <div className={`operator-result ${result.ok ? "success" : "error"}`}>{result.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}{result.message}</div>}

      <main className="facilities-grid">
        <section className="facility-next-card" aria-label="Next service task">
          <div className="panel-heading"><h2>Next Best Action</h2><span>{state.location.timezone}</span></div>
          {topTask ? <TaskCard task={topTask} featured loading={loading} onAction={(action) => mutateTask(topTask, action)} /> : <div className="all-ready"><CheckCircle2 size={36} /><strong>All suites are ready</strong><span>No turnover or inspection tasks are open.</span></div>}
        </section>

        <section className="operator-panel facilities-actions" aria-label="Service notes and inspection context">
          <div className="panel-heading"><h2>Service Notes</h2><Flag size={18} /></div>
          <div className={`selected-context ${contextChangedFromTopTask ? "context-warning" : ""}`} aria-live="polite">
            <span>Selected suite</span>
            <strong>{selectedSuite?.name ?? "No suite selected"}</strong>
            <span>{selectedSuite ? formatStatus(selectedSuite.status) : ""}{selectedTaskForSuite ? ` - ${formatTask(selectedTaskForSuite.taskType)} ${formatTaskStatus(selectedTaskForSuite.status)}` : ""}</span>
            {contextChangedFromTopTask && <em>Next Best Action is for {topTask?.suiteName}. You intentionally changed the target suite.</em>}
          </div>
          <label>Notes for {selectedSuite?.name ?? "selected suite"}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Completion note or inspection reason" /></label>
          <button className="danger" type="button" disabled={loading || !selectedSuite} onClick={flagInspection}><Flag size={17} />Flag {selectedSuite?.name ?? "suite"} for inspection</button>
        </section>

        {otherTasks.length > 0 && <section className="operator-panel facilities-task-list">
          <div className="panel-heading"><h2>Other Tasks</h2><span>{otherTasks.length}</span></div>
          <div className="task-list">{otherTasks.map((task) => <TaskCard key={task.id} task={task} loading={loading} onAction={(action) => mutateTask(task, action)} />)}</div>
        </section>}

        <section className="operator-panel facilities-suite-list">
          <div className="panel-heading"><h2>Suites</h2><span>{state.suites.length}</span></div>
          <div className="facility-suite-list">{state.suites.map((suite) => <button className={`facility-suite-row ${suite.id === selectedSuite?.id ? "selected" : ""}`} key={suite.id} type="button" aria-pressed={suite.id === selectedSuite?.id} onClick={() => setSelectedSuiteId(suite.id)}><strong>{suite.name}</strong><span>{formatStatus(suite.status)}</span><small>{suite.occupiedUntil ? `Occupied until ${formatTime(suite.occupiedUntil)}` : suite.nextReservationAt ? `Next reservation ${formatTime(suite.nextReservationAt)}` : "No upcoming booking"}</small></button>)}</div>
        </section>
      </main>
    </div>
  );
}

function TaskCard({ task, featured, loading, onAction }: { task: FacilityTask; featured?: boolean; loading: boolean; onAction: (action: TaskAction) => void }) {
  const nextAction = nextTaskAction(task);
  return (
    <article className={`task-card ${featured ? "featured" : ""}`} aria-label={`${task.suiteName} ${formatTask(task.taskType)} task`}>
      <div className="task-card-heading"><strong>{task.suiteName}</strong><span>{formatTask(task.taskType)} - {formatTaskStatus(task.status)}</span></div>
      <dl>
        <div><dt>Priority</dt><dd>{task.priority}</dd></div>
        <div><dt>Window</dt><dd>{task.minutesUntilNextReservation == null ? "Long vacancy" : `${task.minutesUntilNextReservation} min`}</dd></div>
        <div><dt>Due</dt><dd>{task.dueAt ? formatTime(task.dueAt) : "Flexible"}</dd></div>
      </dl>
      {nextAction ? <div className="button-row"><button className={nextAction === "complete" ? undefined : "secondary"} type="button" disabled={loading} onClick={() => onAction(nextAction)}>{taskActionIcon(nextAction)}{taskActionLabel(nextAction)}</button></div> : <p className="operator-empty">No further lifecycle action is available for this task.</p>}
    </article>
  );
}

function nextTaskAction(task: FacilityTask): TaskAction | null {
  if (task.status === "open") return "claim";
  if (task.status === "claimed") return "start";
  if (task.status === "in_progress") return "complete";
  return null;
}

function taskActionIcon(action: TaskAction) {
  if (action === "claim") return <ClipboardCheck size={16} />;
  if (action === "start") return <PlayCircle size={16} />;
  return <CheckCircle2 size={16} />;
}

function taskActionLabel(action: TaskAction): string {
  if (action === "claim") return "Claim task";
  if (action === "start") return "Start service";
  return "Mark ready";
}

function taskSuccessMessage(task: FacilityTask, action: TaskAction): string {
  if (action === "claim") return `${formatTask(task.taskType)} claimed for ${task.suiteName}.`;
  if (action === "start") return `${formatTask(task.taskType)} started for ${task.suiteName}.`;
  return `${task.suiteName} marked ready after ${formatTask(task.taskType)}.`;
}

function friendlyFacilitiesError(error: unknown, fallback: string): string {
  const value = String(error ?? "");
  if (value.includes("FACILITY_TASK_ALREADY_CLAIMED") || value.includes("FACILITY_TASK_CLAIMED_BY_ANOTHER")) return "Another facilities user already has this task. Refresh Cleaning Mode.";
  if (value.includes("REASON_REQUIRED")) return "Add a reason before changing suite readiness.";
  if (value.includes("FACILITIES_FORBIDDEN")) return "Your account does not have Facilities access for this location.";
  return fallback;
}

function formatTask(task: string): string { return titleCase(task.replaceAll("_", " ")); }
function formatTaskStatus(status: FacilityTask["status"]): string {
  if (status === "in_progress") return "In service";
  return titleCase(status.replaceAll("_", " "));
}
function formatStatus(status: SuiteStatus): string { return titleCase(status.replaceAll("_", " ")); }
function titleCase(value: string): string { return value.replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatTime(value: string | Date): string { return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
