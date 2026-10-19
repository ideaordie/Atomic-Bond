import { notFound } from "next/navigation";
import { ColorReview } from "../../../../prototypes/doodle/ColorReview";
export const dynamic = "force-dynamic";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ColorReview />;
}
