import QRCode from "qrcode";
import { appOrigin } from "../auth/policy";
import { invitationPath } from "../supabase/services";

/** Server-generated image: no third-party QR endpoint ever receives the secret. */
export async function invitationPresentation(
  token: string,
  env: Record<string, string | undefined>,
) {
  const url = `${appOrigin(env)}${invitationPath(token)}`;
  const image = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 4,
    scale: 8,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return { url, image };
}
