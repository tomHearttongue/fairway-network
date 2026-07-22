import { NextRequest, NextResponse } from "next/server";
import { requiredEnvironmentVariables } from "@/application/member-flow/authenticated-context";
import { getAuthenticatedOperatorContext } from "@/application/operator-flow/authenticated-operator-context";
import type { SuiteStatus } from "@/domains/locations/types";

export const dynamic = "force-dynamic";

const VALID_SUITE_STATUSES = new Set<SuiteStatus>(["available", "occupied", "turnover", "inspection_required", "maintenance", "out_of_service", "administrative_hold"]);

export async function PATCH(request: NextRequest, context: { params: Promise<{ suiteId: string }> }) {
  const body = await request.json().catch(() => ({}));
  const { suiteId } = await context.params;
  const status = String(body.status ?? "") as SuiteStatus;

  try {
    const operatorContext = await getAuthenticatedOperatorContext();
    if (operatorContext.kind === "setup_required") return NextResponse.json({ error: "ENVIRONMENT_NOT_CONFIGURED", required: requiredEnvironmentVariables(), missing: operatorContext.missing }, { status: 503 });
    if (operatorContext.kind === "unauthenticated") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if (operatorContext.kind === "forbidden") return NextResponse.json({ error: "OPERATOR_FORBIDDEN" }, { status: 403 });
    if (!VALID_SUITE_STATUSES.has(status)) return NextResponse.json({ error: "INVALID_SUITE_STATUS" }, { status: 400 });

    const reason = String(body.reason ?? "").trim();
    if (!reason) return NextResponse.json({ error: "REASON_REQUIRED" }, { status: 400 });

    const result = await operatorContext.store.setSuiteStatus({
      operatorMemberProfileId: operatorContext.memberProfileId,
      suiteId,
      status,
      reason,
      idempotencyKey: String(body.idempotencyKey ?? crypto.randomUUID()),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }, { status: 409 });
  }
}