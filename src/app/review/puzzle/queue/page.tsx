import { notFound } from "next/navigation";
import { QueueReview } from "./view";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <QueueReview />;
}
