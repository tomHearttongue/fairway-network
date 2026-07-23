import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMemberContext, requiredEnvironmentVariables } from "@/application/member-flow/authenticated-context";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const mode = body.mode === "ADVANCE" ? "ADVANCE" : "PLAY_NOW";

  try {
    const context = await getAuthenticatedMemberContext();
    if (context.kind === "setup_required") {
      return NextResponse.json({ error: "ENVIRONMENT_NOT_CONFIGURED", required: requiredEnvironmentVariables(), missing: context.missing }, { status: 503 });
    }
    if (context.kind === "unauthenticated") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const state = await context.store.getMemberState(context.memberProfileId);
    const result = await context.store.createReservation({
      memberProfileId: context.memberProfileId,
      bookingMode: mode,
      location: state.location,
      suiteId: typeof body.suiteId === "string" ? body.suiteId : undefined,
      startAt: body.startAt ? new Date(String(body.startAt)) : undefined,
      endAt: body.endAt ? new Date(String(body.endAt)) : undefined,
      requestedMinutes: body.requestedMinutes ? Number(body.requestedMinutes) : undefined,
      idempotencyKey: String(body.idempotencyKey ?? crypto.randomUUID()),
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }, { status: 409 });
  }
}

