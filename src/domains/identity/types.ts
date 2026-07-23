export interface AuthPrincipal {
  id: string;
  provider: "clerk" | "development";
  externalId: string;
  email: string;
  displayName?: string;
}

export interface Person {
  id: string;
  email: string;
  displayName: string;
}

export interface MemberProfile {
  id: string;
  personId: string;
  homeLocationId: string;
  memberNumber: string;
}


