"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationGroups } from "./configuration";
import "./navigation.css";
export function ApplicationNavigation({
  owner = false,
  doodle = false,
  puzzle = false,
  current,
  hrefs = {},
}: {
  owner?: boolean;
  doodle?: boolean;
  puzzle?: boolean;
  current?: string;
  hrefs?: Record<string, string>;
}) {
  const path = usePathname();
  return (
    <nav className="application-navigation" aria-label="Application navigation">
      {Object.values(navigationGroups)
        .flat()
        .filter(
          (item) =>
            (!item.owner || owner) &&
            (item.href !== "/global-doodle" || doodle) &&
            (item.href !== "/partici-puzzle" || puzzle),
        )
        .map((item) => {
          const selected =
            (current ?? path) === item.href ||
            (item.href === "/global-doodle" && (current ?? path) === "/doodle");
          return (
            <Link
              key={item.href}
              href={hrefs[item.href] ?? item.href}
              aria-current={selected ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
