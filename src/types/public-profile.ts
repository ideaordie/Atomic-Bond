/** Public, self-supplied social identities. No email or private authentication data. */
export interface PublicSocialIdentity {
  readonly handle: string;
  /** Only a future trusted verification service may issue verified metadata. */
  readonly verification:
    | { readonly status: "unverified" }
    | { readonly status: "verified"; readonly verifiedAt: string };
}

export interface PublicSocialProfiles {
  readonly x?: PublicSocialIdentity;
}
