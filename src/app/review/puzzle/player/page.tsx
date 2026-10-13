import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import { preparePuzzle } from "../../../../services/puzzle/prepare";
import { PlayerReview } from "./view";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  // Private local review only. Official artwork never enters public assets or Git.
  const art = await preparePuzzle(
    await readFile("artifacts/connected-landscape-prepared.png"),
  );
  return (
    <PlayerReview
      images={[art.full, ...art.tiles].map(
        (bytes) => `data:image/png;base64,${bytes.toString("base64")}`,
      )}
    />
  );
}
