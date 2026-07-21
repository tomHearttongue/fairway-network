import type { Reservation } from "@/domains/reservations/types";

export interface PracticeSession {
  id: string;
  reservationId: string;
  memberProfileId: string;
  suiteId: string;
  startedAt: Date;
  provider: "fake";
}

export interface SessionProvider {
  startSession(input: { reservation: Reservation; startedAt: Date }): Promise<PracticeSession>;
}

export class FakeSessionProvider implements SessionProvider {
  async startSession(input: { reservation: Reservation; startedAt: Date }): Promise<PracticeSession> {
    return { id: `fake_session_${input.reservation.id}`, reservationId: input.reservation.id, memberProfileId: input.reservation.memberProfileId, suiteId: input.reservation.suiteId, startedAt: new Date(input.startedAt), provider: "fake" };
  }
}
