import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { InvitationReview } from "./view";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ recipient?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const recipient = (await searchParams).recipient === "1";
  const url = "http://127.0.0.1:3140/review/invitation?recipient=1";
  const image = await QRCode.toDataURL(url, {
    width: 320,
    margin: 4,
    errorCorrectionLevel: "M",
  });
  return <InvitationReview recipient={recipient} image={image} url={url} />;
}
