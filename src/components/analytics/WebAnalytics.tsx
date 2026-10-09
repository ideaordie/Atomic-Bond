"use client";

import { Analytics } from "@vercel/analytics/next";
import { safePageView } from "../../services/analytics/page-view";

export function WebAnalytics() {
  return (
    <Analytics
      debug={false}
      beforeSend={(event) =>
        window.location.search || window.location.hash
          ? null
          : safePageView(event, document.referrer)
      }
    />
  );
}
