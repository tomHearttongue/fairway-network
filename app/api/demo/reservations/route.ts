import { NextRequest, NextResponse } from "next/server";
import { addMinutes } from "@/domains/reservations/availability";
import { demoStore } from "@/application/demo/demo-store";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const mode = body.mode === "ADVANCE" ? "ADVANCE" : "PLAY_NOW";

  try {
    const reservation = mode === "ADVANCE"
      ? await demoStore.reservationService.createAdvanceReservation({
          memberProfileId: demoStore.memberProfile.id,
          suiteId: String(body.suiteId ?? demoStore.suites[0]?.id),
          startAt: new Date(String(body.startAt)),
          endAt: new Date(String(body.endAt)),
          creditCost: Number(body.creditCost ?? 1),
          idempotencyKey: String(body.idempotencyKey ?? crypto.randomUUID()),
        })
      : await demoStore.reservationService.createPlayNowReservation({
          memberProfileId: demoStore.memberProfile.id,
          requestedMinutes: Number(body.requestedMinutes ?? demoStore.location.minimumSessionMinutes),
          creditCost: Number(body.creditCost ?? 1),
          idempotencyKey: String(body.idempotencyKey ?? crypto.randomUUID()),
        });

    demoStore.latestReservation = reservation;
    const accessGrant = await demoStore.accessProvider.createGrant({ reservation, location: demoStore.location });
    demoStore.auditLog.record({ type: "reservation.created", actorId: demoStore.memberProfile.id, resourceId: reservation.id, reason: `${reservation.bookingMode} reservation created with simulated access grant`, createdAt: new Date() });

    return NextResponse.json({ reservation, accessGrant, availableCredits: demoStore.ledger.availableBalance(demoStore.memberProfile.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }, { status: 409 });
  }
}

export async function GET() {
  const now = new Date();
  return NextResponse.json({ exampleAdvanceReservation: { mode: "ADVANCE", suiteId: demoStore.suites[0]?.id, startAt: addMinutes(now, 60).toISOString(), endAt: addMinutes(now, 90).toISOString(), creditCost: 1 } });
}
