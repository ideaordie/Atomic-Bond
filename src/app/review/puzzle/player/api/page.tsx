import { notFound } from "next/navigation";
import { PuzzlePlayer } from "../../../../../components/puzzle/PuzzlePlayer";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PuzzlePlayer />;
}
