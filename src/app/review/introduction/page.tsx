import { notFound } from "next/navigation";
import { IntroductionReview } from "../../../prototypes/introduction/IntroductionReview";

export const metadata = {
  title: "Atomic Bond — Introduction review",
  robots: { index: false, follow: false },
};
export default function IntroductionPrototypePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <IntroductionReview />;
}
