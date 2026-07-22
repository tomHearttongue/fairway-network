import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMemberContext, requiredEnvironmentVariables } from "@/application/member-flow/authenticated-context";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  try {
    const context = await getAuthenticatedMemberContext();
    if (context.kind === "setup_required") return NextResponse.json({ error: "ENVIRONMENT_NOT_CONFIGURED", required: requiredEnvironmentVariables(), missing: context.missing }, { status: 503 });
    if (context.kind === "unauthenticated") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

    const reservationId = String(body.reservationId ?? "").trim();
    if (!reservationId) return NextResponse.json({ error: "RESERVATION_REQUIRED" }, { status: 400 });

    const result = await context.store.completeSession({
      memberProfileId: context.memberProfileId,
      reservationId,
      idempotencyKey: String(body.idempotencyKey ?? crypto.randomUUID()),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }, { status: 409 });
  }
}