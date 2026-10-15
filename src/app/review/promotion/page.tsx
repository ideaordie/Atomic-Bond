import { notFound } from "next/navigation";
import { PromotionReview } from "../../../prototypes/promotion/PromotionReview";
export const metadata = {
  title: "Atomic Bond — Campaign review",
  robots: { index: false, follow: false },
};
export default function PromotionPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PromotionReview />;
}
