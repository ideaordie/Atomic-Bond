import { notFound } from "next/navigation";
import { EvolveReview } from "./view";

export default function Page() {
  if (process.env.NODE_ENV !== "development" || process.env.VERCEL) notFound();
  return <EvolveReview />;
}
