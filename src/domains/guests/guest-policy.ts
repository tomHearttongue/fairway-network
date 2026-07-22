export type GuestReadinessState = "ready" | "waiver_pending" | "removed" | "blocked";

export function canAddGuest(input: { activeGuestCount: number; guestAllowance: number }): boolean {
  if (input.guestAllowance < 0) return false;
  return input.activeGuestCount < input.guestAllowance;
}

export function guestReadinessState(input: { associationActive: boolean; waiverVerified: boolean; reservationEligible: boolean }): GuestReadinessState {
  if (!input.associationActive) return "removed";
  if (!input.waiverVerified) return "waiver_pending";
  if (!input.reservationEligible) return "blocked";
  return "ready";
}
