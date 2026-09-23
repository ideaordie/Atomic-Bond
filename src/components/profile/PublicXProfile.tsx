import type { PublicSocialProfiles } from "../../types/public-profile";
import { xProfileUrl } from "../../utils/x-profile";
import "./public-profile.css";

export function PublicXProfile({
  profiles,
}: {
  profiles: PublicSocialProfiles | undefined;
}) {
  const profile = profiles?.x;
  const url = xProfileUrl(profile?.handle);
  if (!profile || !url) return null;
  return (
    <div className="public-x-profile">
      <span>𝕏 @{profile.handle}</span>
      <small>Ownership not verified</small>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        aria-label={`View @${profile.handle} on X (opens in a new tab)`}
      >
        VIEW ON X <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}
