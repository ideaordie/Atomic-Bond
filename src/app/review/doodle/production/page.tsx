import { notFound } from "next/navigation";
import { DoodleProductionReview } from "../../../../prototypes/doodle/DoodleProductionReview";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Atomic Bond — Doodle local production review",
  robots: { index: false, follow: false },
};
export default function DoodleProductionPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DoodleProductionReview />;
}
