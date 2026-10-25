export interface DirectItem {
  id: string;
  number: string;
  incoming: boolean;
  expiresAt: string;
  createdAt: string;
}
export interface DirectResult {
  eligible?: boolean;
  pending?: boolean;
  id?: string;
  receiving?: boolean;
  items?: DirectItem[];
  notice?: string | null;
  noticeItem?: DirectItem | null;
  state?: string;
  replayed?: boolean;
}
export type DirectOperation =
  | "eligibility"
  | "create"
  | "list"
  | "notice"
  | "accept"
  | "dismiss"
  | "decline"
  | "cancel"
  | "preferences"
  | "set_preference";
export type DirectTransport = (
  operation: DirectOperation,
  payload?: Record<string, unknown>,
) => Promise<DirectResult>;
