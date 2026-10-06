import "server-only";
import { authClient } from "../auth/server";

export interface ConnectedGroup {
  id: string;
  atomCount: number;
  activeAtomCount: number;
  bondCount: number;
  publicNumbers: string[];
  regions: number;
  countries: number;
  earliestRetainedBond: string | null;
  founding: boolean;
}
export interface NetworkReport {
  generatedAt: string;
  activeAtoms: number;
  confirmedBonds: number;
  connectedGroups: number;
  organicGroups: number;
  isolatedAtoms: string[];
  largestGroup: number;
  foundingNetwork: ConnectedGroup | null;
  groups: ConnectedGroup[];
  historyAvailable: false;
}
export async function networkReport(): Promise<NetworkReport> {
  const client = await authClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.email_confirmed_at)
    throw new Error("Administrator access required");
  const { data, error } = await client.rpc("admin_network_report");
  if (error || !data)
    throw new Error("Network report unavailable or access denied");
  return data as NetworkReport;
}
