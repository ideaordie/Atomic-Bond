/** Presentation only: preserve the generated credential URL byte-for-byte in text. */
export function authEmail(link: string) {
  const invitation = new URL(link).pathname === "/auth/register/confirm";
  const heading = invitation
    ? "YOUR CONNECTION IS WAITING"
    : "VERIFY YOUR ATOM";
  const copy = invitation
    ? "Verify your email to create your Atom and continue to your Bond invitation."
    : "Verify your email to securely create or access your Atom.";
  const action = invitation ? "VERIFY & CONTINUE" : "VERIFY MY ATOM";
  const footer = "If you did not request this email, you can ignore it.";
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character]!,
    );
  return {
    text: `ATOMIC BOND\n\n${heading}\n\n${copy}\n\n${action}\n${link}\n\n${footer}`,
    html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${heading}</title></head>
<body style="margin:0;padding:0;background-color:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff"><tr><td align="center" style="padding:40px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px"><tr><td style="color:#111111">
<p style="margin:0 0 40px;font-size:14px;font-weight:bold;letter-spacing:3px;color:#111111">ATOMIC BOND</p>
<h1 style="margin:0 0 20px;font-size:28px;line-height:1.2;letter-spacing:-0.5px;color:#111111">${heading}</h1>
<p style="margin:0 0 28px;font-size:17px;line-height:1.6;color:#333333">${copy}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#000000" style="background-color:#000000;border-radius:6px;text-align:center;mso-padding-alt:18px 24px">
<a tabindex="0" href="${escape(link)}" style="display:inline-block;border:1px solid #000000;border-radius:6px;background-color:#000000;color:#ffffff;font-size:15px;line-height:20px;font-weight:bold;letter-spacing:0.5px;text-align:center;text-decoration:none;padding:18px 24px;mso-padding-alt:0"><span style="color:#ffffff">${escape(action)}</span></a>
</td></tr></table>
<p style="margin:40px 0 0;padding-top:24px;border-top:1px solid #dddddd;font-size:13px;line-height:1.6;color:#555555">${footer}</p>
</td></tr></table>
</td></tr></table>
</body></html>`,
  };
}
