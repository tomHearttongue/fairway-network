export interface MembershipPlanSeed {
  id?: string;
  code: string;
  name: string;
  monthlyCredits: number;
  bookingWindowDays: number;
  maxActiveFutureReservations: number;
  playNowEnabled: boolean;
  guestAllowance: number;
}

export const TEST_BIRDIE: MembershipPlanSeed = {
  code: "TEST_BIRDIE",
  name: "Test Birdie",
  monthlyCredits: 24,
  bookingWindowDays: 7,
  maxActiveFutureReservations: 2,
  playNowEnabled: true,
  guestAllowance: 1,
};

export const DEVELOPMENT_TEST_CREDIT_GRANT = 100;
