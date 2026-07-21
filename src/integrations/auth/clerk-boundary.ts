import type { AuthPrincipal } from "@/domains/identity/types";

export interface AuthProvider {
  getCurrentPrincipal(): Promise<AuthPrincipal | null>;
}

export function clerkEnvironmentConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export function developmentPrincipal(): AuthPrincipal {
  return {
    id: process.env.FAIRWAY_DEMO_AUTH_PRINCIPAL_ID ?? "dev_clerk_user",
    provider: "development",
    externalId: process.env.FAIRWAY_DEMO_AUTH_PRINCIPAL_ID ?? "dev_clerk_user",
    email: process.env.FAIRWAY_DEMO_MEMBER_EMAIL ?? "founder@example.com",
  };
}
