import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMemberContext, requiredEnvironmentVariables } from "@/application/member-flow/authenticated-context";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ reservationId: string; reservationGuestId: string }> }) {
  const body = await request.json().catch(() => ({}));
  const { reservationId, reservationGuestId } = await context.params;
  const action = String(body.action ?? "");

  if (!reservationId) return NextResponse.json({ error: "RESERVATION_ID_REQUIRED" }, { status: 400 });
  if (!reservationGuestId) return NextResponse.json({ error: "RESERVATION_GUEST_ID_REQUIRED" }, { status: 400 });

  try {
    const memberContext = await getAuthenticatedMemberContext();
    if (memberContext.kind === "setup_required") return NextResponse.json({ error: "ENVIRONMENT_NOT_CONFIGURED", required: requiredEnvironmentVariables(), missing: memberContext.missing }, { status: 503 });
    if (memberContext.kind === "unauthenticated") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

    if (action === "request_waiver") {
      return NextResponse.json(await memberContext.store.requestGuestWaiver({
        memberProfileId: memberContext.memberProfileId,
        reservationGuestId,
        idempotencyKey: String(body.idempotencyKey ?? `guest-waiver-request:${reservationGuestId}`),
      }));
    }

    if (action === "complete_waiver") {
      return NextResponse.json(await memberContext.store.completeGuestWaiver({
        memberProfileId: memberContext.memberProfileId,
        reservationGuestId,
        idempotencyKey: String(body.idempotencyKey ?? `guest-waiver-complete:${reservationGuestId}`),
      }));
    }

    if (action === "check_eligibility") {
      return NextResponse.json(await memberContext.store.checkGuestAccessEligibility({
        memberProfileId: memberContext.memberProfileId,
        reservationGuestId,
        idempotencyKey: String(body.idempotencyKey ?? `guest-eligibility:${reservationGuestId}`),
      }));
    }

    return NextResponse.json({ error: "UNKNOWN_GUEST_ACTION" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ reservationId: string; reservationGuestId: string }> }) {
  const body = await request.json().catch(() => ({}));
  const { reservationId, reservationGuestId } = await context.params;

  if (!reservationId) return NextResponse.json({ error: "RESERVATION_ID_REQUIRED" }, { status: 400 });
  if (!reservationGuestId) return NextResponse.json({ error: "RESERVATION_GUEST_ID_REQUIRED" }, { status: 400 });

  try {
    const memberContext = await getAuthenticatedMemberContext();
    if (memberContext.kind === "setup_required") return NextResponse.json({ error: "ENVIRONMENT_NOT_CONFIGURED", required: requiredEnvironmentVariables(), missing: memberContext.missing }, { status: 503 });
    if (memberContext.kind === "unauthenticated") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

    const result = await memberContext.store.removeReservationGuest({
      memberProfileId: memberContext.memberProfileId,
      reservationGuestId,
      idempotencyKey: String(body.idempotencyKey ?? `guest-remove:${reservationGuestId}`),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }, { status: 409 });
  }
}
