import { NextRequest, NextResponse } from "next/server";
import { requiredEnvironmentVariables } from "@/application/member-flow/authenticated-context";
import { getAuthenticatedOperatorContext } from "@/application/operator-flow/authenticated-operator-context";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ reservationId: string }> }) {
  const body = await request.json().catch(() => ({}));
  const { reservationId } = await context.params;

  try {
    const operatorContext = await getAuthenticatedOperatorContext();
    if (operatorContext.kind === "setup_required") return NextResponse.json({ error: "ENVIRONMENT_NOT_CONFIGURED", required: requiredEnvironmentVariables(), missing: operatorContext.missing }, { status: 503 });
    if (operatorContext.kind === "unauthenticated") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if (operatorContext.kind === "forbidden") return NextResponse.json({ error: "OPERATOR_FORBIDDEN" }, { status: 403 });

    const reason = String(body.reason ?? "").trim();
    if (!reason) return NextResponse.json({ error: "REASON_REQUIRED" }, { status: 400 });

    const result = await operatorContext.store.cancelReservation({
      operatorMemberProfileId: operatorContext.memberProfileId,
      reservationId,
      reason,
      idempotencyKey: String(body.idempotencyKey ?? crypto.randomUUID()),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }, { status: 409 });
  }
}