export interface GrowthMetrics {
  connectedAtoms: number;
  directBonds: number;
  regions: number;
  countries: number;
}
export type GrowthOutcome =
  | "ineligible"
  | "disabled"
  | "baseline"
  | "no_growth"
  | "would_send"
  | "already_sent"
  | "blocked";
export interface GrowthDelivery {
  id: string;
  attemptId: string;
  email: string;
  publicId: string;
  previous: GrowthMetrics;
  current: GrowthMetrics;
  unsubscribeToken: string;
}
export interface GrowthStore {
  scan(
    after: string,
    limit: number,
  ): Promise<{ public_id: string; eligibility: string }[]>;
  evaluate(
    publicId: string,
    persist: boolean,
  ): Promise<{ outcome: GrowthOutcome }>;
  reserve(publicId: string): Promise<string | null>;
  claim(job: string): Promise<GrowthDelivery | null>;
  authorize(job: string, attempt: string, hash: string): Promise<boolean>;
  finish(job: string, attempt: string, accepted: boolean): Promise<boolean>;
  unsubscribe(token: string): Promise<boolean>;
}
