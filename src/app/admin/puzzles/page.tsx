import { connection } from "next/server";
import { AdminDenied } from "../../../components/admin/AdminNavigation";
import { readStudio } from "./actions";
import { PuzzleStudio } from "../../../components/puzzle/PuzzleStudio";
export const metadata = {
  title: "Puzzle Studio | Atomic Bond",
  robots: { index: false, follow: false },
};
export default async function PuzzleStudioPage() {
  await connection();
  const initial = await readStudio();
  if (!initial) return <AdminDenied />;
  return <PuzzleStudio initial={initial} />;
}
