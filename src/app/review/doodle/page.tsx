import { notFound } from "next/navigation";
import { connection } from "next/server";
import { GlobalDoodle } from "../../../prototypes/doodle/GlobalDoodle";

export const metadata = {
  title: "Atomic Bond — Global Doodle local prototype",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function DoodleReviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  await connection();
  // Request-scoped server snapshot seeds the client clock without a hydration mismatch.
  // eslint-disable-next-line react-hooks/purity
  return <GlobalDoodle initialTime={Date.now()} />;
}
