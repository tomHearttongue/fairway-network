export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export function applicationClock(): Clock {
  const demoClock = process.env.FAIRWAY_DEMO_CLOCK_ISO;
  const demoEnabled = process.env.FAIRWAY_DEMO_MODE === "true";
  const productionDeployment = process.env.VERCEL_ENV === "production";
  if (demoEnabled && demoClock && !productionDeployment) {
    const parsed = new Date(demoClock);
    if (Number.isNaN(parsed.getTime())) throw new Error("FAIRWAY_DEMO_CLOCK_ISO_INVALID");
    return new FixedClock(parsed);
  }
  return systemClock;
}

export class FixedClock implements Clock {
  constructor(private readonly fixedNow: Date) {}

  now(): Date {
    return new Date(this.fixedNow);
  }
}
