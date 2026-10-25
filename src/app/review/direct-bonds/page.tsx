import { notFound } from "next/navigation";
import { DirectReview } from "./view";
export default function Page() {
  if (process.env.NODE_ENV !== "development" || process.env.VERCEL) notFound();
  return <DirectReview />;
}
