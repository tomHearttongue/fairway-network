import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMemberContext, requiredEnvironmentVariables } from "@/application/member-flow/authenticated-context";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ reservationId: string }> }) {
  const body = await request.json().catch(() => ({}));
  const { reservationId } = await context.params;
  const guestName = String(body.guestName ?? "").trim();
  const guestEmail = String(body.guestEmail ?? "").trim();
  const idempotencyKey = String(body.idempotencyKey ?? `guest:${reservationId}:${crypto.randomUUID()}`);

  if (!reservationId) return NextResponse.json({ error: "RESERVATION_ID_REQUIRED" }, { status: 400 });
  if (!guestName) return NextResponse.json({ error: "GUEST_NAME_REQUIRED" }, { status: 400 });

  const memberContext = await getAuthenticatedMemberContext();
  if (memberContext.kind === "setup_required") return NextResponse.json({ error: "ENVIRONMENT_NOT_CONFIGURED", required: requiredEnvironmentVariables(), missing: memberContext.missing }, { status: 503 });
  if (memberContext.kind === "unauthenticated") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  try {
    const result = await memberContext.store.addReservationGuest({
      memberProfileId: memberContext.memberProfileId,
      reservationId,
      guestName,
      guestEmail: guestEmail || undefined,
      idempotencyKey,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message.includes("GUEST_ALLOWANCE_EXCEEDED")) {
      await memberContext.store.recordGuestAllowanceRejected({ memberProfileId: memberContext.memberProfileId, reservationId, idempotencyKey }).catch(() => undefined);
    }
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
