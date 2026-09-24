import type { PublicSocialProfiles } from "../../types/public-profile";
import { normalizeXHandle, xProfileUrl } from "../../utils/x-profile";
import "./public-profile.css";

export function PublicXProfile({
  profiles,
}: {
  profiles: PublicSocialProfiles | undefined;
}) {
  const profile = profiles?.x;
  const url = xProfileUrl(profile?.handle);
  if (!profile || !url) return null;
  const handle = normalizeXHandle(profile.handle)!;
  return (
    <div className="public-x-profile">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        aria-label={`View @${handle} on X (opens in a new tab)`}
      >
        <span>𝕏 @{handle}</span>
        <span className="x-action">
          VIEW ON X <span aria-hidden="true">↗</span>
        </span>
      </a>
      <small>Ownership not verified</small>
    </div>
  );
}
