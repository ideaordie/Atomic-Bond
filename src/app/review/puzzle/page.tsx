import { notFound } from "next/navigation";
import { PuzzleReview } from "../../../prototypes/puzzle/PuzzleReview";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "PARTICIPUZZLE — local review",
  robots: { index: false, follow: false },
};
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PuzzleReview />;
}
