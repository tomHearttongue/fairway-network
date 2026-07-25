export type EvidenceCapture = {
  captureId: string;
  logicalStateId: string;
  stepId: string;
  viewport: string;
  reconciliationPath?: string;
};

export type EvidenceAssertion = {
  id: string;
  evidenceType: "ui" | "state";
  sourcePath: string;
  comparator: "equals" | "contains" | "count" | "absent";
  expected: string | number | boolean | null;
  actual: string | number | boolean | null;
  passed: true;
  locator?: { kind: "testId" | "role" | "label" | "css"; value: string; name?: string };
  stateEvidence?: { reconciliationPath: string; queryId: string };
};

export function validateEvidenceAssertion(assertion: EvidenceAssertion, capture: Pick<EvidenceCapture, "reconciliationPath">): void;

export function summarizeCaptureIdentity(captures: EvidenceCapture[]): {
  totalCaptures: number;
  uniqueLogicalStates: number;
  viewportCounts: Record<string, number>;
};
