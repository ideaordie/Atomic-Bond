import { dataConfiguration } from "../../data/supabase/config";
import { supabaseTransport } from "../supabase/transport";
import { createSupabaseServices } from "../supabase/services";

/** Composition only: the synthetic fixture can never be an input to real storage. */
export async function exploreSource(
  env: Record<string, string | undefined>,
  publicId?: string,
) {
  const config = dataConfiguration(env);
  if (config.mode === "mock") {
    const { generateMockGraph, mockAtomId } =
      await import("../../data/mock/graph");
    return {
      mode: "mock" as const,
      graph: generateMockGraph(),
      centerId: mockAtomId(0),
    };
  }
  const services = createSupabaseServices(supabaseTransport(config));
  const graph = await services.bonds.graph(publicId);
  return {
    mode: "supabase" as const,
    graph,
    centerId: publicId ?? graph.nodes[0]?.id,
  };
}
