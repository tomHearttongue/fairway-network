import type { LocationConfig } from "@/domains/locations/types";
import { addMinutes } from "@/domains/reservations/availability";
import type { Reservation } from "@/domains/reservations/types";

export interface AccessGrant {
  id: string;
  reservationId: string;
  memberProfileId: string;
  locationId: string;
  suiteId: string;
  startsAt: Date;
  expiresAt: Date;
  provider: "fake";
  credentialLabel: string;
}

export interface AccessProvider {
  createGrant(input: { reservation: Reservation; location: LocationConfig }): Promise<AccessGrant>;
}

export class FakeAccessProvider implements AccessProvider {
  async createGrant(input: { reservation: Reservation; location: LocationConfig }): Promise<AccessGrant> {
    return { id: `fake_access_${input.reservation.id}`, reservationId: input.reservation.id, memberProfileId: input.reservation.memberProfileId, locationId: input.reservation.locationId, suiteId: input.reservation.suiteId, startsAt: addMinutes(input.reservation.startAt, -input.location.accessBeforeMinutes), expiresAt: addMinutes(input.reservation.endAt, input.location.accessAfterMinutes), provider: "fake", credentialLabel: "Simulated mobile unlock" };
  }
}
