import { notFound } from "next/navigation";
import { DoodleNetworkReview } from "../../../../prototypes/doodle/DoodleNetworkReview";
import { generateMockGraph } from "../../../../data/mock/graph";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ draw?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <DoodleNetworkReview
      graph={generateMockGraph()}
      draw={Boolean((await searchParams).draw)}
    />
  );
}
