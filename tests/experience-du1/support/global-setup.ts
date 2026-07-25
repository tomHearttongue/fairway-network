import { clerkSetup } from "@clerk/testing/playwright";
import { assertDevelopmentEnv, loadHarnessEnv } from "../../experience/support/env";
import { ensureClerkPersonas } from "../../experience/support/personas";

export default async function globalSetup() {
  const env = loadHarnessEnv();
  assertDevelopmentEnv(env);
  await clerkSetup();
  await ensureClerkPersonas(env);
}
