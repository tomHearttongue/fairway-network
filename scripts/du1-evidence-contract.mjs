export function validateEvidenceAssertion(assertion, capture) {
  for (const field of ["id", "evidenceType", "sourceKind", "sourcePath", "comparator", "passed"]) {
    if (assertion?.[field] === undefined || assertion?.[field] === null) throw new Error(`Assertion lacks ${field}.`);
  }
  if (assertion.passed !== true) throw new Error(`Assertion did not pass: ${assertion.id}`);
  if (assertion.sourceKind === "state-backed") {
    if (assertion.evidenceType === "ui" && (!assertion.locator?.kind || !assertion.locator?.value)) {
      throw new Error(`State-backed UI assertion lacks locator provenance: ${assertion.id}`);
    }
    if (!assertion.stateEvidence?.queryId || assertion.stateEvidence?.reconciliationPath !== capture.reconciliationPath) {
      throw new Error(`State-backed assertion lacks reconciliation provenance: ${assertion.id}`);
    }
  } else if (assertion.sourceKind === "derived-presentation") {
    if (assertion.evidenceType !== "ui") throw new Error(`Derived-presentation assertion must be UI evidence: ${assertion.id}`);
    if (!assertion.presentationEvidence?.ruleId || !Array.isArray(assertion.presentationEvidence?.inputs)) {
      throw new Error(`Derived-presentation assertion lacks its named rule and inputs: ${assertion.id}`);
    }
  } else if (assertion.sourceKind === "interaction") {
    if (assertion.evidenceType !== "ui") throw new Error(`Interaction assertion must be UI evidence: ${assertion.id}`);
    if (!assertion.locator?.kind || !assertion.locator?.value || !assertion.interactionEvidence?.expectedState) {
      throw new Error(`Interaction assertion lacks locator or expected-state provenance: ${assertion.id}`);
    }
  } else {
    throw new Error(`Unknown assertion sourceKind: ${assertion.id}`);
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
