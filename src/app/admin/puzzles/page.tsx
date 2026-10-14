import { connection } from "next/server";
import { AdminDenied } from "../../../components/admin/AdminNavigation";
import { readQueue } from "./actions";
import { PuzzleQueueStudio } from "../../../components/puzzle/PuzzleQueueStudio";
export const metadata = {
  title: "Puzzle Studio | Atomic Bond",
  robots: { index: false, follow: false },
};
export default async function PuzzleStudioPage() {
  await connection();
  const initial = await readQueue();
  if (!initial) return <AdminDenied />;
  return <PuzzleQueueStudio initial={initial} />;
}
