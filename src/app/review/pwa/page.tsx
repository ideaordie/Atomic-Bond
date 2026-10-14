import { notFound } from "next/navigation";
import { InstallReview } from "./view";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <InstallReview />;
}
