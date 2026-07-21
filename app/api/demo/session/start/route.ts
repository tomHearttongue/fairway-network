import { NextResponse } from "next/server";
import { demoStore } from "@/application/demo/demo-store";

export async function POST() {
  if (!demoStore.latestReservation) {
    return NextResponse.json({ error: "NO_RESERVATION_TO_START" }, { status: 409 });
  }

  const session = await demoStore.sessionProvider.startSession({ reservation: demoStore.latestReservation, startedAt: new Date() });
  demoStore.auditLog.record({ type: "session.started", actorId: demoStore.memberProfile.id, resourceId: session.id, reason: "Simulated Practice Suite session started", createdAt: new Date() });

  return NextResponse.json({ session });
}
