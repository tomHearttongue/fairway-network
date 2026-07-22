import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { clerkSetup } from "@clerk/testing/playwright";
import { assertDevelopmentEnv, loadHarnessEnv } from "./env";
import { cleanExperienceArtifacts, ensureClerkPersonas } from "./personas";

export default async function globalSetup() {
  const env = loadHarnessEnv();
  assertDevelopmentEnv(env);
  cleanExperienceArtifacts();
  await clerkSetup();
  await ensureClerkPersonas(env);
}