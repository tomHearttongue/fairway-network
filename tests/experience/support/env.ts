import { readFileSync } from "node:fs";

export type HarnessEnv = Record<string, string>;

export function loadHarnessEnv(): HarnessEnv {
  const env: HarnessEnv = {};
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
        if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) continue;
        const index = line.indexOf("=");
        let value = line.slice(index + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        env[line.slice(0, index).trim()] = value;
      }
    } catch {
      // Optional file.
    }
  }
  process.env.CLERK_SECRET_KEY = env.CLERK_SECRET_KEY;
  process.env.CLERK_PUBLISHABLE_KEY = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.DATABASE_URL = env.DATABASE_URL;
  return env;
}

export function assertDevelopmentEnv(env: HarnessEnv): void {
  if (!env.CLERK_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Experience QA requires a Clerk development sk_test key");
  if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")) throw new Error("Experience QA requires a Clerk development pk_test key");
  if (!env.DATABASE_URL?.startsWith("postgres")) throw new Error("Experience QA requires DATABASE_URL for the development Supabase/Postgres project");
}