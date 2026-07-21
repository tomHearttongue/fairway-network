import { FakeAccessProvider } from "@/domains/access/fake-access-provider";
import { AuditLog } from "@/domains/audit/audit-log";
import { CreditLedger } from "@/domains/credits/ledger";
import type { MemberProfile, Person } from "@/domains/identity/types";
import { createSeedSuites, locationOneConfig } from "@/domains/locations/types";
import { DEVELOPMENT_TEST_CREDIT_GRANT, TEST_BIRDIE } from "@/domains/membership/test-birdie";
import { InMemoryReservationRepository } from "@/domains/reservations/in-memory-reservation-repository";
import { ReservationService } from "@/domains/reservations/reservation-service";
import type { Reservation } from "@/domains/reservations/types";
import { FakeSessionProvider } from "@/domains/sessions/fake-session-provider";
import { systemClock } from "@/shared/clock";

const memberProfileId = "mp_demo_founder";

const person: Person = {
  id: "person_demo_founder",
  email: process.env.FAIRWAY_DEMO_MEMBER_EMAIL ?? "founder@example.com",
  displayName: "Founder Test Member",
};

const memberProfile: MemberProfile = {
  id: memberProfileId,
  personId: person.id,
  homeLocationId: locationOneConfig.id,
  memberNumber: "FN-0001",
};

const suites = createSeedSuites(locationOneConfig);
const ledger = new CreditLedger();
ledger.grant({ memberProfileId, amount: TEST_BIRDIE.monthlyCredits, idempotencyKey: "seed:test-birdie-monthly-grant", reason: "TEST_BIRDIE monthly seed grant", createdAt: systemClock.now() });
ledger.grant({ memberProfileId, amount: DEVELOPMENT_TEST_CREDIT_GRANT, idempotencyKey: "seed:development-100-credit-grant", reason: "Development-only workflow exercise grant", createdAt: systemClock.now() });

const repository = new InMemoryReservationRepository();
const auditLog = new AuditLog();
const accessProvider = new FakeAccessProvider();
const sessionProvider = new FakeSessionProvider();

export const demoStore = {
  location: locationOneConfig,
  suites,
  person,
  memberProfile,
  membershipPlan: TEST_BIRDIE,
  ledger,
  auditLog,
  accessProvider,
  sessionProvider,
  reservationService: new ReservationService({ clock: systemClock, location: locationOneConfig, suites, repository, ledger, membershipPlan: TEST_BIRDIE }),
  latestReservation: undefined as Reservation | undefined,
};
