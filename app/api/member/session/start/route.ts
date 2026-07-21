import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMemberContext, requiredEnvironmentVariables } from "@/application/member-flow/authenticated-context";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const reservationId = String(body.reservationId ?? "");

  if (!reservationId) {
    return NextResponse.json({ error: "RESERVATION_ID_REQUIRED" }, { status: 400 });
  }

  try {
    const context = await getAuthenticatedMemberContext();
    if (context.kind === "setup_required") {
      return NextResponse.json({ error: "ENVIRONMENT_NOT_CONFIGURED", required: requiredEnvironmentVariables(), missing: context.missing }, { status: 503 });
    }
    if (context.kind === "unauthenticated") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const result = await context.store.startSession({
      memberProfileId: context.memberProfileId,
      reservationId,
      idempotencyKey: String(body.idempotencyKey ?? `session:${reservationId}`),
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }, { status: 409 });
  }
}
