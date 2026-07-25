export function validateEvidenceAssertion(assertion, capture) {
  for (const field of ["id", "evidenceType", "sourcePath", "comparator", "passed"]) {
    if (assertion?.[field] === undefined || assertion?.[field] === null) throw new Error(`Assertion lacks ${field}.`);
  }
  if (assertion.passed !== true) throw new Error(`Assertion did not pass: ${assertion.id}`);
  if (assertion.evidenceType === "ui") {
    if (!assertion.locator?.kind || !assertion.locator?.value) throw new Error(`UI assertion lacks locator provenance: ${assertion.id}`);
  } else if (assertion.evidenceType === "state") {
    if (!assertion.stateEvidence?.queryId || assertion.stateEvidence?.reconciliationPath !== capture.reconciliationPath) {
      throw new Error(`State assertion lacks reconciliation provenance: ${assertion.id}`);
    }
  } else {
    throw new Error(`Unknown assertion evidence type: ${assertion.id}`);
  }
}

export function summarizeCaptureIdentity(captures) {
  for (const capture of captures) {
    for (const field of ["captureId", "logicalStateId", "stepId"]) {
      if (!capture?.[field]) throw new Error(`Capture lacks ${field}.`);
    }
  }
  return {
    totalCaptures: captures.length,
    uniqueLogicalStates: new Set(captures.map((capture) => capture.logicalStateId)).size,
    viewportCounts: Object.fromEntries([...new Set(captures.map((capture) => capture.viewport))].sort().map((viewport) => [
      viewport,
      captures.filter((capture) => capture.viewport === viewport).length,
    ])),
  };
}
