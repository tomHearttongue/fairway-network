export type CreditEntryType = "grant" | "hold" | "commit" | "release" | "refund" | "expiration" | "adjustment";

export interface CreditLedgerEntry {
  id: string;
  memberProfileId: string;
  type: CreditEntryType;
  amount: number;
  balanceDelta: number;
  idempotencyKey: string;
  relatedEntryId?: string;
  reason: string;
  createdAt: Date;
}

export class CreditLedger {
  private readonly entries: CreditLedgerEntry[] = [];

  constructor(initialEntries: CreditLedgerEntry[] = []) {
    this.entries = [...initialEntries];
  }

  all(): CreditLedgerEntry[] {
    return [...this.entries];
  }

  grant(input: BaseCreditInput): CreditLedgerEntry {
    return this.record({ ...input, type: "grant", balanceDelta: input.amount });
  }

  hold(input: BaseCreditInput): CreditLedgerEntry {
    this.assertAvailable(input.memberProfileId, input.amount);
    return this.record({ ...input, type: "hold", balanceDelta: 0 });
  }

  commit(input: BaseCreditInput & { relatedEntryId: string }): CreditLedgerEntry {
    this.assertHoldExists(input.relatedEntryId, input.memberProfileId, input.amount);
    return this.record({ ...input, type: "commit", balanceDelta: -input.amount });
  }

  release(input: BaseCreditInput & { relatedEntryId: string }): CreditLedgerEntry {
    this.assertHoldExists(input.relatedEntryId, input.memberProfileId, input.amount);
    return this.record({ ...input, type: "release", balanceDelta: 0 });
  }

  refund(input: BaseCreditInput & { relatedEntryId: string }): CreditLedgerEntry {
    this.assertCommitExists(input.relatedEntryId, input.memberProfileId, input.amount);
    const existingRefund = this.entries.find((entry) => entry.relatedEntryId === input.relatedEntryId && entry.type === "refund");
    if (existingRefund && existingRefund.idempotencyKey !== input.idempotencyKey) throw new Error("CREDIT_COMMIT_ALREADY_REFUNDED");
    return this.record({ ...input, type: "refund", balanceDelta: input.amount });
  }

  committedEntryForHold(holdId: string, memberProfileId: string): CreditLedgerEntry | undefined {
    return this.entries.find((entry) => entry.relatedEntryId === holdId && entry.memberProfileId === memberProfileId && entry.type === "commit");
  }

  availableBalance(memberProfileId: string): number {
    const committedBalance = this.entries.filter((entry) => entry.memberProfileId === memberProfileId).reduce((sum, entry) => sum + entry.balanceDelta, 0);
    const openHolds = this.entries
      .filter((entry) => entry.memberProfileId === memberProfileId && entry.type === "hold")
      .filter((hold) => !this.entries.some((entry) => entry.relatedEntryId === hold.id && (entry.type === "commit" || entry.type === "release")))
      .reduce((sum, entry) => sum + entry.amount, 0);
    return committedBalance - openHolds;
  }

  private record(input: RecordCreditInput): CreditLedgerEntry {
    const existing = this.entries.find((entry) => entry.idempotencyKey === input.idempotencyKey);
    if (existing) return existing;

    const entry: CreditLedgerEntry = {
      id: `cred_${this.entries.length + 1}`,
      memberProfileId: input.memberProfileId,
      type: input.type,
      amount: input.amount,
      balanceDelta: input.balanceDelta,
      idempotencyKey: input.idempotencyKey,
      relatedEntryId: input.relatedEntryId,
      reason: input.reason,
      createdAt: new Date(input.createdAt),
    };
    this.entries.push(entry);
    return entry;
  }

  private assertAvailable(memberProfileId: string, amount: number): void {
    if (this.availableBalance(memberProfileId) < amount) throw new Error("INSUFFICIENT_CREDITS");
  }

  private assertHoldExists(holdId: string, memberProfileId: string, amount: number): void {
    const hold = this.entries.find((entry) => entry.id === holdId && entry.memberProfileId === memberProfileId && entry.type === "hold");
    if (!hold || hold.amount !== amount) throw new Error("CREDIT_HOLD_NOT_FOUND");
  }

  private assertCommitExists(commitId: string, memberProfileId: string, amount: number): void {
    const commit = this.entries.find((entry) => entry.id === commitId && entry.memberProfileId === memberProfileId && entry.type === "commit");
    if (!commit || commit.amount !== amount) throw new Error("CREDIT_COMMIT_NOT_FOUND");
  }
}

interface BaseCreditInput {
  memberProfileId: string;
  amount: number;
  idempotencyKey: string;
  reason: string;
  createdAt: Date;
}

interface RecordCreditInput extends BaseCreditInput {
  type: CreditEntryType;
  balanceDelta: number;
  relatedEntryId?: string;
}
