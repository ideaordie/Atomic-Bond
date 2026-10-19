/** Local foundation contract only; not wired to a production route or client. */
export type EvolveStatus =
  "PROPOSED" | "UNDER REVIEW" | "PLANNED" | "LIVE" | "DEFERRED" | "DECLINED";
export type EvolveModeration = "PENDING" | "VISIBLE" | "HIDDEN" | "REMOVED";
export interface EvolveIdea {
  supportCount: number;
  id: string;
  body: string | null;
  status: EvolveStatus;
  moderation: EvolveModeration;
  createdAt: string;
  updatedAt: string;
  explanation: string;
  revision: number;
  mine: boolean | null;
  supported: boolean;
  acknowledgmentEligible: boolean | null;
  authorAlias: string | null;
  withdrawnAt: string | null;
  acknowledgment?: string;
}
export type EvolveRequest =
  | {
      operation: "session" | "list" | "admin_list" | "development_history";
      payload: { before?: string; beforeId?: string };
    }
  | {
      operation: "submit";
      payload: { body: string; attribution: boolean; revision: number };
    }
  | {
      operation: "support";
      payload: { id: string; supported: boolean; revision: number };
    }
  | {
      operation: "moderate";
      payload: {
        id: string;
        revision: number;
        status: EvolveStatus;
        moderation: Exclude<EvolveModeration, "PENDING">;
        explanation: string;
      };
    }
  | {
      operation: "withdraw";
      payload: { id: string; revision: number };
    }
  | {
      operation: "publish_history";
      payload: {
        improvement: string;
        completedOn: string;
        explanation: string;
        sanitized: true;
      };
    }
  | { operation: "remove_history"; payload: { id: string } }
  | {
      operation: "history";
      payload: { id?: string; before?: string; beforeId?: string };
    };
export type EvolveResult<T> =
  | {
      data: T;
      revision: number;
      nextSubmissionAt: string | null;
      serverTime: string;
    }
  | {
      error:
        | "RATE_LIMIT"
        | "STALE_REVISION"
        | "SUBMISSION_COOLDOWN"
        | "DUPLICATE_IDEA"
        | "NOT_AVAILABLE"
        | "INVALID_REQUEST"
        | "FORBIDDEN";
    };
/** A future server adapter must use the existing owner session, never service role.
 * Reads must be no-store. Render body/explanation as plain text, never HTML/links.
 * Expected revisions come from the latest response; stale actions require review.
 * No owner identifier is accepted. Administrative permissions are checked in SQL.
 */
export interface EvolveService {
  request(request: EvolveRequest): Promise<EvolveResult<unknown>>;
}
